import type { SortCriteria } from '../core/sorting.js';
import type { FilterModels } from '../core/filter-model.js';
import type { SourceError } from '../core/source-error.js';
import type { FetchAllOptions } from '../core/fetch-all.js';
import type { ArraySource } from './source.js';

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
   * 정렬 비교 타입(숫자/불리언/날짜/텍스트)을 정하는 컬럼 정의. 생략한 컬럼은 값의 형으로
   * 비교한다 — 숫자는 숫자로, 불리언은 불리언으로, `Date` 는 날짜로, 그 밖은 텍스트로.
   * 값이 문자열인 날짜(`'2026-10-22'`)나 숫자 문자열을 값 기준으로 비교하려면 `type` 을 준다.
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

/** `useArraySource` 의 `source` — 목록 골격(`ListPage` · `bindSource`)에 넘기는 소스. 이 훅의 상태를 읽고 조작은 훅으로 간다. */
export type HookArraySource<T> = Omit<ArraySource<T>, 'update'>;

export interface UseArraySourceResult<T> {
  /** 이 훅의 상태를 소스 모양으로 — `<ListPage source={orders.source}>` · `bindSource(orders.source, el)`. 늘 같은 객체다. */
  source: HookArraySource<T>;
  /** 현재 페이지의 행(검색+정렬 적용 후 slice). */
  data: T[];
  /** 검색+정렬 적용 후, 페이지 나누기 전의 총 건수(`useODataSource`의 `@odata.count`와 동일 의미). */
  totalCount: number;
  /** 항상 `false` — 로컬 배열은 동기 처리라 로딩 상태가 없다. `useODataSource`와의 반환 형태 동일성을 위해 유지. */
  loading: boolean;
  /** 항상 `null` — 로컬 배열 처리는 실패하지 않는다. 위와 같은 이유로 유지. */
  error: SourceError | null;
  page: number;
  setPage: (page: number) => void;
  /** 한 페이지의 행 수 — `pageSize` 옵션으로 시작하고 `setPageSize` 로 바뀐다. */
  pageSize: number;
  /** 페이지 크기를 바꾸고 첫 장으로 간다. */
  setPageSize: (size: number) => void;
  sortCriteria: SortCriteria[];
  onSortChange: (e: CustomEvent) => void;
  /** 열 필터 — 표의 `filter-change.detail.filters`(모델). 검색보다 먼저 거른다. */
  filters: FilterModels;
  /** flex-table 의 `filter-change` 를 받는다(`detail.filters`) — 열 필터를 바꾸고 첫 장으로 간다. */
  onFilterChange: (e: CustomEvent) => void;
  /** 열 필터를 직접 바꾼다(저장해 둔 필터를 되돌릴 때) — 첫 장으로 간다. */
  setFilters: (filters: FilterModels) => void;
  setSearch: (term: string) => void;
  search: string;
  /** no-op — 로컬 배열에는 다시 불러올 원격 상태가 없다. 소비자가 `useODataSource`와
   *  같은 자리에 무조건 배선한 refresh 버튼이 있어도 안전하게 아무 일도 하지 않는다. */
  refresh: () => void;
  /** 지금 검색·정렬의 결과 전체(페이지 없이) — `useODataSource` 의 `fetchAll` 과 같은 계약. 내보내기에 쓴다. */
  fetchAll: (options?: FetchAllOptions) => Promise<T[]>;
}
