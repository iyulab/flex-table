import type { SortCriteria } from '../core/sorting.js';

export interface UseODataSourceOptions {
  pageSize?: number;
  defaultOrderBy?: string;
  /**
   * 초기 페이지. **0-based** — 반환되는 `page`/`setPage`와 같은 축이고, 요청의
   * `$skip`은 `page * pageSize`다. 기본값 `0`.
   *
   * ⚠`useState`의 초기값이므로 **첫 렌더에서만** 읽힌다(`defaultOrderBy`와 같은 계약).
   * 마운트 이후에 페이지를 옮기려면 `setPage`를 쓴다.
   */
  initialPage?: number;
  /** 초기 검색어. 기본값 `''`. `initialPage`와 같은 「첫 렌더에서만」 계약이다. */
  initialSearch?: string;
  /**
   * 초기 정렬. 주면 `defaultOrderBy` 파싱보다 **우선**한다 — 두 옵션은 같은 것을 서로
   * 다른 표기로 말하고, 이쪽은 `sortCriteria`/`onSortChange`가 주고받는 모양 그대로라
   * 저장해 둔 정렬 상태를 파싱 없이 되돌릴 수 있다.
   */
  initialSort?: SortCriteria[];
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
