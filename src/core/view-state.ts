import type { ColumnDefinition } from '../models/types.js';
import type { SortCriteria } from './sorting.js';
import type { FilterModels } from './filter-model.js';

/** One column's part of the view: where it sits (its place in `columns`) and how it shows. */
export interface ColumnViewState {
  key: string;
  /** Width in px; absent while the column has neither been resized nor declares a width (it is auto). */
  width?: number;
  hidden: boolean;
  pinned: 'left' | 'right' | null;
}

/**
 * What a user did to the table that is worth keeping — column order, width, visibility and pinning, the sort
 * and the filters. Plain JSON: store it anywhere (`localStorage`, a profile, a URL) and hand it back with
 * `applyViewState`. Rows, selection and the cell values are data, not view, and are not in it.
 */
export interface TableViewState {
  /** In display order. */
  columns: ColumnViewState[];
  sort: SortCriteria[];
  filters: FilterModels;
}

/** Why `view-state-change` fired. */
export type ViewStateChangeReason = 'column-order' | 'column-width' | 'column-visibility' | 'sort' | 'filter';

/** Reads the view off the table's current columns, widths, sort and filters. */
export function snapshotViewState(
  columns: readonly ColumnDefinition[],
  widths: ReadonlyMap<string, number>,
  sort: readonly SortCriteria[],
  filters: FilterModels,
): TableViewState {
  return {
    columns: columns.map(c => {
      const width = widths.get(c.key) ?? c.width;
      const entry: ColumnViewState = { key: c.key, hidden: c.hidden ?? false, pinned: c.pinned ?? null };
      if (width !== undefined) entry.width = width;
      return entry;
    }),
    sort: sort.map(s => ({ ...s })),
    filters: { ...filters },
  };
}

function isColumnViewState(value: unknown): value is ColumnViewState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.key === 'string';
}

/**
 * Lays a stored view over the table's columns. The columns the state names come first, in its order; a column
 * the state does not know (added since it was saved) keeps its place relative to the others and follows them. A
 * key the table no longer has is dropped. Returns the new columns and the widths to set — a width the state
 * leaves out is left alone, so a column keeps what it has.
 */
export function mergeColumnViewState(
  columns: readonly ColumnDefinition[],
  state: readonly unknown[],
): { columns: ColumnDefinition[]; widths: Map<string, number>; skipped: unknown[] } {
  const byKey = new Map(columns.map(c => [c.key, c]));
  const widths = new Map<string, number>();
  const skipped: unknown[] = [];
  const placed = new Set<string>();
  const ordered: ColumnDefinition[] = [];

  for (const entry of state) {
    if (!isColumnViewState(entry)) { skipped.push(entry); continue; }
    const base = byKey.get(entry.key);
    if (!base || placed.has(entry.key)) { skipped.push(entry); continue; }
    placed.add(entry.key);
    const next: ColumnDefinition = { ...base };
    if (typeof entry.hidden === 'boolean') next.hidden = entry.hidden;
    if (entry.pinned === 'left' || entry.pinned === 'right') next.pinned = entry.pinned;
    else if (entry.pinned === null) delete next.pinned;
    if (typeof entry.width === 'number' && Number.isFinite(entry.width) && entry.width > 0) widths.set(entry.key, entry.width);
    ordered.push(next);
  }
  return { columns: [...ordered, ...columns.filter(c => !placed.has(c.key))], widths, skipped };
}
