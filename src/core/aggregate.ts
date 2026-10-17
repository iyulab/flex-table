import type { DataRow } from '../models/types.js';

/**
 * How a column summarizes the rows the table shows. `sum` · `avg` · `min` · `max` read numbers (a numeric string
 * counts, an empty cell does not); `count` counts non-empty cells. A function gets the column's values and rows.
 */
export type ColumnAggregate<T = DataRow> =
  | 'sum'
  | 'avg'
  | 'count'
  | 'min'
  | 'max'
  | ((values: unknown[], rows: T[]) => unknown);

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * The summary of `values` (one per shown row, in view order). `undefined` = nothing to show — `avg` · `min` · `max`
 * of no numbers. `sum` of no numbers is 0, as a spreadsheet's SUM is.
 */
export function computeAggregate<T>(kind: ColumnAggregate<T>, values: unknown[], rows: T[]): unknown {
  if (typeof kind === 'function') return kind(values, rows);
  if (kind === 'count') return values.filter((v) => v != null && v !== '').length;
  const nums: number[] = [];
  for (const v of values) {
    const n = toNumber(v);
    if (n !== null) nums.push(n);
  }
  switch (kind) {
    case 'sum': return nums.reduce((a, b) => a + b, 0);
    case 'avg': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : undefined;
    case 'min': return nums.length ? Math.min(...nums) : undefined;
    case 'max': return nums.length ? Math.max(...nums) : undefined;
    default: return undefined;
  }
}
