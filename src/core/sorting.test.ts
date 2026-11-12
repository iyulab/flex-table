import { describe, it, expect } from 'vitest';
import { Locale } from '@iyulab/components/dist/utilities/Locale.js';
import { computeSortedIndices, toggleSort } from './sorting.js';
import type { SortCriteria } from './sorting.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';

const cols: ColumnDefinition[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'age', label: 'Age', type: 'number' },
  { key: 'active', label: 'Active', type: 'boolean' },
  { key: 'joined', label: 'Joined', type: 'date' },
];

const data: DataRow[] = [
  { name: 'Charlie', age: 30, active: true, joined: '2023-03-01' },
  { name: 'Alice', age: 25, active: false, joined: '2023-01-15' },
  { name: 'Bob', age: 35, active: true, joined: '2023-02-10' },
  { name: 'Alice', age: 28, active: true, joined: '2023-04-20' },
];

describe('computeSortedIndices', () => {
  it('should return identity when no criteria', () => {
    const result = computeSortedIndices(data, [], cols);
    expect(result).toEqual([0, 1, 2, 3]);
  });

  it('should sort text ascending', () => {
    const result = computeSortedIndices(data, [{ key: 'name', direction: 'asc' }], cols);
    // Alice(1), Alice(3), Bob(2), Charlie(0)
    expect(result).toEqual([1, 3, 2, 0]);
  });

  it('should sort text descending', () => {
    const result = computeSortedIndices(data, [{ key: 'name', direction: 'desc' }], cols);
    // Charlie(0), Bob(2), Alice(1), Alice(3) — stable sort preserves original order for ties
    expect(result).toEqual([0, 2, 1, 3]);
  });

  it('should sort numbers', () => {
    const result = computeSortedIndices(data, [{ key: 'age', direction: 'asc' }], cols);
    // 25(1), 28(3), 30(0), 35(2)
    expect(result).toEqual([1, 3, 0, 2]);
  });

  it('should sort booleans', () => {
    const result = computeSortedIndices(data, [{ key: 'active', direction: 'asc' }], cols);
    // false(1) first, then true(0,2,3) in original order
    expect(result).toEqual([1, 0, 2, 3]);
  });

  it('should sort dates', () => {
    const result = computeSortedIndices(data, [{ key: 'joined', direction: 'asc' }], cols);
    // 2023-01-15(1), 2023-02-10(2), 2023-03-01(0), 2023-04-20(3)
    expect(result).toEqual([1, 2, 0, 3]);
  });

  it('should handle multi-column sort', () => {
    const result = computeSortedIndices(data, [
      { key: 'name', direction: 'asc' },
      { key: 'age', direction: 'asc' },
    ], cols);
    // Alice(25,idx1), Alice(28,idx3), Bob(35,idx2), Charlie(30,idx0)
    expect(result).toEqual([1, 3, 2, 0]);
  });

  it('should handle multi-column sort with desc secondary', () => {
    const result = computeSortedIndices(data, [
      { key: 'name', direction: 'asc' },
      { key: 'age', direction: 'desc' },
    ], cols);
    // Alice(28,idx3), Alice(25,idx1), Bob(35,idx2), Charlie(30,idx0)
    expect(result).toEqual([3, 1, 2, 0]);
  });

  it('should handle null values (sort to end in asc)', () => {
    const dataWithNull: DataRow[] = [
      { name: null, age: 10 },
      { name: 'Alice', age: 20 },
      { name: 'Bob', age: null },
    ];
    const result = computeSortedIndices(dataWithNull,
      [{ key: 'name', direction: 'asc' }], cols);
    // Alice(1), Bob(2), null(0)
    expect(result).toEqual([1, 2, 0]);
  });

  it('should handle null values (sort to end in desc too)', () => {
    const dataWithNull: DataRow[] = [
      { name: null, age: 10 },
      { name: 'Alice', age: 20 },
      { name: 'Bob', age: null },
    ];
    const result = computeSortedIndices(dataWithNull,
      [{ key: 'name', direction: 'desc' }], cols);
    // Bob(2), Alice(1), null(0) — nulls always last regardless of direction
    expect(result).toEqual([2, 1, 0]);
  });

  it('compares an undeclared column by its values — numbers numerically, not as text', () => {
    // Text order would put 1076000000 before 22000000.
    const rows: DataRow[] = [{ amount: 1076000000 }, { amount: 22000000 }, { amount: 481000000 }];
    expect(computeSortedIndices(rows, [{ key: 'amount', direction: 'asc' }], [])).toEqual([1, 2, 0]);
  });

  it('never reads strings as numbers — an undeclared column of strings and a declared text column stay text', () => {
    // As numbers 1.5 > 1.25; as text (digit runs compared as numbers, like a version) 1.5 < 1.25. Reading the
    // strings as numbers would flip this pair.
    const rows: DataRow[] = [{ code: '1.5' }, { code: '1.25' }];
    expect(computeSortedIndices(rows, [{ key: 'code', direction: 'asc' }], [])).toEqual([0, 1]);
    const typed: ColumnDefinition[] = [{ key: 'n', label: 'N', type: 'text' }];
    expect(computeSortedIndices([{ n: '1.5' }, { n: '1.25' }], [{ key: 'n', direction: 'asc' }], typed)).toEqual([0, 1]);
  });

  it('orders digit runs inside text as numbers — A-2 before A-10', () => {
    const rows: DataRow[] = [{ code: 'A-10' }, { code: 'A-2' }, { code: 'A-1' }, { code: '10' }, { code: '9' }];
    // '9'(4) '10'(3) A-1(2) A-2(1) A-10(0) — digits before letters, and each digit run compared as a number
    expect(computeSortedIndices(rows, [{ key: 'code', direction: 'asc' }], [])).toEqual([4, 3, 2, 1, 0]);
  });

  it('puts Hangul before or after Latin by the app locale, not the browser locale', () => {
    const rows: DataRow[] = [{ name: 'banana' }, { name: '가나다' }, { name: 'Apple' }];
    const asc = [{ key: 'name', direction: 'asc' as const }];
    const prev = Locale.get();
    try {
      Locale.set('en');
      expect(computeSortedIndices(rows, asc, [])).toEqual([2, 0, 1]); // Apple · banana · 가나다
      Locale.set('ko');
      expect(computeSortedIndices(rows, asc, [])).toEqual([1, 2, 0]); // 가나다 · Apple · banana
    } finally {
      Locale.set(prev);
    }
  });

  it('should handle empty data', () => {
    expect(computeSortedIndices([], [{ key: 'name', direction: 'asc' }], cols)).toEqual([]);
  });
});

describe('toggleSort', () => {
  it('should add asc when no criteria', () => {
    expect(toggleSort([], 'name', false)).toEqual([{ key: 'name', direction: 'asc' }]);
  });

  it('should toggle asc to desc (single mode)', () => {
    const criteria: SortCriteria[] = [{ key: 'name', direction: 'asc' }];
    expect(toggleSort(criteria, 'name', false)).toEqual([{ key: 'name', direction: 'desc' }]);
  });

  it('should toggle desc to none (single mode)', () => {
    const criteria: SortCriteria[] = [{ key: 'name', direction: 'desc' }];
    expect(toggleSort(criteria, 'name', false)).toEqual([]);
  });

  it('should replace previous sort in single mode', () => {
    const criteria: SortCriteria[] = [{ key: 'name', direction: 'asc' }];
    expect(toggleSort(criteria, 'age', false)).toEqual([{ key: 'age', direction: 'asc' }]);
  });

  it('should add secondary sort in multi mode', () => {
    const criteria: SortCriteria[] = [{ key: 'name', direction: 'asc' }];
    expect(toggleSort(criteria, 'age', true)).toEqual([
      { key: 'name', direction: 'asc' },
      { key: 'age', direction: 'asc' },
    ]);
  });

  it('should toggle existing in multi mode', () => {
    const criteria: SortCriteria[] = [
      { key: 'name', direction: 'asc' },
      { key: 'age', direction: 'asc' },
    ];
    expect(toggleSort(criteria, 'age', true)).toEqual([
      { key: 'name', direction: 'asc' },
      { key: 'age', direction: 'desc' },
    ]);
  });

  it('should remove desc in multi mode', () => {
    const criteria: SortCriteria[] = [
      { key: 'name', direction: 'asc' },
      { key: 'age', direction: 'desc' },
    ];
    expect(toggleSort(criteria, 'age', true)).toEqual([
      { key: 'name', direction: 'asc' },
    ]);
  });
});
