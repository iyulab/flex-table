// src/odata/use-odata-source.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import buildQuery from 'odata-query';
import type { SortCriteria } from '../core/sorting.js';
import type { UseODataSourceOptions, UseODataSourceResult } from './types.js';

/**
 * OData v4 서버 사이드 데이터소스 React 훅.
 * flex-table의 dataMode="server"와 함께 사용한다.
 */
export function useODataSource<T = Record<string, unknown>>(
  url: string,
  options: UseODataSourceOptions = {}
): UseODataSourceResult<T> {
  const { pageSize = 20, defaultOrderBy, fixedFilter } = options;

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
      queryParams.search = search;
    }

    const queryString = buildQuery(queryParams);
    const fullUrl = `${window.location.origin}${url}${queryString}`;

    fetch(fullUrl, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
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
  // fixedFilterKey(문자열)로 값 비교, fixedFilter 객체 자체는 eslint-disable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, page, pageSize, sortCriteria, search, fixedFilterKey, defaultOrderBy, refreshToken]);

  return {
    data, totalCount, loading, error,
    page, setPage,
    sortCriteria, onSortChange,
    search, setSearch: handleSetSearch,
    refresh,
  };
}

function parseOrderBy(orderBy: string): SortCriteria[] {
  return orderBy.split(',').map(s => {
    const parts = s.trim().split(/\s+/);
    return {
      key: parts[0],
      direction: (parts[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc') as SortCriteria['direction'],
    };
  });
}
