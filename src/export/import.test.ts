import { describe, it, expect, afterEach } from 'vitest';
import { Locale } from '@iyulab/components/dist/utilities/Locale.js';
import type { ColumnDefinition } from '../models/types.js';
import { buildImport, matchHeaders } from './import.js';
import { detectDelimiter, readDelimited } from './delimited-reader.js';
import { parseBoolean } from '../clipboard/clipboard.js';

/**
 * File import reports what did not come in: a header no column matched, a column the file lacks, a
 * cell that is not its column's type. Before, all three vanished — the header's values were dropped, an unread
 * boolean became `false`, and `data-import` carried only `{ count }`. And a comma CSV was read as tab-separated, so
 * the whole file came in as empty rows.
 */
const columns: ColumnDefinition[] = [
  { key: 'code', label: '관리번호', importAliases: ['관리 번호', 'Asset no.'] },
  { key: 'qty', label: 'Qty', type: 'number' },
  { key: 'active', label: 'Active', type: 'boolean' },
  { key: 'since', label: 'Since', type: 'date' },
  { key: 'note', label: 'Note' },
];

afterEach(() => { Locale.set('en'); });

describe('readDelimited', () => {
  it('reads a comma CSV, quoted commas included, and strips the byte-order mark an export writes', () => {
    const sheet = readDelimited('﻿관리번호,Note\r\nA-1,"red, large"\r\n', 'csv');
    expect(sheet.headers).toEqual(['관리번호', 'Note']);
    expect(sheet.rows).toEqual([['A-1', 'red, large']]);
  });

  it('reads a semicolon CSV (Excel on comma-decimal locales) and a TSV', () => {
    expect(readDelimited('a;b\n1,5;2', 'csv').rows).toEqual([['1,5', '2']]);
    expect(readDelimited('a,x\tb\n1\t2', 'tsv').headers).toEqual(['a,x', 'b']);
  });

  it('counts separators on the first line only, outside quotes', () => {
    expect(detectDelimiter('"a;b;c",d\ne;f;g;h')).toBe(',');
    expect(detectDelimiter('single')).toBe(',');
  });
});

describe('matchHeaders', () => {
  it('matches the label or an alias — exactly, then ignoring case and surrounding spaces', () => {
    const map = matchHeaders(['관리 번호', ' qty ', 'ACTIVE'], columns);
    expect([...map.values()]).toEqual(['code', 'qty', 'active']);
  });

  it('🔴NEGATIVE — a second header for the same column is not merged into it', () => {
    const map = matchHeaders(['Note', 'note'], columns);
    expect([...map.entries()]).toEqual([[0, 'note']]);
  });
});

describe('buildImport', () => {
  it('reports unmatched headers, missing columns and cells that are not their type — the cell keeps its text', () => {
    const { rows, report } = buildImport(
      { headers: ['Asset no.', 'Qty', 'Active', '비고2', ''], rows: [['A-1', '3', 'yes', 'x', ''], ['A-2', 'many', 'maybe', 'y', '']] },
      columns,
    );
    expect(rows).toEqual([
      { code: 'A-1', qty: 3, active: true },
      { code: 'A-2', qty: 'many', active: 'maybe' },
    ]);
    expect(report).toEqual({
      count: 2,
      unmatchedHeaders: ['비고2'],
      missingColumns: ['since', 'note'],
      coercionFailures: [
        { row: 1, key: 'qty', raw: 'many' },
        { row: 1, key: 'active', raw: 'maybe' },
      ],
    });
  });

  it('🔴NEGATIVE — a date already in YYYY-MM-DD and an empty cell are not failures', () => {
    const { report } = buildImport({ headers: ['Since', 'Qty'], rows: [['2026-10-02', '']] }, columns);
    expect(report.coercionFailures).toEqual([]);
  });
});

describe('parseBoolean', () => {
  it('reads true/false/1/0, the locale labels and its words — anything else is not a boolean', () => {
    expect([parseBoolean('TRUE'), parseBoolean('0'), parseBoolean('Yes'), parseBoolean('n')]).toEqual([true, false, true, false]);
    expect(parseBoolean('예')).toBeNull();
    Locale.set('ko');
    expect([parseBoolean('예'), parseBoolean('아니오'), parseBoolean('참')]).toEqual([true, false, true]);
    expect(parseBoolean('사용')).toBeNull();
  });
});
