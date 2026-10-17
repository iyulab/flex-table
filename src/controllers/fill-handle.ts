import { html, type TemplateResult } from 'lit';
import { getCellValue, setCellValue } from '../core/cell-value.js';
import type { CellRange, SelectionState } from '../core/selection.js';
import type { FlexTableEventMap } from '../events.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';

/** What the fill handle needs from the table — the controller owns the drag and the fill, the table owns everything else. */
export interface FillHandleContext {
  host: HTMLElement;
  /** The visible columns, in display order. */
  columns(): ColumnDefinition[];
  data(): DataRow[];
  /** Rows on show (after filter and sort, before paging). */
  rowCount(): number;
  /** Data index of a visual row. */
  dataIndex(visualRow: number): number;
  isEditable(col: ColumnDefinition, row: DataRow | undefined): boolean;
  /** Whether the table as a whole accepts changes — the handle is not drawn without it. */
  editable(): boolean;
  selection: SelectionState;
  rowHeight(): number;
  headerHeight(): number;
  scrollLeft(): number;
  scrollTop(): number;
  /** Width of the row-number and checkbox columns in front of the data columns. */
  prefixWidth(): number;
  /** Left edge of each visible column in content coordinates. */
  colLeftOffsets(): number[];
  colWidth(col: ColumnDefinition): number;
  /** A pointer's `clientY` in row space (header and scroll taken off). */
  rowSpaceY(clientY: number): number;
  /** Puts an undoable step on the table's stack and tells listeners the undo state moved. */
  pushUndo(step: { label: string; undo: () => void; redo: () => void }): void;
  emitApply(detail: FlexTableEventMap['fill-handle-apply']['detail']): void;
  invalidate(): void;
}

interface FillDrag {
  sourceRange: CellRange;
  targetRange: CellRange | null;
  active: boolean;
}

/** The fill handle at the selection's corner: drag it over neighbouring cells to repeat the selection, or continue a numeric series. */
export class FillHandleController {
  private drag: FillDrag | null = null;

  constructor(private readonly ctx: FillHandleContext) {}

  /** Copies the source block's values over the target range (a numeric series continues) as one undoable step. */
  apply(sourceRange: CellRange, targetRange: CellRange): void {
    const cols = this.ctx.columns();
    const data = this.ctx.data();
    const saved: Array<{ dataRow: number; key: string; oldValue: unknown; newValue: unknown }> = [];
    const targets: DataRow[] = [];

    for (let c = targetRange.startCol; c <= targetRange.endCol; c++) {
      const col = cols[c];
      const srcRows = [];
      for (let r = sourceRange.startRow; r <= sourceRange.endRow; r++) {
        srcRows.push(getCellValue(data[this.ctx.dataIndex(r)], col.key));
      }
      const series = detectNumericSeries(srcRows);

      for (let r = targetRange.startRow; r <= targetRange.endRow; r++) {
        if (r >= sourceRange.startRow && r <= sourceRange.endRow) continue;
        const dataRow = this.ctx.dataIndex(r);
        if (!this.ctx.isEditable(col, data[dataRow])) continue;
        const oldValue = getCellValue(data[dataRow], col.key);
        let newValue: unknown;
        if (series && r > sourceRange.endRow) {
          const step = r - sourceRange.endRow;
          const lastSrc = series.last + series.diff * step;
          newValue = col.type === 'number' ? lastSrc : String(lastSrc);
        } else {
          const srcIdx = (r - sourceRange.startRow) % srcRows.length;
          const normalizedIdx = srcIdx < 0 ? srcIdx + srcRows.length : srcIdx;
          newValue = srcRows[normalizedIdx];
        }
        setCellValue(data[dataRow], col.key, newValue);
        saved.push({ dataRow, key: col.key, oldValue, newValue });
        targets.push(data[dataRow]);
      }
    }

    if (saved.length > 0) {
      this.ctx.pushUndo({
        label: 'fill-handle',
        undo: () => { saved.forEach((s, i) => { setCellValue(targets[i], s.key, s.oldValue); }); this.ctx.invalidate(); },
        redo: () => { saved.forEach((s, i) => { setCellValue(targets[i], s.key, s.newValue); }); this.ctx.invalidate(); },
      });
      this.ctx.emitApply({ sourceRange, targetRange, cells: saved });
    }
    this.ctx.invalidate();
  }

  /** The handle (and, while dragging, the dashed preview of the range it would fill) — nothing when the table cannot change. */
  render(): TemplateResult | '' {
    if (!this.ctx.editable()) return '';
    const range = this.ctx.selection.getEffectiveRange();
    if (!range) return '';
    const cols = this.ctx.columns();
    if (range.endCol >= cols.length || range.endRow >= this.ctx.rowCount()) return '';

    const offsets = this.ctx.colLeftOffsets();
    const left = (offsets[range.endCol] ?? 0) + this.ctx.colWidth(cols[range.endCol]) - this.ctx.scrollLeft() - 4;
    const top = this.ctx.headerHeight() + (range.endRow + 1) * this.ctx.rowHeight() - this.ctx.scrollTop() - 4;

    if (left < 0 || top < this.ctx.headerHeight()) return '';

    // Preview dashed border during drag
    const preview = this.drag?.active && this.drag.targetRange
      ? this.renderPreview(this.drag.targetRange)
      : '';

    return html`
      ${preview}
      <div class="ft-fill-handle"
        style="left:${left}px;top:${top}px;"
        @mousedown=${(e: MouseEvent) => this.onMouseDown(e)}>
      </div>
    `;
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const sourceRange = this.ctx.selection.getEffectiveRange();
    if (!sourceRange) return;

    this.drag = { sourceRange, targetRange: null, active: false };

    const onMouseMove = (ev: MouseEvent) => {
      if (!this.drag) return;
      this.drag.active = true;
      this.updateDrag(ev);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (this.drag?.active && this.drag.targetRange) {
        this.apply(this.drag.sourceRange, this.drag.targetRange);
      }
      this.drag = null;
      this.ctx.invalidate();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  private updateDrag(e: MouseEvent): void {
    if (!this.drag) return;
    const rect = this.ctx.host.getBoundingClientRect();
    const mx = e.clientX - rect.left + this.ctx.scrollLeft() - this.ctx.prefixWidth();
    const my = this.ctx.rowSpaceY(e.clientY);
    const offsets = this.ctx.colLeftOffsets();
    const cols = this.ctx.columns();

    let colIdx = 0;
    for (let i = 0; i < cols.length; i++) {
      if ((offsets[i] ?? 0) <= mx) colIdx = i;
    }
    const rowIdx = Math.max(0, Math.min(this.ctx.rowCount() - 1, Math.floor(my / this.ctx.rowHeight())));

    const { sourceRange: src } = this.drag;
    const dRow = rowIdx - src.endRow;
    const dCol = colIdx - src.endCol;

    let target: CellRange;
    if (Math.abs(dRow) >= Math.abs(dCol)) {
      if (dRow >= 0) {
        target = { ...src, endRow: rowIdx };
      } else {
        target = { ...src, startRow: Math.min(rowIdx, src.startRow) };
      }
    } else {
      if (dCol >= 0) {
        target = { ...src, endCol: colIdx };
      } else {
        target = { ...src, startCol: Math.min(colIdx, src.startCol) };
      }
    }
    this.drag.targetRange = target;
    this.ctx.invalidate();
  }

  private renderPreview(range: CellRange): TemplateResult | '' {
    const cols = this.ctx.columns();
    if (range.endCol >= cols.length || range.endRow >= this.ctx.rowCount()) return '';
    const offsets = this.ctx.colLeftOffsets();
    const left = (offsets[range.startCol] ?? 0) - this.ctx.scrollLeft();
    const top = this.ctx.headerHeight() + range.startRow * this.ctx.rowHeight() - this.ctx.scrollTop();
    const width = (offsets[range.endCol] ?? 0) + this.ctx.colWidth(cols[range.endCol]) - (offsets[range.startCol] ?? 0);
    const height = (range.endRow - range.startRow + 1) * this.ctx.rowHeight();
    return html`<div class="ft-fill-preview" style="left:${left}px;top:${top}px;width:${width}px;height:${height}px;"></div>`;
  }
}

/** An arithmetic series in the source values (two or more numbers with one constant step), or `null`. */
function detectNumericSeries(values: unknown[]): { last: number; diff: number } | null {
  if (values.length < 2) return null;
  const nums = values.map(v => Number(v));
  if (nums.some(n => isNaN(n))) return null;
  const diff = nums[1] - nums[0];
  for (let i = 2; i < nums.length; i++) {
    if (Math.abs(nums[i] - nums[i - 1] - diff) > 1e-9) return null;
  }
  return { last: nums[nums.length - 1], diff };
}
