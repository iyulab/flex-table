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
 * Compute filtered indices.
 * Returns data indices that pass ALL filters (AND logic).
 * Original data is never mutated.
 */
export function computeFilteredIndices(
  data: DataRow[],
  filters: ColumnFilter[]
): number[] {
  if (filters.length === 0) {
    return Array.from({ length: data.length }, (_, i) => i);
  }

  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    let pass = true;
    for (const filter of filters) {
      if (!filter.predicate(row[filter.key], row)) {
        pass = false;
        break;
      }
    }
    if (pass) result.push(i);
  }
  return result;
}
