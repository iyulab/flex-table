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
 * Handles RFC 4180 quoted fields: double-quote escaping, embedded tabs/newlines.
 */
export function parseClipboardText(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let i = 0;
  const len = normalized.length;

  while (i <= len) {
    if (i === len) {
      // End of input — push final row if non-empty
      if (row.length > 0 || rows.length > 0) {
        rows.push(row);
      }
      break;
    }

    const ch = normalized[i];

    if (ch === '"') {
      // Quoted field: collect until closing quote
      let field = '';
      i++; // skip opening quote
      while (i < len) {
        if (normalized[i] === '"') {
          if (i + 1 < len && normalized[i + 1] === '"') {
            // Escaped double-quote
            field += '"';
            i += 2;
          } else {
            // Closing quote
            i++; // skip closing quote
            break;
          }
        } else {
          field += normalized[i];
          i++;
        }
      }
      row.push(field);
      // Skip delimiter or newline after quoted field
      if (i < len && normalized[i] === '\t') {
        i++;
      } else if (i < len && normalized[i] === '\n') {
        rows.push(row);
        row = [];
        i++;
      }
    } else {
      // Unquoted field: collect until tab or newline
      let field = '';
      while (i < len && normalized[i] !== '\t' && normalized[i] !== '\n') {
        field += normalized[i];
        i++;
      }
      row.push(field);
      if (i < len && normalized[i] === '\t') {
        i++;
      } else if (i < len && normalized[i] === '\n') {
        rows.push(row);
        row = [];
        i++;
      }
    }
  }

  // Remove trailing empty row (common from spreadsheet copy)
  while (rows.length > 0) {
    const lastRow = rows[rows.length - 1];
    if (lastRow.length === 0 || (lastRow.length === 1 && lastRow[0] === '')) {
      rows.pop();
    } else {
      break;
    }
  }

  return rows;
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
