import { describe, it, expect } from 'vitest';
import { copyToClipboard, parseClipboardText, parseValueForColumn } from './clipboard.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';

const cols: ColumnDefinition[] = [
  { key: 'name', header: 'Name', type: 'text' },
  { key: 'value', header: 'Value', type: 'number' },
  { key: 'active', header: 'Active', type: 'boolean' },
];

describe('copyToClipboard', () => {
  it('should copy single cell', () => {
    const data: DataRow[] = [{ name: 'Alice', value: 42, active: true }];
    const result = copyToClipboard(data, cols, { startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
    expect(result).toBe('Alice');
  });

  it('should copy range as TSV', () => {
    const data: DataRow[] = [
      { name: 'Alice', value: 42, active: true },
      { name: 'Bob', value: 7, active: false },
    ];
    const result = copyToClipboard(data, cols, { startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
    expect(result).toBe('Alice\t42\nBob\t7');
  });

  it('should handle null values', () => {
    const data: DataRow[] = [{ name: null, value: undefined, active: true }];
    const result = copyToClipboard(data, cols, { startRow: 0, startCol: 0, endRow: 0, endCol: 1 });
    expect(result).toBe('\t');
  });
});

describe('parseClipboardText', () => {
  it('should parse simple TSV', () => {
    const result = parseClipboardText('A\tB\nC\tD');
    expect(result).toEqual([['A', 'B'], ['C', 'D']]);
  });

  it('should handle Windows line endings', () => {
    const result = parseClipboardText('A\tB\r\nC\tD\r\n');
    expect(result).toEqual([['A', 'B'], ['C', 'D']]);
  });

  it('should handle single cell', () => {
    const result = parseClipboardText('hello');
    expect(result).toEqual([['hello']]);
  });
});

describe('parseValueForColumn', () => {
  it('should parse number values', () => {
    expect(parseValueForColumn('42', cols[1])).toBe(42);
    expect(parseValueForColumn('3.14', cols[1])).toBe(3.14);
    expect(parseValueForColumn('notnum', cols[1])).toBe('notnum');
  });

  it('should parse boolean values', () => {
    expect(parseValueForColumn('true', cols[2])).toBe(true);
    expect(parseValueForColumn('1', cols[2])).toBe(true);
    expect(parseValueForColumn('false', cols[2])).toBe(false);
    expect(parseValueForColumn('0', cols[2])).toBe(false);
  });

  it('should return null for empty string', () => {
    expect(parseValueForColumn('', cols[0])).toBe(null);
  });
});
