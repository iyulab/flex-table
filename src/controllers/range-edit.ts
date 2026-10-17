import { getCellValue, setCellValue } from '../core/cell-value.js';
import type { CellRange, SelectionState } from '../core/selection.js';
import { parseValueForColumn } from '../clipboard/clipboard.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';

/** What the range edits need from the table — the controller owns what a key does to a block of cells, the table owns everything else. */
export interface RangeEditContext {
  /** The visible columns, in display order. */
  columns(): ColumnDefinition[];
  data(): DataRow[];
  /** Data index of a visual row. */
  dataIndex(visualRow: number): number;
  isEditable(col: ColumnDefinition, row: DataRow | undefined): boolean;
  selection: SelectionState;
  /** The table's public cell update — it raises the change events and puts the step on the undo stack. */
  updateRows(changes: Array<{ row: number; key: string; value: unknown }>): void;
  /** Puts an undoable step on the table's stack and tells listeners the undo state moved. */
  pushUndo(step: { label: string; undo: () => void; redo: () => void }): void;
  invalidate(): void;
}

/** Fill down / right (Ctrl+D, Ctrl+R) and clear (Delete) over the selection's blocks — each one undoable step. */
export class RangeEditController {
  constructor(private readonly ctx: RangeEditContext) {}

  /** A single cell takes the one above; a block repeats its first row down. */
  fillDown(): void {
    const range = this.ctx.selection.getEffectiveRange();
    if (!range) return;
    const cols = this.ctx.columns();
    const data = this.ctx.data();

    if (range.startRow === range.endRow && range.startCol === range.endCol) {
      if (range.startRow === 0) return;
      const col = cols[range.startCol];
      const sourceRow = this.ctx.dataIndex(range.startRow - 1);
      const destRow = this.ctx.dataIndex(range.startRow);
      if (!col || !this.ctx.isEditable(col, data[destRow])) return;
      this.ctx.updateRows([{ row: destRow, key: col.key, value: getCellValue(data[sourceRow], col.key) }]);
      return;
    }

    const changes: Array<{ row: number; key: string; value: unknown }> = [];
    for (let c = range.startCol; c <= range.endCol; c++) {
      const col = cols[c];
      if (!col) continue;
      const sourceValue = getCellValue(data[this.ctx.dataIndex(range.startRow)], col.key);
      for (let r = range.startRow + 1; r <= range.endRow; r++) {
        const dataRow = this.ctx.dataIndex(r);
        if (!this.ctx.isEditable(col, data[dataRow])) continue;
        changes.push({ row: dataRow, key: col.key, value: sourceValue });
      }
    }
    if (changes.length > 0) this.ctx.updateRows(changes);
  }

  /** A single cell takes the one to its left; a block repeats its first column across. */
  fillRight(): void {
    const range = this.ctx.selection.getEffectiveRange();
    if (!range) return;
    const cols = this.ctx.columns();
    const data = this.ctx.data();

    if (range.startRow === range.endRow && range.startCol === range.endCol) {
      if (range.startCol === 0) return;
      const col = cols[range.startCol];
      const srcCol = cols[range.startCol - 1];
      const dataRow = this.ctx.dataIndex(range.startRow);
      if (!col || !srcCol || !this.ctx.isEditable(col, data[dataRow])) return;
      this.ctx.updateRows([{ row: dataRow, key: col.key, value: getCellValue(data[dataRow], srcCol.key) }]);
      return;
    }

    const changes: Array<{ row: number; key: string; value: unknown }> = [];
    for (let r = range.startRow; r <= range.endRow; r++) {
      const dataRow = this.ctx.dataIndex(r);
      const srcCol = cols[range.startCol];
      if (!srcCol) continue;
      const rawValue = getCellValue(data[dataRow], srcCol.key);
      for (let c = range.startCol + 1; c <= range.endCol; c++) {
        const col = cols[c];
        if (!col || !this.ctx.isEditable(col, data[dataRow])) continue;
        const value = parseValueForColumn(rawValue == null ? '' : String(rawValue), col);
        changes.push({ row: dataRow, key: col.key, value });
      }
    }
    if (changes.length > 0) this.ctx.updateRows(changes);
  }

  /** Clears every selected block (the active range and the extra ones). */
  clearSelection(): void {
    const range = this.ctx.selection.getEffectiveRange();
    const extras = this.ctx.selection.extraRanges;
    if (!range && extras.length === 0) return;
    this.clear(range ? [range, ...extras] : [...extras]);
  }

  /** Empties the editable cells of the given blocks (false / 0 / '' by column type) as one undoable step. */
  clear(ranges: CellRange[]): void {
    const cols = this.ctx.columns();
    const data = this.ctx.data();
    const saved: Array<{ target: DataRow; key: string; oldValue: unknown; clearValue: unknown }> = [];
    const visited = new Set<string>();

    for (const range of ranges) {
      for (let r = range.startRow; r <= range.endRow; r++) {
        const dataRow = this.ctx.dataIndex(r);
        for (let c = range.startCol; c <= range.endCol; c++) {
          const key = `${dataRow}:${c}`;
          if (visited.has(key)) continue;
          visited.add(key);
          const col = cols[c];
          if (!col || !this.ctx.isEditable(col, data[dataRow])) continue;
          const oldValue = getCellValue(data[dataRow], col.key);
          const clearValue = col.type === 'boolean' ? false : col.type === 'number' ? 0 : '';
          setCellValue(data[dataRow], col.key, clearValue);
          saved.push({ target: data[dataRow], key: col.key, oldValue, clearValue });
        }
      }
    }

    if (saved.length > 0) {
      this.ctx.pushUndo({
        label: 'clear',
        undo: () => {
          for (const s of saved) setCellValue(s.target, s.key, s.oldValue);
          this.ctx.invalidate();
        },
        redo: () => {
          for (const s of saved) setCellValue(s.target, s.key, s.clearValue);
          this.ctx.invalidate();
        },
      });
    }

    this.ctx.invalidate();
  }
}
