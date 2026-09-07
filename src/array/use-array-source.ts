import { useState, useMemo, useCallback } from 'react';
import { computeSortedIndices } from '../core/sorting.js';
import type { SortCriteria } from '../core/sorting.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';
import type { UseArraySourceOptions, UseArraySourceResult } from './types.js';
import { resolveInitialState } from '../odata/use-odata-source.js';

export interface ComputeArrayViewOptions<T> {
  search: string;
  sortCriteria: SortCriteria[];
  page: number;
  pageSize: number;
  columns?: ColumnDefinition<T>[];
  searchFields?: (row: T) => Array<string | number | boolean | null | undefined>;
}

/**
 * `useArraySource`의 검색→정렬→페이지 파이프라인을 React 없이 순수하게 계산한다
 * (훅은 이 함수를 `useMemo`로 감싸기만 한다) — React 훅 렌더 인프라 없이 이 패키지의
 * 다른 순수 헬퍼(`buildSearchExpression`/`parseOrderBy`)와 같은 방식으로 단위
 * 테스트하기 위해 분리했다.
 *
 * 정렬은 그리드 자신의 클라이언트 정렬 파이프라인이 쓰는 `computeSortedIndices`를
 * 그대로 재사용한다 — `columns`를 넘기면 숫자/날짜/불리언도 값 기준으로 비교되고,
 * 생략하면 전부 텍스트 비교로 낮아진다.
 */
export function computeArrayView<T extends DataRow>(
  data: T[],
  { search, sortCriteria, page, pageSize, columns, searchFields }: ComputeArrayViewOptions<T>
): { data: T[]; totalCount: number } {
  const term = search.trim().toLowerCase();
  const filtered = term
    ? data.filter((row) => {
        const values = searchFields ? searchFields(row) : Object.values(row as Record<string, unknown>);
        return values.some((v) => v != null && String(v).toLowerCase().includes(term));
      })
    : data;

  let sorted = filtered;
  if (sortCriteria.length > 0) {
    // computeSortedIndices는 col.key/col.type만 읽는다(row 제네릭 콜백은 안 씀) — T별
    // 제네릭 컬럼 정의를 DataRow 버전으로 캐스트해도 안전하다(FlexTableReact도 경계에서
    // 같은 방식의 캐스트를 한다).
    const indices = computeSortedIndices(filtered as DataRow[], sortCriteria, (columns ?? []) as ColumnDefinition[]);
    sorted = indices.map((i) => filtered[i]);
  }

  const totalCount = sorted.length;
  /*
   * 🔴**페이지가 결과 집합을 넘어서면 마지막 유효 페이지로 클램프한다.**
   * 배열 소스에서 「좁히기」의 실제 형태는 소비자가 상위에서 `rows.filter(...)` 한 **더 짧은
   * 배열을 넘기는 것**이다. 클램프가 없으면 `slice` 가 결과 집합 밖을 가리켜 **행은 하나도
   * 없는데 `totalCount` 는 0이 아닌** 상태가 화면에 나온다.
   *
   * ⚠**`useODataSource` 의 `fixedFilter` 리셋과 처방이 다르다.** 거기서는 «바뀌면 0페이지로»
   * 가 맞지만(소비자가 쿼리를 명시적으로 바꾼 것이다), `data` 는 routine refresh·polling
   * 으로도 바뀌므로 같은 규칙을 쓰면 **보던 페이지가 이유 없이 튄다.** 클램프는 범위를 넘을
   * 때만 움직이므로 그 오작동이 없다.
   */
  const lastPage = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize) - 1;
  const safePage = Math.min(Math.max(page, 0), lastPage);
  const start = safePage * pageSize;
  return { data: sorted.slice(start, start + pageSize), totalCount };
}

/**
 * 클라이언트 배열(이미 메모리에 있는 데이터, 흔히 여러 출처를 조인해 만든 파생
 * 행 배열) 전용 React 훅. `useODataSource`와 **같은 반환 형태**(`data`/`totalCount`/
 * `loading`/`error`/`page`/`setPage`/`sortCriteria`/`onSortChange`/`search`/
 * `setSearch`/`refresh`)를 제공해, `dataMode="server"` + `<FlexTableReact>` 배선
 * 코드를 서버·클라이언트 소스 사이에서 그대로 재사용할 수 있게 한다.
 *
 * `useODataSource`가 서버에 `$search`/`$orderby`/`$top`/`$skip`을 보내 처리를
 * 위임하는 것과 달리, 이 훅은 검색·정렬·페이지 나누기를 전부 로컬에서 계산한다
 * (`computeArrayView`) — 서버 read 모델에 없는 클라이언트 조인 파생 필드(예: 별도
 * 엔드포인트에서 가져와 붙인 상품명)로 검색/정렬해야 해서 서버 쿼리로 표현할 수
 * 없는 lookup 테이블에 쓴다.
 */
export function useArraySource<T extends DataRow = DataRow>(
  data: T[],
  options: UseArraySourceOptions<T> = {}
): UseArraySourceResult<T> {
  const {
    pageSize = 20,
    defaultOrderBy,
    initialPage = 0,
    initialSearch = '',
    initialSort,
    columns,
    searchFields,
  } = options;

  /*
   * 초기 상태 옵션은 `useODataSource` 와 **같은 이름·같은 의미**여야 한다 — 이 훅의 존재
   * 이유가 *"same shape … so the same binding code works with either source"*(README)라,
   * 한쪽에만 있으면 소스를 바꿔 끼우는 순간 그 계약이 조용히 깨진다.
   */
  const initial = resolveInitialState({ defaultOrderBy, initialPage, initialSearch, initialSort });
  const [page, setPage] = useState(initial.page);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria[]>(initial.sortCriteria);
  const [search, setSearchState] = useState(initial.search);

  const setSearch = useCallback((term: string) => {
    setSearchState(term);
    setPage(0);
  }, []);

  const onSortChange = useCallback((e: CustomEvent) => {
    const criteria = e.detail?.criteria as SortCriteria[] | undefined;
    if (criteria) {
      setSortCriteria(criteria);
      setPage(0);
    }
  }, []);

  const refresh = useCallback(() => { /* no-op — 이 훅에는 다시 불러올 원격 상태가 없다 */ }, []);

  const { data: pageData, totalCount } = useMemo(
    () => computeArrayView(data, { search, sortCriteria, page, pageSize, columns, searchFields }),
    [data, search, sortCriteria, page, pageSize, columns, searchFields]
  );

  /**
   * 계산된 `totalCount` 기준으로 `page` **상태**도 같이 되돌린다.
   *
   * `computeArrayView` 만 클램프하면 «보이는 행»은 맞지만 훅이 돌려주는 `page` 는 범위를
   * 넘은 값 그대로라, 페이저가 **존재하지 않는 페이지를 강조**한다(그 자리를 눌러도 아무
   * 일이 일어나지 않는다). 표시와 상태가 갈라지는 것이 이 조정을 두는 이유다.
   *
   * ⚠**effect 가 아니라 렌더 중 조정이다** — `useODataSource` 의 `fixedFilter` 리셋과 같은
   * 근거(React `you-might-not-need-an-effect`). 여기서는 요청이 없어 낭비 요청 문제는
   * 없지만, effect 로 하면 한 프레임 동안 페이저가 틀린 페이지를 강조한 뒤 튄다.
   *
   * ⚠**루프하지 않는다** — 조정은 `page` 를 항상 **낮추기만** 하고 `lastPage` 에서 멈춘다.
   */
  const lastPage = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize) - 1;
  if (page > lastPage) {
    setPage(lastPage);
  }

  return {
    data: pageData,
    totalCount,
    loading: false,
    error: null,
    page,
    setPage,
    sortCriteria,
    onSortChange,
    search,
    setSearch,
    refresh,
  };
}
