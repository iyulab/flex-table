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

/** `resolveInitialState`가 읽는 옵션 — 두 소스 훅의 옵션 타입이 공통으로 갖는 부분. */
export interface InitialSourceStateOptions {
  defaultOrderBy?: string;
  initialPage?: number;
  initialSearch?: string;
  initialSort?: SortCriteria[];
}

/**
 * 옵션에서 `page`/`search`/`sortCriteria`의 **초기값**을 뽑는다.
 *
 * ★**두 훅이 이 함수 하나를 공유하는 것이 요점이다.** README가 *"same shape … so the same
 * binding code works with either source"*를 계약으로 선언하는데, 초기값 해석을 양쪽에
 * 복제하면 그 계약이 **문장으로만** 유지된다 — 이 리포가 반복 기록한 실패 형태다.
 * 구현이 하나면 드리프트가 없다.
 *
 * ⚠**`initialSort`가 `defaultOrderBy`를 이긴다.** 둘은 같은 것을 서로 다른 표기로
 * 말하고(`SortCriteria[]` ↔ `$orderby` 문자열), 더 구체적인 쪽을 우선한다.
 * `initialSort`는 `onSortChange`가 주는 모양 그대로라 저장해 둔 정렬을 파싱 없이 되돌린다.
 *
 * ⚠**React가 useState 초기값을 첫 렌더에서만 읽는다는 사실이 계약의 일부다** — 이후의
 * 옵션 변경은 무시되고, 이동은 `setPage`/`setSearch`로 한다. `defaultOrderBy`가 이미
 * 그렇게 동작해 왔으므로 새 규칙이 아니다.
 */
export function resolveInitialState(options: InitialSourceStateOptions): {
  page: number;
  search: string;
  sortCriteria: SortCriteria[];
} {
  const { defaultOrderBy, initialPage = 0, initialSearch = '', initialSort } = options;
  return {
    page: initialPage,
    search: initialSearch,
    sortCriteria: initialSort ?? (defaultOrderBy ? parseOrderBy(defaultOrderBy) : []),
  };
}

/**
 * OData v4 서버 사이드 데이터소스 React 훅.
 * flex-table의 dataMode="server"와 함께 사용한다.
 */
export function useODataSource<T = Record<string, unknown>>(
  url: string,
  options: UseODataSourceOptions = {}
): UseODataSourceResult<T> {
  const {
    pageSize = 20,
    defaultOrderBy,
    initialPage = 0,
    initialSearch = '',
    initialSort,
    fixedFilter,
    baseUrl,
    fetcher = fetch,
    onUnauthorized,
  } = options;

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
  /*
   * 초기 상태를 «옵션으로» 받는 이유: 이것들이 없으면 「목록 → 상세 → 뒤로가기」에서
   * 위치를 되살리려는 소비자가 마운트 effect + setPage 로 우회할 수밖에 없고, 그 우회는
   * ⑴버려지는 첫 요청과 ⑵`setSearch` 의 `setPage(0)` 부수효과와의 순서 경합을 낳는다.
   * useState 초기값으로 흘리면 그 두 문제가 «표현 불가능» 해진다 — defaultOrderBy 가
   * 이미 정렬 축에서 하고 있던 것과 같은 방식이다.
   */
  const initial = resolveInitialState({ defaultOrderBy, initialPage, initialSearch, initialSort });
  const [page, setPage] = useState(initial.page);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria[]>(initial.sortCriteria);
  const [search, setSearch] = useState(initial.search);
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
          // ⚠영어 리터럴이다 — 이 패키지는 로케일 레지스트리를 갖지 않는다.
          // 한 문자열을 위해 @iyulab/components 런타임 의존을 들이는 것은 비용이 이득을
          // 넘는다(이 패키지는 지금 lit + odata-query 둘뿐이다). 표준의 «영어 기본»은
          // 충족하고, 서버가 메시지를 주면 그쪽이 이긴다(아래 두 줄).
          let msg = `Request failed (${res.status})`;
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
