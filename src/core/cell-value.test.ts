import { describe, it, expect } from 'vitest';
import { getCellValue, setCellValue } from './cell-value.js';
import { buildODataQuery, parseOrderBy } from '../odata/index.js';
import { computeSortedIndices } from './sorting.js';
import { exportData } from '../export/export.js';
import type { ColumnDefinition } from '../models/types.js';

/**
 * A column key may be a dot path into the row — what a server list gets from `$expand` (`row.Customer.Name`). Display,
 * sort, filter, copy and export read through the same function, and the server sort is the path in OData form.
 * Before, every read was `row[key]`, so a referenced record's name could not be a column at all.
 */
describe('getCellValue / setCellValue', () => {
  const row = { id: 1, Customer: { Name: 'Aster', Owner: { Name: 'Kim' } }, 'a.b': 'flat', '@odata.etag': 'W/"1"' };

  it('reads a dot path into nested objects', () => {
    expect(getCellValue(row, 'Customer.Name')).toBe('Aster');
    expect(getCellValue(row, 'Customer.Owner.Name')).toBe('Kim');
    expect(getCellValue(row, 'id')).toBe(1);
  });

  it('🔴NEGATIVE — a property named by the whole key wins over the path; a missing link is undefined, not an error', () => {
    expect(getCellValue(row, 'a.b')).toBe('flat');
    expect(getCellValue(row, '@odata.etag')).toBe('W/"1"');
    expect(getCellValue({ Customer: null }, 'Customer.Name')).toBeUndefined();
    expect(getCellValue(undefined, 'x')).toBeUndefined();
  });

  it('writes along the path, creating the objects that are missing — and a flat dotted property stays flat', () => {
    const r: Record<string, unknown> = { 'a.b': 1 };
    setCellValue(r, 'Customer.Name', 'Blue');
    setCellValue(r, 'a.b', 2);
    expect(r).toEqual({ 'a.b': 2, Customer: { Name: 'Blue' } });
  });
});

describe('path columns across the table', () => {
  const columns: ColumnDefinition[] = [
    { key: 'id', label: 'Id', type: 'number' },
    { key: 'Customer.Name', label: 'Customer' },
  ];
  const rows = [
    { id: 1, Customer: { Name: 'Cedar' } },
    { id: 2, Customer: { Name: 'Aster' } },
  ];

  it('sorts by the nested value on the client', () => {
    expect(computeSortedIndices(rows, [{ key: 'Customer.Name', direction: 'asc' }], columns)).toEqual([1, 0]);
  });

  it('exports the nested value under the column label', () => {
    expect(exportData(rows, columns, 'csv')).toBe('Id,Customer\n1,Cedar\n2,Aster');
  });

  it('sorts on the server by the OData path, and reads it back as the column key', () => {
    const q = new URLSearchParams(buildODataQuery({
      sortCriteria: [{ key: 'Customer.Name', direction: 'desc' }],
      expand: 'Customer($select=Name)',
      select: ['id'],
    }).replace(/^\?/, ''));
    expect(q.get('$orderby')).toBe('Customer/Name desc');
    expect(q.get('$expand')).toBe('Customer($select=Name)');
    expect(q.get('$select')).toBe('id');
    expect(parseOrderBy('Customer/Name desc')).toEqual([{ key: 'Customer.Name', direction: 'desc' }]);
  });

  it('🔴NEGATIVE — no $expand or $select when not given', () => {
    const q = buildODataQuery({ pageSize: 10 });
    expect(q).not.toContain('$expand');
    expect(q).not.toContain('$select');
  });
});
