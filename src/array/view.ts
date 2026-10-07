// src/array/view.ts
// React 없이 쓰는 순수 함수 — `./array` 엔트리가 싣는 전부다(훅은 `./react`).
import { computeSortedIndices } from '../core/sorting.js';
import type { SortCriteria } from '../core/sorting.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';
import { DEFAULT_MAX_ROWS, type FetchAllOptions } from '../core/fetch-all.js';
import { RowLimitError } from '../core/source-error.js';

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
 * 페이지 없이 — 검색·정렬만 적용한 결과 전체. 메모리 소스의 `fetchAll`(소스·훅 둘 다)이 이것을 부른다. OData 소스와
 * 같은 계약이다: 상한을 넘으면 `RowLimitError`, 거둔 신호면 `AbortError`, 진행 콜백은 한 번(전부 한 «페이지»).
 */
export async function readAllArrayRows<T extends DataRow>(
  data: T[],
  view: Omit<ComputeArrayViewOptions<T>, 'page' | 'pageSize'>,
  { maxRows = DEFAULT_MAX_ROWS, signal, onProgress }: FetchAllOptions = {},
): Promise<T[]> {
  signal?.throwIfAborted();
  // pageSize 는 행 수 이상이면 된다 — 한 장에 전부(0행이어도 1 — 0 으로 나누지 않게).
  const { data: rows, totalCount } = computeArrayView(data, { ...view, page: 0, pageSize: Math.max(data.length, 1) });
  if (totalCount > maxRows) throw new RowLimitError(maxRows, totalCount);
  onProgress?.(rows.length, totalCount);
  return rows;
}
