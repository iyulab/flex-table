import type { SortCriteria } from '../core/sorting.js';

export interface UseODataSourceOptions {
  pageSize?: number;
  defaultOrderBy?: string;
  fixedFilter?: Record<string, unknown>;
}

export interface UseODataSourceResult<T> {
  data: T[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  page: number;
  setPage: (page: number) => void;
  sortCriteria: SortCriteria[];
  onSortChange: (e: CustomEvent) => void;
  setSearch: (term: string) => void;
  search: string;
  refresh: () => void;
}
