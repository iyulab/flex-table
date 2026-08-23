import type { SelectionMode } from '../models/types.js';

/**
 * Manages row-level selection state (checkbox-based).
 * Separate from cell-level SelectionState.
 */
export class RowSelectionState {
  private _selected: Set<number> = new Set();
  private _mode: SelectionMode = 'multi';
  private _rowCount = 0;

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

  setRowCount(count: number): void {
    this._rowCount = count;
    // Remove out-of-bounds selections
    for (const idx of this._selected) {
      if (idx >= count) this._selected.delete(idx);
    }
  }

  get selectedIndices(): number[] {
    return [...this._selected].sort((a, b) => a - b);
  }

  get selectedCount(): number {
    return this._selected.size;
  }

  get isAllSelected(): boolean {
    return this._rowCount > 0 && this._selected.size === this._rowCount;
  }

  get isSomeSelected(): boolean {
    return this._selected.size > 0 && this._selected.size < this._rowCount;
  }

  isSelected(index: number): boolean {
    return this._selected.has(index);
  }

  toggle(index: number): void {
    if (this._mode === 'single') {
      if (this._selected.has(index)) {
        this._selected.clear();
      } else {
        this._selected.clear();
        this._selected.add(index);
      }
    } else {
      if (this._selected.has(index)) {
        this._selected.delete(index);
      } else {
        this._selected.add(index);
      }
    }
  }

  select(index: number): void {
    if (this._mode === 'single') {
      this._selected.clear();
    }
    this._selected.add(index);
  }

  deselect(index: number): void {
    this._selected.delete(index);
  }

  selectAll(): void {
    if (this._mode === 'single') return;
    this._selected.clear();
    for (let i = 0; i < this._rowCount; i++) {
      this._selected.add(i);
    }
  }

  deselectAll(): void {
    this._selected.clear();
  }

  /**
   * Selects every index between from and to, inclusive, in either direction.
   * Used for shift-click range selection anchored at the last toggled row.
   * Single mode: only the endpoint (to) ends up selected, matching toggle()'s
   * "one at a time" semantics — a range doesn't make sense with one slot.
   */
  selectRange(from: number, to: number): void {
    if (this._mode === 'single') {
      this.select(to);
      return;
    }
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    for (let i = start; i <= end; i++) {
      if (i >= 0 && i < this._rowCount) this._selected.add(i);
    }
  }
}
