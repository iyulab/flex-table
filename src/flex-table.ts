import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { flexTableStyles } from './styles/flex-table.styles.js';
import { renderCell } from './renderers/cell-renderer.js';
import { SelectionState } from './core/selection.js';
import { EditingState } from './core/editing.js';
import { RowSelectionState } from './core/row-selection.js';
import { computeSortedIndices, toggleSort } from './core/sorting.js';
import { computeFilteredIndices } from './core/filtering.js';
import { UndoStack } from './core/undo.js';
import { copyToClipboard, parseClipboardText, parseValueForColumn } from './clipboard/clipboard.js';
import { exportData, downloadFile, getExportMimeType, getExportExtension } from './export/export.js';
import type { ExportFormat } from './export/export.js';
import type { CellPosition, CellRange } from './core/selection.js';
import type { SortCriteria } from './core/sorting.js';
import type { ColumnFilter, FilterPredicate } from './core/filtering.js';
import type { ColumnDefinition, DataRow, SelectionMode, DataMode } from './models/types.js';
import type { TemplateResult } from 'lit';

const DEFAULT_COL_WIDTH = 120;
const MIN_COL_WIDTH = 40;
const DEFAULT_ROW_HEIGHT = 32;
const OVERSCAN = 5;

@customElement('flex-table')
export class FlexTable extends LitElement {
  static styles = flexTableStyles;

  @property({ type: Array })
  columns: ColumnDefinition[] = [];

  @property({ type: Array, hasChanged: () => true })
  data: DataRow[] = [];

  @property({ type: Number, attribute: 'row-height' })
  rowHeight: number = DEFAULT_ROW_HEIGHT;

  @property({ type: Boolean, attribute: 'show-row-numbers' })
  showRowNumbers: boolean = false;

  @property({ type: String, reflect: true })
  theme: 'light' | 'dark' | undefined = undefined;

  @property({ type: Number, attribute: 'max-rows' })
  maxRows: number = 0;

  @property({ type: Boolean })
  editable: boolean = true;

  @property({ type: Boolean, attribute: 'show-filters' })
  showFilters: boolean = false;

  /** Enable built-in context menu on cell right-click. */
  @property({ type: Boolean, attribute: 'show-context-menu' })
  showContextMenu: boolean = false;

  /** Enable row-level checkbox selection. */
  @property({ type: Boolean })
  selectable: boolean = false;

  /** Row selection mode: 'single' or 'multi' (default: 'multi'). */
  @property({ type: String, attribute: 'selection-mode' })
  set selectionMode(value: SelectionMode) {
    this._rowSelection.mode = value;
    this.requestUpdate();
  }
  get selectionMode(): SelectionMode {
    return this._rowSelection.mode;
  }

  /** Data processing mode: 'client' (default) or 'server'. */
  @property({ type: String, attribute: 'data-mode' })
  dataMode: DataMode = 'client';

  /** Footer/summary row data. Keys match column keys; values are display strings. */
  @property({ type: Object, attribute: 'footer-data' })
  footerData: Record<string, string | TemplateResult> | null = null;

  @property({ type: Number, attribute: 'max-undo-size' })
  set maxUndoSize(value: number) {
    this._undo.maxSize = value;
  }
  get maxUndoSize(): number {
    return this._undo.maxSize;
  }

  @state()
  private _scrollTop = 0;

  @state()
  private _scrollLeft = 0;

  @state()
  private _viewportHeight = 0;

  @state()
  private _viewportWidth = 0;

  private _colLeftOffsets: number[] = [];
  private _totalRowWidth = 0;

  @state()
  private _activeCell: CellPosition | null = null;

  @state()
  private _editingCell: CellPosition | null = null;

  @state()
  private _sortCriteria: SortCriteria[] = [];

  private _selection = new SelectionState();
  private _editing = new EditingState();
  private _rowSelection = new RowSelectionState();
  private _undo = new UndoStack();
  private _filters: ColumnFilter[] = [];
  private _filteredIndices: number[] = [];
  private _sortedIndices: number[] = [];
  @state()
  private _openFilterKey: string | null = null;

  @state()
  private _rowSelectionVersion = 0;

  @state()
  private _autocompleteState: { candidates: string[]; activeIndex: number } | null = null;

  @state()
  private _headerMenu: { key: string; x: number; y: number; hiddenNeighbors: ColumnDefinition[] } | null = null;

  @state()
  private _bodyContextMenu: { rowIndex: number; colIndex: number; dataIndex: number; x: number; y: number } | null = null;

  private _viewDirty = true;
  private _isDragging = false;
  private _wasDrag = false;
  private _resizing: { colIndex: number; startX: number; startWidth: number } | null = null;
  private _resizeCleanup: (() => void) | null = null;
  private _colDrag: {
    col: ColumnDefinition;
    colIndex: number;
    startX: number;
    ghost: HTMLElement | null;
    active: boolean;
    targetIndex: number;
  } | null = null;
  private _colDragIndicatorLeft: number | null = null;
  private _fillDrag: {
    sourceRange: CellRange;
    targetRange: CellRange | null;
    active: boolean;
  } | null = null;
  private _rowDrag: {
    rowIndex: number;
    startY: number;
    ghost: HTMLElement | null;
    active: boolean;
    targetIndex: number;
  } | null = null;
  private _rowDragIndicatorY: number | null = null;
  private _findState: {
    mode: 'find' | 'replace';
    query: string;
    replaceWith: string;
    matchCase: boolean;
    wholeCell: boolean;
    results: Array<{ row: number; col: number }>;
    currentIndex: number;
  } | null = null;
  private _columnWidths: Map<string, number> = new Map();
  private _hostResizeObserver: ResizeObserver | null = null;

  get visibleColumns(): ColumnDefinition[] {
    return this.columns.filter(col => !col.hidden);
  }

  private get _prefixWidth(): number {
    let w = 0;
    if (this.selectable) w += 36;
    if (this.showRowNumbers) w += 48;
    return w;
  }

  /** Whether an undo operation is available. */
  get canUndo(): boolean {
    return this._undo.canUndo;
  }

  /** Whether a redo operation is available. */
  get canRedo(): boolean {
    return this._undo.canRedo;
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

  // --- Public API: Row Selection ---

  /** Get data indices of currently selected rows. */
  getSelectedRows(): { selectedIndices: number[]; selectedRows: DataRow[] } {
    const indices = this._rowSelection.selectedIndices
      .map(vi => this._toDataIndex(vi))
      .filter(i => i >= 0 && i < this.data.length);
    return {
      selectedIndices: indices,
      selectedRows: indices.map(i => this.data[i]),
    };
  }

  /** Select all visible rows (multi mode only). */
  selectAll(): void {
    if (!this.selectable) return;
    this._rowSelection.selectAll();
    this._rowSelectionVersion++;
    this._dispatchRowSelectionEvent();
  }

  /** Deselect all rows. */
  deselectAll(): void {
    if (!this.selectable) return;
    this._rowSelection.deselectAll();
    this._rowSelectionVersion++;
    this._dispatchRowSelectionEvent();
  }

  private _dispatchRowSelectionEvent(): void {
    const { selectedIndices, selectedRows } = this.getSelectedRows();
    this.dispatchEvent(new CustomEvent('selection-change', {
      detail: { selectedIndices, selectedRows },
      bubbles: true,
      composed: true,
    }));
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

  /**
   * Explicitly request a re-render after external data mutations.
   * Useful when `data` array contents are mutated in-place without reassignment.
   */
  refreshData(): void {
    this.requestUpdate('data');
  }

  private _dispatchUndoStateEvent(): void {
    this.dispatchEvent(new CustomEvent('undo-state-change', {
      detail: { canUndo: this.canUndo, canRedo: this.canRedo },
      bubbles: true,
      composed: true,
    }));
  }

  private _dispatchFilterEvent(): void {
    this.dispatchEvent(new CustomEvent('filter-change', {
      detail: { keys: this.filterKeys, filteredCount: this.filteredRowCount },
      bubbles: true,
      composed: true,
    }));
  }

  // --- Public API: Column Operations ---

  /**
   * Add a column at the specified index (default: end).
   * Returns the added column definition.
   */
  addColumn(def: ColumnDefinition, index?: number): ColumnDefinition {
    const insertAt = index ?? this.columns.length;
    this.columns = [
      ...this.columns.slice(0, insertAt),
      def,
      ...this.columns.slice(insertAt),
    ];

    this._undo.push({
      label: 'column-add',
      undo: () => {
        this.columns = this.columns.filter(c => c !== def);
        this.requestUpdate();
      },
      redo: () => {
        this.columns = [
          ...this.columns.slice(0, insertAt),
          def,
          ...this.columns.slice(insertAt),
        ];
        this.requestUpdate();
      },
    });

    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('column-add', {
      detail: { column: def, index: insertAt },
      bubbles: true,
      composed: true,
    }));
    this._dispatchUndoStateEvent();

    return def;
  }

  /**
   * Delete a column by its key.
   * Removes related filters, sort criteria, and column width overrides.
   */
  deleteColumn(key: string): void {
    const colIndex = this.columns.findIndex(c => c.key === key);
    if (colIndex === -1) return;

    const removed = this.columns[colIndex];

    // Capture related state for undo
    const hadFilter = this._filters.find(f => f.key === key);
    const hadSort = this._sortCriteria.find(c => c.key === key);
    const hadWidth = this._columnWidths.get(key);

    // Clean up related state
    this._filters = this._filters.filter(f => f.key !== key);
    this._sortCriteria = this._sortCriteria.filter(c => c.key !== key);
    this._columnWidths.delete(key);

    // Remove column
    this.columns = this.columns.filter(c => c.key !== key);

    this._undo.push({
      label: 'column-delete',
      undo: () => {
        this.columns = [
          ...this.columns.slice(0, colIndex),
          removed,
          ...this.columns.slice(colIndex),
        ];
        // Restore related state
        if (hadFilter) this._filters.push(hadFilter);
        if (hadSort) this._sortCriteria = [...this._sortCriteria, hadSort];
        if (hadWidth !== undefined) this._columnWidths.set(key, hadWidth);
        this.requestUpdate();
      },
      redo: () => {
        this._filters = this._filters.filter(f => f.key !== key);
        this._sortCriteria = this._sortCriteria.filter(c => c.key !== key);
        this._columnWidths.delete(key);
        this.columns = this.columns.filter(c => c.key !== key);
        this.requestUpdate();
      },
    });

    // Clear selection if it references a column beyond bounds
    if (this._activeCell && this._activeCell.col >= this.visibleColumns.length) {
      this._selection.clear();
      this._activeCell = null;
    }

    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('column-delete', {
      detail: { column: removed, key, index: colIndex },
      bubbles: true,
      composed: true,
    }));
    this._dispatchUndoStateEvent();
  }

  /**
   * Move a column to a new position.
   * @param key Column key to move.
   * @param newIndex Target index in the columns array.
   */
  moveColumn(key: string, newIndex: number): void {
    const oldIndex = this.columns.findIndex(c => c.key === key);
    if (oldIndex === -1) return;
    const clampedNew = Math.max(0, Math.min(this.columns.length - 1, newIndex));
    if (oldIndex === clampedNew) return;

    const col = this.columns[oldIndex];
    const newCols = [...this.columns];
    newCols.splice(oldIndex, 1);
    newCols.splice(clampedNew, 0, col);
    this.columns = newCols;

    this._undo.push({
      label: 'column-reorder',
      undo: () => {
        const cols = [...this.columns];
        cols.splice(clampedNew, 1);
        cols.splice(oldIndex, 0, col);
        this.columns = cols;
        this.requestUpdate();
      },
      redo: () => {
        const cols = [...this.columns];
        cols.splice(oldIndex, 1);
        cols.splice(clampedNew, 0, col);
        this.columns = cols;
        this.requestUpdate();
      },
    });

    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('column-reorder', {
      detail: { key, oldIndex, newIndex: clampedNew },
      bubbles: true,
      composed: true,
    }));
    this._dispatchUndoStateEvent();
  }

  /** Hide a column by its key. Fires `column-visibility-change` event. */
  hideColumn(key: string): void {
    this._setColumnHidden(key, true);
  }

  /** Show a previously hidden column by its key. Fires `column-visibility-change` event. */
  showColumn(key: string): void {
    this._setColumnHidden(key, false);
  }

  private _setColumnHidden(key: string, hidden: boolean): void {
    const idx = this.columns.findIndex(c => c.key === key);
    if (idx === -1) return;
    this.columns = this.columns.map((c, i) => i === idx ? { ...c, hidden } : c);
    this.dispatchEvent(new CustomEvent('column-visibility-change', {
      detail: { key, hidden },
      bubbles: true,
      composed: true,
    }));
  }

  /** Returns all columns marked as hidden. */
  getHiddenColumns(): ColumnDefinition[] {
    return this.columns.filter(c => c.hidden);
  }

  // --- Public API: Row Operations ---

  /**
   * Add a row at the specified index (default: end).
   * Returns the new row.
   */
  addRow(row?: DataRow, index?: number): DataRow | null {
    if (this.maxRows > 0 && this.data.length >= this.maxRows) return null;
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
    this._dispatchUndoStateEvent();

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
    this._dispatchUndoStateEvent();
  }

  /**
   * Apply multiple cell changes as a single undo-able operation.
   * @param changes Array of { row (data index), key, value } objects.
   */
  updateRows(changes: Array<{ row: number; key: string; value: unknown }>): void {
    if (changes.length === 0) return;

    const saved: Array<{ row: number; key: string; oldValue: unknown; newValue: unknown }> = [];

    for (const change of changes) {
      if (change.row < 0 || change.row >= this.data.length) continue;
      const oldValue = this.data[change.row][change.key];
      this.data[change.row][change.key] = change.value;
      saved.push({ row: change.row, key: change.key, oldValue, newValue: change.value });
    }

    if (saved.length === 0) return;

    this._undo.push({
      label: 'batch-update',
      undo: () => {
        for (const s of saved) {
          this.data[s.row][s.key] = s.oldValue;
        }
        this.requestUpdate();
      },
      redo: () => {
        for (const s of saved) {
          this.data[s.row][s.key] = s.newValue;
        }
        this.requestUpdate();
      },
    });

    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('batch-update', {
      detail: { changes: saved },
      bubbles: true,
      composed: true,
    }));
    this._dispatchUndoStateEvent();
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
   * @param options.selectionOnly - Export only the currently selected range
   */
  exportToString(format: ExportFormat, options?: { selectionOnly?: boolean }): string | Uint8Array {
    if (options?.selectionOnly) {
      const range = this._selection.getEffectiveRange();
      if (!range) return '';
      const cols = this.visibleColumns.slice(range.startCol, range.endCol + 1);
      const rows: DataRow[] = [];
      for (let r = range.startRow; r <= range.endRow; r++) {
        rows.push(this.data[this._toDataIndex(r)]);
      }
      return exportData(rows, cols, format);
    }
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

  /**
   * Get the effective width for a column, checking internal overrides first.
   */
  getColumnWidth(key: string): number | undefined {
    return this._columnWidths.get(key);
  }

  private _getColWidth(col: ColumnDefinition): number {
    const width = this._columnWidths.get(col.key) ?? col.width ?? DEFAULT_COL_WIDTH;
    return Math.max(width, col.minWidth ?? MIN_COL_WIDTH);
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
    this._onDocumentClick = this._onDocumentClick.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);
    this.addEventListener('scroll', this._onScroll, { passive: true });
    this.addEventListener('keydown', this._onKeyDown);
    this.addEventListener('contextmenu', this._onContextMenu);

    if (!this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0');
    }
    this.setAttribute('role', 'grid');

    // ResizeObserver — host의 client size 변화만 감시.
    // 이전 구현은 `updated()`에서 매번 _measureViewport()를 호출하여 @state를 갱신했는데,
    // scrollbar 출현으로 clientWidth가 진동하는 경우 무한 reflow loop 발생 (yesung 11차 run에서 발견:
    // F12에서 <html> 요소가 빠르게 깜빡이는 현상).
    // ResizeObserver는 ResizeObserverLoop 보호 메커니즘이 있어 안전.
    if (typeof ResizeObserver !== 'undefined') {
      this._hostResizeObserver = new ResizeObserver(() => this._measureViewport());
      this._hostResizeObserver.observe(this);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('scroll', this._onScroll);
    this.removeEventListener('keydown', this._onKeyDown);
    this.removeEventListener('contextmenu', this._onContextMenu);
    document.removeEventListener('click', this._onDocumentClick);
    this._isDragging = false;
    this._wasDrag = false;
    // Clean up any in-progress resize listeners
    if (this._resizeCleanup) {
      this._resizeCleanup();
      this._resizeCleanup = null;
    }
    if (this._hostResizeObserver) {
      this._hostResizeObserver.disconnect();
      this._hostResizeObserver = null;
    }
  }

  protected firstUpdated(): void {
    this._measureViewport();
  }

  private _updateColOffsets(): void {
    const cols = this.visibleColumns;
    const offsets: number[] = [];
    let x = this._prefixWidth;
    for (const col of cols) {
      offsets.push(x);
      x += this._getColWidth(col);
    }
    this._colLeftOffsets = offsets;
    this._totalRowWidth = x;
  }

  private get visibleColRange(): { start: number; end: number } {
    const cols = this.visibleColumns;
    if (cols.length === 0) return { start: 0, end: 0 };

    const offsets = this._colLeftOffsets;
    if (offsets.length === 0) return { start: 0, end: cols.length };

    const scrollLeft = this._scrollLeft;
    const viewRight = scrollLeft + this._viewportWidth;

    // Default to past-end when all columns are left of scrollLeft
    let start = cols.length;
    for (let i = 0; i < offsets.length; i++) {
      if (offsets[i] + this._getColWidth(cols[i]) > scrollLeft) {
        start = i;
        break;
      }
    }
    start = Math.max(0, start - OVERSCAN);

    let end = cols.length;
    for (let i = start; i < offsets.length; i++) {
      if (offsets[i] > viewRight) {
        end = i;
        break;
      }
    }
    end = Math.min(cols.length, end + OVERSCAN);

    return { start, end };
  }

  protected willUpdate(changedProperties: Map<string, unknown>): void {
    // Skip expensive recompute for scroll-only updates
    const scrollOnly = changedProperties.size <= 2
      && !changedProperties.has('data')
      && !changedProperties.has('columns')
      && !changedProperties.has('_openFilterKey')
      && !changedProperties.has('_editingCell')
      && !changedProperties.has('_activeCell')
      && (changedProperties.has('_scrollTop') || changedProperties.has('_scrollLeft'));

    if (!scrollOnly || this._viewDirty) {
      this._recomputeView();
      this._viewDirty = false;
    }
    this._updateColOffsets();
    this._selection.setDimensions(this._visibleRowCount, this.visibleColumns.length);
    this._rowSelection.setRowCount(this._visibleRowCount);
  }

  protected updated(): void {
    // _measureViewport()는 더 이상 여기서 호출하지 않는다.
    // 호출 시 @state 갱신 → 무한 update 루프 위험 (위 connectedCallback의 ResizeObserver 주석 참조).
    // 크기 변화는 ResizeObserver가 비동기로 처리한다.
    this._focusEditor();
    this._adjustFilterDropdown();
    // Update ARIA live attributes
    this.setAttribute('aria-rowcount', String(this._visibleRowCount));
    this.setAttribute('aria-colcount', String(this.visibleColumns.length));
  }

  /** Recompute filter → sort pipeline. */
  private _recomputeView(): void {
    // Server mode: data is already sorted/filtered by the consumer
    if (this.dataMode === 'server') {
      this._filteredIndices = Array.from({ length: this.data.length }, (_, i) => i);
      this._sortedIndices = this._filteredIndices;
      return;
    }

    this._filteredIndices = computeFilteredIndices(this.data, this._filters, (error, row, filter) => {
      this.dispatchEvent(new CustomEvent('filter-error', {
        detail: { error, row, filterKey: filter.key },
        bubbles: true,
        composed: true,
      }));
    });
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
    const w = this.clientWidth;
    if (h !== this._viewportHeight) this._viewportHeight = h;
    if (w !== this._viewportWidth) this._viewportWidth = w;
  }

  private _onScroll(): void {
    this._scrollTop = this.scrollTop;
    this._scrollLeft = this.scrollLeft;
  }

  private _onDocumentClick(): void {
    if (this._openFilterKey) {
      this._openFilterKey = null;
    }
    if (this._headerMenu) {
      this._headerMenu = null;
    }
    if (this._bodyContextMenu) {
      this._bodyContextMenu = null;
    }
  }

  private _onContextMenu(e: MouseEvent): void {
    // Find the cell element from the event path
    const path = e.composedPath();
    const cellEl = path.find(
      (el) => el instanceof HTMLElement && el.classList.contains('ft-cell')
    ) as HTMLElement | undefined;
    if (!cellEl) return;

    e.preventDefault();

    // Find row and col from data attributes
    const rowEl = cellEl.parentElement;
    if (!rowEl || !rowEl.classList.contains('ft-row')) return;

    const colIndex = parseInt(cellEl.dataset.colIndex ?? '-1', 10);
    const rowAttr = rowEl.style.top;
    const top = parseInt(rowAttr, 10);
    const rowIndex = Math.round(top / this.rowHeight);

    if (colIndex < 0 || rowIndex < 0) return;

    const dataIndex = this._toDataIndex(rowIndex);
    const col = this.visibleColumns[colIndex];
    if (!col) return;

    const ctxEvent = new CustomEvent('context-menu', {
      detail: {
        x: e.clientX,
        y: e.clientY,
        row: dataIndex,
        col: colIndex,
        key: col.key,
        value: this.data[dataIndex]?.[col.key],
        rowData: this.data[dataIndex],
      },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(ctxEvent);

    if (this.showContextMenu && !ctxEvent.defaultPrevented) {
      this._bodyContextMenu = { rowIndex, colIndex, dataIndex, x: e.clientX, y: e.clientY };
      requestAnimationFrame(() => {
        document.addEventListener('click', this._onDocumentClick, { once: true });
      });
    }
  }

  private _onCellClickEvent(e: MouseEvent, rowIndex: number, colIndex: number): void {
    // If this click is the end of a drag selection, skip — drag already handled it
    if (this._wasDrag) {
      this._wasDrag = false;
      return;
    }
    // Plain click: drag ended without moving to another cell, reset drag state
    this._isDragging = false;
    if (this._editing.current) {
      this._commitEdit();
    }
    if (e.shiftKey) {
      this._selection.setActiveWithRange(rowIndex, colIndex);
    } else if (e.ctrlKey || e.metaKey) {
      this._selection.toggleCell(rowIndex, colIndex);
    } else {
      this._selection.setActive(rowIndex, colIndex);
    }
    this._activeCell = this._selection.activeCell ? { ...this._selection.activeCell } : null;
    this._dispatchSelectionEvent();
    this.requestUpdate();
  }

  private _onCellMouseDown(e: MouseEvent, rowIndex: number, colIndex: number): void {
    if (e.button !== 0) return;
    if (e.shiftKey) return;
    // Ctrl+Click: focus without starting drag or clearing selection
    if (e.ctrlKey || e.metaKey) {
      this.focus({ preventScroll: true });
      e.preventDefault();
      return;
    }

    this._isDragging = true;
    this._wasDrag = false;

    if (this._editing.current) this._commitEdit();
    this._selection.setActive(rowIndex, colIndex);
    this._activeCell = { row: rowIndex, col: colIndex };

    this.focus({ preventScroll: true });
    // Prevent browser text selection during drag
    e.preventDefault();

    const onMouseUp = () => {
      this._isDragging = false;
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mouseup', onMouseUp);
    this.requestUpdate();
  }

  private _onCellMouseEnter(rowIndex: number, colIndex: number): void {
    if (!this._isDragging) return;

    this._wasDrag = true;
    this._selection.setActiveWithRange(rowIndex, colIndex);
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

  /** Check if a column is editable based on global + per-column settings */
  private _isCellEditable(col: ColumnDefinition): boolean {
    if (!this.editable) return false;
    if (col.editable === false) return false;
    return true;
  }

  private _startEdit(): void {
    if (!this._activeCell) return;
    const cols = this.visibleColumns;
    const col = cols[this._activeCell.col];
    if (!col || !this._isCellEditable(col)) return;

    // Boolean: toggle immediately, don't enter edit mode
    if (col.type === 'boolean') {
      const row = this.data[this._toDataIndex(this._activeCell.row)];
      const currentValue = row[col.key];
      this._applyEdit(!currentValue);
      return;
    }

    const dataRow = this._toDataIndex(this._activeCell.row);
    const row = this.data[dataRow];
    this._editing.start(this._activeCell, row[col.key]);
    this._editingCell = { ...this._activeCell };

    this.dispatchEvent(new CustomEvent('cell-edit-start', {
      detail: { row: dataRow, col: this._activeCell.col, key: col.key, value: row[col.key] },
      bubbles: true,
      composed: true,
    }));
  }

  private _commitEdit(): void {
    if (!this._editing.current) return;
    const col = this.visibleColumns[this._editing.current.position.col];

    // select editor uses <select> element
    if (col.type === 'select') {
      const sel = this.shadowRoot?.querySelector('select.ft-editor') as HTMLSelectElement | null;
      if (sel) {
        const opt = col.options?.find((o): o is { label: string; value: unknown } =>
          typeof o !== 'string' && String(o.value) === sel.value
        );
        this._applyEdit(opt ? opt.value : sel.value);
      } else {
        this._cancelEdit();
      }
      return;
    }

    const input = this.shadowRoot?.querySelector('.ft-editor') as HTMLInputElement | null;
    if (input) {
      const newValue = parseValueForColumn(input.value, col);
      this._applyEdit(newValue);
    } else {
      this._cancelEdit();
    }
  }

  private _applyEdit(newValue: unknown): void {
    this._autocompleteState = null;
    const editState = this._editing.commit();
    this._editingCell = null;
    if (!editState) return;

    const { row, col } = editState.position;
    const dataRow = this._toDataIndex(row);
    const colDef = this.visibleColumns[col];
    const oldValue = editState.originalValue;

    // Strict autocomplete: value must be in existing column values
    if (colDef.autocomplete === 'strict' && newValue != null && newValue !== '') {
      const allCandidates = this._getAutocompleteCandidates(colDef, '');
      if (!allCandidates.includes(String(newValue))) {
        const error = 'Value must be from the existing list';
        this._markCellInvalid(row, col, error);
        this.dispatchEvent(new CustomEvent('validation-error', {
          detail: { row: dataRow, col, key: colDef.key, value: newValue, error },
          bubbles: true,
          composed: true,
        }));
        return;
      }
    }

    // Run validator if present
    if (colDef.validator) {
      const error = colDef.validator(newValue, this.data[dataRow], colDef);
      if (error) {
        this._markCellInvalid(row, col, error);
        this.dispatchEvent(new CustomEvent('validation-error', {
          detail: { row: dataRow, col, key: colDef.key, value: newValue, error },
          bubbles: true,
          composed: true,
        }));
        return;
      }
    }

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
    this._dispatchUndoStateEvent();
  }

  private _cancelEdit(): void {
    this._autocompleteState = null;
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
    // Autocomplete dropdown navigation
    if (this._autocompleteState && this._autocompleteState.candidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        const len = this._autocompleteState.candidates.length;
        this._autocompleteState = { ...this._autocompleteState, activeIndex: Math.min(this._autocompleteState.activeIndex + 1, len - 1) };
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        this._autocompleteState = { ...this._autocompleteState, activeIndex: Math.max(this._autocompleteState.activeIndex - 1, -1) };
        return;
      }
      if (e.key === 'Enter' && this._autocompleteState.activeIndex >= 0) {
        e.preventDefault();
        e.stopPropagation();
        const selected = this._autocompleteState.candidates[this._autocompleteState.activeIndex];
        this._selectAutocompleteCandidate(selected);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this._autocompleteState = null;
        return;
      }
    }

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

  private _getAutocompleteCandidates(col: ColumnDefinition, text: string): string[] {
    const lower = text.toLowerCase();
    const seen = new Set<string>();
    const results: string[] = [];
    for (const row of this.data) {
      const v = row[col.key];
      if (v == null) continue;
      const s = String(v);
      if (!seen.has(s) && (text === '' || s.toLowerCase().includes(lower))) {
        seen.add(s);
        results.push(s);
        if (results.length >= 20) break;
      }
    }
    return results;
  }

  private _onAutocompleteInput(e: Event, col: ColumnDefinition): void {
    const input = e.target as HTMLInputElement;
    const text = input.value;
    const candidates = this._getAutocompleteCandidates(col, text).filter(c => c !== text);
    this._autocompleteState = candidates.length > 0 ? { candidates, activeIndex: -1 } : null;
  }

  private _selectAutocompleteCandidate(value: string): void {
    this._autocompleteState = null;
    this._applyEdit(value);
    this._selection.moveDown();
    this._syncActiveCell();
  }

  private _syncActiveCell(): void {
    this._activeCell = this._selection.activeCell ? { ...this._selection.activeCell } : null;
    this._scrollToActiveCell();
    this._dispatchSelectionEvent();
  }

  // --- Navigation ---

  private _onKeyDown(e: KeyboardEvent): void {
    if (this._editing.current) return;

    const cols = this.visibleColumns;

    // Ctrl shortcuts that work globally (no active cell required)
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (['f', 'h', 'z', 'y'].includes(k)) {
        if (this._handleCtrlKey(e)) return;
      }
    }

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
      // Allow Escape to close find panel even without active cell
      if (e.key === 'Escape' && this._findState) {
        this._closeFindPanel();
        e.preventDefault();
        return;
      }
      return;
    }

    if (this._handleCtrlKey(e)) return;
    if (this._handleAltKey(e, cols)) return;

    // Printable character starts editing with that character
    if (this._activeCell && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const col = cols[this._activeCell.col];
      if (col && this._isCellEditable(col)) {
        this._startEdit();
      }
      return;
    }

    const handled = this._handleNavigation(e);

    if (handled) {
      e.preventDefault();
      this._syncActiveCell();
    }
  }

  private _handleCtrlKey(e: KeyboardEvent): boolean {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;

    switch (e.key.toLowerCase()) {
      case 'z':
        e.preventDefault();
        if (e.shiftKey) { this._undo.redo(); } else { this._undo.undo(); }
        this.requestUpdate();
        this._dispatchUndoStateEvent();
        return true;
      case 'y':
        e.preventDefault();
        this._undo.redo();
        this.requestUpdate();
        this._dispatchUndoStateEvent();
        return true;
      case 'c':
        e.preventDefault();
        this._handleCopy(false);
        return true;
      case 'x':
        e.preventDefault();
        this._handleCopy(this.editable);
        return true;
      case 'v':
        e.preventDefault();
        if (this.editable) this._handlePaste();
        return true;
      case 'd':
        e.preventDefault();
        if (this.editable) this._handleFillDown();
        return true;
      case 'r':
        e.preventDefault();
        if (this.editable) this._handleFillRight();
        return true;
      case 'f':
        e.preventDefault();
        this._toggleFindPanel('find');
        return true;
      case 'h':
        e.preventDefault();
        this._toggleFindPanel('replace');
        return true;
      default:
        return false;
    }
  }

  private _handleAltKey(e: KeyboardEvent, cols: ColumnDefinition[]): boolean {
    if (!e.altKey || !this._activeCell) return false;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return false;

    e.preventDefault();
    const col = cols[this._activeCell.col];
    if (!col) return true;

    const currentWidth = this._columnWidths.get(col.key) ?? col.width ?? DEFAULT_COL_WIDTH;
    const delta = e.key === 'ArrowRight' ? 20 : -20;
    const minW = col.minWidth ?? MIN_COL_WIDTH;
    const newWidth = Math.max(minW, currentWidth + delta);
    this._columnWidths.set(col.key, newWidth);
    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('column-resize', {
      detail: { key: col.key, width: newWidth, colIndex: this._activeCell.col },
      bubbles: true,
      composed: true,
    }));
    return true;
  }

  private _handleNavigation(e: KeyboardEvent): boolean {
    switch (e.key) {
      case 'ArrowUp':
        e.shiftKey ? this._selection.shiftMoveUp() : this._selection.moveUp();
        return true;
      case 'ArrowDown':
        e.shiftKey ? this._selection.shiftMoveDown() : this._selection.moveDown();
        return true;
      case 'ArrowLeft':
        e.shiftKey ? this._selection.shiftMoveLeft() : this._selection.moveLeft();
        return true;
      case 'ArrowRight':
        e.shiftKey ? this._selection.shiftMoveRight() : this._selection.moveRight();
        return true;
      case 'Tab':
        e.shiftKey ? this._selection.movePrev() : this._selection.moveNext();
        return true;
      case 'Home':
        e.ctrlKey ? this._selection.moveToStart() : this._selection.moveToRowStart();
        return true;
      case 'End':
        e.ctrlKey ? this._selection.moveToEnd() : this._selection.moveToRowEnd();
        return true;
      case 'Escape':
        if (this._findState) {
          this._closeFindPanel();
          return true;
        }
        this._selection.clear();
        return true;
      case 'Delete':
      case 'Backspace':
        if (this.editable) this._handleDelete();
        return true;
      default:
        return false;
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
    } catch (err) {
      this.dispatchEvent(new CustomEvent('clipboard-error', {
        detail: { action: 'copy', error: err },
        bubbles: true,
        composed: true,
      }));
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

    const text = await this._readClipboardText();
    if (text == null) return;

    const parsed = parseClipboardText(text);
    if (parsed.length === 0) return;

    const addedRows = this._expandRowsForPaste(this._activeCell.row, parsed.length);
    const changes = this._applyPasteData(this._activeCell, parsed);

    if (changes.length > 0 || addedRows.length > 0) {
      const addedCount = addedRows.length;
      this._undo.push({
        label: 'paste',
        undo: () => {
          for (const c of changes) { this.data[c.row][c.key] = c.oldValue; }
          if (addedCount > 0) {
            this.data.splice(this.data.length - addedCount, addedCount);
          }
          this.requestUpdate();
        },
        redo: () => {
          if (addedCount > 0) {
            for (let i = 0; i < addedCount; i++) {
              this.data.push(this._createEmptyRow());
            }
          }
          for (const c of changes) { this.data[c.row][c.key] = c.newValue; }
          this.requestUpdate();
        },
      });
      this._dispatchUndoStateEvent();
    }

    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('clipboard-paste', {
      detail: { changes, addedRows: addedRows.length },
      bubbles: true,
      composed: true,
    }));
  }

  private async _readClipboardText(): Promise<string | null> {
    try {
      return await navigator.clipboard.readText();
    } catch (err) {
      this.dispatchEvent(new CustomEvent('clipboard-error', {
        detail: { action: 'paste', error: err },
        bubbles: true,
        composed: true,
      }));
      return null;
    }
  }

  private _expandRowsForPaste(startRow: number, pasteRowCount: number): number[] {
    const addedRows: number[] = [];
    const requiredRows = startRow + pasteRowCount;
    const rowLimit = this.maxRows > 0 ? this.maxRows : Infinity;
    while (this.data.length < requiredRows && this.data.length < rowLimit) {
      const insertAt = this.data.length;
      this.data.push(this._createEmptyRow());
      addedRows.push(insertAt);
    }
    if (addedRows.length > 0) {
      this._recomputeView();
    }
    return addedRows;
  }

  private _applyPasteData(
    anchor: { row: number; col: number },
    parsed: string[][],
  ): Array<{ row: number; col: number; key: string; oldValue: unknown; newValue: unknown }> {
    const cols = this.visibleColumns;
    const changes: Array<{ row: number; col: number; key: string; oldValue: unknown; newValue: unknown }> = [];
    for (let r = 0; r < parsed.length; r++) {
      const visualRow = anchor.row + r;
      if (visualRow >= this._visibleRowCount) break;
      const dataRow = this._toDataIndex(visualRow);
      for (let c = 0; c < parsed[r].length; c++) {
        const colIndex = anchor.col + c;
        if (colIndex >= cols.length) break;
        const col = cols[colIndex];
        const oldValue = this.data[dataRow][col.key];
        const newValue = parseValueForColumn(parsed[r][c], col);
        this.data[dataRow][col.key] = newValue;
        changes.push({ row: dataRow, col: colIndex, key: col.key, oldValue, newValue });
      }
    }
    return changes;
  }

  private _handleFillDown(): void {
    const range = this._selection.getEffectiveRange();
    if (!range) return;
    const cols = this.visibleColumns;

    // Single cell: fill from the cell above
    if (range.startRow === range.endRow && range.startCol === range.endCol) {
      if (range.startRow === 0) return;
      const col = cols[range.startCol];
      if (!col || !this._isCellEditable(col)) return;
      const sourceRow = this._toDataIndex(range.startRow - 1);
      const destRow = this._toDataIndex(range.startRow);
      this.updateRows([{ row: destRow, key: col.key, value: this.data[sourceRow][col.key] }]);
      return;
    }

    const changes: Array<{ row: number; key: string; value: unknown }> = [];
    for (let c = range.startCol; c <= range.endCol; c++) {
      const col = cols[c];
      if (!col || !this._isCellEditable(col)) continue;
      const sourceValue = this.data[this._toDataIndex(range.startRow)][col.key];
      for (let r = range.startRow + 1; r <= range.endRow; r++) {
        changes.push({ row: this._toDataIndex(r), key: col.key, value: sourceValue });
      }
    }
    if (changes.length > 0) this.updateRows(changes);
  }

  private _handleFillRight(): void {
    const range = this._selection.getEffectiveRange();
    if (!range) return;
    const cols = this.visibleColumns;

    // Single cell: fill from the cell to the left
    if (range.startRow === range.endRow && range.startCol === range.endCol) {
      if (range.startCol === 0) return;
      const col = cols[range.startCol];
      const srcCol = cols[range.startCol - 1];
      if (!col || !this._isCellEditable(col) || !srcCol) return;
      const dataRow = this._toDataIndex(range.startRow);
      this.updateRows([{ row: dataRow, key: col.key, value: this.data[dataRow][srcCol.key] }]);
      return;
    }

    const changes: Array<{ row: number; key: string; value: unknown }> = [];
    for (let r = range.startRow; r <= range.endRow; r++) {
      const dataRow = this._toDataIndex(r);
      const srcCol = cols[range.startCol];
      if (!srcCol) continue;
      const rawValue = this.data[dataRow][srcCol.key];
      for (let c = range.startCol + 1; c <= range.endCol; c++) {
        const col = cols[c];
        if (!col || !this._isCellEditable(col)) continue;
        const value = parseValueForColumn(rawValue == null ? '' : String(rawValue), col);
        changes.push({ row: dataRow, key: col.key, value });
      }
    }
    if (changes.length > 0) this.updateRows(changes);
  }

  private _handleDelete(): void {
    const range = this._selection.getEffectiveRange();
    const extras = this._selection.extraRanges;
    if (!range && extras.length === 0) return;
    const rangesToClear = range ? [range, ...extras] : [...extras];
    this._clearRanges(rangesToClear);
  }

  private _clearRanges(ranges: Array<{ startRow: number; startCol: number; endRow: number; endCol: number }>): void {
    const cols = this.visibleColumns;
    const saved: Array<{ dataRow: number; key: string; oldValue: unknown; clearValue: unknown }> = [];
    const visited = new Set<string>();

    for (const range of ranges) {
      for (let r = range.startRow; r <= range.endRow; r++) {
        const dataRow = this._toDataIndex(r);
        for (let c = range.startCol; c <= range.endCol; c++) {
          const key = `${dataRow}:${c}`;
          if (visited.has(key)) continue;
          visited.add(key);
          const col = cols[c];
          const oldValue = this.data[dataRow][col.key];
          const clearValue = col.type === 'boolean' ? false : col.type === 'number' ? 0 : '';
          this.data[dataRow][col.key] = clearValue;
          saved.push({ dataRow, key: col.key, oldValue, clearValue });
        }
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
      this._dispatchUndoStateEvent();
    }

    this.requestUpdate();
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
      this._dispatchUndoStateEvent();
    }

    this.requestUpdate();
  }

  private _scrollToActiveCell(): void {
    if (!this._activeCell) return;

    // Vertical scroll
    const rowTop = this._activeCell.row * this.rowHeight + this.headerHeight;
    const rowBottom = rowTop + this.rowHeight;

    if (rowTop < this.scrollTop + this.headerHeight) {
      this.scrollTop = rowTop - this.headerHeight;
    } else if (rowBottom > this.scrollTop + this.clientHeight) {
      this.scrollTop = rowBottom - this.clientHeight;
    }

    // Horizontal scroll — use cached column offsets
    const cols = this.visibleColumns;
    const colIndex = this._activeCell.col;
    const colLeft = this._colLeftOffsets[colIndex] ?? 0;
    const colWidth = this._getColWidth(cols[colIndex]);
    const colRight = colLeft + colWidth;

    if (colLeft < this.scrollLeft) {
      this.scrollLeft = colLeft;
    } else if (colRight > this.scrollLeft + this.clientWidth) {
      this.scrollLeft = colRight - this.clientWidth;
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
    const colIndex = this.visibleColumns.indexOf(col);

    // Ctrl+Click or Meta+Click → column selection
    if (e.ctrlKey || e.metaKey) {
      this._selectColumn(colIndex);
      return;
    }

    if (col.sortable === false) return;
    this._sortCriteria = toggleSort(this._sortCriteria, col.key, e.shiftKey);

    // In server mode, only dispatch the event — don't recompute locally
    if (this.dataMode !== 'server') {
      this._recomputeView();
    }
    this.requestUpdate();

    this.dispatchEvent(new CustomEvent('sort-change', {
      detail: { criteria: [...this._sortCriteria] },
      bubbles: true,
      composed: true,
    }));
  }

  private _selectColumn(colIndex: number): void {
    const rowCount = this._visibleRowCount;
    if (rowCount === 0 || colIndex < 0) return;

    this._selection.setActive(0, colIndex);
    this._selection.setActiveWithRange(rowCount - 1, colIndex);
    this._activeCell = { row: 0, col: colIndex };
    this.requestUpdate();

    this.dispatchEvent(new CustomEvent('column-select', {
      detail: {
        colIndex,
        key: this.visibleColumns[colIndex]?.key,
        rowCount,
      },
      bubbles: true,
      composed: true,
    }));
  }

  /** Public API: select an entire column by index. */
  selectColumn(colIndex: number): void {
    this._selectColumn(colIndex);
  }

  /** Calculate cumulative left offset for a left-pinned column */
  private _getPinnedLeft(colIndex: number): number {
    const cols = this.visibleColumns;
    let left = 0;
    if (this.selectable) left += 36;
    if (this.showRowNumbers) left += 48;
    for (let i = 0; i < colIndex; i++) {
      if (cols[i].pinned === 'left') {
        left += this._getColWidth(cols[i]);
      }
    }
    return left;
  }

  /** Calculate cumulative right offset for a right-pinned column */
  private _getPinnedRight(colIndex: number): number {
    const cols = this.visibleColumns;
    let right = 0;
    for (let i = cols.length - 1; i > colIndex; i--) {
      if (cols[i].pinned === 'right') {
        right += this._getColWidth(cols[i]);
      }
    }
    return right;
  }

  private _renderHeaderCell(col: ColumnDefinition, colIndex: number) {
    const sortable = col.sortable !== false;
    const criterion = this._sortCriteria.find(c => c.key === col.key);
    const sortIndex = this._sortCriteria.length > 1
      ? this._sortCriteria.findIndex(c => c.key === col.key)
      : -1;

    const hasFilter = this._filters.some(f => f.key === col.key);
    const isPinnedLeft = col.pinned === 'left';
    const isPinnedRight = col.pinned === 'right';
    const isPinned = isPinnedLeft || isPinnedRight;

    const classes = [
      'ft-header-cell',
      sortable ? 'ft-sortable' : '',
      isPinned ? 'ft-pinned' : '',
    ].filter(Boolean).join(' ');

    const ariaSortValue = sortable
      ? (criterion
        ? (criterion.direction === 'asc' ? 'ascending' : 'descending')
        : 'none')
      : undefined;

    const width = this._getColWidth(col);
    const hdrH = this.headerHeight;
    const left = this._colLeftOffsets[colIndex] ?? 0;

    let cellStyle: string;
    if (isPinnedLeft) {
      cellStyle = `position: absolute; top: 0; left: ${this._scrollLeft + this._getPinnedLeft(colIndex)}px; width: ${width}px; height: ${hdrH}px; z-index: 4;`;
    } else if (isPinnedRight) {
      cellStyle = `position: absolute; top: 0; right: ${-this._scrollLeft + this._getPinnedRight(colIndex)}px; width: ${width}px; height: ${hdrH}px; z-index: 4;`;
    } else {
      cellStyle = `left: ${left}px; width: ${width}px; height: ${hdrH}px;`;
    }

    const isDraggingThis = this._colDrag?.active && this._colDrag.colIndex === colIndex;
    const dragClasses = [
      ...classes.split(' '),
      isDraggingThis ? 'ft-col-dragging' : '',
    ].filter(Boolean).join(' ');

    // Find hidden columns in this.columns that are between the previous visible column and this one
    const allCols = this.columns;
    const thisAllIdx = allCols.findIndex(c => c.key === col.key);
    const hiddenBefore: ColumnDefinition[] = [];
    if (thisAllIdx > 0) {
      for (let i = thisAllIdx - 1; i >= 0; i--) {
        if (allCols[i].hidden) hiddenBefore.push(allCols[i]);
        else break;
      }
    }
    const showHiddenIndicator = hiddenBefore.length > 0;

    return html`
      <div class=${dragClasses}
        role="columnheader"
        data-col-index=${colIndex}
        style=${cellStyle}
        aria-sort=${ariaSortValue ?? nothing}
        @contextmenu=${(e: MouseEvent) => this._onHeaderContextMenu(e, col)}
        @mousedown=${(e: MouseEvent) => this._onHeaderMouseDown(e, col, colIndex)}
        @click=${sortable ? (e: MouseEvent) => this._onHeaderClick(e, col) : undefined}>
        ${showHiddenIndicator ? html`
          <button class="ft-hidden-col-indicator"
            title="Show hidden column(s)"
            @click=${(e: MouseEvent) => { e.stopPropagation(); this._showHiddenBefore(col); }}>&#x276F;</button>
        ` : ''}
        <span>${col.header}</span>
        ${criterion ? html`<span class="ft-sort-indicator">${criterion.direction === 'asc' ? '\u25B2' : '\u25BC'}</span>` : ''}
        ${sortIndex >= 0 ? html`<span class="ft-sort-order">${sortIndex + 1}</span>` : ''}
        ${this.showFilters ? html`
          <button class="ft-filter-btn ${hasFilter ? 'ft-filter-active' : ''}"
            title="Filter"
            aria-label=${`Filter ${col.header}`}
            aria-expanded=${this._openFilterKey === col.key ? 'true' : 'false'}
            @click=${(e: MouseEvent) => this._onFilterBtnClick(e, col)}>
            \u25BD
          </button>
        ` : ''}
        <div class="ft-resize-handle"
          @mousedown=${(e: MouseEvent) => { e.stopPropagation(); this._onResizeStart(e, colIndex); }}
          @dblclick=${(e: MouseEvent) => this._onResizeAutoFit(e, colIndex)}></div>
      </div>
      ${this._openFilterKey === col.key ? this._renderFilterDropdown(col) : ''}
    `;
  }

  private _onHeaderContextMenu(e: MouseEvent, col: ColumnDefinition): void {
    e.preventDefault();
    const allCols = this.columns;
    const thisIdx = allCols.findIndex(c => c.key === col.key);
    const hiddenNeighbors: ColumnDefinition[] = [];
    // Collect adjacent hidden columns (before and after)
    for (let i = thisIdx - 1; i >= 0; i--) {
      if (allCols[i].hidden) hiddenNeighbors.push(allCols[i]);
      else break;
    }
    for (let i = thisIdx + 1; i < allCols.length; i++) {
      if (allCols[i].hidden) hiddenNeighbors.push(allCols[i]);
      else break;
    }

    this._headerMenu = { key: col.key, x: e.clientX, y: e.clientY, hiddenNeighbors };
    this.dispatchEvent(new CustomEvent('header-context-menu', {
      detail: { key: col.key, header: col.header, x: e.clientX, y: e.clientY },
      bubbles: true,
      composed: true,
    }));
    requestAnimationFrame(() => {
      document.addEventListener('click', this._onDocumentClick, { once: true });
    });
  }

  private _showHiddenBefore(col: ColumnDefinition): void {
    const allCols = this.columns;
    const thisIdx = allCols.findIndex(c => c.key === col.key);
    for (let i = thisIdx - 1; i >= 0; i--) {
      if (allCols[i].hidden) this._setColumnHidden(allCols[i].key, false);
      else break;
    }
  }

  private _renderHeaderContextMenu() {
    if (!this._headerMenu) return nothing;
    const { key, x, y, hiddenNeighbors } = this._headerMenu;
    const col = this.columns.find(c => c.key === key);
    if (!col) return nothing;

    return html`
      <div class="ft-header-menu" style="position: fixed; left: ${x}px; top: ${y}px; z-index: 200;"
        @mousedown=${(e: MouseEvent) => e.stopPropagation()}>
        <div class="ft-header-menu-item"
          @click=${() => { this._setColumnHidden(key, true); this._headerMenu = null; }}>
          Hide column
        </div>
        ${hiddenNeighbors.map(h => html`
          <div class="ft-header-menu-item"
            @click=${() => { this._setColumnHidden(h.key, false); this._headerMenu = null; }}>
            Show: ${h.header}
          </div>
        `)}
      </div>
    `;
  }

  private _renderBodyContextMenu() {
    if (!this._bodyContextMenu) return nothing;
    const { colIndex, dataIndex, x, y } = this._bodyContextMenu;
    const col = this.visibleColumns[colIndex];
    if (!col) return nothing;
    const value = this.data[dataIndex]?.[col.key];
    const hasFilter = this._filters.some(f => f.key === col.key);
    const close = () => { this._bodyContextMenu = null; };

    // Viewport boundary correction: if menu would go off-screen, flip
    const menuW = 200;
    const menuH = 280;
    const adjustedX = x + menuW > window.innerWidth ? x - menuW : x;
    const adjustedY = y + menuH > window.innerHeight ? y - menuH : y;

    return html`
      <div class="ft-body-context-menu" style="position: fixed; left: ${adjustedX}px; top: ${adjustedY}px; z-index: 200;"
        @mousedown=${(e: MouseEvent) => e.stopPropagation()}>
        <div class="ft-context-menu-item"
          @click=${() => { this._handleCopy(false); close(); }}>
          Copy
        </div>
        <div class="ft-context-menu-separator"></div>
        <div class="ft-context-menu-item"
          @click=${() => { this.addRow(undefined, dataIndex); close(); }}>
          Insert row above
        </div>
        <div class="ft-context-menu-item"
          @click=${() => { this.addRow(undefined, dataIndex + 1); close(); }}>
          Insert row below
        </div>
        <div class="ft-context-menu-item ft-context-menu-danger"
          @click=${() => { this.deleteRows([dataIndex]); close(); }}>
          Delete row
        </div>
        <div class="ft-context-menu-separator"></div>
        <div class="ft-context-menu-item"
          @click=${() => { this._setColumnHidden(col.key, true); close(); }}>
          Hide column
        </div>
        <div class="ft-context-menu-separator"></div>
        <div class="ft-context-menu-item"
          @click=${() => { this._applySortFromMenu(col.key, 'asc'); close(); }}>
          Sort ascending ↑
        </div>
        <div class="ft-context-menu-item"
          @click=${() => { this._applySortFromMenu(col.key, 'desc'); close(); }}>
          Sort descending ↓
        </div>
        <div class="ft-context-menu-separator"></div>
        <div class="ft-context-menu-item"
          @click=${() => { this.setFilter(col.key, (v) => v === value); close(); }}>
          Filter by this value
        </div>
        ${hasFilter ? html`
          <div class="ft-context-menu-item"
            @click=${() => { this.removeFilter(col.key); close(); }}>
            Clear filter
          </div>
        ` : ''}
      </div>
    `;
  }

  private _applySortFromMenu(key: string, dir: 'asc' | 'desc'): void {
    const col = this.columns.find(c => c.key === key);
    if (!col) return;
    this._sortCriteria = [{ key, direction: dir }];
    this._sortedIndices = computeSortedIndices(this.data, this._sortCriteria, this.columns);
    this.dispatchEvent(new CustomEvent('sort-change', {
      detail: { sortCriteria: [...this._sortCriteria] },
      bubbles: true,
      composed: true,
    }));
    this.requestUpdate();
  }

  // --- Filter UI ---

  private _adjustFilterDropdown(): void {
    if (!this._openFilterKey) return;
    const dropdown = this.shadowRoot?.querySelector('.ft-filter-dropdown') as HTMLElement | null;
    if (!dropdown) return;

    // Reset any previous adjustments
    dropdown.style.top = '';
    dropdown.style.bottom = '';

    const rect = dropdown.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // If dropdown extends beyond viewport bottom, flip it above the header
    if (rect.bottom > viewportHeight) {
      dropdown.style.top = 'auto';
      dropdown.style.bottom = '100%';
    }
  }

  private _onFilterBtnClick(e: MouseEvent, col: ColumnDefinition): void {
    e.preventDefault();
    e.stopPropagation();
    const newKey = this._openFilterKey === col.key ? null : col.key;
    this._openFilterKey = newKey;

    if (newKey) {
      // Delay to avoid immediate close from current click
      requestAnimationFrame(() => {
        document.addEventListener('click', this._onDocumentClick, { once: true });
      });
    }
  }

  private _renderFilterDropdown(col: ColumnDefinition) {
    const type = col.type ?? 'text';

    return html`
      <div class="ft-filter-dropdown" @click=${(e: MouseEvent) => e.stopPropagation()}>
        ${type === 'boolean' ? this._renderBooleanFilter(col)
          : type === 'number' ? this._renderNumberFilter(col)
          : type === 'date' || type === 'datetime' ? this._renderDateFilter(col)
          : this._renderTextFilter(col)}
        <div class="ft-filter-actions">
          <button class="ft-filter-clear" @click=${() => this._clearColumnFilter(col.key)}>Clear</button>
        </div>
      </div>
    `;
  }

  private _renderTextFilter(col: ColumnDefinition) {
    return html`
      <input class="ft-filter-input" type="text" placeholder="Search..."
        .value=${this._textFilterState.get(col.key) ?? ''}
        @input=${(e: InputEvent) => {
          const value = (e.target as HTMLInputElement).value;
          this._textFilterState.set(col.key, value);
          if (value) {
            this.setFilter(col.key, (v) => String(v ?? '').toLowerCase().includes(value.toLowerCase()));
          } else {
            this.removeFilter(col.key);
          }
        }}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Escape') this._openFilterKey = null;
          e.stopPropagation();
        }}>
    `;
  }

  private _renderNumberFilter(col: ColumnDefinition) {
    const state = this._numberFilterState.get(col.key) ?? {};
    return html`
      <div class="ft-filter-range">
        <input class="ft-filter-input" type="number" placeholder="Min"
          .value=${state.min != null ? String(state.min) : ''}
          @input=${(e: InputEvent) => this._applyNumberFilter(col.key, e, 'min')}
          @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape') this._openFilterKey = null; e.stopPropagation(); }}>
        <input class="ft-filter-input" type="number" placeholder="Max"
          .value=${state.max != null ? String(state.max) : ''}
          @input=${(e: InputEvent) => this._applyNumberFilter(col.key, e, 'max')}
          @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape') this._openFilterKey = null; e.stopPropagation(); }}>
      </div>
    `;
  }

  private _invalidCells: Map<string, { error: string; timer: ReturnType<typeof setTimeout> }> = new Map();

  private _cellKey(row: number, col: number): string {
    return `${row}:${col}`;
  }

  private _markCellInvalid(row: number, col: number, error: string): void {
    const key = this._cellKey(row, col);
    const existing = this._invalidCells.get(key);
    if (existing) clearTimeout(existing.timer);

    const timer = setTimeout(() => {
      this._invalidCells.delete(key);
      this.requestUpdate();
    }, 3000);
    this._invalidCells.set(key, { error, timer });
    this.requestUpdate();
  }

  private _isCellInvalid(row: number, col: number): string | null {
    const entry = this._invalidCells.get(this._cellKey(row, col));
    return entry ? entry.error : null;
  }
  private _textFilterState: Map<string, string> = new Map();
  private _numberFilterState: Map<string, { min?: number; max?: number }> = new Map();
  private _dateFilterState: Map<string, { from?: string; to?: string }> = new Map();

  private _applyNumberFilter(key: string, e: InputEvent, bound: 'min' | 'max'): void {
    const value = (e.target as HTMLInputElement).value;
    const state = this._numberFilterState.get(key) ?? {};
    if (value === '') {
      delete state[bound];
    } else {
      state[bound] = Number(value);
    }
    this._numberFilterState.set(key, state);

    if (state.min == null && state.max == null) {
      this.removeFilter(key);
    } else {
      this.setFilter(key, (v) => {
        const n = Number(v);
        if (isNaN(n)) return false;
        if (state.min != null && n < state.min) return false;
        if (state.max != null && n > state.max) return false;
        return true;
      });
    }
  }

  private _renderDateFilter(col: ColumnDefinition) {
    const inputType = col.type === 'datetime' ? 'datetime-local' : 'date';
    const state = this._dateFilterState.get(col.key) ?? {};
    return html`
      <div class="ft-filter-range">
        <input class="ft-filter-input" type=${inputType} placeholder="From"
          .value=${state.from ?? ''}
          @input=${(e: InputEvent) => this._applyDateFilter(col.key, e, 'from')}
          @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape') this._openFilterKey = null; e.stopPropagation(); }}>
        <input class="ft-filter-input" type=${inputType} placeholder="To"
          .value=${state.to ?? ''}
          @input=${(e: InputEvent) => this._applyDateFilter(col.key, e, 'to')}
          @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape') this._openFilterKey = null; e.stopPropagation(); }}>
      </div>
    `;
  }

  private _applyDateFilter(key: string, e: InputEvent, bound: 'from' | 'to'): void {
    const value = (e.target as HTMLInputElement).value;
    const state = this._dateFilterState.get(key) ?? {};
    if (value === '') {
      delete state[bound];
    } else {
      state[bound] = value;
    }
    this._dateFilterState.set(key, state);

    if (state.from == null && state.to == null) {
      this.removeFilter(key);
    } else {
      this.setFilter(key, (v) => {
        if (v == null || v === '') return false;
        const d = v instanceof Date ? v : new Date(String(v));
        if (isNaN(d.getTime())) return false;
        if (state.from) {
          const from = new Date(state.from);
          if (d < from) return false;
        }
        if (state.to) {
          const to = new Date(state.to);
          // For date type, include the entire end day
          if (state.to.length === 10) {
            to.setHours(23, 59, 59, 999);
          }
          if (d > to) return false;
        }
        return true;
      });
    }
  }

  private _renderBooleanFilter(col: ColumnDefinition) {
    return html`
      <select class="ft-filter-input"
        @change=${(e: Event) => {
          const value = (e.target as HTMLSelectElement).value;
          if (value === 'all') {
            this.removeFilter(col.key);
          } else {
            this.setFilter(col.key, (v) => Boolean(v) === (value === 'true'));
          }
        }}
        @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape') this._openFilterKey = null; e.stopPropagation(); }}>
        <option value="all">All</option>
        <option value="true">\u2714 True</option>
        <option value="false">\u2718 False</option>
      </select>
    `;
  }

  private _clearColumnFilter(key: string): void {
    this.removeFilter(key);
    this._textFilterState.delete(key);
    this._numberFilterState.delete(key);
    this._dateFilterState.delete(key);
    this._openFilterKey = null;
  }

  // --- Column Resize ---

  private _onResizeAutoFit(e: MouseEvent, colIndex: number): void {
    e.preventDefault();
    e.stopPropagation();

    const col = this.visibleColumns[colIndex];
    if (!col) return;

    // Measure content widths by scanning visible cells using data-col-index attribute
    const cells = this.shadowRoot?.querySelectorAll(`.ft-cell[data-col-index="${colIndex}"]`);
    let maxWidth = 0;

    // Measure header text width using data-col-index attribute
    const headerCell = this.shadowRoot?.querySelector(`.ft-header-cell[data-col-index="${colIndex}"]`) as HTMLElement | null;
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
    this._columnWidths.set(col.key, newWidth);
    this.requestUpdate();

    this.dispatchEvent(new CustomEvent('column-resize', {
      detail: { key: col.key, width: newWidth, colIndex },
      bubbles: true,
      composed: true,
    }));
  }

  private _onResizeStart(e: MouseEvent, colIndex: number): void {
    e.preventDefault();
    e.stopPropagation(); // Prevent sort toggle

    const col = this.visibleColumns[colIndex];
    const startWidth = this._columnWidths.get(col.key) ?? col.width ?? DEFAULT_COL_WIDTH;
    this._resizing = { colIndex, startX: e.clientX, startWidth };

    const onMouseMove = (ev: MouseEvent) => {
      if (!this._resizing) return;
      const delta = ev.clientX - this._resizing.startX;
      const minW = col.minWidth ?? MIN_COL_WIDTH;
      const newWidth = Math.max(minW, this._resizing.startWidth + delta);
      this._columnWidths.set(col.key, newWidth);
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
        const finalWidth = this._columnWidths.get(col.key) ?? DEFAULT_COL_WIDTH;
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

  // --- Column drag reorder ---

  private _onHeaderMouseDown(e: MouseEvent, col: ColumnDefinition, colIndex: number): void {
    if (e.button !== 0) return;
    e.preventDefault();

    this._colDrag = { col, colIndex, startX: e.clientX, ghost: null, active: false, targetIndex: colIndex };

    const onMouseMove = (ev: MouseEvent) => {
      if (!this._colDrag) return;
      const dx = Math.abs(ev.clientX - this._colDrag.startX);
      if (!this._colDrag.active && dx > 5) {
        this._colDrag.active = true;
        this._startColumnGhost(ev);
        this.requestUpdate();
      }
      if (this._colDrag.active) {
        this._updateColumnDrag(ev);
      }
    };

    const onMouseUp = (_ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (this._colDrag?.active) {
        this._finishColumnDrag();
      }
      if (this._colDrag?.ghost) {
        this._colDrag.ghost.remove();
      }
      this._colDrag = null;
      this._colDragIndicatorLeft = null;
      this.requestUpdate();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  private _startColumnGhost(e: MouseEvent): void {
    const ghost = document.createElement('div');
    ghost.textContent = this._colDrag!.col.header ?? this._colDrag!.col.key;
    ghost.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:9999',
      'opacity:0.85',
      `background:${getComputedStyle(this).getPropertyValue('--ft-header-bg') || '#f0f0f0'}`,
      `border:2px solid ${getComputedStyle(this).getPropertyValue('--ft-active-color') || '#3b82f6'}`,
      'padding:4px 10px',
      'border-radius:4px',
      'font-size:13px',
      'font-weight:600',
      'white-space:nowrap',
      `left:${e.clientX + 12}px`,
      `top:${e.clientY - 14}px`,
    ].join(';');
    document.body.appendChild(ghost);
    this._colDrag!.ghost = ghost;
  }

  private _updateColumnDrag(e: MouseEvent): void {
    if (!this._colDrag) return;

    if (this._colDrag.ghost) {
      this._colDrag.ghost.style.left = `${e.clientX + 12}px`;
      this._colDrag.ghost.style.top = `${e.clientY - 14}px`;
    }

    const rect = this.getBoundingClientRect();
    const scrollLeft = this._scrollLeft;
    const cols = this.visibleColumns;
    const mouseX = e.clientX - rect.left + scrollLeft;

    let targetIndex = cols.length;
    for (let i = 0; i < cols.length; i++) {
      const midpoint = (this._colLeftOffsets[i] ?? 0) + this._getColWidth(cols[i]) / 2;
      if (mouseX < midpoint) { targetIndex = i; break; }
    }

    if (this._colDrag.colIndex < targetIndex) targetIndex--;

    this._colDrag.targetIndex = targetIndex;
    const indicatorColIndex = targetIndex < cols.length ? targetIndex : cols.length - 1;
    const indicatorOffset = targetIndex < cols.length
      ? (this._colLeftOffsets[indicatorColIndex] ?? 0)
      : (this._colLeftOffsets[indicatorColIndex] ?? 0) + this._getColWidth(cols[indicatorColIndex]);
    this._colDragIndicatorLeft = indicatorOffset - scrollLeft + this._prefixWidth;
    this.requestUpdate();
  }

  private _finishColumnDrag(): void {
    if (!this._colDrag) return;
    const { col, colIndex, targetIndex } = this._colDrag;
    if (targetIndex !== colIndex) {
      this.moveColumn(col.key, targetIndex);
    }
  }

  // --- Fill Handle ---

  private _onFillHandleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const sourceRange = this._selection.getEffectiveRange();
    if (!sourceRange) return;

    this._fillDrag = { sourceRange, targetRange: null, active: false };

    const onMouseMove = (ev: MouseEvent) => {
      if (!this._fillDrag) return;
      this._fillDrag.active = true;
      this._updateFillDrag(ev);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (this._fillDrag?.active && this._fillDrag.targetRange) {
        this._applyFillHandle(this._fillDrag.sourceRange, this._fillDrag.targetRange);
      }
      this._fillDrag = null;
      this.requestUpdate();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  private _updateFillDrag(e: MouseEvent): void {
    if (!this._fillDrag) return;
    const rect = this.getBoundingClientRect();
    const mx = e.clientX - rect.left + this._scrollLeft - this._prefixWidth;
    const my = e.clientY - rect.top + this._scrollTop - this.headerHeight;
    const cols = this.visibleColumns;

    let colIdx = 0;
    for (let i = 0; i < cols.length; i++) {
      if ((this._colLeftOffsets[i] ?? 0) <= mx) colIdx = i;
    }
    const rowIdx = Math.max(0, Math.min(this._visibleRowCount - 1, Math.floor(my / this.rowHeight)));

    const { sourceRange: src } = this._fillDrag;
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
    this._fillDrag.targetRange = target;
    this.requestUpdate();
  }

  _applyFillHandle(sourceRange: CellRange, targetRange: CellRange): void {
    const cols = this.visibleColumns;
    const saved: Array<{ dataRow: number; key: string; oldValue: unknown; newValue: unknown }> = [];

    for (let c = targetRange.startCol; c <= targetRange.endCol; c++) {
      const col = cols[c];
      const srcRows = [];
      for (let r = sourceRange.startRow; r <= sourceRange.endRow; r++) {
        srcRows.push(this.data[this._toDataIndex(r)][col.key]);
      }
      const series = this._detectNumericSeries(srcRows);

      for (let r = targetRange.startRow; r <= targetRange.endRow; r++) {
        if (r >= sourceRange.startRow && r <= sourceRange.endRow) continue;
        const dataRow = this._toDataIndex(r);
        const oldValue = this.data[dataRow][col.key];
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
        this.data[dataRow][col.key] = newValue;
        saved.push({ dataRow, key: col.key, oldValue, newValue });
      }
    }

    if (saved.length > 0) {
      this._undo.push({
        label: 'fill-handle',
        undo: () => { for (const s of saved) this.data[s.dataRow][s.key] = s.oldValue; this.requestUpdate(); },
        redo: () => { for (const s of saved) this.data[s.dataRow][s.key] = s.newValue; this.requestUpdate(); },
      });
      this._dispatchUndoStateEvent();
      this.dispatchEvent(new CustomEvent('fill-handle-apply', {
        detail: { sourceRange, targetRange, cells: saved },
        bubbles: true, composed: true,
      }));
    }
    this.requestUpdate();
  }

  private _detectNumericSeries(values: unknown[]): { last: number; diff: number } | null {
    if (values.length < 2) return null;
    const nums = values.map(v => Number(v));
    if (nums.some(n => isNaN(n))) return null;
    const diff = nums[1] - nums[0];
    for (let i = 2; i < nums.length; i++) {
      if (Math.abs(nums[i] - nums[i - 1] - diff) > 1e-9) return null;
    }
    return { last: nums[nums.length - 1], diff };
  }

  private _renderFillHandle() {
    if (!this.editable) return '';
    const range = this._selection.getEffectiveRange();
    if (!range) return '';
    const cols = this.visibleColumns;
    if (range.endCol >= cols.length || range.endRow >= this._visibleRowCount) return '';

    const left = this._prefixWidth + (this._colLeftOffsets[range.endCol] ?? 0) + this._getColWidth(cols[range.endCol]) - this._scrollLeft - 4;
    const top = this.headerHeight + (range.endRow + 1) * this.rowHeight - this._scrollTop - 4;

    if (left < 0 || top < this.headerHeight) return '';

    // Preview dashed border during drag
    const preview = this._fillDrag?.active && this._fillDrag.targetRange
      ? this._renderFillPreview(this._fillDrag.targetRange)
      : '';

    return html`
      ${preview}
      <div class="ft-fill-handle"
        style="left:${left}px;top:${top}px;"
        @mousedown=${(e: MouseEvent) => this._onFillHandleMouseDown(e)}>
      </div>
    `;
  }

  private _renderFillPreview(range: CellRange) {
    const cols = this.visibleColumns;
    if (range.endCol >= cols.length || range.endRow >= this._visibleRowCount) return '';
    const left = this._prefixWidth + (this._colLeftOffsets[range.startCol] ?? 0) - this._scrollLeft;
    const top = this.headerHeight + range.startRow * this.rowHeight - this._scrollTop;
    const width = (this._colLeftOffsets[range.endCol] ?? 0) + this._getColWidth(cols[range.endCol]) - (this._colLeftOffsets[range.startCol] ?? 0);
    const height = (range.endRow - range.startRow + 1) * this.rowHeight;
    return html`<div class="ft-fill-preview" style="left:${left}px;top:${top}px;width:${width}px;height:${height}px;"></div>`;
  }

  // --- Row drag reorder ---

  private _onRowNumMouseDown(e: MouseEvent, rowIndex: number): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    this._rowDrag = { rowIndex, startY: e.clientY, ghost: null, active: false, targetIndex: rowIndex };

    const onMouseMove = (ev: MouseEvent) => {
      if (!this._rowDrag) return;
      const dy = Math.abs(ev.clientY - this._rowDrag.startY);
      if (!this._rowDrag.active && dy > 5) {
        this._rowDrag.active = true;
        this._startRowGhost(ev, rowIndex);
        this.requestUpdate();
      }
      if (this._rowDrag.active) this._updateRowDrag(ev);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (this._rowDrag?.active) this._finishRowDrag();
      if (this._rowDrag?.ghost) this._rowDrag.ghost.remove();
      this._rowDrag = null;
      this._rowDragIndicatorY = null;
      this.requestUpdate();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  private _startRowGhost(e: MouseEvent, rowIndex: number): void {
    const dataIndex = this._toDataIndex(rowIndex);
    const row = this.data[dataIndex];
    const label = this.visibleColumns[0]
      ? String(row[this.visibleColumns[0].key] ?? dataIndex + 1)
      : String(dataIndex + 1);
    const ghost = document.createElement('div');
    ghost.textContent = label;
    ghost.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:9999',
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
    this._rowDrag!.ghost = ghost;
  }

  private _updateRowDrag(e: MouseEvent): void {
    if (!this._rowDrag) return;
    if (this._rowDrag.ghost) {
      this._rowDrag.ghost.style.left = `${e.clientX + 12}px`;
      this._rowDrag.ghost.style.top = `${e.clientY - 10}px`;
    }

    const rect = this.getBoundingClientRect();
    const mouseY = e.clientY - rect.top + this._scrollTop - this.headerHeight;
    const rowH = this.rowHeight;

    let targetIndex = Math.round(mouseY / rowH);
    targetIndex = Math.max(0, Math.min(this._visibleRowCount, targetIndex));
    if (this._rowDrag.rowIndex < targetIndex) targetIndex--;

    this._rowDrag.targetIndex = targetIndex;
    const indicatorY = this.headerHeight + targetIndex * rowH - this._scrollTop;
    this._rowDragIndicatorY = Math.max(this.headerHeight, Math.min(indicatorY, rect.height));
    this.requestUpdate();
  }

  private _finishRowDrag(): void {
    if (!this._rowDrag) return;
    const { rowIndex, targetIndex } = this._rowDrag;
    if (targetIndex === rowIndex) return;

    const fromDataIdx = this._toDataIndex(rowIndex);
    const toDataIdx = this._toDataIndex(targetIndex);
    const oldData = [...this.data];
    const newData = [...this.data];
    const [moved] = newData.splice(fromDataIdx, 1);
    newData.splice(toDataIdx, 0, moved);
    this.data = newData;

    this._undo.push({
      label: 'row-reorder',
      undo: () => { this.data = [...oldData]; this.requestUpdate(); },
      redo: () => { this.data = [...newData]; this.requestUpdate(); },
    });
    this._dispatchUndoStateEvent();
    this.dispatchEvent(new CustomEvent('row-reorder', {
      detail: { from: fromDataIdx, to: toDataIdx },
      bubbles: true, composed: true,
    }));
  }

  // --- Find / Replace ---

  private _toggleFindPanel(mode: 'find' | 'replace'): void {
    if (this._findState?.mode === mode) {
      this._closeFindPanel();
      return;
    }
    this._openFindPanel(mode);
  }

  _openFindPanel(mode: 'find' | 'replace'): void {
    this._findState = {
      mode,
      query: this._findState?.query ?? '',
      replaceWith: this._findState?.replaceWith ?? '',
      matchCase: false,
      wholeCell: false,
      results: [],
      currentIndex: 0,
    };
    if (this._findState.query) this._findSearch();
    this.requestUpdate();
    requestAnimationFrame(() => {
      this.shadowRoot?.querySelector<HTMLInputElement>('.ft-find-input')?.focus();
    });
  }

  private _closeFindPanel(): void {
    this._findState = null;
    this.requestUpdate();
  }

  _findSearch(): void {
    if (!this._findState) return;
    const { query, matchCase, wholeCell } = this._findState;
    if (!query) {
      this._findState.results = [];
      this._findState.currentIndex = 0;
      this.requestUpdate();
      return;
    }

    const needle = matchCase ? query : query.toLowerCase();
    const cols = this.visibleColumns;
    const results: Array<{ row: number; col: number }> = [];

    for (let r = 0; r < this._visibleRowCount; r++) {
      const dataRow = this._toDataIndex(r);
      for (let c = 0; c < cols.length; c++) {
        const cellVal = String(this.data[dataRow][cols[c].key] ?? '');
        const haystack = matchCase ? cellVal : cellVal.toLowerCase();
        const hit = wholeCell ? haystack === needle : haystack.includes(needle);
        if (hit) results.push({ row: r, col: c });
      }
    }

    this._findState.results = results;
    this._findState.currentIndex = 0;
    this.requestUpdate();
  }

  private _findGoTo(index: number): void {
    if (!this._findState || this._findState.results.length === 0) return;
    const count = this._findState.results.length;
    this._findState.currentIndex = ((index % count) + count) % count;
    const { row, col } = this._findState.results[this._findState.currentIndex];
    this._selection.setActive(row, col);
    this._activeCell = { row, col };
    this._scrollToActiveCell();
    this.requestUpdate();
  }

  private _findNext(): void {
    if (!this._findState) return;
    this._findGoTo(this._findState.currentIndex + 1);
  }

  private _findPrev(): void {
    if (!this._findState) return;
    this._findGoTo(this._findState.currentIndex - 1);
  }

  _replaceAll(): void {
    if (!this._findState || this._findState.results.length === 0) return;
    const { results, replaceWith } = this._findState;
    const cols = this.visibleColumns;
    const saved: Array<{ dataRow: number; key: string; oldValue: unknown; newValue: unknown }> = [];

    for (const { row, col } of results) {
      const dataRow = this._toDataIndex(row);
      const key = cols[col].key;
      const oldValue = this.data[dataRow][key];
      this.data[dataRow][key] = replaceWith;
      saved.push({ dataRow, key, oldValue, newValue: replaceWith });
    }

    if (saved.length > 0) {
      this._undo.push({
        label: 'replace-all',
        undo: () => { for (const s of saved) this.data[s.dataRow][s.key] = s.oldValue; this.requestUpdate(); },
        redo: () => { for (const s of saved) this.data[s.dataRow][s.key] = s.newValue; this.requestUpdate(); },
      });
      this._dispatchUndoStateEvent();
      this.dispatchEvent(new CustomEvent('find-replace', {
        detail: { type: 'replace-all', cells: saved.map(s => ({ row: s.dataRow, col: s.key, oldValue: s.oldValue, newValue: s.newValue })) },
        bubbles: true, composed: true,
      }));
    }

    this._findState.results = [];
    this._findState.currentIndex = 0;
    this.requestUpdate();
  }

  private _replaceOne(): void {
    if (!this._findState || this._findState.results.length === 0) return;
    const { currentIndex, results, replaceWith } = this._findState;
    const { row, col } = results[currentIndex];
    const dataRow = this._toDataIndex(row);
    const key = this.visibleColumns[col].key;
    const oldValue = this.data[dataRow][key];
    this.data[dataRow][key] = replaceWith;

    this._undo.push({
      label: 'replace',
      undo: () => { this.data[dataRow][key] = oldValue; this.requestUpdate(); },
      redo: () => { this.data[dataRow][key] = replaceWith; this.requestUpdate(); },
    });
    this._dispatchUndoStateEvent();
    this.dispatchEvent(new CustomEvent('find-replace', {
      detail: { type: 'replace', cells: [{ row: dataRow, col: key, oldValue, newValue: replaceWith }] },
      bubbles: true, composed: true,
    }));

    this._findSearch();
    this._findGoTo(Math.min(currentIndex, this._findState.results.length - 1));
  }

  private _renderFindPanel() {
    if (!this._findState) return '';
    const { mode, query, replaceWith, matchCase, wholeCell, results, currentIndex } = this._findState;
    const count = results.length;
    const current = count > 0 ? currentIndex + 1 : 0;

    return html`
      <div class="ft-find-panel"
        @keydown=${(e: KeyboardEvent) => {
          e.stopPropagation();
          if (e.key === 'Escape') { this._closeFindPanel(); return; }
          if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.classList.contains('ft-find-input')) {
            e.shiftKey ? this._findPrev() : this._findNext();
          }
        }}>
        <div class="ft-find-row">
          <input class="ft-find-input" type="text" placeholder="Find..."
            .value=${query}
            @input=${(e: Event) => {
              this._findState!.query = (e.target as HTMLInputElement).value;
              this._findSearch();
            }}>
          <span class="ft-find-count">${count > 0 ? `${current}/${count}` : query ? '0 results' : ''}</span>
          <button @click=${() => this._findPrev()} title="Previous (Shift+Enter)">◀</button>
          <button @click=${() => this._findNext()} title="Next (Enter)">▶</button>
          <label title="Match case"><input type="checkbox" ?checked=${matchCase} @change=${(e: Event) => { this._findState!.matchCase = (e.target as HTMLInputElement).checked; this._findSearch(); }}> Aa</label>
          <label title="Whole cell"><input type="checkbox" ?checked=${wholeCell} @change=${(e: Event) => { this._findState!.wholeCell = (e.target as HTMLInputElement).checked; this._findSearch(); }}> [ ]</label>
          <button @click=${() => this._closeFindPanel()} title="Close (Escape)">✕</button>
        </div>
        ${mode === 'replace' ? html`
          <div class="ft-find-row">
            <input class="ft-find-replace-input" type="text" placeholder="Replace with..."
              .value=${replaceWith}
              @input=${(e: Event) => { this._findState!.replaceWith = (e.target as HTMLInputElement).value; }}>
            <button @click=${() => this._replaceOne()} ?disabled=${count === 0}>Replace</button>
            <button @click=${() => this._replaceAll()} ?disabled=${count === 0}>Replace All</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  // --- Rendering ---

  render() {
    const cols = this.visibleColumns;

    if (cols.length === 0) {
      return html`<div class="ft-empty">No columns defined</div>`;
    }

    const hdrH = this.headerHeight;
    const tw = this._totalRowWidth;

    // Compute which columns are in the horizontal viewport
    const { start: colStart, end: colEnd } = this.visibleColRange;

    // Determine pinned column indices that are outside the visible range (always render)
    const pinnedIndices: number[] = [];
    for (let i = 0; i < cols.length; i++) {
      if ((cols[i].pinned === 'left' || cols[i].pinned === 'right') && (i < colStart || i >= colEnd)) {
        pinnedIndices.push(i);
      }
    }

    // --- Header prefix cells ---
    let prefixLeft = 0;
    const sl = this._scrollLeft;
    const selectAllHeader = this.selectable
      ? html`<div class="ft-checkbox-header"
            style="position: absolute; top: 0; left: ${sl + prefixLeft}px; width: 36px; height: ${hdrH}px; z-index: 4;">
          ${this._rowSelection.mode === 'multi' ? html`
            <input type="checkbox"
              .checked=${this._rowSelection.isAllSelected}
              .indeterminate=${this._rowSelection.isSomeSelected}
              @change=${this._onSelectAllChange}>
          ` : ''}
        </div>`
      : '';
    if (this.selectable) prefixLeft += 36;

    const rowNumHeader = this.showRowNumbers
      ? html`<div class="ft-row-num-header"
            style="position: absolute; top: 0; left: ${sl + prefixLeft}px; width: 48px; height: ${hdrH}px; z-index: 4;">#</div>` : '';

    // --- Header cells (pinned outside range + visible range) ---
    const headerCells = [];
    // Render pinned columns outside visible range
    for (const pi of pinnedIndices) {
      headerCells.push(this._renderHeaderCell(cols[pi], pi));
    }
    // Render visible range
    for (let i = colStart; i < colEnd; i++) {
      headerCells.push(this._renderHeaderCell(cols[i], i));
    }

    const dropIndicator = this._colDragIndicatorLeft != null
      ? html`<div class="ft-drop-indicator" style="left:${this._colDragIndicatorLeft}px"></div>`
      : '';

    if (this.data.length === 0 || this._visibleRowCount === 0) {
      const msg = this.data.length === 0 ? 'No data' : 'No matching data';
      return html`
        <div class="ft-header" role="row" style="width: ${tw}px; height: ${hdrH}px;">
          ${selectAllHeader}${rowNumHeader}
          ${headerCells}
          ${dropIndicator}
        </div>
        <div class="ft-empty">${msg}</div>
      `;
    }

    const { start, end } = this.visibleRange;
    const rows = [];
    for (let i = start; i < end; i++) {
      rows.push(this._renderRow(i, colStart, colEnd, pinnedIndices));
    }

    const fillHandle = this._renderFillHandle();
    const rowDropIndicator = this._rowDragIndicatorY != null
      ? html`<div class="ft-row-drop-indicator" style="top:${this._rowDragIndicatorY}px;width:${tw + this._prefixWidth}px;"></div>`
      : '';

    return html`
      ${this._renderFindPanel()}
      <div class="ft-header" role="row" style="width: ${tw}px; height: ${hdrH}px;">
        ${selectAllHeader}${rowNumHeader}
        ${headerCells}
        ${dropIndicator}
      </div>
      <div class="ft-body" style="height: ${this.totalBodyHeight}px; width: ${tw}px;">
        ${rows}
      </div>
      ${this.footerData ? this._renderFooter(colStart, colEnd, pinnedIndices) : ''}
      ${rowDropIndicator}
      ${fillHandle}
      ${this._renderHeaderContextMenu()}
      ${this._renderBodyContextMenu()}
    `;
  }

  private _onSelectAllChange(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    if (checked) {
      this._rowSelection.selectAll();
    } else {
      this._rowSelection.deselectAll();
    }
    this._rowSelectionVersion++;
    this._dispatchRowSelectionEvent();
  }

  private _onRowCheckboxChange(e: Event, rowIndex: number): void {
    e.stopPropagation();
    this._rowSelection.toggle(rowIndex);
    this._rowSelectionVersion++;
    this._dispatchRowSelectionEvent();
  }

  private _renderFooter(colStart: number, colEnd: number, pinnedIndices: number[]) {
    if (!this.footerData) return '';
    const cols = this.visibleColumns;
    const rowH = this.rowHeight;
    const tw = this._totalRowWidth;

    // Footer prefix cells — absolute positioning with scrollLeft compensation
    const sl = this._scrollLeft;
    let prefixLeft = 0;
    const checkboxFooter = this.selectable
      ? html`<div class="ft-footer-cell ft-checkbox-cell"
            style="position: absolute; top: 0; left: ${sl + prefixLeft}px; width: 36px; height: ${rowH}px; z-index: 2;"></div>`
      : '';
    if (this.selectable) prefixLeft += 36;

    const rowNumFooter = this.showRowNumbers
      ? html`<div class="ft-footer-cell ft-row-num"
            style="position: absolute; top: 0; left: ${sl + prefixLeft}px; width: 48px; height: ${rowH}px; z-index: 2;"></div>`
      : '';

    // Footer cells (pinned outside range + visible range)
    const footerCells = [];
    for (const pi of pinnedIndices) {
      const col = cols[pi];
      const width = this._getColWidth(col);
      const pStyle = col.pinned === 'right'
        ? `position: absolute; top: 0; right: ${-sl + this._getPinnedRight(pi)}px; width: ${width}px; height: ${rowH}px; z-index: 2;`
        : `position: absolute; top: 0; left: ${sl + this._getPinnedLeft(pi)}px; width: ${width}px; height: ${rowH}px; z-index: 2;`;
      footerCells.push(html`
        <div class="ft-footer-cell ft-pinned" style=${pStyle}>
          ${this.footerData![col.key] ?? ''}</div>
      `);
    }
    for (let i = colStart; i < colEnd; i++) {
      const col = cols[i];
      const width = this._getColWidth(col);
      const left = this._colLeftOffsets[i] ?? 0;
      const isPinnedLeft = col.pinned === 'left';
      const isPinnedRight = col.pinned === 'right';
      const isPinned = isPinnedLeft || isPinnedRight;
      let cellStyle: string;
      if (isPinnedLeft) {
        cellStyle = `position: absolute; top: 0; left: ${sl + this._getPinnedLeft(i)}px; width: ${width}px; height: ${rowH}px; z-index: 2;`;
      } else if (isPinnedRight) {
        cellStyle = `position: absolute; top: 0; right: ${-sl + this._getPinnedRight(i)}px; width: ${width}px; height: ${rowH}px; z-index: 2;`;
      } else {
        cellStyle = `left: ${left}px; width: ${width}px; height: ${rowH}px;`;
      }
      footerCells.push(html`
        <div class="ft-footer-cell ${isPinned ? 'ft-pinned' : ''}" style=${cellStyle}>
          ${this.footerData![col.key] ?? ''}</div>
      `);
    }

    return html`
      <div class="ft-footer" role="row" style="width: ${tw}px; height: ${rowH}px;">
        ${checkboxFooter}${rowNumFooter}
        ${footerCells}
      </div>
    `;
  }

  private _renderRow(index: number, colStart: number, colEnd: number, pinnedIndices: number[]) {
    const cols = this.visibleColumns;
    const dataIndex = this._toDataIndex(index);
    const row = this.data[dataIndex];
    const top = index * this.rowHeight;
    const rowH = this.rowHeight;
    const tw = this._totalRowWidth;
    const parity = index % 2 === 0 ? 'ft-row-even' : 'ft-row-odd';
    const isRowSelected = this.selectable && this._rowSelection.isSelected(index);

    // Prefix cells — use absolute positioning with scrollLeft compensation
    // (position: sticky inside scrollable containers causes inline whitespace gaps)
    const sl = this._scrollLeft;
    let prefixLeft = 0;
    const checkboxCell = this.selectable ? html`
      <div class="ft-checkbox-cell"
        style="position: absolute; top: 0; left: ${sl + prefixLeft}px; width: 36px; height: ${rowH}px; z-index: 2;">
        <input type="checkbox"
          .checked=${isRowSelected}
          @change=${(e: Event) => this._onRowCheckboxChange(e, index)}>
      </div>
    ` : '';
    if (this.selectable) prefixLeft += 36;

    const isDraggingRow = this._rowDrag?.active && this._rowDrag.rowIndex === index;
    const rowNumCell = this.showRowNumbers ? html`
      <div class="ft-row-num ${isDraggingRow ? 'ft-col-dragging' : ''}"
        style="position: absolute; top: 0; left: ${sl + prefixLeft}px; width: 48px; height: ${rowH}px; z-index: 2; cursor: grab;"
        @mousedown=${(e: MouseEvent) => this._onRowNumMouseDown(e, index)}
        @click=${() => this._onRowNumberClick(index)}>${dataIndex + 1}</div>
    ` : '';

    // Data cells: pinned outside range + visible range
    const cells = [];
    for (const pi of pinnedIndices) {
      cells.push(this._renderCell(row, cols[pi], index, pi));
    }
    for (let i = colStart; i < colEnd; i++) {
      cells.push(this._renderCell(row, cols[i], index, i));
    }

    return html`
      <div class="ft-row ${parity} ${isRowSelected ? 'ft-row-selected' : ''}" role="row"
        style="top: ${top}px; height: ${rowH}px; width: ${tw}px;">
        ${checkboxCell}${rowNumCell}
        ${cells}
      </div>
    `;
  }

  private _renderCell(row: DataRow, col: ColumnDefinition, rowIndex: number, colIndex: number) {
    const isActive = this._activeCell?.row === rowIndex && this._activeCell?.col === colIndex;
    const isEditing = this._editingCell?.row === rowIndex && this._editingCell?.col === colIndex;
    const isSelected = this._selection.isInRange(rowIndex, colIndex);
    const isPinnedLeft = col.pinned === 'left';
    const isPinnedRight = col.pinned === 'right';
    const isPinned = isPinnedLeft || isPinnedRight;

    const width = this._getColWidth(col);
    const rowH = this.rowHeight;
    const left = this._colLeftOffsets[colIndex] ?? 0;

    let cellStyle: string;
    if (isPinnedLeft) {
      cellStyle = `position: absolute; top: 0; left: ${this._scrollLeft + this._getPinnedLeft(colIndex)}px; width: ${width}px; height: ${rowH}px; z-index: 2;`;
    } else if (isPinnedRight) {
      cellStyle = `position: absolute; top: 0; right: ${-this._scrollLeft + this._getPinnedRight(colIndex)}px; width: ${width}px; height: ${rowH}px; z-index: 2;`;
    } else {
      cellStyle = `left: ${left}px; width: ${width}px; height: ${rowH}px;`;
    }

    const readonly = !this._isCellEditable(col);

    // Apply conditional formatting rules
    if (col.conditionalRules && col.conditionalRules.length > 0) {
      const value = row[col.key];
      const mergedStyle: Record<string, string> = {};
      for (const rule of col.conditionalRules) {
        if (rule.when(value, row, col)) {
          if (rule.style.background) mergedStyle['background'] = rule.style.background;
          if (rule.style.color) mergedStyle['color'] = rule.style.color;
          if (rule.style.fontWeight) mergedStyle['font-weight'] = rule.style.fontWeight;
          if (rule.style.fontStyle) mergedStyle['font-style'] = rule.style.fontStyle;
        }
      }
      const extraStyle = Object.entries(mergedStyle).map(([k, v]) => `${k}: ${v}`).join('; ');
      if (extraStyle) cellStyle += ' ' + extraStyle + ';';
    }

    if (isEditing) {
      return html`
        <div class="ft-cell ft-editing ft-active ${isPinned ? 'ft-pinned' : ''}" role="gridcell"
          data-col-index=${colIndex}
          aria-selected="true"
          aria-readonly=${readonly ? 'true' : nothing}
          style=${cellStyle}>
          ${this._renderEditor(row, col)}
        </div>
      `;
    }

    const selected = isActive || isSelected;
    const validationError = this._isCellInvalid(rowIndex, colIndex);
    const findResults = this._findState?.results ?? [];
    const findMatchIdx = findResults.findIndex(r => r.row === rowIndex && r.col === colIndex);
    const isFindMatch = findMatchIdx >= 0;
    const isFindCurrent = isFindMatch && findMatchIdx === this._findState!.currentIndex;
    const classes = [
      'ft-cell',
      `ft-type-${col.type ?? 'text'}`,
      isActive ? 'ft-active' : '',
      isSelected ? 'ft-selected' : '',
      isPinned ? 'ft-pinned' : '',
      validationError ? 'ft-invalid' : '',
      isFindCurrent ? 'ft-find-current' : (isFindMatch ? 'ft-find-match' : ''),
    ].filter(Boolean).join(' ');

    return html`
      <div class=${classes}
        role="gridcell"
        data-col-index=${colIndex}
        aria-selected=${selected ? 'true' : 'false'}
        aria-readonly=${readonly ? 'true' : nothing}
        aria-invalid=${validationError ? 'true' : nothing}
        title=${validationError ?? nothing}
        style=${cellStyle}
        @mousedown=${(e: MouseEvent) => this._onCellMouseDown(e, rowIndex, colIndex)}
        @mouseenter=${() => this._onCellMouseEnter(rowIndex, colIndex)}
        @click=${(e: MouseEvent) => this._onCellClickEvent(e, rowIndex, colIndex)}
        @dblclick=${() => this._onCellDblClick(rowIndex, colIndex)}>
        ${renderCell(row[col.key], row, col)}
      </div>
    `;
  }

  private _renderEditor(row: DataRow, col: ColumnDefinition) {
    // Use custom editor if provided
    if (col.editor) {
      return col.editor(row[col.key], row, col);
    }

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

    if (col.type === 'select' && col.options && col.options.length > 0) {
      const opts = col.options;
      const isStringArray = typeof opts[0] === 'string';
      return html`
        <select class="ft-editor"
          @keydown=${this._onEditorKeyDown}
          @blur=${() => this._commitEdit()}
          @change=${() => this._commitEdit()}>
          ${isStringArray
            ? (opts as string[]).map(o => html`<option value=${o} ?selected=${o === value}>${o}</option>`)
            : (opts as { label: string; value: unknown }[]).map(o =>
                html`<option value=${String(o.value)} ?selected=${o.value === value}>${o.label}</option>`
              )
          }
        </select>
      `;
    }

    if (col.autocomplete) {
      const candidates = this._autocompleteState?.candidates ?? [];
      const activeIdx = this._autocompleteState?.activeIndex ?? -1;
      return html`
        <input class="ft-editor" type="text"
          .value=${strValue}
          @input=${(e: Event) => this._onAutocompleteInput(e, col)}
          @keydown=${this._onEditorKeyDown}
          @blur=${() => this._commitEdit()}>
        ${candidates.length > 0 ? html`
          <div class="ft-autocomplete-dropdown">
            ${candidates.map((c, i) => html`
              <div class="ft-autocomplete-item ${i === activeIdx ? 'ft-autocomplete-active' : ''}"
                @mousedown=${(e: MouseEvent) => { e.preventDefault(); this._selectAutocompleteCandidate(c); }}>
                ${c}
              </div>
            `)}
          </div>
        ` : nothing}
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
