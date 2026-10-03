import type { CellRange } from '../core/selection.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';

import { encodeTsv } from '@iyulab/components/dist/utilities/tsv.js';
import { parseNumber } from '@iyulab/components/dist/utilities/format.js';
import { Locale } from '@iyulab/components/dist/utilities/Locale.js';

/**
 * Copy selected range to clipboard as TSV — the spreadsheet clipboard format (see `encodeTsv`):
 * a cell containing a tab, a line break or a quote is quoted, so it pastes into Excel as one cell.
 */
export function copyToClipboard(
  data: DataRow[],
  columns: ColumnDefinition[],
  range: CellRange
): string {
  const rows: string[][] = [];
  for (let r = range.startRow; r <= range.endRow; r++) {
    const row = data[r];
    const cells: string[] = [];
    for (let c = range.startCol; c <= range.endCol; c++) {
      const col = columns[c];
      const value = row[col.key];
      cells.push(value == null ? '' : String(value));
    }
    rows.push(cells);
  }
  return encodeTsv(rows);
}

export function parseValueForColumn(raw: string, col: ColumnDefinition): unknown {
  if (raw === '') return null;

  switch (col.type) {
    case 'number': {
      // Locale-aware first, so `1,5` from a comma-decimal spreadsheet is 1.5 and `1.234,5` is 1234.5.
      // Plain JS notation (`1e3`) is still read; text that is neither stays text, as before.
      const n = parseNumber(raw);
      if (n !== null) return n;
      const plain = Number(raw.trim());
      return raw.trim() !== '' && Number.isFinite(plain) ? plain : raw;
    }
    case 'boolean':
      return raw.toLowerCase() === 'true' || raw === '1';
    default:
      return raw;
  }
}

/**
 * A number as a person edits it: the active locale's decimal separator, no grouping, every digit
 * kept (`1234.5` → `1234,5` on a German page). The inverse is {@link parseValueForColumn}.
 */
export function editableNumber(value: number): string {
  // `String()` gives the shortest digits that round-trip (0.1 stays 0.1 — `Intl` with a wide
  // fraction would print the binary expansion). Only the decimal separator is localized.
  const plain = String(value);
  if (!Number.isFinite(value) || plain.includes('e')) return plain;
  const decimal = new Intl.NumberFormat(Locale.get()).formatToParts(1.5).find(p => p.type === 'decimal')?.value;
  return decimal && decimal !== '.' ? plain.replace('.', decimal) : plain;
}
