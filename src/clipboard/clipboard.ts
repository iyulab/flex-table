import type { CellRange } from '../core/selection.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';

import { encodeTsv } from '@iyulab/components/dist/utilities/tsv.js';

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
      const n = Number(raw);
      return isNaN(n) ? raw : n;
    }
    case 'boolean':
      return raw.toLowerCase() === 'true' || raw === '1';
    default:
      return raw;
  }
}
