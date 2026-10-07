import type { SortCriteria } from '../core/sorting.js';
import type { ODataSourceOptions, ODataSourceState } from './source.js';

/** `useODataSource` 의 옵션 — 프레임워크 중립 소스(`createODataSource`)의 설정과 같다. `initial*` 은 첫 렌더에서만 읽힌다. */
export type UseODataSourceOptions = ODataSourceOptions;

export interface UseODataSourceResult<T> extends ODataSourceState<T> {
  setPage: (page: number) => void;
  /** flex-table 의 `sort-change` 를 받는다(`detail.criteria`) — 정렬을 바꾸고 첫 장으로 간다. */
  onSortChange: (e: CustomEvent) => void;
  /** 검색어를 바꾸고 첫 장으로 간다. */
  setSearch: (term: string) => void;
  refresh: () => void;
}

export type { SortCriteria };
