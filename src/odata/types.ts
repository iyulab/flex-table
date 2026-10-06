import type { SortCriteria } from '../core/sorting.js';
import type { SourceError } from '../core/source-error.js';

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
  /**
   * 응답이 401 일 때 호출(세션 만료 리다이렉트 등). 호출 후에도 기존 에러 처리는 계속 진행된다.
   * 403(인증됐지만 권한 없음)에는 부르지 않는다 — 그 실패는 `error` 로 드러난다.
   */
  onUnauthorized?: (response: Response) => void;
  /**
   * `false` 인 동안 요청하지 않는다. 기본값 `true`.
   *
   * 조회 조건이 다른 비동기 값(현재 사용자·기본 필터·선택된 부모 레코드)에 달린 목록에서
   * 그 값이 오기 전에 «틀린 조건의 첫 조회» 가 나가지 않게 한다. `false → true` 가 되는 순간
   * 첫 조회가 나가고, 그 사이 `loading` 은 `true` 다(표가 «데이터 없음» 이 아니라 «불러오는 중»
   * 을 보인다). 조회 중에 `false` 가 되면 진행 중 요청을 취소한다. `false` 인 동안의 `refresh()` 는
   * 아무 일도 하지 않는다 — 켜지는 순간의 조회가 이미 최신 조건이다.
   */
  enabled?: boolean;
}

export interface UseODataSourceResult<T> {
  data: T[];
  totalCount: number;
  /**
   * 조회 중이거나 아직 한 번도 답을 받지 않았으면 `true` — 첫 렌더부터 첫 응답(성공·실패)이 정착할 때까지,
   * 그리고 `enabled: false` 인 동안. 그래서 `!loading && totalCount === 0` 이 곧 «결과 없음» 이다.
   */
  loading: boolean;
  /**
   * 마지막 요청의 실패, 없으면 `null`. 화면에는 `error.message` 를 그린다. «어떤 실패인가» 는
   * `status`(HTTP) · `code`(서버의 거절 코드) · `details` 로 가른다 — 401 은 `onUnauthorized` 도 부른다.
   */
  error: SourceError | null;
  page: number;
  setPage: (page: number) => void;
  sortCriteria: SortCriteria[];
  onSortChange: (e: CustomEvent) => void;
  setSearch: (term: string) => void;
  search: string;
  refresh: () => void;
}
