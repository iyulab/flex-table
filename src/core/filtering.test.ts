import { describe, it, expect, vi } from 'vitest';
import { computeFilteredIndices } from './filtering.js';
import type { ColumnFilter } from './filtering.js';
import type { DataRow } from '../models/types.js';

const sampleData: DataRow[] = [
  { name: 'Alice', age: 30, active: true },
  { name: 'Bob', age: 25, active: false },
  { name: 'Charlie', age: 35, active: true },
  { name: 'Diana', age: 28, active: false },
  { name: 'Eve', age: 22, active: true },
];

describe('computeFilteredIndices', () => {
  it('should return all indices when no filters', () => {
    const result = computeFilteredIndices(sampleData, []);
    expect(result).toEqual([0, 1, 2, 3, 4]);
  });

  it('should filter by single column', () => {
    const filters: ColumnFilter[] = [
      { key: 'active', predicate: (v) => v === true },
    ];
    const result = computeFilteredIndices(sampleData, filters);
    expect(result).toEqual([0, 2, 4]); // Alice, Charlie, Eve
  });

  it('should filter by number comparison', () => {
    const filters: ColumnFilter[] = [
      { key: 'age', predicate: (v) => (v as number) >= 28 },
    ];
    const result = computeFilteredIndices(sampleData, filters);
    expect(result).toEqual([0, 2, 3]); // Alice(30), Charlie(35), Diana(28)
  });

  it('should filter by text contains', () => {
    const filters: ColumnFilter[] = [
      { key: 'name', predicate: (v) => String(v).toLowerCase().includes('a') },
    ];
    const result = computeFilteredIndices(sampleData, filters);
    expect(result).toEqual([0, 2, 3]); // Alice, Charlie, Diana
  });

  it('should apply multiple filters with AND logic', () => {
    const filters: ColumnFilter[] = [
      { key: 'active', predicate: (v) => v === true },
      { key: 'age', predicate: (v) => (v as number) >= 30 },
    ];
    const result = computeFilteredIndices(sampleData, filters);
    expect(result).toEqual([0, 2]); // Alice(30, true), Charlie(35, true)
  });

  it('should return empty array when no rows match', () => {
    const filters: ColumnFilter[] = [
      { key: 'age', predicate: (v) => (v as number) > 100 },
    ];
    const result = computeFilteredIndices(sampleData, filters);
    expect(result).toEqual([]);
  });

  it('should handle empty data', () => {
    const filters: ColumnFilter[] = [
      { key: 'name', predicate: () => true },
    ];
    const result = computeFilteredIndices([], filters);
    expect(result).toEqual([]);
  });

  it('should provide full row to predicate', () => {
    const filters: ColumnFilter[] = [
      { key: 'name', predicate: (_v, row) => (row.age as number) > 25 && row.active === true },
    ];
    const result = computeFilteredIndices(sampleData, filters);
    expect(result).toEqual([0, 2]); // Alice(30, true), Charlie(35, true)
  });

  it('should handle null/undefined values', () => {
    const data: DataRow[] = [
      { name: 'A', value: null },
      { name: 'B', value: 10 },
      { name: 'C' }, // value is undefined
      { name: 'D', value: 0 },
    ];
    const filters: ColumnFilter[] = [
      { key: 'value', predicate: (v) => v != null },
    ];
    const result = computeFilteredIndices(data, filters);
    expect(result).toEqual([1, 3]); // B(10), D(0)
  });

  it('should include row when predicate throws (fail-open)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const filters: ColumnFilter[] = [
      { key: 'name', predicate: () => { throw new Error('boom'); } },
    ];
    const result = computeFilteredIndices(sampleData, filters);
    // All rows included because predicate always throws
    expect(result).toEqual([0, 1, 2, 3, 4]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('should call onError callback when predicate throws', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onError = vi.fn();
    const thrownError = new Error('test error');
    const filters: ColumnFilter[] = [
      { key: 'age', predicate: () => { throw thrownError; } },
    ];
    computeFilteredIndices(sampleData, filters, onError);
    expect(onError).toHaveBeenCalledTimes(sampleData.length);
    expect(onError).toHaveBeenCalledWith(thrownError, sampleData[0], filters[0]);
    vi.restoreAllMocks();
  });

  it('should continue filtering after predicate error on some rows', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const filters: ColumnFilter[] = [
      {
        key: 'age',
        predicate: (v) => {
          if (v === 25) throw new Error('bad value');
          return (v as number) >= 30;
        },
      },
    ];
    const result = computeFilteredIndices(sampleData, filters);
    // Alice(30) pass, Bob(25) throws→included, Charlie(35) pass, Diana(28) fail, Eve(22) fail
    expect(result).toEqual([0, 1, 2]);
    vi.restoreAllMocks();
  });
});
