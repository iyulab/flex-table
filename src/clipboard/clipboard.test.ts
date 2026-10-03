import { describe, it, expect } from 'vitest';
import { afterEach } from 'vitest';
import { Locale } from '@iyulab/components/dist/utilities/Locale.js';
import { copyToClipboard, editableNumber, parseValueForColumn } from './clipboard.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';

const cols: ColumnDefinition[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'value', label: 'Value', type: 'number' },
  { key: 'active', label: 'Active', type: 'boolean' },
];

describe('copyToClipboard', () => {
  it('quotes a cell with a line break, a tab or a quote so it pastes into a spreadsheet as one cell', () => {
    const data: DataRow[] = [{ name: 'line1\nline2', value: 'a"b', active: 'x\ty' }];
    const result = copyToClipboard(data, cols, { startRow: 0, startCol: 0, endRow: 0, endCol: 2 });
    expect(result).toBe('"line1\nline2"\t"a""b"\t"x\ty"');
  });

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

describe('locale-aware number parsing', () => {
  afterEach(() => Locale.set('en'));

  it('reads a decimal comma and grouped values from a spreadsheet', () => {
    Locale.set('de');
    expect(parseValueForColumn('1,5', cols[1])).toBe(1.5);
    expect(parseValueForColumn('1.234,5', cols[1])).toBe(1234.5);
    Locale.set('en');
    expect(parseValueForColumn('1,234.5', cols[1])).toBe(1234.5);
    expect(parseValueForColumn('1e3', cols[1])).toBe(1000);
    expect(parseValueForColumn('1,5x', cols[1])).toBe('1,5x');
  });

  it('writes a number for editing with the locale decimal separator, every digit kept', () => {
    Locale.set('de');
    expect(editableNumber(1234.5)).toBe('1234,5');
    expect(editableNumber(0.1)).toBe('0,1');
    Locale.set('en');
    expect(editableNumber(1234.5)).toBe('1234.5');
    expect(editableNumber(1e21)).toBe('1e+21');
  });
});
