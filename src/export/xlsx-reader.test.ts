import { describe, it, expect } from 'vitest';
import { readXlsx } from './xlsx-reader.js';
import { buildXlsx } from './xlsx-writer.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';

// Round-trip test data (write with xlsx-writer, read with xlsx-reader)
const cols: ColumnDefinition[] = [
  { key: 'name', header: 'Name', type: 'text' },
  { key: 'age', header: 'Age', type: 'number' },
  { key: 'active', header: 'Active', type: 'boolean' },
];

const data: DataRow[] = [
  { name: 'Alice', age: 30, active: true },
  { name: 'Bob', age: 25, active: false },
  { name: 'Charlie', age: 40, active: true },
];

function xlsxBuffer(d: DataRow[], c: ColumnDefinition[]): ArrayBuffer {
  return buildXlsx(d, c).buffer as ArrayBuffer;
}

describe('readXlsx', () => {
  it('should return correct headers', async () => {
    const buf = xlsxBuffer(data, cols);
    const sheet = await readXlsx(buf);
    expect(sheet.headers).toEqual(['Name', 'Age', 'Active']);
  });

  it('should return correct row count', async () => {
    const buf = xlsxBuffer(data, cols);
    const sheet = await readXlsx(buf);
    expect(sheet.rows).toHaveLength(3);
  });

  it('should read text cell values', async () => {
    const buf = xlsxBuffer(data, cols);
    const sheet = await readXlsx(buf);
    expect(sheet.rows[0][0]).toBe('Alice');
    expect(sheet.rows[1][0]).toBe('Bob');
    expect(sheet.rows[2][0]).toBe('Charlie');
  });

  it('should read number cell values as strings', async () => {
    const buf = xlsxBuffer(data, cols);
    const sheet = await readXlsx(buf);
    expect(sheet.rows[0][1]).toBe('30');
    expect(sheet.rows[1][1]).toBe('25');
    expect(sheet.rows[2][1]).toBe('40');
  });

  it('should read boolean cell values as "true"/"false"', async () => {
    const buf = xlsxBuffer(data, cols);
    const sheet = await readXlsx(buf);
    expect(sheet.rows[0][2]).toBe('true');
    expect(sheet.rows[1][2]).toBe('false');
    expect(sheet.rows[2][2]).toBe('true');
  });

  it('should handle empty data (headers only)', async () => {
    const buf = xlsxBuffer([], cols);
    const sheet = await readXlsx(buf);
    expect(sheet.headers).toEqual(['Name', 'Age', 'Active']);
    expect(sheet.rows).toHaveLength(0);
  });

  it('should handle single column', async () => {
    const singleCol: ColumnDefinition[] = [{ key: 'id', header: 'ID', type: 'number' }];
    const singleData: DataRow[] = [{ id: 1 }, { id: 2 }];
    const buf = xlsxBuffer(singleData, singleCol);
    const sheet = await readXlsx(buf);
    expect(sheet.headers).toEqual(['ID']);
    expect(sheet.rows[0][0]).toBe('1');
    expect(sheet.rows[1][0]).toBe('2');
  });

  it('should handle null/undefined cell values', async () => {
    const d: DataRow[] = [{ name: null, age: undefined, active: true }];
    const buf = xlsxBuffer(d, cols);
    const sheet = await readXlsx(buf);
    expect(sheet.rows[0][0]).toBe('');
    expect(sheet.rows[0][2]).toBe('true');
  });

  it('should handle special characters in strings', async () => {
    const d: DataRow[] = [{ name: 'A & B < C > D "E"', age: 1, active: true }];
    const buf = xlsxBuffer(d, cols);
    const sheet = await readXlsx(buf);
    expect(sheet.rows[0][0]).toBe('A & B < C > D "E"');
  });

  it('should handle large datasets (100 rows)', async () => {
    const bigData: DataRow[] = Array.from({ length: 100 }, (_, i) => ({
      name: `Name${i}`,
      age: i,
      active: i % 2 === 0,
    }));
    const buf = xlsxBuffer(bigData, cols);
    const sheet = await readXlsx(buf);
    expect(sheet.rows).toHaveLength(100);
    expect(sheet.rows[50][0]).toBe('Name50');
    expect(sheet.rows[99][1]).toBe('99');
  });

  it('should handle many columns (10 columns)', async () => {
    const manyCols: ColumnDefinition[] = Array.from({ length: 10 }, (_, i) => ({
      key: `col${i}`,
      header: `Col${i}`,
      type: 'text' as const,
    }));
    const manyData: DataRow[] = [
      Object.fromEntries(manyCols.map(c => [c.key, `val_${c.key}`])),
    ];
    const buf = xlsxBuffer(manyData, manyCols);
    const sheet = await readXlsx(buf);
    expect(sheet.headers).toHaveLength(10);
    expect(sheet.rows[0][9]).toBe('val_col9');
  });
});
