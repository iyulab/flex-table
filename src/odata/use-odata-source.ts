// src/odata/use-odata-source.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import buildQuery from 'odata-query';
import type { SortCriteria } from '../core/sorting.js';
import type { UseODataSourceOptions, UseODataSourceResult } from './types.js';

/**
 * 검색어를 OData `$search` 표현식으로 인코딩한다 (`red shirt` → `"red" AND "shirt"`).
 *
 * 토큰을 인용하는 이유: OData 4.0의 `searchWord`는 문자(Unicode L/Nl)만 허용해
 * `2026`·`ZT-E2E-A` 같은 검색어가 거부된다. 4.01이 숫자·하이픈을 허용하도록 완화했으나
 * Microsoft.OData 렉서는 아직 4.0 규칙이다(odata.net#2445). `searchPhrase`는 두 버전
 * 모두에서 적법하므로 서버 버전과 무관하게 안전하다.
 *
 * 통째로가 아니라 토큰별로 감싸는 이유: 인용 없는 다중 단어는 암묵 AND로 파싱되므로
 * (`searchAndExpr = RWS [ 'AND' RWS ] searchExpr`), 전체를 한 phrase로 감싸면 연속
 * 문자열 매칭으로 의미가 바뀐다. 토큰별 인용은 기존 의미론을 그대로 보존한다.
 *
 * `"`는 phrase 안에 넣을 수 없고 이스케이프 규칙도 없어(`qchar-no-AMP-DQUOTE`) 제거한다.
 *
 * @returns `$search` 표현식, 또는 유효 토큰이 없으면 `undefined`
 */
export function buildSearchExpression(term: string): string | undefined {
  const tokens = term
    .split(/\s+/)
    .map(token => token.replace(/"/g, ''))
    .filter(token => token.length > 0);
  if (tokens.length === 0) return undefined;
  return tokens.map(token => `"${token}"`).join(' AND ');
}

/**
 * OData v4 서버 사이드 데이터소스 React 훅.
 * flex-table의 dataMode="server"와 함께 사용한다.
 */
export function useODataSource<T = Record<string, unknown>>(
  url: string,
  options: UseODataSourceOptions = {}
): UseODataSourceResult<T> {
  const { pageSize = 20, defaultOrderBy, fixedFilter, baseUrl, fetcher = fetch, onUnauthorized } = options;

  /*
   * fixedFilter는 호출자가 매 render마다 새 객체 리터럴로 넘기는 경우가 흔하다
   * (e.g. `fixedFilter={ IsActive: true }`). 참조 비교만 하면 useEffect가 매 render마다
   * 재실행되어 무한 fetch loop가 발생. 직렬화 키로 변환해 값 비교를 수행한다.
   */
  const fixedFilterKey = fixedFilter ? JSON.stringify(fixedFilter) : '';

  const [data, setData] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria[]>(() => {
    if (!defaultOrderBy) return [];
    return parseOrderBy(defaultOrderBy);
  });
  const [search, setSearch] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    setRefreshToken(t => t + 1);
  }, []);

  const handleSetSearch = useCallback((term: string) => {
    setSearch(term);
    setPage(0);
  }, []);

  const onSortChange = useCallback((e: CustomEvent) => {
    const criteria = e.detail?.criteria as SortCriteria[] | undefined;
    if (criteria) {
      setSortCriteria(criteria);
      setPage(0);
    }
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const orderBy = sortCriteria.length > 0
      ? sortCriteria.map(s => `${s.key} ${s.direction}`).join(', ')
      : defaultOrderBy;

    const queryParams: Record<string, unknown> = {
      top: pageSize,
      skip: page * pageSize,
      count: true,
    };

    if (orderBy) queryParams.orderBy = orderBy;
    if (fixedFilter) queryParams.filter = fixedFilter;
    if (search) {
      const searchExpression = buildSearchExpression(search);
      if (searchExpression) queryParams.search = searchExpression;
    }

    const queryString = buildQuery(queryParams);
    const fullUrl = `${baseUrl ?? window.location.origin}${url}${queryString}`;

    fetcher(fullUrl, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          if ((res.status === 401 || res.status === 403) && onUnauthorized) {
            onUnauthorized(res);
          }
          const text = await res.text().catch(() => '');
          let msg = `요청 실패 (${res.status})`;
          try {
            const json = JSON.parse(text);
            msg = json?.error?.message ?? json?.message ?? msg;
          } catch { /* ignore parse error */ }
          throw new Error(msg);
        }
        return res.json();
      })
      .then((json) => {
        if (controller.signal.aborted) return;
        setData(json.value ?? json);
        setTotalCount(json['@odata.count'] ?? 0);
        setError(null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err.name === 'AbortError') return;
        setError(err.message);
        setData([]);
        setTotalCount(0);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  // deps는 의도적으로 부분집합이다: fixedFilter 객체 대신 직렬화 키(fixedFilterKey)로 값을 비교하고,
  // fetcher/onUnauthorized는 매 render 재생성될 수 있는 함수라 제외한다 —
  // 호출자가 useCallback 등으로 안정된 참조를 넘길 것을 전제로 한다(url과 동일한 계약).
  }, [url, page, pageSize, sortCriteria, search, fixedFilterKey, defaultOrderBy, refreshToken, baseUrl]);

  return {
    data, totalCount, loading, error,
    page, setPage,
    sortCriteria, onSortChange,
    search, setSearch: handleSetSearch,
    refresh,
  };
}

/**
 * `$orderby` 문자열을 정렬 기준 배열로 파싱한다 (`'a asc, b desc'`).
 * 방향이 생략되거나 `desc`가 아니면 `asc`로 본다(OData 기본값).
 */
export function parseOrderBy(orderBy: string): SortCriteria[] {
  return orderBy.split(',').map(s => {
    const parts = s.trim().split(/\s+/);
    return {
      key: parts[0],
      direction: (parts[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc') as SortCriteria['direction'],
    };
  });
}
