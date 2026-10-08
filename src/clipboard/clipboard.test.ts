import { describe, it, expect } from 'vitest';
import { afterEach } from 'vitest';
import { Locale } from '@iyulab/components/dist/utilities/Locale.js';
import { copyToClipboard, editableDate, editableDateTime, editableNumber, parseValueForColumn } from './clipboard.js';
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

describe('dates', () => {
  const dateCol: ColumnDefinition = { key: 'd', label: 'D', type: 'date' };

  it('reads pasted dates into ISO and keeps text that is not a date', () => {
    expect(parseValueForColumn('2026/10/2', dateCol)).toBe('2026-10-02');
    expect(parseValueForColumn('20261002', dateCol)).toBe('2026-10-02');
    expect(parseValueForColumn('2026-10-02', dateCol)).toBe('2026-10-02');
    expect(parseValueForColumn('next week', dateCol)).toBe('next week');
  });

  it('writes a date for editing without a timezone shift', () => {
    expect(editableDate('2026-10-02')).toBe('2026-10-02');
    expect(editableDate('2026-10-02T23:30:00Z')).toBe('2026-10-02');
    expect(editableDate(new Date(2026, 9, 2))).toBe('2026-10-02');
    expect(editableDate(null)).toBe('');
    expect(editableDate('soon')).toBe('soon');
  });
});

describe('date-times', () => {
  const col: ColumnDefinition = { key: 'at', label: 'At', type: 'datetime' };

  it('reads pasted date-times into local ISO and keeps other text', () => {
    expect(parseValueForColumn('2026-10-02 14:05', col)).toBe('2026-10-02T14:05');
    expect(parseValueForColumn('2026-10-02', col)).toBe('2026-10-02T00:00');
    expect(parseValueForColumn('tomorrow', col)).toBe('tomorrow');
  });

  it('writes a date-time for editing in local time', () => {
    expect(editableDateTime('2026-10-02T14:05')).toBe('2026-10-02 14:05');
    expect(editableDateTime('2026-10-02T14:05:30')).toBe('2026-10-02 14:05');
    expect(editableDateTime(new Date(2026, 9, 2, 8, 7))).toBe('2026-10-02 08:07');
    const utc = new Date(Date.UTC(2026, 9, 2, 0, 0));
    const pad = (n: number) => String(n).padStart(2, '0');
    expect(editableDateTime('2026-10-02T00:00:00Z'))
      .toBe(`${utc.getFullYear()}-${pad(utc.getMonth() + 1)}-${pad(utc.getDate())} ${pad(utc.getHours())}:${pad(utc.getMinutes())}`);
    expect(editableDateTime('')).toBe('');
  });
});

describe('copying dates — the wall clock, which a paste reads back', () => {
  const dateCols: ColumnDefinition[] = [
    { key: 'd', label: 'D', type: 'date' },
    { key: 't', label: 'T', type: 'datetime' },
  ];
  const pad = (n: number) => String(n).padStart(2, '0');

  it('🔴a UTC instant is copied as local wall-clock text and pastes back as the same local time', () => {
    const instant = '2026-09-05T06:54:57Z';
    const local = new Date(instant);
    const text = copyToClipboard([{ d: '2026-09-05', t: instant }], dateCols, { startRow: 0, startCol: 0, endRow: 0, endCol: 1 });
    const wall = `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())} ${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`;
    expect(text).toBe(`2026-09-05\t${wall}`);
    // 붙여넣기는 datetime 을 편집과 같은 분 단위로 읽는다 — 같은 로컬 분이면 된다.
    const pasted = parseValueForColumn(wall, dateCols[1]) as string;
    expect(new Date(pasted).getTime()).toBe(new Date(local).setSeconds(0, 0));
  });

  it('a `Date` is not copied as `Date#toString()`', () => {
    const text = copyToClipboard([{ d: new Date(2026, 9, 2), t: new Date(2026, 9, 2, 8, 0, 0) }], dateCols, { startRow: 0, startCol: 0, endRow: 0, endCol: 1 });
    expect(text).toBe('2026-10-02\t2026-10-02 08:00:00');
  });
});
