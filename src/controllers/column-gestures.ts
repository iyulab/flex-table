import type { ColumnDefinition } from '../models/types.js';
import type { FlexTableEventMap } from '../events.js';
import { DEFAULT_COL_WIDTH, MIN_COL_WIDTH } from '../core/column-width.js';

/** What the column gestures need from the table — the controller owns the drag and resize state, the table owns the rest. */
export interface ColumnGesturesContext {
  host: HTMLElement;
  root(): ShadowRoot | null;
  /** The visible columns, in display order. */
  columns(): ColumnDefinition[];
  /** Widths the user set (resize, auto-fit, a restored view) — the table reads the same map when it lays out. */
  widths: Map<string, number>;
  colWidth(col: ColumnDefinition): number;
  /** Left edge of each visible column in content coordinates. */
  colLeftOffsets(): number[];
  scrollLeft(): number;
  /** Width of the row-number and checkbox columns in front of the data columns. */
  prefixWidth(): number;
  /** Reports a finished resize: the `column-resize` event and the saved-view event. */
  emitResize(detail: FlexTableEventMap['column-resize']['detail']): void;
  moveColumn(key: string, newIndex: number): void;
  /** The browser sends a click after a drag; the header must not read it as a sort. */
  markHeaderDrag(): void;
  invalidate(): void;
}

export interface ColumnDrag {
  col: ColumnDefinition;
  colIndex: number;
  startX: number;
  ghost: HTMLElement | null;
  active: boolean;
  targetIndex: number;
}

/** Column resize (drag, auto-fit) and column drag-reorder — the gestures on the header. */
export class ColumnGestures {
  resizing: { colIndex: number; startX: number; startWidth: number } | null = null;
  resizeCleanup: (() => void) | null = null;
  colDrag: ColumnDrag | null = null;
  /** Left of the drop marker while a column is dragged, in header coordinates. */
  dragIndicatorLeft: number | null = null;

  constructor(private readonly ctx: ColumnGesturesContext) {}

  /** Size a column to its widest rendered content — the resize handle's double-click and the column menu. */
  autoFit(key: string): void {
    const colIndex = this.ctx.columns().findIndex(c => c.key === key);
    const col = this.ctx.columns()[colIndex];
    if (!col) return;

    // Measure content widths by scanning visible cells using data-col-index attribute
    const cells = this.ctx.root()?.querySelectorAll(`.ft-cell[data-col-index="${colIndex}"]`);
    let maxWidth = 0;

    // Measure header text width using data-col-index attribute
    const headerCell = this.ctx.root()?.querySelector(`.ft-header-cell[data-col-index="${colIndex}"]`) as HTMLElement | null;
    if (headerCell) {
      maxWidth = Math.max(maxWidth, headerCell.scrollWidth);
    }

    // Measure data cell widths
    if (cells) {
      for (const cell of cells) {
        const el = cell as HTMLElement;
        maxWidth = Math.max(maxWidth, el.scrollWidth);
      }
    }

    // Apply with padding and minimum
    const minW = col.minWidth ?? MIN_COL_WIDTH;
    const newWidth = Math.max(minW, maxWidth + 8); // 8px buffer
    this.ctx.widths.set(col.key, newWidth);
    this.ctx.invalidate();

    this.ctx.emitResize({ key: col.key, width: newWidth, colIndex });
  }

  startResize(e: MouseEvent, colIndex: number): void {
    e.preventDefault();
    e.stopPropagation(); // Prevent sort toggle

    const col = this.ctx.columns()[colIndex];
    const startWidth = this.ctx.widths.get(col.key) ?? col.width ?? DEFAULT_COL_WIDTH;
    this.resizing = { colIndex, startX: e.clientX, startWidth };

    const onMouseMove = (ev: MouseEvent) => {
      if (!this.resizing) return;
      const delta = ev.clientX - this.resizing.startX;
      const minW = col.minWidth ?? MIN_COL_WIDTH;
      const newWidth = Math.max(minW, this.resizing.startWidth + delta);
      this.ctx.widths.set(col.key, newWidth);
      this.ctx.invalidate();
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this.resizeCleanup = null;
    };

    const onMouseUp = () => {
      cleanup();

      if (this.resizing) {
        const finalWidth = this.ctx.widths.get(col.key) ?? DEFAULT_COL_WIDTH;
        this.ctx.emitResize({ key: col.key, width: finalWidth, colIndex });
        this.resizing = null;
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    this.resizeCleanup = cleanup;
  }

  // --- Column drag reorder ---

  headerMouseDown(e: MouseEvent, col: ColumnDefinition, colIndex: number): void {
    if (e.button !== 0) return;
    e.preventDefault();

    this.colDrag = { col, colIndex, startX: e.clientX, ghost: null, active: false, targetIndex: colIndex };

    const onMouseMove = (ev: MouseEvent) => {
      if (!this.colDrag) return;
      const dx = Math.abs(ev.clientX - this.colDrag.startX);
      if (!this.colDrag.active && dx > 5) {
        this.colDrag.active = true;
        this.startGhost(ev);
        this.ctx.invalidate();
      }
      if (this.colDrag.active) {
        this.updateDrag(ev);
      }
    };

    const onMouseUp = (_ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (this.colDrag?.active) {
        this.ctx.markHeaderDrag();
        this.finishDrag();
      }
      if (this.colDrag?.ghost) {
        this.colDrag.ghost.remove();
      }
      this.colDrag = null;
      this.dragIndicatorLeft = null;
      this.ctx.invalidate();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  private startGhost(e: MouseEvent): void {
    const ghost = document.createElement('div');
    ghost.textContent = this.colDrag!.col.label ?? this.colDrag!.col.key;
    ghost.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:var(--u-layer-overlay, 9999)',
      'opacity:0.85',
      `background:${getComputedStyle(this.ctx.host).getPropertyValue('--ft-header-bg') || '#f0f0f0'}`,
      `border:2px solid ${getComputedStyle(this.ctx.host).getPropertyValue('--ft-active-color') || '#3b82f6'}`,
      'padding:4px 10px',
      'border-radius:4px',
      'font-size:13px',
      'font-weight:600',
      'white-space:nowrap',
      `left:${e.clientX + 12}px`,
      `top:${e.clientY - 14}px`,
    ].join(';');
    document.body.appendChild(ghost);
    this.colDrag!.ghost = ghost;
  }

  private updateDrag(e: MouseEvent): void {
    if (!this.colDrag) return;

    if (this.colDrag.ghost) {
      this.colDrag.ghost.style.left = `${e.clientX + 12}px`;
      this.colDrag.ghost.style.top = `${e.clientY - 14}px`;
    }

    const rect = this.ctx.host.getBoundingClientRect();
    const scrollLeft = this.ctx.scrollLeft();
    const cols = this.ctx.columns();
    const mouseX = e.clientX - rect.left + scrollLeft;

    let targetIndex = cols.length;
    for (let i = 0; i < cols.length; i++) {
      const midpoint = (this.ctx.colLeftOffsets()[i] ?? 0) + this.ctx.colWidth(cols[i]) / 2;
      if (mouseX < midpoint) { targetIndex = i; break; }
    }

    if (this.colDrag.colIndex < targetIndex) targetIndex--;

    this.colDrag.targetIndex = targetIndex;
    const indicatorColIndex = targetIndex < cols.length ? targetIndex : cols.length - 1;
    const indicatorOffset = targetIndex < cols.length
      ? (this.ctx.colLeftOffsets()[indicatorColIndex] ?? 0)
      : (this.ctx.colLeftOffsets()[indicatorColIndex] ?? 0) + this.ctx.colWidth(cols[indicatorColIndex]);
    this.dragIndicatorLeft = indicatorOffset - scrollLeft + this.ctx.prefixWidth();
    this.ctx.invalidate();
  }

  private finishDrag(): void {
    if (!this.colDrag) return;
    const { col, colIndex, targetIndex } = this.colDrag;
    if (targetIndex !== colIndex) {
      this.ctx.moveColumn(col.key, targetIndex);
    }
  }
}
