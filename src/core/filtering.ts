import type { DataRow } from '../models/types.js';

/**
 * Filter predicate function.
 * Receives the cell value and the full row.
 */
export type FilterPredicate = (value: unknown, row: DataRow) => boolean;

/**
 * A filter applied to a specific column.
 */
export interface ColumnFilter {
  /** Column key this filter applies to */
  key: string;
  /** Filter predicate */
  predicate: FilterPredicate;
}

/**
 * Callback invoked when a filter predicate throws an error.
 */
export type FilterErrorCallback = (error: unknown, row: DataRow, filter: ColumnFilter) => void;

/**
 * Compute filtered indices.
 * Returns data indices that pass ALL filters (AND logic).
 * Original data is never mutated.
 *
 * If a filter predicate throws, the row is included (fail-open)
 * and the optional `onError` callback is invoked.
 */
export function computeFilteredIndices(
  data: DataRow[],
  filters: ColumnFilter[],
  onError?: FilterErrorCallback
): number[] {
  if (filters.length === 0) {
    return Array.from({ length: data.length }, (_, i) => i);
  }

  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    let pass = true;
    for (const filter of filters) {
      try {
        if (!filter.predicate(row[filter.key], row)) {
          pass = false;
          break;
        }
      } catch (e) {
        // Fail-open: include the row when predicate throws
        console.warn('Filter predicate error for key "%s":', filter.key, e);
        if (onError) {
          onError(e, row, filter);
        }
      }
    }
    if (pass) result.push(i);
  }
  return result;
}
