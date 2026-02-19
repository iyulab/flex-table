import type { CellRange } from '../core/selection.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';

/**
 * Copy selected range to clipboard as TSV.
 */
export function copyToClipboard(
  data: DataRow[],
  columns: ColumnDefinition[],
  range: CellRange
): string {
  const lines: string[] = [];
  for (let r = range.startRow; r <= range.endRow; r++) {
    const row = data[r];
    const cells: string[] = [];
    for (let c = range.startCol; c <= range.endCol; c++) {
      const col = columns[c];
      const value = row[col.key];
      cells.push(value == null ? '' : String(value));
    }
    lines.push(cells.join('\t'));
  }
  return lines.join('\n');
}

/**
 * Parse TSV/CSV clipboard text into a 2D array of strings.
 */
export function parseClipboardText(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  // Remove trailing empty line (common from spreadsheet copy)
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.map(line => line.split('\t'));
}

export function parseValueForColumn(raw: string, col: ColumnDefinition): unknown {
  if (raw === '') return null;

  switch (col.type) {
    case 'number': {
      const n = Number(raw);
      return isNaN(n) ? raw : n;
    }
    case 'boolean':
      return raw.toLowerCase() === 'true' || raw === '1';
    default:
      return raw;
  }
}
