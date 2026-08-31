import { useState, useMemo, useCallback } from 'react';
import { computeSortedIndices } from '../core/sorting.js';
import type { SortCriteria } from '../core/sorting.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';
import type { UseArraySourceOptions, UseArraySourceResult } from './types.js';
import { parseOrderBy } from '../odata/use-odata-source.js';

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
  const start = page * pageSize;
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
  const { pageSize = 20, defaultOrderBy, columns, searchFields } = options;

  const [page, setPage] = useState(0);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria[]>(() =>
    defaultOrderBy ? parseOrderBy(defaultOrderBy) : []
  );
  const [search, setSearchState] = useState('');

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
