import { useState, useMemo, useCallback } from 'react';
import type { SortCriteria } from '../core/sorting.js';
import type { DataRow } from '../models/types.js';
import type { UseArraySourceOptions, UseArraySourceResult } from './types.js';
import { resolveInitialState } from '../odata/query.js';
import { computeArrayView } from './view.js';

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
