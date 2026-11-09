import { isFromControl } from '@iyulab/components/dist/utilities/elements.js';
import type { CellPosition, SelectionState } from '../core/selection.js';
import type { FlexTableEventMap } from '../events.js';

/** What the cursor needs from the table — the controller owns the pointer's way into the selection and the follow-scroll, the table owns everything else. */
export interface CursorContext {
  host: HTMLElement;
  /** 읽는 방향이 오른쪽→왼쪽인가 — 화면 방향을 쓰는 키 · 끌기 · 스크롤 좌표가 읽는다(없으면 왼쪽→오른쪽). */
  isRtl?(): boolean;
  selection: SelectionState;
  /** The table's reactive copy of the selection's active cell (it drives the re-render). */
  activeCell(): CellPosition | null;
  setActiveCell(position: CellPosition | null): void;
  /** Closes an open cell editor, keeping its value (a no-op when none is open). */
  commitEdit(): void;
  startEdit(): void;
  /** `row-activate` for the active cell, as the pointer's half (a plain click opens the row). */
  activateRow(colIndex: number): void;
  /** Whether a real row-drag reorder just ended — consumed once, so the click that follows it is not taken for a select. */
  consumeRowDrag(): boolean;
  rowCount(): number;
  /** The visible columns' keys, in display order. */
  columnKey(colIndex: number): string | undefined;
  /** Stable id of the row shown at `visualRow` (empty when there is none). */
  rowId(visualRow: number): string;
  rowHeight(): number;
  headerHeight(): number;
  frozenRowCount(): number;
  frozenRowsHeight(): number;
  /** Left edge of each visible column in content coordinates. */
  colLeftOffsets(): number[];
  colWidth(colIndex: number): number;
  emitCellSelect(detail: FlexTableEventMap['cell-select']['detail']): void;
  emitColumnSelect(detail: FlexTableEventMap['column-select']['detail']): void;
  invalidate(): void;
}

/**
 * The cell cursor: how the pointer moves it (click, press-and-drag, row number, double click, a whole
 * column) and how the view follows it. The keyboard walks the same cursor from the table; both end in
 * the same `cell-select` event and the same follow-scroll.
 */
export class CursorController {
  /** A press on a cell that has not been released yet — moving onto another cell then extends the range. */
  private pressing = false;
  /** A drag selected something: the `click` the browser fires after its mouseup is that drag's, not a new select. */
  private dragged = false;

  constructor(private readonly ctx: CursorContext) {}

  /** Forgets a press in progress (the table left the page mid-drag). */
  reset(): void {
    this.pressing = false;
    this.dragged = false;
  }

  /** Takes the active cell from the selection and tells the table to draw it. */
  private syncFromSelection(): void {
    const active = this.ctx.selection.activeCell;
    this.ctx.setActiveCell(active ? { ...active } : null);
  }

  /** `cell-select` for the active cell (`null` when none). */
  dispatchSelection(): void {
    const ac = this.ctx.activeCell();
    this.ctx.emitCellSelect(ac ? { ...ac, id: this.ctx.rowId(ac.row) } : null);
  }

  /** Makes the selection's active cell the table's, scrolls it into view and announces it — the keyboard's way in. */
  followSelection(): void {
    this.syncFromSelection();
    this.scrollToActive();
    this.dispatchSelection();
  }

  click(e: MouseEvent, rowIndex: number, colIndex: number, cell: HTMLElement): void {
    // The end of a drag selection — the drag already did the selecting.
    if (this.dragged) {
      this.dragged = false;
      return;
    }
    // A plain click: the press ended without moving to another cell.
    this.pressing = false;
    this.ctx.commitEdit();
    const extendsSelection = e.shiftKey || e.ctrlKey || e.metaKey;
    if (e.shiftKey) {
      this.ctx.selection.setActiveWithRange(rowIndex, colIndex);
    } else if (e.ctrlKey || e.metaKey) {
      this.ctx.selection.toggleCell(rowIndex, colIndex);
    } else {
      this.ctx.selection.setActive(rowIndex, colIndex);
    }
    this.syncFromSelection();
    this.dispatchSelection();
    this.ctx.invalidate();
    // A plain click opens the row — the pointer half of `row-activate` (Enter is the keyboard half).
    // A click that extends a selection, or presses a control the cell renders, is that act's, not this one.
    if (!extendsSelection && !isFromControl(e, cell)) {
      this.ctx.activateRow(colIndex);
    }
  }

  mouseDown(e: MouseEvent, rowIndex: number, colIndex: number): void {
    if (e.button !== 0) return;
    if (e.shiftKey) return;
    // Ctrl+Click: focus without starting a drag or clearing the selection.
    if (e.ctrlKey || e.metaKey) {
      this.ctx.host.focus({ preventScroll: true });
      e.preventDefault();
      return;
    }

    this.pressing = true;
    this.dragged = false;

    this.ctx.commitEdit();
    this.ctx.selection.setActive(rowIndex, colIndex);
    this.ctx.setActiveCell({ row: rowIndex, col: colIndex });

    this.ctx.host.focus({ preventScroll: true });
    // Stop the browser's own text selection from following the drag.
    e.preventDefault();

    const onMouseUp = () => {
      this.pressing = false;
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mouseup', onMouseUp);
    this.ctx.invalidate();
  }

  mouseEnter(rowIndex: number, colIndex: number): void {
    if (!this.pressing) return;

    this.dragged = true;
    this.ctx.selection.setActiveWithRange(rowIndex, colIndex);
    this.syncFromSelection();
    this.dispatchSelection();
    this.ctx.invalidate();
  }

  /** A row number selects the whole row. */
  rowNumberClick(rowIndex: number, lastCol: number): void {
    // The click that follows a real row-drag reorder is not a select intent.
    if (this.ctx.consumeRowDrag()) return;
    this.ctx.commitEdit();
    this.ctx.selection.setActive(rowIndex, 0);
    this.ctx.selection.setActiveWithRange(rowIndex, lastCol);
    this.syncFromSelection();
    this.dispatchSelection();
    this.ctx.invalidate();
  }

  doubleClick(rowIndex: number, colIndex: number): void {
    this.ctx.commitEdit();
    this.ctx.selection.setActive(rowIndex, colIndex);
    this.syncFromSelection();
    this.dispatchSelection();
    this.ctx.startEdit();
  }

  /** Selects every row of visible column `colIndex`. */
  selectColumn(colIndex: number): void {
    const rowCount = this.ctx.rowCount();
    if (rowCount === 0 || colIndex < 0) return;

    this.ctx.selection.setActive(0, colIndex);
    this.ctx.selection.setActiveWithRange(rowCount - 1, colIndex);
    this.ctx.setActiveCell({ row: 0, col: colIndex });
    this.ctx.invalidate();

    this.ctx.emitColumnSelect({ colIndex, key: this.ctx.columnKey(colIndex), rowCount });
  }

  /** Scrolls the active cell into view. */
  scrollToActive(): void {
    const ac = this.ctx.activeCell();
    if (!ac) return;
    const { host } = this.ctx;

    const rowTop = ac.row * this.ctx.rowHeight() + this.ctx.headerHeight();
    const rowBottom = rowTop + this.ctx.rowHeight();

    // Frozen rows are always visible — only the horizontal scroll below applies to them.
    if (ac.row < this.ctx.frozenRowCount()) {
      // nothing to scroll vertically
    } else if (rowTop < host.scrollTop + this.ctx.headerHeight() + this.ctx.frozenRowsHeight()) {
      host.scrollTop = rowTop - this.ctx.headerHeight() - this.ctx.frozenRowsHeight();
    } else if (rowBottom > host.scrollTop + host.clientHeight) {
      host.scrollTop = rowBottom - host.clientHeight;
    }

    this.scrollColumnIntoView(ac.col);
  }

  /** Scrolls horizontally so the visible column at `colIndex` is in view — from the cached column offsets. */
  scrollColumnIntoView(colIndex: number): void {
    const { host } = this.ctx;
    const colLeft = this.ctx.colLeftOffsets()[colIndex] ?? 0;
    const colRight = colLeft + this.ctx.colWidth(colIndex);

    // 논리 스크롤(시작 가장자리에서의 거리) 로 판정하고 브라우저 규약(RTL 은 끝으로 갈수록 음수)으로 쓴다.
    const sign = (this.ctx.isRtl?.() ?? false) ? -1 : 1;
    const start = Math.abs(host.scrollLeft);
    if (colLeft < start) {
      host.scrollLeft = sign * colLeft;
    } else if (colRight > start + host.clientWidth) {
      host.scrollLeft = sign * (colRight - host.clientWidth);
    }
  }
}
