import type { SortCriteria } from '../core/sorting.js';

export interface UseArraySourceOptions<T> {
  /** 페이지당 행 수. `useODataSource`와 동일 기본값. */
  pageSize?: number;
  /** 초기 정렬(`'a asc, b desc'` 형식, `useODataSource`와 동일 문법). */
  defaultOrderBy?: string;
  /**
   * 초기 페이지. **0-based** — `useODataSource`와 같은 축이다. 기본값 `0`.
   *
   * ⚠`useState`의 초기값이라 **첫 렌더에서만** 읽힌다. 이후 이동은 `setPage`.
   */
  initialPage?: number;
  /** 초기 검색어. 기본값 `''`. `initialPage`와 같은 「첫 렌더에서만」 계약이다. */
  initialSearch?: string;
  /** 초기 정렬. 주면 `defaultOrderBy` 파싱보다 **우선**한다(`useODataSource`와 동일). */
  initialSort?: SortCriteria[];
  /**
   * 타입 인지 정렬 비교(숫자/불리언/날짜/텍스트)에 쓸 컬럼 정의. 생략하면 전부
   * 텍스트로 비교한다(숫자 컬럼도 문자열 정렬 순서를 따름) — 그리드에 이미 넘기는
   * `columns`를 그대로 전달하면 된다.
   */
  columns?: import('../models/types.js').ColumnDefinition<T>[];
  /**
   * 자유 텍스트 검색이 대조할 값들을 행에서 뽑아낸다. 생략하면 행의 모든 값
   * (`Object.values`)을 대상으로 한다 — 서버 read 모델에 없는 클라이언트 조인
   * 파생 필드(예: 조인해 붙인 상품명)도 이 행 객체에 실제로 들어있는 한 기본
   * 동작만으로 검색된다. 명시적으로 검색 범위를 좁히거나 넓히고 싶을 때만 지정.
   */
  searchFields?: (row: T) => Array<string | number | boolean | null | undefined>;
}

export interface UseArraySourceResult<T> {
  /** 현재 페이지의 행(검색+정렬 적용 후 slice). */
  data: T[];
  /** 검색+정렬 적용 후, 페이지 나누기 전의 총 건수(`useODataSource`의 `@odata.count`와 동일 의미). */
  totalCount: number;
  /** 항상 `false` — 로컬 배열은 동기 처리라 로딩 상태가 없다. `useODataSource`와의 반환 형태 동일성을 위해 유지. */
  loading: boolean;
  /** 항상 `null` — 로컬 배열 처리는 실패하지 않는다. 위와 같은 이유로 유지. */
  error: string | null;
  page: number;
  setPage: (page: number) => void;
  sortCriteria: SortCriteria[];
  onSortChange: (e: CustomEvent) => void;
  setSearch: (term: string) => void;
  search: string;
  /** no-op — 로컬 배열에는 다시 불러올 원격 상태가 없다. 소비자가 `useODataSource`와
   *  같은 자리에 무조건 배선한 refresh 버튼이 있어도 안전하게 아무 일도 하지 않는다. */
  refresh: () => void;
}
