import type { FlexTableEventMap } from '../events.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';

/** What the row reorder needs from the table — the controller owns the drag, the table owns the rows. */
export interface RowReorderContext {
  host: HTMLElement;
  /** The visible columns, in display order — the first one labels the drag ghost. */
  columns(): ColumnDefinition[];
  data(): DataRow[];
  /** Replaces the table's rows (a new array: the table reads `data` as a property). */
  setData(rows: DataRow[]): void;
  /** Rows on show (after filter and sort, before paging). */
  rowCount(): number;
  /** Data index of a visual row. */
  dataIndex(visualRow: number): number;
  rowHeight(): number;
  headerHeight(): number;
  /** A pointer's `clientY` in row space (header and scroll taken off). */
  rowSpaceY(clientY: number): number;
  /** Where the boundary above visual row `index` sits in the viewport. */
  rowBoundaryViewportY(index: number): number;
  /** The browser sends a click after a drag; the row number must not read it as selecting the row. */
  markRowDrag(): void;
  /** Puts an undoable step on the table's stack and tells listeners the undo state moved. */
  pushUndo(step: { label: string; undo: () => void; redo: () => void }): void;
  emitReorder(detail: FlexTableEventMap['row-reorder']['detail']): void;
  invalidate(): void;
}

export interface RowDrag {
  rowIndex: number;
  startY: number;
  ghost: HTMLElement | null;
  active: boolean;
  targetIndex: number;
}

/** Drag a row by its number to move it — the ghost, the drop marker and the undoable move. */
export class RowReorderController {
  drag: RowDrag | null = null;
  /** Viewport Y of the drop marker while a row is dragged. */
  indicatorY: number | null = null;

  constructor(private readonly ctx: RowReorderContext) {}

  /** Whether the row at this visual index is the one being dragged — the row number draws it dimmed. */
  isDragging(rowIndex: number): boolean {
    return !!this.drag?.active && this.drag.rowIndex === rowIndex;
  }

  onNumMouseDown(e: MouseEvent, rowIndex: number): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    this.drag = { rowIndex, startY: e.clientY, ghost: null, active: false, targetIndex: rowIndex };

    const onMouseMove = (ev: MouseEvent) => {
      if (!this.drag) return;
      const dy = Math.abs(ev.clientY - this.drag.startY);
      if (!this.drag.active && dy > 5) {
        this.drag.active = true;
        this.startGhost(ev, rowIndex);
        this.ctx.invalidate();
      }
      if (this.drag.active) this.update(ev);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (this.drag?.active) {
        this.ctx.markRowDrag();
        this.finish();
      }
      if (this.drag?.ghost) this.drag.ghost.remove();
      this.drag = null;
      this.indicatorY = null;
      this.ctx.invalidate();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  private startGhost(e: MouseEvent, rowIndex: number): void {
    const dataIndex = this.ctx.dataIndex(rowIndex);
    const row = this.ctx.data()[dataIndex];
    const first = this.ctx.columns()[0];
    const label = first
      ? String(row[first.key] ?? dataIndex + 1)
      : String(dataIndex + 1);
    const ghost = document.createElement('div');
    ghost.textContent = label;
    ghost.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:var(--u-layer-overlay, 9999)',
      'opacity:0.85',
      'background:#e8f0fe',
      'border:2px solid #3b82f6',
      'padding:3px 10px',
      'border-radius:3px',
      'font-size:12px',
      'white-space:nowrap',
      `left:${e.clientX + 12}px`,
      `top:${e.clientY - 10}px`,
    ].join(';');
    document.body.appendChild(ghost);
    this.drag!.ghost = ghost;
  }

  private update(e: MouseEvent): void {
    if (!this.drag) return;
    if (this.drag.ghost) {
      this.drag.ghost.style.left = `${e.clientX + 12}px`;
      this.drag.ghost.style.top = `${e.clientY - 10}px`;
    }

    const rect = this.ctx.host.getBoundingClientRect();
    const mouseY = this.ctx.rowSpaceY(e.clientY);

    let targetIndex = Math.round(mouseY / this.ctx.rowHeight());
    targetIndex = Math.max(0, Math.min(this.ctx.rowCount(), targetIndex));
    if (this.drag.rowIndex < targetIndex) targetIndex--;

    this.drag.targetIndex = targetIndex;
    const indicatorY = this.ctx.rowBoundaryViewportY(targetIndex);
    this.indicatorY = Math.max(this.ctx.headerHeight(), Math.min(indicatorY, rect.height));
    this.ctx.invalidate();
  }

  /** Moves the dragged row to its drop place as one undoable step. */
  finish(): void {
    if (!this.drag) return;
    const { rowIndex, targetIndex } = this.drag;
    if (targetIndex === rowIndex) return;

    const fromDataIdx = this.ctx.dataIndex(rowIndex);
    const toDataIdx = this.ctx.dataIndex(targetIndex);
    const oldData = [...this.ctx.data()];
    const newData = [...this.ctx.data()];
    const [moved] = newData.splice(fromDataIdx, 1);
    newData.splice(toDataIdx, 0, moved);
    this.ctx.setData(newData);

    this.ctx.pushUndo({
      label: 'row-reorder',
      undo: () => { this.ctx.setData([...oldData]); this.ctx.invalidate(); },
      redo: () => { this.ctx.setData([...newData]); this.ctx.invalidate(); },
    });
    this.ctx.emitReorder({ from: fromDataIdx, to: toDataIdx });
  }
}
