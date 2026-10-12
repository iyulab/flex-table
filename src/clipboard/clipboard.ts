import type { CellRange } from '../core/selection.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';

import { encodeTsv } from '@iyulab/components/dist/utilities/tsv.js';
import { parseDate, parseDateTime, parseNumber } from '@iyulab/components/dist/utilities/format.js';
import { Locale } from '@iyulab/components/dist/utilities/Locale.js';
import { readDateValue, writePlainDate, writePlainDateTime } from '@iyulab/components/dist/utilities/dateValue.js';
import { t } from '../locale.js';
import { getCellValue } from '../core/cell-value.js';
import { exportDate, exportDateText } from '../export/values.js';

/**
 * Copy selected range to clipboard as TSV — the spreadsheet clipboard format (see `encodeTsv`):
 * a cell containing a tab, a line break or a quote is quoted, so it pastes into Excel as one cell. A date is its
 * wall-clock text (as in a CSV export), which a spreadsheet reads as a date and a paste here reads back.
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
      const value = getCellValue(row, col.key);
      const date = value == null ? null : exportDate(value, col);
      cells.push(value == null ? '' : date ? exportDateText(date, col) : String(value));
    }
    rows.push(cells);
  }
  return encodeTsv(rows);
}

export function parseValueForColumn(raw: string, col: ColumnDefinition): unknown {
  return parseCellForColumn(raw, col).value;
}

/**
 * {@link parseValueForColumn} with the outcome: `failed` is true when the column has a type (`number`, `boolean`,
 * `date`, `datetime`) and the text is not one — the value is then the text itself, unchanged. An importer reports
 * those cells instead of losing them.
 */
export function parseCellForColumn(raw: string, col: ColumnDefinition): { value: unknown; failed: boolean } {
  if (raw === '') return { value: null, failed: false };
  // A parser's `null` is the failure; its result may equal the text (`2026-10-02` reads as itself).
  const parsed = (value: unknown) => (value === null ? { value: raw, failed: true } : { value, failed: false });

  switch (col.type) {
    case 'number': {
      // Locale-aware first, so `1,5` from a comma-decimal spreadsheet is 1.5 and `1.234,5` is 1234.5.
      // Plain JS notation (`1e3`) is still read; text that is neither stays text, as before.
      const n = parseNumber(raw);
      if (n !== null) return { value: n, failed: false };
      const plain = Number(raw.trim());
      return raw.trim() !== '' && Number.isFinite(plain) ? { value: plain, failed: false } : { value: raw, failed: true };
    }
    case 'boolean': {
      // `true`/`false`/`1`/`0`, the locale's labels and its true/false words; anything else stays text —
      // turning «예» or «Y» into `false` would change what the file said.
      const b = parseBoolean(raw);
      return b === null ? { value: raw, failed: true } : { value: b, failed: false };
    }
    case 'date':
      // `2026/10/2`, `20261002` and `2026. 10. 2.` become `2026-10-02`; text that is not a date stays text.
      return parsed(parseDate(raw));
    case 'datetime':
      // `2026-10-02 14:05` becomes local `2026-10-02T14:05` (a date alone is midnight); text that is not one stays text.
      return parsed(parseDateTime(raw));
    default:
      return { value: raw, failed: false };
  }
}

/** A boolean as a spreadsheet writes it, or `null` when the text is not one. */
export function parseBoolean(raw: string): boolean | null {
  const word = raw.trim().toLowerCase();
  const words = (key: 'booleanTrueWords' | 'booleanFalseWords', label: 'booleanTrue' | 'booleanFalse', base: string[]) =>
    new Set([...base, t(label), ...t(key).split(',')].map(w => w.trim().toLowerCase()).filter(Boolean));
  if (words('booleanTrueWords', 'booleanTrue', ['true', '1']).has(word)) return true;
  if (words('booleanFalseWords', 'booleanFalse', ['false', '0']).has(word)) return false;
  return null;
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

/** A cell value read as a date (`readDateValue` — the rule the display path uses), or `null`. */
function readCellDate(value: unknown) {
  return value instanceof Date || typeof value === 'string' ? readDateValue(value) : null;
}

/**
 * A `date` cell's value as `YYYY-MM-DD` for editing — the form the editor reads back — and the day the
 * cell shows: a plain date is that day, a plain date-time its own wall-clock day, an instant (`Z`, an
 * offset, a `Date`) its local day. Anything else, a day that does not exist included, is shown as it is.
 */
export function editableDate(value: unknown): string {
  if (value == null || value === '') return '';
  const read = readCellDate(value);
  if (read) return writePlainDate(read.date);
  return value instanceof Date ? '' : String(value);
}

/**
 * A `datetime` cell's value as `YYYY-MM-DD HH:mm` (local) for editing — the form the editor reads
 * back. A plain date-time (`2026-10-02T14:05`, no offset) keeps its wall clock, an instant (`Z`, an
 * offset, a `Date`) is shown in local time and a plain date at its local midnight. Anything else is
 * shown as it is.
 */
export function editableDateTime(value: unknown): string {
  if (value == null || value === '') return '';
  const read = readCellDate(value);
  if (read) return writePlainDateTime(read.date, false).replace('T', ' ');
  return value instanceof Date ? '' : String(value);
}
