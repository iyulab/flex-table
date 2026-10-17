import { copyToClipboard, parseValueForColumn } from '../clipboard/clipboard.js';
import { decodeTsv } from '@iyulab/components/dist/utilities/tsv.js';
import { copyFromKey, isTextEntry, pasteFromKey } from '@iyulab/components/dist/utilities/clipboard.js';
import { getCellValue, setCellValue } from '../core/cell-value.js';
import type { CellPosition, CellRange, SelectionState } from '../core/selection.js';
import type { FlexTableEventMap } from '../events.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';

type ClipboardEventName = 'clipboard-copy' | 'clipboard-cut' | 'clipboard-paste' | 'clipboard-error';

/** What copy, cut and paste need from the table — the controller owns the steps, the table owns everything else. */
export interface ClipboardContext {
  /** The visible columns, in display order. */
  columns(): ColumnDefinition[];
  /** The table's rows. A paste appends and an undo removes rows in place, so the table sees the same array. */
  data(): DataRow[];
  /** Data indices in display order (after filter and sort). */
  sortedIndices(): number[];
  /** Rows on show (after filter and sort, before paging). */
  rowCount(): number;
  /** Data index of a visual row. */
  dataIndex(visualRow: number): number;
  isEditable(col: ColumnDefinition, row: DataRow | undefined): boolean;
  /** Whether the table as a whole accepts changes — cut and paste do nothing without it. */
  editable(): boolean;
  /** Row limit of a paste that grows the table; 0 is none. */
  maxRows(): number;
  createEmptyRow(): DataRow;
  /** Filter, sort and paging again — rows a paste appended are not in them yet. */
  recomputeView(): void;
  selection: SelectionState;
  activeCell(): CellPosition | null;
  setActiveCell(position: CellPosition): void;
  clearRanges(ranges: CellRange[]): void;
  /** Puts an undoable step on the table's stack and tells listeners the undo state moved. */
  pushUndo(step: { label: string; undo: () => void; redo: () => void }): void;
  emit<K extends ClipboardEventName>(name: K, detail: FlexTableEventMap[K]['detail']): void;
  invalidate(): void;
}

interface PasteChange { row: number; col: number; key: string; oldValue: unknown; newValue: unknown }

/** Copy, cut and paste of the selection as TSV — the keys, the context menu's Copy, and their events. */
export class ClipboardController {
  constructor(private readonly ctx: ClipboardContext) {}

  /**
   * Ctrl/Cmd+C and +X. The key is left to the browser (not prevented): `copyFromKey` takes the browser's
   * clipboard event where it fires and the Clipboard API where it does not (Safari, which fires no copy
   * event without a text selection).
   */
  onCopyKey(e: KeyboardEvent): void {
    if (isTextEntry(e.composedPath()[0])) return;
    const copied = this.selectionTsv();
    if (!copied) return;
    const cut = e.key.toLowerCase() === 'x' && this.ctx.editable();
    void copyFromKey(copied.text).then((ok) => {
      if (ok) this.afterCopy(copied.range, copied.text, cut);
      else this.error('copy', new Error('The clipboard did not take the copied text'));
    });
  }

  /** Ctrl/Cmd+V — into the active cell, and only where the table can change. */
  onPasteKey(e: KeyboardEvent): void {
    if (isTextEntry(e.composedPath()[0]) || !this.ctx.editable() || !this.ctx.activeCell()) return;
    pasteFromKey().then((text) => this.pasteText(text), (err) => this.error('paste', err));
  }

  /** The context menu's Copy — a click, not a key, so it goes through the async Clipboard API. */
  async copyFromMenu(): Promise<void> {
    const copied = this.selectionTsv();
    if (!copied) return;
    try {
      await navigator.clipboard.writeText(copied.text);
    } catch (err) {
      // Nothing reached the clipboard: report the failure and stop — no `clipboard-copy`.
      this.error('copy', err);
      return;
    }
    this.afterCopy(copied.range, copied.text, false);
  }

  /** The selection as TSV in display (sorted) order, or `null` without a selection. */
  private selectionTsv(): { range: CellRange; text: string } | null {
    const range = this.ctx.selection.getEffectiveRange();
    if (!range) return null;
    const data = this.ctx.data();
    const sortedData = this.ctx.sortedIndices().map(i => data[i]);
    return { range, text: copyToClipboard(sortedData, this.ctx.columns(), range) };
  }

  private error(action: 'copy' | 'paste', error: unknown): void {
    this.ctx.emit('clipboard-error', { action, error });
  }

  /** Runs once the text is on the clipboard — only then is a cut range cleared. */
  private afterCopy(range: CellRange, text: string, cut: boolean): void {
    if (cut) this.ctx.clearRanges([range]);
    this.ctx.emit(cut ? 'clipboard-cut' : 'clipboard-copy', { range, text });
  }

  /** Writes text at the active cell: grows the table where the block runs past the last row, selects what it wrote. */
  pasteText(text: string): void {
    const anchor = this.ctx.activeCell();
    if (!anchor) return;

    const parsed = decodeTsv(text);
    if (parsed.length === 0) return;

    const addedRows = this.expandRows(anchor.row, parsed.length);
    const changes = this.applyData(anchor, parsed);
    this.selectPasted(anchor, parsed);

    if (changes.length > 0 || addedRows.length > 0) {
      const data = this.ctx.data();
      // Row objects, not positions: `data` can change between the paste and its undo.
      const targets = changes.map(c => data[c.row]);
      const added = addedRows.map(i => data[i]);
      this.ctx.pushUndo({
        label: 'paste',
        undo: () => {
          changes.forEach((c, i) => { setCellValue(targets[i], c.key, c.oldValue); });
          const rows = this.ctx.data();
          for (const row of added) {
            const at = rows.indexOf(row);
            if (at >= 0) rows.splice(at, 1);
          }
          this.ctx.invalidate();
        },
        redo: () => {
          const rows = this.ctx.data();
          for (const row of added) rows.push(row);
          changes.forEach((c, i) => { setCellValue(targets[i], c.key, c.newValue); });
          this.ctx.invalidate();
        },
      });
    }

    this.ctx.invalidate();
    this.ctx.emit('clipboard-paste', { changes, addedRows: addedRows.length });
  }

  /**
   * After a paste, the cells it wrote are the selection — as in spreadsheets — so the reader sees
   * what changed and can copy, clear or undo it as one block. The active cell stays where the
   * paste began (the same shape as selecting a column: range to the far corner, focus at the start).
   */
  private selectPasted(anchor: CellPosition, parsed: string[][]): void {
    const columnCount = this.ctx.columns().length;
    const width = Math.max(...parsed.map(r => r.length));
    const endRow = Math.min(anchor.row + parsed.length, this.ctx.rowCount()) - 1;
    const endCol = Math.min(anchor.col + width, columnCount) - 1;
    if (endRow === anchor.row && endCol === anchor.col) return;
    // Rows a paste appended are not in the selection's bounds until the next update.
    this.ctx.selection.setDimensions(this.ctx.rowCount(), columnCount);
    this.ctx.selection.setActive(anchor.row, anchor.col);
    this.ctx.selection.setActiveWithRange(endRow, endCol);
    this.ctx.setActiveCell({ row: anchor.row, col: anchor.col });
  }

  private expandRows(startRow: number, pasteRowCount: number): number[] {
    const data = this.ctx.data();
    const addedRows: number[] = [];
    const requiredRows = startRow + pasteRowCount;
    const maxRows = this.ctx.maxRows();
    const rowLimit = maxRows > 0 ? maxRows : Infinity;
    while (data.length < requiredRows && data.length < rowLimit) {
      const insertAt = data.length;
      data.push(this.ctx.createEmptyRow());
      addedRows.push(insertAt);
    }
    if (addedRows.length > 0) this.ctx.recomputeView();
    return addedRows;
  }

  private applyData(anchor: CellPosition, parsed: string[][]): PasteChange[] {
    const cols = this.ctx.columns();
    const data = this.ctx.data();
    const changes: PasteChange[] = [];
    for (let r = 0; r < parsed.length; r++) {
      const visualRow = anchor.row + r;
      if (visualRow >= this.ctx.rowCount()) break;
      const dataRow = this.ctx.dataIndex(visualRow);
      for (let c = 0; c < parsed[r].length; c++) {
        const colIndex = anchor.col + c;
        if (colIndex >= cols.length) break;
        const col = cols[colIndex];
        // A cell that may not change keeps its value — the paste still covers the block it was given.
        if (!this.ctx.isEditable(col, data[dataRow])) continue;
        const oldValue = getCellValue(data[dataRow], col.key);
        const newValue = parseValueForColumn(parsed[r][c], col);
        setCellValue(data[dataRow], col.key, newValue);
        changes.push({ row: dataRow, col: colIndex, key: col.key, oldValue, newValue });
      }
    }
    return changes;
  }
}
