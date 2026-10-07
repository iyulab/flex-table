// src/odata/use-odata-source.ts
import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import type { SortCriteria } from '../core/sorting.js';
import type { UseODataSourceOptions, UseODataSourceResult } from './types.js';
import { createODataSource } from './source.js';

/**
 * OData v4 서버 사이드 데이터소스 React 훅 — 프레임워크 중립 소스(`createODataSource`)의 React 어댑터다.
 * flex-table의 dataMode="server"와 함께 사용한다.
 *
 * 요청·페이지 보정·`nextLink`·취소는 전부 소스가 한다. 이 훅은 소스를 한 번 만들고(`initial*` 은 그때만 읽힌다),
 * 렌더마다 바뀐 옵션을 넘기고, 상태를 구독한다. 같은 틱의 조작은 소스가 한 요청으로 모으므로 필터를 바꾼 렌더도
 * 낡은 페이지로 요청하지 않는다.
 */
export function useODataSource<T = Record<string, unknown>>(
  url: string,
  options: UseODataSourceOptions = {}
): UseODataSourceResult<T> {
  const [source] = useState(() => createODataSource<T>(url, options));

  // 옵션은 렌더마다 넘긴다 — 소스가 값으로 비교해 바뀐 것만 반영한다(`fixedFilter` 는 직렬화 값, 함수는 다음 요청부터).
  useEffect(() => {
    source.update(url, options);
  });

  const state = useSyncExternalStore(source.subscribe, source.getState, source.getState);

  const onSortChange = useCallback((e: CustomEvent) => {
    const criteria = e.detail?.criteria as SortCriteria[] | undefined;
    if (criteria) source.setSort(criteria);
  }, [source]);

  return {
    ...state,
    setPage: source.setPage,
    setPageSize: source.setPageSize,
    onSortChange,
    setSearch: source.setSearch,
    refresh: source.refresh,
    fetchAll: source.fetchAll,
  };
}
