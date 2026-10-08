import type { ColumnDefinition, DataRow } from '../models/types.js';
import { parseCellForColumn } from '../clipboard/clipboard.js';
import type { ImportedSheet } from './xlsx-reader.js';
import { setCellValue } from '../core/cell-value.js';

/**
 * What an import took in and what it could not — `importFromFile` returns it and `data-import` carries it, so a
 * preview can show «what will not come in» before anything is saved.
 */
export interface ImportReport {
  /** Rows imported. */
  count: number;
  /** File headers no column matched (by `label` or `importAliases`) — their values were not imported. */
  unmatchedHeaders: string[];
  /** Keys of the columns no file header matched — those cells are empty in every imported row. */
  missingColumns: string[];
  /**
   * Cells whose text is not a value of the column's type (`number`, `boolean`, `date`, `datetime`). The cell keeps the
   * text as it was. `row` is the 0-based index among the imported rows.
   */
  coercionFailures: { row: number; key: string; raw: string }[];
}

const normalize = (s: string) => s.trim().toLowerCase();

/** File header → column key: the label or an alias, exactly first, then ignoring case and surrounding spaces. */
export function matchHeaders(headers: string[], columns: ColumnDefinition[]): Map<number, string> {
  const names = (c: ColumnDefinition) => [c.label, ...(c.importAliases ?? [])];
  const out = new Map<number, string>();
  const used = new Set<string>();
  headers.forEach((hdr, i) => {
    const col =
      columns.find(c => !used.has(c.key) && names(c).includes(hdr)) ??
      columns.find(c => !used.has(c.key) && names(c).some(n => normalize(n) === normalize(hdr)));
    if (!col) return;
    used.add(col.key);
    out.set(i, col.key);
  });
  return out;
}

/** A parsed sheet as table rows, with the report of what did not come in. */
export function buildImport(sheet: ImportedSheet, columns: ColumnDefinition[]): { rows: DataRow[]; report: ImportReport } {
  const map = matchHeaders(sheet.headers, columns);
  const byKey = new Map(columns.map(c => [c.key, c]));
  const coercionFailures: ImportReport['coercionFailures'] = [];
  const rows = sheet.rows.map((raw, r) => {
    const row: DataRow = {};
    for (const [i, key] of map) {
      const { value, failed } = parseCellForColumn(raw[i] ?? '', byKey.get(key)!);
      setCellValue(row, key, value);
      if (failed) coercionFailures.push({ row: r, key, raw: raw[i] ?? '' });
    }
    return row;
  });
  const matched = new Set(map.values());
  return {
    rows,
    report: {
      count: rows.length,
      unmatchedHeaders: sheet.headers.filter((h, i) => !map.has(i) && h.trim() !== ''),
      missingColumns: columns.filter(c => !matched.has(c.key)).map(c => c.key),
      coercionFailures,
    },
  };
}
