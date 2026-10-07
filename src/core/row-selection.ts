import type { SelectionMode } from '../models/types.js';

/**
 * Row-level (checkbox) selection, kept as a set of row ids — see `FlexTable.getRowId`.
 * Separate from the cell-level `SelectionState`.
 *
 * An id names a row, not a position: sorting, filtering, inserting or deleting rows leaves the checkmarks on the
 * rows they were put on. The header checkbox and "select all" act on the rows currently in view (`ids` arguments);
 * ids of rows that are not in view (another server page) stay selected.
 */
export class RowSelectionState {
  private _selected: Set<string> = new Set();
  private _mode: SelectionMode = 'multi';

  get mode(): SelectionMode {
    return this._mode;
  }

  set mode(value: SelectionMode) {
    this._mode = value;
    // Single mode: keep at most one
    if (value === 'single' && this._selected.size > 1) {
      const first = this._selected.values().next().value;
      this._selected.clear();
      if (first !== undefined) this._selected.add(first);
    }
  }

  /** Selected ids, in the order they were selected. */
  get selectedIds(): string[] {
    return [...this._selected];
  }

  get selectedCount(): number {
    return this._selected.size;
  }

  isSelected(id: string): boolean {
    return this._selected.has(id);
  }

  /** Every one of `ids` (the rows in view) is selected — false when `ids` is empty. */
  isAllSelected(ids: readonly string[]): boolean {
    return ids.length > 0 && ids.every((id) => this._selected.has(id));
  }

  /** Some but not all of `ids` (the rows in view) are selected. */
  isSomeSelected(ids: readonly string[]): boolean {
    const n = ids.reduce((c, id) => c + (this._selected.has(id) ? 1 : 0), 0);
    return n > 0 && n < ids.length;
  }

  toggle(id: string): void {
    if (this._selected.has(id)) {
      this._selected.delete(id);
    } else {
      this.select(id);
    }
  }

  select(id: string): void {
    if (this._mode === 'single') this._selected.clear();
    this._selected.add(id);
  }

  deselect(id: string): void {
    this._selected.delete(id);
  }

  /** Adds `ids` to the selection (multi mode only — one slot cannot hold a set). */
  selectAll(ids: readonly string[]): void {
    if (this._mode === 'single') return;
    for (const id of ids) this._selected.add(id);
  }

  /** Removes `ids` from the selection — the rest stays. */
  deselectMany(ids: readonly string[]): void {
    for (const id of ids) this._selected.delete(id);
  }

  deselectAll(): void {
    this._selected.clear();
  }

  /** Replaces the selection with `ids` (single mode keeps the last). Returns whether it changed. */
  set(ids: Iterable<string>): boolean {
    const next = [...new Set(ids)];
    const kept = this._mode === 'single' ? next.slice(-1) : next;
    if (kept.length === this._selected.size && kept.every((id) => this._selected.has(id))) return false;
    this._selected = new Set(kept);
    return true;
  }

  /** Keeps only the ids `keep` accepts. Returns whether anything was dropped. */
  retain(keep: (id: string) => boolean): boolean {
    let dropped = false;
    for (const id of this._selected) {
      if (!keep(id)) {
        this._selected.delete(id);
        dropped = true;
      }
    }
    return dropped;
  }

  /**
   * Selects `ids` between the positions of `from` and `to` in `ordered` (the rows in view, top to bottom), inclusive,
   * in either direction — shift-click range selection anchored at the last toggled row. Single mode selects only
   * `to`, matching `toggle()`'s one-slot semantics. An anchor that is no longer in view selects only `to`.
   */
  selectRange(ordered: readonly string[], from: string, to: string): void {
    const a = ordered.indexOf(from);
    const b = ordered.indexOf(to);
    if (this._mode === 'single' || a < 0 || b < 0) {
      this.select(to);
      return;
    }
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) this._selected.add(ordered[i]);
  }
}
