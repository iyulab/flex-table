import { describe, it, expect } from 'vitest';
import { computeArrayView } from './use-array-source.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';
import type { SortCriteria } from '../core/sorting.js';

interface Row extends DataRow {
  id: number;
  name: string;
  price: number;
  category: string;
}

const ROWS: Row[] = [
  { id: 1, name: 'Widget A', price: 30, category: 'Tools' },
  { id: 2, name: 'Widget B', price: 10, category: 'Tools' },
  { id: 3, name: 'Gadget C', price: 20, category: 'Electronics' },
];

const BASE: { search: string; sortCriteria: SortCriteria[]; page: number; pageSize: number } = {
  search: '',
  sortCriteria: [],
  page: 0,
  pageSize: 20,
};

describe('computeArrayView — 검색', () => {
  it('검색어가 없으면 원본 순서를 그대로 유지한다', () => {
    const result = computeArrayView(ROWS, { ...BASE });
    expect(result.data.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(result.totalCount).toBe(3);
  });

  it('기본 검색 범위(모든 값)에서 대소문자 무관 부분일치로 매칭한다', () => {
    const result = computeArrayView(ROWS, { ...BASE, search: 'widget' });
    expect(result.data.map((r) => r.id)).toEqual([1, 2]);
    expect(result.totalCount).toBe(2);
  });

  it('searchFields로 검색 범위를 좁힐 수 있다(서버 read 모델에 없는 조인 파생 필드 포함)', () => {
    // "카테고리로는 검색하지 않는다"는 정책을 흉내 — name만 대상으로.
    const result = computeArrayView(ROWS, {
      ...BASE,
      search: 'Electronics',
      searchFields: (row: Row) => [row.name],
    });
    expect(result.totalCount).toBe(0);
  });

  it('일치하는 것이 없으면 빈 결과 + totalCount 0', () => {
    const result = computeArrayView(ROWS, { ...BASE, search: 'nonexistent' });
    expect(result.data).toEqual([]);
    expect(result.totalCount).toBe(0);
  });
});

describe('computeArrayView — 정렬', () => {
  it('정렬 기준이 없으면 원본 순서를 유지한다', () => {
    const result = computeArrayView(ROWS, { ...BASE });
    expect(result.data.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it('columns 없이(텍스트 비교로 낮아짐) 숫자 컬럼을 정렬하면 문자열 순서가 된다', () => {
    // 10 < 20 < 30 이지만 텍스트로는 "10" < "20" < "30" 이라 결과가 같다 —
    // 이 케이스는 숫자 비교와 텍스트 비교가 우연히 같은 순서를 내므로,
    // 아래 "columns 있을 때" 테스트와 대비되는 자리에서 값을 다르게 잡는다.
    const result = computeArrayView(ROWS, {
      ...BASE,
      sortCriteria: [{ key: 'price', direction: 'asc' }],
    });
    expect(result.data.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it('columns를 넘기면 숫자 컬럼을 값 기준으로 비교한다(텍스트 정렬과 다른 결과를 만드는 케이스로 재현)', () => {
    const rows: Row[] = [
      { id: 1, name: 'A', price: 9, category: 'x' },
      { id: 2, name: 'B', price: 10, category: 'x' },
      { id: 3, name: 'C', price: 2, category: 'x' },
    ];
    const columns: ColumnDefinition<Row>[] = [{ key: 'price', header: 'Price', type: 'number' }];

    const withColumns = computeArrayView(rows, {
      ...BASE,
      sortCriteria: [{ key: 'price', direction: 'asc' }],
      columns,
    });
    expect(withColumns.data.map((r) => r.id)).toEqual([3, 1, 2]); // 2 < 9 < 10 (값 비교)

    const withoutColumns = computeArrayView(rows, {
      ...BASE,
      sortCriteria: [{ key: 'price', direction: 'asc' }],
    });
    expect(withoutColumns.data.map((r) => r.id)).toEqual([2, 3, 1]); // "10" < "2" < "9" (텍스트 비교)
  });

  it('검색 후 정렬한다(순서: 검색 → 정렬 → 페이지)', () => {
    const result = computeArrayView(ROWS, {
      ...BASE,
      search: 'widget',
      sortCriteria: [{ key: 'name', direction: 'desc' }],
    });
    expect(result.data.map((r) => r.id)).toEqual([2, 1]); // Widget B, Widget A
  });
});

describe('computeArrayView — 페이지', () => {
  it('page/pageSize로 slice한다', () => {
    const result = computeArrayView(ROWS, { ...BASE, page: 0, pageSize: 2 });
    expect(result.data.map((r) => r.id)).toEqual([1, 2]);
    expect(result.totalCount).toBe(3); // 페이지 나누기 전 총 건수
  });

  it('다음 페이지를 가져온다', () => {
    const result = computeArrayView(ROWS, { ...BASE, page: 1, pageSize: 2 });
    expect(result.data.map((r) => r.id)).toEqual([3]);
  });

  it('totalCount는 검색 필터 후 값이다(OData @odata.count와 동일 의미)', () => {
    const result = computeArrayView(ROWS, { ...BASE, search: 'widget', pageSize: 1 });
    expect(result.totalCount).toBe(2);
    expect(result.data.length).toBe(1);
  });
});

describe('computeArrayView — 페이지 범위 초과', () => {
  /**
   * 🔴**데이터가 줄면 빈 목록이 나온다.** 배열 소스에서 「필터를 좁히는」 것의 실제 형태는
   * 소비자가 상위에서 `rows.filter(...)` 한 **더 짧은 배열을 넘기는 것**이다. 그때 `page`
   * 는 그대로라 `slice(page * pageSize, …)` 가 결과 집합 밖을 가리키고, 화면에는
   * **행이 하나도 없는데 `totalCount` 는 0이 아닌** 상태가 나온다.
   *
   * ⚠**처방이 `useODataSource` 의 `fixedFilter` 리셋과 다르다**: `data` 는 routine
   * refresh/polling 으로도 바뀌므로 «바뀌면 0페이지로» 는 과잉이다(사용자가 보던 페이지가
   * 이유 없이 튄다). 여기서는 **마지막 유효 페이지로 클램프**한다.
   */
  const MANY = Array.from({ length: 45 }, (_, i) => ({ id: i, name: `row ${i}` }));

  it('페이지가 결과 집합을 넘어서면 마지막 유효 페이지를 돌려준다', () => {
    const result = computeArrayView(MANY.slice(0, 5), { ...BASE, page: 4, pageSize: 10 });
    // 5행 / 10행씩 = 마지막 페이지는 0
    expect(result.totalCount).toBe(5);
    expect(result.data).toHaveLength(5);
  });

  it('마지막 페이지가 0이 아닌 경우에도 그 페이지를 돌려준다', () => {
    const result = computeArrayView(MANY, { ...BASE, page: 99, pageSize: 20 });
    // 45행 / 20행씩 = 페이지 0,1,2 — 마지막은 2 (5행)
    expect(result.totalCount).toBe(45);
    expect(result.data).toHaveLength(5);
    expect(result.data[0]).toEqual({ id: 40, name: 'row 40' });
  });

  it('결과가 0건이면 빈 배열 (클램프할 페이지가 없다)', () => {
    const result = computeArrayView([], { ...BASE, page: 3, pageSize: 10 });
    expect(result.totalCount).toBe(0);
    expect(result.data).toEqual([]);
  });

  it('범위 안의 페이지는 종전과 똑같이 동작한다', () => {
    const result = computeArrayView(MANY, { ...BASE, page: 1, pageSize: 20 });
    expect(result.data).toHaveLength(20);
    expect(result.data[0]).toEqual({ id: 20, name: 'row 20' });
  });
});
