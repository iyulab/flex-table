import type { ColumnDefinition, DataRow } from '../models/types.js';
import { getCellValue } from './cell-value.js';
import { readCellDate } from './date-value.js';

/**
 * Sort direction.
 */
export type SortDirection = 'asc' | 'desc';

/**
 * A single sort criterion.
 */
export interface SortCriteria {
  /** Column key to sort by */
  key: string;
  /** Sort direction */
  direction: SortDirection;
}

/**
 * Compute sorted index mapping.
 * Returns an array where result[visualIndex] = dataIndex.
 * Original data is never mutated.
 */
export function computeSortedIndices(
  data: DataRow[],
  criteria: SortCriteria[],
  columns: ColumnDefinition[]
): number[] {
  const indices = Array.from({ length: data.length }, (_, i) => i);
  if (criteria.length === 0) return indices;

  // Build column type map for comparison — only declared types. An undeclared column is compared by
  // its values' own kind (see `compareValues`), so a column of numbers sorts numerically without a definition.
  const colTypeMap = new Map<string, string>();
  for (const col of columns) {
    if (col.type) colTypeMap.set(col.key, col.type);
  }

  indices.sort((a, b) => {
    for (const { key, direction } of criteria) {
      const va = getCellValue(data[a], key);
      const vb = getCellValue(data[b], key);
      // Nulls always sort last regardless of direction
      const aNull = va == null;
      const bNull = vb == null;
      if (aNull && bNull) continue;
      if (aNull) return 1;
      if (bNull) return -1;
      const cmp = compareValues(va, vb, colTypeMap.get(key) ?? inferType(va, vb));
      if (cmp !== 0) {
        return direction === 'asc' ? cmp : -cmp;
      }
    }
    // Stable sort: preserve original order for equal elements
    return a - b;
  });

  return indices;
}

/**
 * The comparison for a column whose type is not declared: numbers as numbers, booleans as booleans,
 * `Date`s as dates — when both values are that kind. Anything else (strings, mixed kinds) compares as text.
 * Without it, `1076000000` sorted before `22000000` (text order) in any column the caller did not type.
 */
function inferType(a: unknown, b: unknown): string {
  if ((typeof a === 'number' || typeof a === 'bigint') && (typeof b === 'number' || typeof b === 'bigint')) return 'number';
  if (typeof a === 'boolean' && typeof b === 'boolean') return 'boolean';
  if (a instanceof Date && b instanceof Date) return 'date';
  return 'text';
}

/**
 * Compare two non-null cell values by type.
 * Caller must handle null/undefined before calling.
 */
function compareValues(a: unknown, b: unknown, type: string): number {
  switch (type) {
    case 'number': {
      const na = Number(a);
      const nb = Number(b);
      if (isNaN(na) && isNaN(nb)) return 0;
      if (isNaN(na)) return 1;
      if (isNaN(nb)) return -1;
      return na - nb;
    }
    case 'boolean':
      return (a ? 1 : 0) - (b ? 1 : 0);
    case 'date':
    case 'datetime': {
      // 표시 경로와 같은 읽기 — `YYYY-MM-DD` 는 로컬 자정(UTC 자정이 아니다)이라 같은 날의 시각과 바르게 줄 선다.
      const da = readCellDate(a)?.getTime() ?? NaN;
      const db = readCellDate(b)?.getTime() ?? NaN;
      return (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
    }
    default: // text
      return String(a).localeCompare(String(b));
  }
}

/**
 * Toggle sort for a column key in the criteria array.
 * Cycle: none → asc → desc → none.
 * If multi is true (Shift+click), add as secondary sort.
 * If multi is false, replace all criteria with this column.
 */
export function toggleSort(
  criteria: SortCriteria[],
  key: string,
  multi: boolean
): SortCriteria[] {
  const existing = criteria.find(c => c.key === key);

  if (!multi) {
    // Single sort: replace all
    if (!existing) {
      return [{ key, direction: 'asc' }];
    }
    if (existing.direction === 'asc') {
      return [{ key, direction: 'desc' }];
    }
    // desc → none
    return [];
  }

  // Multi sort: add/toggle/remove this key
  if (!existing) {
    return [...criteria, { key, direction: 'asc' }];
  }
  if (existing.direction === 'asc') {
    return criteria.map(c => c.key === key ? { ...c, direction: 'desc' as SortDirection } : c);
  }
  // desc → remove
  return criteria.filter(c => c.key !== key);
}
