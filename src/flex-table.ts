import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { flexTableStyles } from './styles/flex-table.styles.js';
import { renderCell } from './renderers/cell-renderer.js';
import { SelectionState } from './core/selection.js';
import { EditingState } from './core/editing.js';
import { computeSortedIndices, toggleSort } from './core/sorting.js';
import { computeFilteredIndices } from './core/filtering.js';
import { UndoStack } from './core/undo.js';
import { copyToClipboard, parseClipboardText, parseValueForColumn } from './clipboard/clipboard.js';
import { exportData, downloadFile, getExportMimeType, getExportExtension } from './export/export.js';
import type { ExportFormat } from './export/export.js';
import type { CellPosition } from './core/selection.js';
import type { SortCriteria } from './core/sorting.js';
import type { ColumnFilter, FilterPredicate } from './core/filtering.js';
import type { ColumnDefinition, DataRow } from './models/types.js';

const DEFAULT_COL_WIDTH = 120;
const MIN_COL_WIDTH = 40;
const DEFAULT_ROW_HEIGHT = 32;
const OVERSCAN = 5;

@customElement('flex-table')
export class FlexTable extends LitElement {
  static styles = flexTableStyles;

  @property({ type: Array })
  columns: ColumnDefinition[] = [];

  @property({ type: Array })
  data: DataRow[] = [];

  @property({ type: Number, attribute: 'row-height' })
  rowHeight: number = DEFAULT_ROW_HEIGHT;

  @property({ type: Boolean, attribute: 'show-row-numbers' })
  showRowNumbers: boolean = false;

  @state()
  private _scrollTop = 0;

  @state()
  private _viewportHeight = 0;

  @state()
  private _activeCell: CellPosition | null = null;

  @state()
  private _editingCell: CellPosition | null = null;

  @state()
  private _sortCriteria: SortCriteria[] = [];

  private _selection = new SelectionState();
  private _editing = new EditingState();
  private _undo = new UndoStack();
  private _filters: ColumnFilter[] = [];
  private _filteredIndices: number[] = [];
  private _sortedIndices: number[] = [];
  private _resizing: { colIndex: number; startX: number; startWidth: number } | null = null;
  private _resizeCleanup: (() => void) | null = null;

  get visibleColumns(): ColumnDefinition[] {
    return this.columns.filter(col => !col.hidden);
  }

  get activeCell(): CellPosition | null {
    return this._activeCell;
  }

  get editingCell(): CellPosition | null {
    return this._editingCell;
  }

  get sortCriteria(): SortCriteria[] {
    return [...this._sortCriteria];
  }

  /** Number of rows after filtering (before pagination). */
  get filteredRowCount(): number {
    return this._filteredIndices.length;
  }

  // --- Public API: Filtering ---

  /**
   * Set a filter for a column. Replaces any existing filter on the same key.
   */
  setFilter(key: string, predicate: FilterPredicate): void {
    this._filters = this._filters.filter(f => f.key !== key);
    this._filters.push({ key, predicate });
    this._recomputeView();
    this.requestUpdate();
    this._dispatchFilterEvent();
  }

  /**
   * Remove the filter for a column.
   */
  removeFilter(key: string): void {
    const before = this._filters.length;
    this._filters = this._filters.filter(f => f.key !== key);
    if (this._filters.length !== before) {
      this._recomputeView();
      this.requestUpdate();
      this._dispatchFilterEvent();
    }
  }

  /**
   * Remove all filters.
   */
  clearFilters(): void {
    if (this._filters.length === 0) return;
    this._filters = [];
    this._recomputeView();
    this.requestUpdate();
    this._dispatchFilterEvent();
  }

  /**
   * Get current active filter keys.
   */
  get filterKeys(): string[] {
    return this._filters.map(f => f.key);
  }

  private _dispatchFilterEvent(): void {
    this.dispatchEvent(new CustomEvent('filter-change', {
      detail: { keys: this.filterKeys, filteredCount: this.filteredRowCount },
      bubbles: true,
      composed: true,
    }));
  }

  // --- Public API: Row Operations ---

  /**
   * Add a row at the specified index (default: end).
   * Returns the new row.
   */
  addRow(row?: DataRow, index?: number): DataRow {
    const newRow: DataRow = row ?? this._createEmptyRow();
    const insertAt = index ?? this.data.length;
    this.data.splice(insertAt, 0, newRow);

    this._undo.push({
      label: 'row-add',
      undo: () => {
        this.data.splice(insertAt, 1);
        this.requestUpdate();
      },
      redo: () => {
        this.data.splice(insertAt, 0, newRow);
        this.requestUpdate();
      },
    });

    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('row-add', {
      detail: { row: newRow, index: insertAt },
      bubbles: true,
      composed: true,
    }));

    return newRow;
  }

  /**
   * Delete rows at the specified data indices.
   * If no indices provided, deletes the currently selected rows.
   */
  deleteRows(indices?: number[]): void {
    const toDelete = indices ?? this._getSelectedDataRows();
    if (toDelete.length === 0) return;

    // Sort descending so splice doesn't shift later indices
    const sorted = [...toDelete].sort((a, b) => b - a);

    // Save deleted rows for undo
    const deleted: Array<{ index: number; row: DataRow }> = [];
    for (const idx of sorted) {
      if (idx >= 0 && idx < this.data.length) {
        deleted.push({ index: idx, row: this.data[idx] });
        this.data.splice(idx, 1);
      }
    }

    if (deleted.length === 0) return;

    // Reverse so undo re-inserts in original order (ascending index)
    deleted.reverse();

    this._undo.push({
      label: 'row-delete',
      undo: () => {
        for (const { index, row } of deleted) {
          this.data.splice(index, 0, row);
        }
        this.requestUpdate();
      },
      redo: () => {
        const re = [...deleted].reverse();
        for (const { index } of re) {
          this.data.splice(index, 1);
        }
        this.requestUpdate();
      },
    });

    // Clear selection if active cell is in deleted range
    if (this._activeCell) {
      const activeDR = this._toDataIndex(this._activeCell.row);
      if (toDelete.includes(activeDR)) {
        this._selection.clear();
        this._activeCell = null;
      }
    }

    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('row-delete', {
      detail: { indices: deleted.map(d => d.index), rows: deleted.map(d => d.row) },
      bubbles: true,
      composed: true,
    }));
  }

  private _createEmptyRow(): DataRow {
    const row: DataRow = {};
    for (const col of this.columns) {
      switch (col.type) {
        case 'number': row[col.key] = 0; break;
        case 'boolean': row[col.key] = false; break;
        default: row[col.key] = '';
      }
    }
    return row;
  }

  // --- Public API: Export ---

  /**
   * Export table data to string in the specified format.
   */
  exportToString(format: ExportFormat): string {
    const visibleData = this._sortedIndices.map(i => this.data[i]);
    return exportData(visibleData, this.visibleColumns, format);
  }

  /**
   * Export table data and trigger file download.
   */
  exportToFile(format: ExportFormat, filename?: string): void {
    const content = this.exportToString(format);
    const name = filename ?? `export${getExportExtension(format)}`;
    downloadFile(content, name, getExportMimeType(format));
  }

  private _getSelectedDataRows(): number[] {
    const range = this._selection.getEffectiveRange();
    if (!range) return [];
    const rows: number[] = [];
    for (let r = range.startRow; r <= range.endRow; r++) {
      rows.push(this._toDataIndex(r));
    }
    return rows;
  }

  private get gridTemplateColumns(): string {
    const cols = this.visibleColumns
      .map(col => {
        const w = col.width ?? DEFAULT_COL_WIDTH;
        const min = col.minWidth ?? MIN_COL_WIDTH;
        return `minmax(${min}px, ${w}px)`;
      })
      .join(' ');
    return this.showRowNumbers ? `48px ${cols}` : cols;
  }

  private get headerHeight(): number {
    return this.rowHeight + 8;
  }

  /** Number of rows visible after filter + sort. */
  private get _visibleRowCount(): number {
    return this._sortedIndices.length;
  }

  private get totalBodyHeight(): number {
    return this._visibleRowCount * this.rowHeight;
  }

  private get visibleRange(): { start: number; end: number } {
    const scrollTop = Math.max(0, this._scrollTop - this.headerHeight);
    const start = Math.max(0, Math.floor(scrollTop / this.rowHeight) - OVERSCAN);
    const visibleCount = Math.ceil(this._viewportHeight / this.rowHeight);
    const end = Math.min(this._visibleRowCount, Math.floor(scrollTop / this.rowHeight) + visibleCount + OVERSCAN);
    return { start, end };
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._onScroll = this._onScroll.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this.addEventListener('scroll', this._onScroll, { passive: true });
    this.addEventListener('keydown', this._onKeyDown);

    if (!this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0');
    }
    this.setAttribute('role', 'grid');
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('scroll', this._onScroll);
    this.removeEventListener('keydown', this._onKeyDown);
    // Clean up any in-progress resize listeners
    if (this._resizeCleanup) {
      this._resizeCleanup();
      this._resizeCleanup = null;
    }
  }

  protected firstUpdated(): void {
    this._measureViewport();
  }

  protected willUpdate(): void {
    // Always recompute: data is often mutated in-place (splice, direct assignment)
    // which doesn't trigger Lit's change detection
    this._recomputeView();
    this._selection.setDimensions(this._visibleRowCount, this.visibleColumns.length);
  }

  protected updated(): void {
    this._measureViewport();
    this._focusEditor();
    // Update ARIA live attributes
    this.setAttribute('aria-rowcount', String(this._visibleRowCount));
    this.setAttribute('aria-colcount', String(this.visibleColumns.length));
  }

  /** Recompute filter → sort pipeline. */
  private _recomputeView(): void {
    this._filteredIndices = computeFilteredIndices(this.data, this._filters);
    // Build filtered data subset for sorting
    if (this._filters.length === 0 && this._sortCriteria.length === 0) {
      this._sortedIndices = Array.from({ length: this.data.length }, (_, i) => i);
    } else if (this._sortCriteria.length === 0) {
      this._sortedIndices = [...this._filteredIndices];
    } else {
      // Sort only the filtered subset
      const filteredData = this._filteredIndices.map(i => this.data[i]);
      const sortedOfFiltered = computeSortedIndices(filteredData, this._sortCriteria, this.visibleColumns);
      // Map sorted filtered indices back to original data indices
      this._sortedIndices = sortedOfFiltered.map(si => this._filteredIndices[si]);
    }
  }

  /** Map visual row index to data row index */
  private _toDataIndex(visualRow: number): number {
    return this._sortedIndices[visualRow] ?? visualRow;
  }

  private _focusEditor(): void {
    if (!this._editingCell) return;
    const input = this.shadowRoot?.querySelector('.ft-editor') as HTMLInputElement | null;
    if (input && document.activeElement !== input) {
      input.focus();
      if (input.type === 'text' || input.type === 'number') {
        input.select();
      }
    }
  }

  private _measureViewport(): void {
    const h = this.clientHeight;
    if (h !== this._viewportHeight) {
      this._viewportHeight = h;
    }
  }

  private _onScroll(): void {
    this._scrollTop = this.scrollTop;
  }

  private _onCellClickEvent(e: MouseEvent, rowIndex: number, colIndex: number): void {
    if (this._editing.current) {
      this._commitEdit();
    }
    if (e.shiftKey) {
      this._selection.setActiveWithRange(rowIndex, colIndex);
    } else {
      this._selection.setActive(rowIndex, colIndex);
    }
    this._activeCell = this._selection.activeCell ? { ...this._selection.activeCell } : null;
    this._dispatchSelectionEvent();
    this.requestUpdate();
  }

  private _onRowNumberClick(rowIndex: number): void {
    if (this._editing.current) {
      this._commitEdit();
    }
    const lastCol = this.visibleColumns.length - 1;
    this._selection.setActive(rowIndex, 0);
    this._selection.setActiveWithRange(rowIndex, lastCol);
    this._activeCell = this._selection.activeCell ? { ...this._selection.activeCell } : null;
    this._dispatchSelectionEvent();
    this.requestUpdate();
  }

  private _onCellDblClick(rowIndex: number, colIndex: number): void {
    if (this._editing.current) {
      this._commitEdit();
    }
    this._selection.setActive(rowIndex, colIndex);
    this._activeCell = this._selection.activeCell ? { ...this._selection.activeCell } : null;
    this._dispatchSelectionEvent();
    this._startEdit();
  }

  // --- Editing ---

  private _startEdit(): void {
    if (!this._activeCell) return;
    const cols = this.visibleColumns;
    const col = cols[this._activeCell.col];
    if (!col) return;

    // Boolean: toggle immediately, don't enter edit mode
    if (col.type === 'boolean') {
      const row = this.data[this._toDataIndex(this._activeCell.row)];
      const currentValue = row[col.key];
      this._applyEdit(!currentValue);
      return;
    }

    const row = this.data[this._toDataIndex(this._activeCell.row)];
    this._editing.start(this._activeCell, row[col.key]);
    this._editingCell = { ...this._activeCell };
  }

  private _commitEdit(): void {
    if (!this._editing.current) return;
    const input = this.shadowRoot?.querySelector('.ft-editor') as HTMLInputElement | null;
    if (input) {
      const col = this.visibleColumns[this._editing.current.position.col];
      const newValue = parseValueForColumn(input.value, col);
      this._applyEdit(newValue);
    } else {
      this._cancelEdit();
    }
  }

  private _applyEdit(newValue: unknown): void {
    const editState = this._editing.commit();
    this._editingCell = null;
    if (!editState) return;

    const { row, col } = editState.position;
    const dataRow = this._toDataIndex(row);
    const colDef = this.visibleColumns[col];
    const oldValue = editState.originalValue;

    // Mutate data
    this.data[dataRow][colDef.key] = newValue;

    // Push undo action
    this._undo.push({
      label: 'cell-edit',
      undo: () => {
        this.data[dataRow][colDef.key] = oldValue;
        this.requestUpdate();
      },
      redo: () => {
        this.data[dataRow][colDef.key] = newValue;
        this.requestUpdate();
      },
    });

    this.requestUpdate();

    this.dispatchEvent(new CustomEvent('cell-edit-commit', {
      detail: { row: dataRow, col, key: colDef.key, oldValue, newValue },
      bubbles: true,
      composed: true,
    }));
  }

  private _cancelEdit(): void {
    const editState = this._editing.cancel();
    this._editingCell = null;
    if (editState) {
      this.dispatchEvent(new CustomEvent('cell-edit-cancel', {
        detail: { row: editState.position.row, col: editState.position.col },
        bubbles: true,
        composed: true,
      }));
    }
  }

  private _onEditorKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      this._commitEdit();
      this._selection.moveDown();
      this._syncActiveCell();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      this._commitEdit();
      if (e.shiftKey) {
        this._selection.movePrev();
      } else {
        this._selection.moveNext();
      }
      this._syncActiveCell();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this._cancelEdit();
    }
  }

  private _syncActiveCell(): void {
    this._activeCell = this._selection.activeCell ? { ...this._selection.activeCell } : null;
    this._scrollToActiveCell();
    this._dispatchSelectionEvent();
  }

  // --- Navigation ---

  private _onKeyDown(e: KeyboardEvent): void {
    // If editing, let the editor handle keys
    if (this._editing.current) return;

    const cols = this.visibleColumns;
    if (cols.length === 0 || this._visibleRowCount === 0) return;

    // Enter/F2 to start editing
    if ((e.key === 'Enter' || e.key === 'F2') && this._activeCell) {
      e.preventDefault();
      this._startEdit();
      return;
    }

    // If no active cell, set to first cell on any nav key
    if (!this._selection.activeCell) {
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'].includes(e.key)) {
        this._selection.setActive(0, 0);
        this._syncActiveCell();
        e.preventDefault();
        return;
      }
      return;
    }

    // Ctrl/Cmd shortcuts
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      // Undo: Ctrl+Z
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) {
          this._undo.redo();
        } else {
          this._undo.undo();
        }
        this.requestUpdate();
        return;
      }
      // Redo: Ctrl+Y
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        this._undo.redo();
        this.requestUpdate();
        return;
      }
      // Clipboard
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        this._handleCopy(false);
        return;
      }
      if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        this._handleCopy(true);
        return;
      }
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        this._handlePaste();
        return;
      }
    }

    // Printable character starts editing with that character
    if (this._activeCell && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this._startEdit();
      return;
    }

    let handled = true;
    switch (e.key) {
      case 'ArrowUp':
        e.shiftKey ? this._selection.shiftMoveUp() : this._selection.moveUp();
        break;
      case 'ArrowDown':
        e.shiftKey ? this._selection.shiftMoveDown() : this._selection.moveDown();
        break;
      case 'ArrowLeft':
        e.shiftKey ? this._selection.shiftMoveLeft() : this._selection.moveLeft();
        break;
      case 'ArrowRight':
        e.shiftKey ? this._selection.shiftMoveRight() : this._selection.moveRight();
        break;
      case 'Tab':
        if (e.shiftKey) {
          this._selection.movePrev();
        } else {
          this._selection.moveNext();
        }
        break;
      case 'Home':
        if (e.ctrlKey) {
          this._selection.moveToStart();
        } else {
          this._selection.moveToRowStart();
        }
        break;
      case 'End':
        if (e.ctrlKey) {
          this._selection.moveToEnd();
        } else {
          this._selection.moveToRowEnd();
        }
        break;
      case 'Escape':
        this._selection.clear();
        break;
      case 'Delete':
      case 'Backspace':
        this._handleDelete();
        break;
      default:
        handled = false;
    }

    if (handled) {
      e.preventDefault();
      this._syncActiveCell();
    }
  }

  // --- Clipboard ---

  private async _handleCopy(cut: boolean): Promise<void> {
    const range = this._selection.getEffectiveRange();
    if (!range) return;
    const cols = this.visibleColumns;
    // Use sorted data view for copy so visual order matches
    const sortedData = this._sortedIndices.map(i => this.data[i]);
    const tsv = copyToClipboard(sortedData, cols, range);

    try {
      await navigator.clipboard.writeText(tsv);
    } catch {
      // Fallback: dispatch event with text for external handling
    }

    if (cut) {
      this._clearRange(range);
    }

    this.dispatchEvent(new CustomEvent(cut ? 'clipboard-cut' : 'clipboard-copy', {
      detail: { range, text: tsv },
      bubbles: true,
      composed: true,
    }));
  }

  private async _handlePaste(): Promise<void> {
    if (!this._activeCell) return;
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return;
    }
    const parsed = parseClipboardText(text);
    if (parsed.length === 0) return;

    const cols = this.visibleColumns;
    const changes: Array<{ row: number; col: number; key: string; oldValue: unknown; newValue: unknown }> = [];
    const addedRows: number[] = [];

    // Auto-expand rows if paste exceeds current data bounds
    const requiredRows = this._activeCell.row + parsed.length;
    while (this.data.length < requiredRows) {
      const newRow = this._createEmptyRow();
      const insertAt = this.data.length;
      this.data.push(newRow);
      addedRows.push(insertAt);
    }

    // Recompute view after potential row additions
    if (addedRows.length > 0) {
      this._recomputeView();
    }

    for (let r = 0; r < parsed.length; r++) {
      const visualRow = this._activeCell.row + r;
      if (visualRow >= this._visibleRowCount) break;
      const dataRow = this._toDataIndex(visualRow);
      for (let c = 0; c < parsed[r].length; c++) {
        const colIndex = this._activeCell.col + c;
        if (colIndex >= cols.length) break;
        const col = cols[colIndex];
        const oldValue = this.data[dataRow][col.key];
        const newValue = parseValueForColumn(parsed[r][c], col);
        this.data[dataRow][col.key] = newValue;
        changes.push({ row: dataRow, col: colIndex, key: col.key, oldValue, newValue });
      }
    }

    if (changes.length > 0 || addedRows.length > 0) {
      const addedCount = addedRows.length;
      this._undo.push({
        label: 'paste',
        undo: () => {
          for (const c of changes) { this.data[c.row][c.key] = c.oldValue; }
          // Remove auto-added rows
          if (addedCount > 0) {
            this.data.splice(this.data.length - addedCount, addedCount);
          }
          this.requestUpdate();
        },
        redo: () => {
          // Re-add rows
          if (addedCount > 0) {
            for (let i = 0; i < addedCount; i++) {
              this.data.push(this._createEmptyRow());
            }
          }
          for (const c of changes) { this.data[c.row][c.key] = c.newValue; }
          this.requestUpdate();
        },
      });
    }

    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('clipboard-paste', {
      detail: { changes, addedRows: addedRows.length },
      bubbles: true,
      composed: true,
    }));
  }

  private _handleDelete(): void {
    const range = this._selection.getEffectiveRange();
    if (!range) return;
    this._clearRange(range);
  }

  private _clearRange(range: { startRow: number; startCol: number; endRow: number; endCol: number }): void {
    const cols = this.visibleColumns;
    const saved: Array<{ dataRow: number; key: string; oldValue: unknown; clearValue: unknown }> = [];

    for (let r = range.startRow; r <= range.endRow; r++) {
      const dataRow = this._toDataIndex(r);
      for (let c = range.startCol; c <= range.endCol; c++) {
        const col = cols[c];
        const oldValue = this.data[dataRow][col.key];
        const clearValue = col.type === 'boolean' ? false : col.type === 'number' ? 0 : '';
        this.data[dataRow][col.key] = clearValue;
        saved.push({ dataRow, key: col.key, oldValue, clearValue });
      }
    }

    if (saved.length > 0) {
      this._undo.push({
        label: 'clear',
        undo: () => {
          for (const s of saved) { this.data[s.dataRow][s.key] = s.oldValue; }
          this.requestUpdate();
        },
        redo: () => {
          for (const s of saved) { this.data[s.dataRow][s.key] = s.clearValue; }
          this.requestUpdate();
        },
      });
    }

    this.requestUpdate();
  }

  private _scrollToActiveCell(): void {
    if (!this._activeCell) return;
    const rowTop = this._activeCell.row * this.rowHeight + this.headerHeight;
    const rowBottom = rowTop + this.rowHeight;

    if (rowTop < this.scrollTop + this.headerHeight) {
      this.scrollTop = rowTop - this.headerHeight;
    } else if (rowBottom > this.scrollTop + this.clientHeight) {
      this.scrollTop = rowBottom - this.clientHeight;
    }
  }

  private _dispatchSelectionEvent(): void {
    this.dispatchEvent(new CustomEvent('cell-select', {
      detail: this._activeCell ? { ...this._activeCell } : null,
      bubbles: true,
      composed: true,
    }));
  }

  // --- Sorting ---

  private _onHeaderClick(e: MouseEvent, col: ColumnDefinition): void {
    if (col.sortable === false) return;
    this._sortCriteria = toggleSort(this._sortCriteria, col.key, e.shiftKey);
    this._recomputeView();
    this.requestUpdate();

    this.dispatchEvent(new CustomEvent('sort-change', {
      detail: { criteria: [...this._sortCriteria] },
      bubbles: true,
      composed: true,
    }));
  }

  private _renderHeaderCell(col: ColumnDefinition, colIndex: number) {
    const sortable = col.sortable !== false;
    const criterion = this._sortCriteria.find(c => c.key === col.key);
    const sortIndex = this._sortCriteria.length > 1
      ? this._sortCriteria.findIndex(c => c.key === col.key)
      : -1;

    const classes = [
      'ft-header-cell',
      sortable ? 'ft-sortable' : '',
    ].filter(Boolean).join(' ');

    const ariaSortValue = criterion
      ? (criterion.direction === 'asc' ? 'ascending' : 'descending')
      : undefined;

    return html`
      <div class=${classes}
        role="columnheader"
        aria-sort=${ariaSortValue ?? 'none'}
        @click=${sortable ? (e: MouseEvent) => this._onHeaderClick(e, col) : undefined}>
        <span>${col.header}</span>
        ${criterion ? html`<span class="ft-sort-indicator">${criterion.direction === 'asc' ? '\u25B2' : '\u25BC'}</span>` : ''}
        ${sortIndex >= 0 ? html`<span class="ft-sort-order">${sortIndex + 1}</span>` : ''}
        <div class="ft-resize-handle"
          @mousedown=${(e: MouseEvent) => this._onResizeStart(e, colIndex)}></div>
      </div>
    `;
  }

  // --- Column Resize ---

  private _onResizeStart(e: MouseEvent, colIndex: number): void {
    e.preventDefault();
    e.stopPropagation(); // Prevent sort toggle

    const col = this.visibleColumns[colIndex];
    const startWidth = col.width ?? DEFAULT_COL_WIDTH;
    this._resizing = { colIndex, startX: e.clientX, startWidth };

    const onMouseMove = (ev: MouseEvent) => {
      if (!this._resizing) return;
      const delta = ev.clientX - this._resizing.startX;
      const minW = col.minWidth ?? MIN_COL_WIDTH;
      const newWidth = Math.max(minW, this._resizing.startWidth + delta);
      col.width = newWidth;
      this.requestUpdate();
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this._resizeCleanup = null;
    };

    const onMouseUp = () => {
      cleanup();

      if (this._resizing) {
        const finalWidth = col.width ?? DEFAULT_COL_WIDTH;
        this.dispatchEvent(new CustomEvent('column-resize', {
          detail: { key: col.key, width: finalWidth, colIndex },
          bubbles: true,
          composed: true,
        }));
        this._resizing = null;
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    this._resizeCleanup = cleanup;
  }

  // --- Rendering ---

  render() {
    const cols = this.visibleColumns;

    if (cols.length === 0) {
      return html`<div class="ft-empty">No columns defined</div>`;
    }

    const gtc = this.gridTemplateColumns;

    const rowNumHeader = this.showRowNumbers
      ? html`<div class="ft-row-num-header">#</div>` : '';

    if (this.data.length === 0 || this._visibleRowCount === 0) {
      const msg = this.data.length === 0 ? 'No data' : 'No matching data';
      return html`
        <div class="ft-header" role="row" style="grid-template-columns: ${gtc}">
          ${rowNumHeader}
          ${cols.map((col, i) => this._renderHeaderCell(col, i))}
        </div>
        <div class="ft-empty">${msg}</div>
      `;
    }

    const { start, end } = this.visibleRange;
    const rows = [];
    for (let i = start; i < end; i++) {
      rows.push(this._renderRow(i, cols, gtc));
    }

    return html`
      <div class="ft-header" role="row" style="grid-template-columns: ${gtc}">
        ${rowNumHeader}
        ${cols.map((col, i) => this._renderHeaderCell(col, i))}
      </div>
      <div class="ft-body" style="height: ${this.totalBodyHeight}px">
        ${rows}
      </div>
    `;
  }

  private _renderRow(index: number, cols: ColumnDefinition[], gtc: string) {
    const dataIndex = this._toDataIndex(index);
    const row = this.data[dataIndex];
    const top = index * this.rowHeight;
    const parity = index % 2 === 0 ? 'ft-row-even' : 'ft-row-odd';

    return html`
      <div class="ft-row ${parity}" role="row" style="grid-template-columns: ${gtc}; top: ${top}px; height: ${this.rowHeight}px">
        ${this.showRowNumbers ? html`<div class="ft-row-num" @click=${() => this._onRowNumberClick(index)}>${dataIndex + 1}</div>` : ''}
        ${cols.map((col, colIndex) => this._renderCell(row, col, index, colIndex))}
      </div>
    `;
  }

  private _renderCell(row: DataRow, col: ColumnDefinition, rowIndex: number, colIndex: number) {
    const isActive = this._activeCell?.row === rowIndex && this._activeCell?.col === colIndex;
    const isEditing = this._editingCell?.row === rowIndex && this._editingCell?.col === colIndex;
    const isSelected = this._selection.isInRange(rowIndex, colIndex);

    if (isEditing) {
      return html`
        <div class="ft-cell ft-editing ft-active" role="gridcell">
          ${this._renderEditor(row, col)}
        </div>
      `;
    }

    const classes = [
      'ft-cell',
      `ft-type-${col.type ?? 'text'}`,
      isActive ? 'ft-active' : '',
      isSelected ? 'ft-selected' : '',
    ].filter(Boolean).join(' ');

    return html`
      <div class=${classes}
        role="gridcell"
        @click=${(e: MouseEvent) => this._onCellClickEvent(e, rowIndex, colIndex)}
        @dblclick=${() => this._onCellDblClick(rowIndex, colIndex)}>
        ${renderCell(row[col.key], row, col)}
      </div>
    `;
  }

  private _renderEditor(row: DataRow, col: ColumnDefinition) {
    const value = row[col.key];
    const strValue = value == null ? '' : String(value);

    if (col.type === 'number') {
      return html`
        <input class="ft-editor ft-editor-number" type="number"
          .value=${strValue}
          @keydown=${this._onEditorKeyDown}
          @blur=${() => this._commitEdit()}>
      `;
    }

    if (col.type === 'date') {
      const dateStr = this._toDateInputValue(value);
      return html`
        <input class="ft-editor" type="date"
          .value=${dateStr}
          @keydown=${this._onEditorKeyDown}
          @blur=${() => this._commitEdit()}>
      `;
    }

    if (col.type === 'datetime') {
      const dtStr = this._toDateTimeInputValue(value);
      return html`
        <input class="ft-editor" type="datetime-local"
          .value=${dtStr}
          @keydown=${this._onEditorKeyDown}
          @blur=${() => this._commitEdit()}>
      `;
    }

    return html`
      <input class="ft-editor" type="text"
        .value=${strValue}
        @keydown=${this._onEditorKeyDown}
        @blur=${() => this._commitEdit()}>
    `;
  }

  /** Convert value to YYYY-MM-DD for date input (local timezone) */
  private _toDateInputValue(value: unknown): string {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(String(value));
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /** Convert value to YYYY-MM-DDTHH:mm for datetime-local input (local timezone) */
  private _toDateTimeInputValue(value: unknown): string {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(String(value));
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'flex-table': FlexTable;
  }
}
