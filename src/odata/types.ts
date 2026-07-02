import type { SortCriteria } from '../core/sorting.js';

export interface UseODataSourceOptions {
  pageSize?: number;
  defaultOrderBy?: string;
  fixedFilter?: Record<string, unknown>;
  /** 기본값: `window.location.origin`. 프록시/BFF 등 다른 origin으로 요청해야 할 때 지정. */
  baseUrl?: string;
  /** 커스텀 fetch transport(예: 인증 헤더를 주입하는 `HttpClient` 래퍼). 기본값: 전역 `fetch`. */
  fetcher?: (input: string, init: RequestInit) => Promise<Response>;
  /** 응답이 401/403일 때 호출(세션 만료 리다이렉트 등). 호출 후에도 기존 에러 처리는 계속 진행된다. */
  onUnauthorized?: (response: Response) => void;
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
