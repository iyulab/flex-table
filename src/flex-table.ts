import { LitElement, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { flexTableStyles } from './styles/flex-table.styles.js';
import { renderCell } from './renderers/cell-renderer.js';
import { t } from './locale.js';
import { Locale } from '@iyulab/components/dist/utilities/Locale.js';
import { SelectionState } from './core/selection.js';
import { EditingState } from './core/editing.js';
import { RowSelectionState } from './core/row-selection.js';
import { computeSortedIndices, toggleSort } from './core/sorting.js';
import { mergeColumnViewState, snapshotViewState } from './core/view-state.js';
import type { TableViewState, ViewStateChangeReason } from './core/view-state.js';
import { computeFilteredIndices } from './core/filtering.js';
import { filterModelPredicate, isEmptyFilterModel, isFilterModel } from './core/filter-model.js';
import type { FilterModel, FilterModels } from './core/filter-model.js';
import { UndoStack } from './core/undo.js';
import { editableDate, editableDateTime, editableNumber, parseValueForColumn } from './clipboard/clipboard.js';
import { parseDate, parseDateTime } from '@iyulab/components/dist/utilities/format.js';
// The date and datetime cell editor (registers `u-date-picker`).
import '@iyulab/components/dist/components/date-picker/UDatePicker.js';
import { exportData, exportDataBlob, downloadBlob, getExportExtension } from './export/export.js';
import type { ExportFormat } from './export/export.js';
import { readXlsx } from './export/xlsx-reader.js';
import type { ImportedSheet } from './export/xlsx-reader.js';
import { readDelimited } from './export/delimited-reader.js';
import { getCellValue, setCellValue } from './core/cell-value.js';
import { computeAggregate } from './core/aggregate.js';
import { buildImport } from './export/import.js';
import type { ImportReport } from './export/import.js';
import type { CellPosition } from './core/selection.js';
import type { SortCriteria } from './core/sorting.js';
import type { ColumnFilter, FilterPredicate } from './core/filtering.js';
import type { ColumnDefinition, DataRow, SelectionMode, DataMode } from './models/types.js';
import { effectiveAlign } from './models/types.js';
import type { FlexTableEventMap } from './events.js';
import type { TemplateResult } from 'lit';
import { ColumnGestures } from './controllers/column-gestures.js';
import { DEFAULT_COL_WIDTH, MIN_COL_WIDTH } from './core/column-width.js';
import { FindReplaceController } from './controllers/find-replace.js';
import { ClipboardController } from './controllers/clipboard.js';
import { FillHandleController } from './controllers/fill-handle.js';
import { RangeEditController } from './controllers/range-edit.js';
import { CommentPopupController } from './controllers/comment-popup.js';
import { RowReorderController } from './controllers/row-reorder.js';
import { FilterPopoverController } from './controllers/filter-popover.js';
import { calendarOpen } from './core/calendar-state.js';
import { isImeComposing } from '@iyulab/components/dist/utilities/keyboard.js';
import { CompositionTracker, replayInput } from '@iyulab/components/dist/utilities/composition.js';
import { isFromControl } from '@iyulab/components/dist/utilities/elements.js';

/** How a `mergeRepeated` cell joins the cells above and below it in its column. */
interface MergeState { continues: boolean; opensDown: boolean; headParity: 'even' | 'odd' }
/**
 * 표 내보내기의 대상 — 선택 범위(`selectionOnly`) 또는 바깥에서 준 행(`rows`, 예: `await source.fetchAll()`). 둘은
 * 함께 쓰지 않는다(바깥 행에는 표의 선택 범위가 없다).
 */
export type TableExportOptions = (
  | { selectionOnly?: boolean; rows?: undefined }
  | { rows: DataRow[]; selectionOnly?: undefined }
) & {
  /**
   * CSV/TSV — start with a UTF-8 byte order mark so spreadsheet apps (Excel) read non-ASCII text correctly.
   * Default: `true` for `exportToFile` (a file a person opens), `false` for `exportToString`/`exportToBlob`.
   */
  bom?: boolean;
};

/** One keyboard (Alt+Arrow) or column-menu (Wider / Narrower) resize step, in px. */
const COLUMN_RESIZE_STEP = 20;
const DEFAULT_ROW_HEIGHT = 32;
const OVERSCAN = 5;
/**
 * 이 행 수부터는 «높이 제약 없음» 을 개발 모드에서 경고한다 — 규칙이라 손으로 쓴다. 제약이 없으면
 * 호스트가 전 행 높이만큼 자라 가상화가 조용히 꺼진다(tests/browser/height-model 이 그 상태를 계약으로
 * 고정한다). 작은 표는 그래도 무방하고, 큰 표는 README 가 내세우는 «100,000+ rows» 의 전제가
 * 깨진 채 통째로 렌더된다 — 그 순간이 소비자가 «탭이 멈춘다» 로 만나는 자리다(소비자 실측).
 */
const UNCONSTRAINED_WARN_ROWS = 200;

@customElement('flex-table')
export class FlexTable extends LitElement {
  static styles = flexTableStyles;

  @property({ type: Array })
  columns: ColumnDefinition[] = [];

  private _data: DataRow[] = [];
  private _inUndoRedo: boolean = false;

  /**
   * The table data. When `clear-undo-on-data-change` is enabled, replacing this
   * property externally (`table.data = newData`) will clear the undo/redo history.
   * Internal undo/redo operations are exempt from this clearing.
   * To manually clear history before data replacement, call `clearUndoHistory()`.
   */
  @property({ type: Array, hasChanged: () => true })
  get data(): DataRow[] {
    return this._data;
  }

  set data(value: DataRow[]) {
    const old = this._data;
    // 참조 동일성 가드: `@lit/react`는 dirty-check 없이 매 렌더마다 `.data`를 재대입하므로,
    // 동일 참조 재대입에도 아래 파괴적 side-effect(undo/선택 해제)가 실행되면
    // "선택 → setState → 리렌더 → data 재대입 → 선택 해제" 루프로 selectable이 깨진다.
    // side-effect는 외부에서 data를 실제로 "교체"했을 때(참조 변경)만 실행한다.
    const isReplacement = value !== old;
    this._data = value;
    if (isReplacement && !this._inUndoRedo) {
      if (this.clearUndoOnDataChange) {
        this._undo.clear();
      }
      if (this._comments.size > 0) this._pruneGoneUnkeyedComments();
      if (this._rowSelection.selectedCount > 0) {
        // A keyed row stays selected across a replacement (another server page — the selection accumulates).
        // A row named only by its object cannot come back once `data` no longer holds it.
        const changed = this.clearSelectionOnDataChange
          ? (this._rowSelection.deselectAll(), true)
          : this._pruneGoneUnkeyedRows();
        if (changed) {
          this._rowSelectionVersion++;
          this._dispatchRowSelectionEvent();
        }
      }
    }
    this.requestUpdate('data', old);
  }

  /**
   * When true, replacing `data` externally automatically clears the undo/redo history.
   * Default: false. Internal undo/redo operations are never affected.
   */
  @property({ type: Boolean, attribute: 'clear-undo-on-data-change' })
  clearUndoOnDataChange: boolean = false;

  /**
   * When true, replacing `data` externally automatically clears row selection
   * (checkbox selection) and re-dispatches `selection-change` with an empty selection.
   * Default: false — keyed rows stay selected across a replacement (see `rowKey`), so a
   * selection can span server pages. Set it when a new `data` should start a new selection
   * (a new search). Internal undo/redo operations are never affected.
   */
  @property({ type: Boolean, attribute: 'clear-selection-on-data-change' })
  clearSelectionOnDataChange: boolean = false;

  /**
   * What names a row: the field whose value identifies it (default `'_id'`, as in `u-rich-table`),
   * or a function of the row. Row selection is kept by this id (`getRowId`), so checkmarks stay on
   * their rows through sorting, filtering, inserts and deletes — and, for rows that have a key,
   * across a `data` replacement: another server page keeps the rows selected on the last one.
   *
   * A row whose key is missing (`undefined`, `null` or `''`) is named by the row object itself —
   * a session-local id `#n`. It follows the row while the same object is in `data`, and leaves the
   * selection when `data` no longer holds that object (a replacement with new objects).
   */
  @property({ attribute: 'row-key' })
  rowKey: string | ((row: DataRow) => unknown) = '_id';

  /**
   * 행 높이(px).
   *
   * ⚠**이 표는 가상 스크롤이라 행 높이가 CSS 가 아니라 여기서 정해진다** — 행은
   * `index * rowHeight` 로 절대 배치되고 셀 높이도 인라인으로 박힌다. 그래서 셀 여백을
   * 아무리 조절해도 행 높이는 따라오지 않는다.
   *
   * 소비자가 표를 **문서 스코프 한 규칙**으로 맞출 수 있도록 CSS 토큰
   * `--ft-row-height` 도 읽는다. 우선순위는 **프로퍼티/속성 > CSS 토큰 > 32px** 이다 —
   * 명시적으로 지정한 쪽이 항상 이긴다.
   */
  @property({ type: Number, attribute: 'row-height' })
  get rowHeight(): number {
    const base = this._rowHeightExplicit ?? this._rowHeightFromCss ?? DEFAULT_ROW_HEIGHT;
    // 호스트 하한(`--u-target-size`)은 명시값보다도 이긴다 — 하한은 정책이지 표마다의 취향이 아니다.
    return Math.max(base, this._targetFloor);
  }
  set rowHeight(value: number) {
    const old = this.rowHeight;
    this._rowHeightExplicit = value;
    this.requestUpdate('rowHeight', old);
  }

  /** 프로퍼티·속성으로 **명시 지정된** 값. 지정 전에는 undefined 라 CSS 가 이긴다. */
  private _rowHeightExplicit?: number;
  /** `--ft-row-height` 판독 결과. 판독 전·판독 실패 시 기본값. */
  private _rowHeightFromCss: number = DEFAULT_ROW_HEIGHT;
  /** 호스트 하한 `--u-target-size`(px) 판독 결과 — 행(그러므로 머리행)과 선택 열 폭의 하한. 미설정이면 0. */
  private _targetFloor = 0;

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

  /** Number of rows to freeze at the top (always visible during vertical scroll). */
  @property({ type: Number, attribute: 'frozen-rows' })
  frozenRows: number = 0;

  /** Message shown when `data` is empty (no rows at all). Empty (the default) uses the locale string (`noData` — 'No data'). */
  @property({ type: String, attribute: 'empty-message' })
  emptyMessage: string = '';

  /**
   * Message shown when `data` has rows but every one is hidden by the active
   * column filters (0 visible rows, non-empty `data`). Empty (the default) uses the locale string (`noMatchingData` —
   * 'No matching data').
   */
  @property({ type: String, attribute: 'no-matching-message' })
  noMatchingMessage: string = '';

  /**
   * The last load failure, or `null`. While set, the grid shows `error.message` in an alert where rows or the empty
   * state would be — a failed query otherwise looks like "no data". Takes a data source's `error` as is
   * (`useODataSource`/`createODataSource`, a `SourceError`): any `{ message }`.
   */
  @property({ attribute: false })
  error: { message: string } | null = null;

  /**
   * True일 때 그리드 위에 로딩 오버레이를 표시하고 host에 `aria-busy="true"`를 반영한다.
   * `useODataSource()`가 반환하는 `loading`과 자연 연동하도록 설계됨:
   * `<FlexTableReact loading={source.loading} .../>`.
   */
  @property({ type: Boolean, reflect: true })
  loading: boolean = false;

  /** Enable file drag-and-drop import (.xlsx, .csv). */
  @property({ type: Boolean, attribute: 'import-enabled' })
  importEnabled: boolean = false;

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

  /**
   * Footer/summary row data, keyed by column key. A string or template shows as given; a **number** is written with the
   * column's `format`, like an `aggregate` — so a total the server computed reads like the cells. An entry wins over
   * the column's `aggregate`.
   */
  @property({ type: Object, attribute: 'footer-data' })
  footerData: Record<string, string | number | TemplateResult> | null = null;

  /**
   * Constructable stylesheets adopted into this element's shadow root, in addition to the
   * grid's own styles. Cell renderers run inside the shadow root, so external document
   * stylesheets (class-based utilities, design-system CSS) don't reach elements a `render` function
   * returns — this is the escape hatch for that. Not an attribute (a `CSSStyleSheet` can't be
   * serialized to one) — set it as a property.
   */
  @property({ attribute: false })
  stylesheets: CSSStyleSheet[] = [];

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
  /** The grid's own compiled styles, captured once so `stylesheets` merges without dropping them. */
  private _baseStyleSheets: CSSStyleSheet[] = [];

  @state()
  private _activeCell: CellPosition | null = null;

  /**
   * The header cell the keyboard is on — the header row sits above the first body row (ArrowUp from
   * it). Exclusive with an active body cell: entering one leaves the other.
   */
  @state()
  private _headerCol: number | null = null;

  /** The cell (body or header) that last held the keyboard focus — to take it back if a re-render drops it. */
  private _focusedCellEl: HTMLElement | null = null;

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
  /** Anchor row (its id) for shift-click range selection on the row checkbox column. */
  private _lastCheckboxRowId: string | null = null;
  /** Session-local ids of rows that have no key — by object, so they follow the row and leave with it. */
  private _unkeyedIds = new WeakMap<object, string>();
  private _unkeyedSeq = 0;
  private _visibleIdsCache: { order: number[]; data: DataRow[]; key: FlexTable['rowKey']; ids: string[] } | null = null;
  /** Set by the checkbox's own click (which carries shiftKey) just before its change event fires. */
  private _checkboxShiftPending = false;

  @state()
  private _autocompleteState: { candidates: string[]; activeIndex: number } | null = null;

  @state()
  private _headerMenu: { key: string; x: number; y: number; hiddenNeighbors: ColumnDefinition[] } | null = null;

  @state()
  private _bodyContextMenu: { rowIndex: number; colIndex: number; dataIndex: number; x: number; y: number } | null = null;

  private _viewDirty = true;
  /** Column key → its `aggregate` over the shown rows; recomputed with the view (not on scroll-only updates). */
  private _aggregates: Record<string, unknown> | null = null;
  private _isDragging = false;
  private _wasDrag = false;
  /** Set by a resize or a real column-drag reorder; consumed once by the next header `click` to
   * suppress the browser's synthetic click that follows mouseup (same pattern as `_wasDrag` for
   * cell-selection drags below). */
  private _wasHeaderDrag = false;
  /** Same as `_wasHeaderDrag`, for the row-number gutter's real row-drag reorder vs. its own
   * `click`-to-select-row listener. */
  private _wasRowDrag = false;
  private _columnWidths: Map<string, number> = new Map();
  /** Column resize and drag-reorder — the gestures on the header. */
  private readonly _columnGestures = new ColumnGestures({
    host: this,
    root: () => this.shadowRoot,
    columns: () => this.visibleColumns,
    widths: this._columnWidths,
    colWidth: (col) => this._getColWidth(col),
    colLeftOffsets: () => this._colLeftOffsets,
    scrollLeft: () => this._scrollLeft,
    prefixWidth: () => this._prefixWidth,
    emitResize: (detail) => { this._emit('column-resize', detail); this._emitViewState('column-width'); },
    moveColumn: (key, newIndex) => this.moveColumn(key, newIndex),
    markHeaderDrag: () => { this._wasHeaderDrag = true; },
    invalidate: () => this.requestUpdate(),
  });
  private _hostResizeObserver: ResizeObserver | null = null;
  /** Keyed by dataIndex → colKey → comment text */
  /** Cell comments by row id (`getRowId`) and column key — they stay on their rows when rows move. */
  private _comments: Map<string, Map<string, string>> = new Map();

  @state()
  private _isDragOver = false;


  get visibleColumns(): ColumnDefinition[] {
    return this.columns.filter(col => !col.hidden);
  }

  /** 행 선택 열의 폭 — 36px, 호스트 하한(`--u-target-size`)이 더 크면 그 값. */
  private get _checkboxColWidth(): number {
    return Math.max(36, this._targetFloor);
  }

  private get _prefixWidth(): number {
    let w = 0;
    if (this.selectable) w += this._checkboxColWidth;
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

  /**
   * The active sort — `[{ key, direction }]`, the first is the primary. Setting it shows that sort (the header
   * indicators) and, in client mode, re-sorts; it does not fire `sort-change`, which is the user's act. A data
   * source's `sortCriteria` goes here as is — the initial or restored sort of a server-paged list, the same as
   * `u-rich-table`'s `sortCriteria`.
   */
  get sortCriteria(): SortCriteria[] {
    return [...this._sortCriteria];
  }

  set sortCriteria(criteria: SortCriteria[]) {
    this._sortCriteria = [...(criteria ?? [])];
    if (this.dataMode !== 'server') this._recomputeView();
    this.requestUpdate();
  }

  /** Number of rows after filtering (before pagination). */
  get filteredRowCount(): number {
    return this._filteredIndices.length;
  }

  /**
   * The rows the table shows, in view order — `data` after the filters and the sort. What a column `aggregate`
   * summarizes; read it to compute a total the table does not. In `data-mode="server"` it is `data` (one page).
   */
  getFilteredRows(): DataRow[] {
    return this._sortedIndices.map(i => this.data[i]);
  }

  // --- Public API: Row Selection ---

  /**
   * The selected rows that `data` holds, in `data` order (filtered-out rows included) — the same shape
   * as `u-rich-table`'s. Every selected id, on every page, is `selectedRowIds`; positions in `data` come
   * with `selection-change` (`selectedIndices`).
   */
  getSelectedRows(): DataRow[] {
    return this._selectionSnapshot().selectedRows;
  }

  /** The selection as `selection-change` reports it. */
  private _selectionSnapshot(): { selectedIds: string[]; selectedIndices: number[]; selectedRows: DataRow[] } {
    const indices: number[] = [];
    if (this._rowSelection.selectedCount > 0) {
      for (let i = 0; i < this.data.length; i++) {
        if (this._rowSelection.isSelected(this.getRowId(this.data[i]))) indices.push(i);
      }
    }
    return {
      selectedIds: this._rowSelection.selectedIds,
      selectedIndices: indices,
      selectedRows: indices.map(i => this.data[i]),
    };
  }

  /** The id row selection keeps for `row` — its `rowKey` value as a string, or `#n` for a row without one. */
  getRowId(row: DataRow): string {
    const key = this.rowKey;
    const value = typeof key === 'function' ? key(row) : row[key];
    if (value !== undefined && value !== null && value !== '') return String(value);
    let id = this._unkeyedIds.get(row);
    if (id === undefined) {
      id = `#${++this._unkeyedSeq}`;
      this._unkeyedIds.set(row, id);
    }
    return id;
  }

  /** Ids of the selected rows — every page, including rows not in `data` now. A copy. */
  get selectedRowIds(): ReadonlySet<string> {
    return new Set(this._rowSelection.selectedIds);
  }

  /**
   * Replaces the row selection with `ids` (single mode keeps the last). Does nothing — and fires
   * nothing — when the selection already is `ids`, so a host can set it from its own state on
   * every render.
   */
  setSelection(ids: Iterable<string>): void {
    if (!this.selectable || !this._rowSelection.set(ids)) return;
    this._rowSelectionVersion++;
    this._dispatchRowSelectionEvent();
    this.requestUpdate();
  }

  /** Selects every row in view — after filtering (multi mode only). Rows on other pages stay as they are. */
  selectAll(): void {
    if (!this.selectable) return;
    this._rowSelection.selectAll(this._visibleRowIds());
    this._rowSelectionVersion++;
    this._dispatchRowSelectionEvent();
  }

  /** Deselects every row — on every page. */
  deselectAll(): void {
    if (!this.selectable) return;
    this._rowSelection.deselectAll();
    this._rowSelectionVersion++;
    this._dispatchRowSelectionEvent();
  }

  /**
   * Selects every currently-loaded row for which `predicate` returns true, in addition to
   * whatever is already selected — call `deselectAll()` first for a fresh set. Iterates the
   * visible (post filter/sort) view and resolves each visual row to its underlying data row,
   * so the predicate always sees the same objects `data` was set with.
   *
   * Built for "paste a list of business keys, select the matching rows" flows — e.g. a user
   * pastes order numbers and the host selects whichever loaded rows match, without the host
   * needing to know how visual/data indices relate.
   */
  selectWhere(predicate: (row: DataRow, dataIndex: number) => boolean): void {
    if (!this.selectable) return;
    for (let visualRow = 0; visualRow < this._visibleRowCount; visualRow++) {
      const dataIndex = this._toDataIndex(visualRow);
      const row = this.data[dataIndex];
      if (row !== undefined && predicate(row, dataIndex)) this._rowSelection.select(this.getRowId(row));
    }
    this._rowSelectionVersion++;
    this._dispatchRowSelectionEvent();
    this.requestUpdate();
  }

  private _dispatchRowSelectionEvent(): void {
    this._emit('selection-change', this._selectionSnapshot());
  }

  /** Ids of the rows in view, top to bottom (after filter and sort). Cached per view and `rowKey`. */
  private _visibleRowIds(): string[] {
    const c = this._visibleIdsCache;
    if (c && c.order === this._sortedIndices && c.data === this.data && c.key === this.rowKey && c.ids.length === this._visibleRowCount) {
      return c.ids;
    }
    const ids: string[] = [];
    for (let v = 0; v < this._visibleRowCount; v++) {
      const row = this.data[this._toDataIndex(v)];
      if (row !== undefined) ids.push(this.getRowId(row));
    }
    this._visibleIdsCache = { order: this._sortedIndices, data: this.data, key: this.rowKey, ids };
    return ids;
  }

  /** Drops comments on `#n` rows `data` no longer holds — such a row cannot come back. */
  private _pruneGoneUnkeyedComments(): void {
    if (![...this._comments.keys()].some((id) => id.startsWith('#'))) return;
    const present = new Set(this.data.map((row) => this.getRowId(row)));
    for (const id of [...this._comments.keys()]) {
      if (id.startsWith('#') && !present.has(id)) this._comments.delete(id);
    }
  }

  /** Drops selected `#n` ids whose rows `data` no longer holds. Returns whether anything was dropped. */
  private _pruneGoneUnkeyedRows(): boolean {
    if (!this._rowSelection.selectedIds.some((id) => id.startsWith('#'))) return false;
    const present = new Set(this.data.map((row) => this.getRowId(row)));
    return this._rowSelection.retain((id) => !id.startsWith('#') || present.has(id));
  }

  // --- Public API: Filtering ---

  /**
   * Set a filter for a column. Replaces any existing filter on the same key.
   *
   * A `FilterModel` is the serializable form (what the filter popover builds): it shows in the popover, is carried by
   * `filter-change` and `filters`, and a server source can turn it into `$filter`. A bare predicate is the escape
   * hatch — it filters the rows the table holds, but has no model to save or send. A model that filters nothing
   * (empty text, a date range with no end) removes the filter.
   */
  setFilter(key: string, filter: FilterPredicate | FilterModel): void {
    if (typeof filter === 'function') {
      this._commitFilter(key, filter);
      return;
    }
    // `filters` 세터와 같은 규칙 — 모양이 틀린 모델(저장된 상태 · 타입 없는 호출자)은 적용하지 않고 말한다.
    if (!isFilterModel(filter)) {
      // eslint-disable-next-line no-console -- the caller's model is wrong; say which column
      console.warn('[@iyulab/flex-table] ignored a filter model that is not valid for "%s":', key, filter);
      return;
    }
    if (isEmptyFilterModel(filter)) {
      this._filterPopover.clearState(key);
      this.removeFilter(key);
      return;
    }
    this._filterPopover.syncState(key, filter);
    this._commitFilter(key, filterModelPredicate(filter), filter);
  }

  /** Puts a filter in place and recomputes. The popover's own path — it already holds the state it built the model from. */
  private _commitFilter(key: string, predicate: FilterPredicate, model?: FilterModel): void {
    this._filters = this._filters.filter(f => f.key !== key);
    this._filters.push(model ? { key, predicate, model } : { key, predicate });
    this._recomputeView();
    this.requestUpdate();
    this._dispatchFilterEvent();
  }

  /**
   * The filters as models, by column key — save them, send them to a server, set them back. A filter set with a bare
   * predicate has no model and is not here (`filter-change` lists those keys as `unmodeled`).
   */
  get filters(): FilterModels {
    const out: FilterModels = {};
    for (const f of this._filters) if (f.model) out[f.key] = f.model;
    return out;
  }

  /**
   * Replaces the model filters with these (a stale or hand-written model is skipped with a warning); filters set with a
   * bare predicate stay. Quiet like `data`: no `filter-change` — the caller already knows. The popovers show the models.
   */
  set filters(models: FilterModels) {
    for (const f of this._filters) if (f.model) this._filterPopover.clearState(f.key);
    const kept = this._filters.filter(f => !f.model);
    const added: ColumnFilter[] = [];
    for (const [key, model] of Object.entries(models ?? {})) {
      if (!isFilterModel(model)) {
        // eslint-disable-next-line no-console -- the caller's stored model is wrong; say which column
        console.warn('[@iyulab/flex-table] ignored a filter model that is not valid for "%s":', key, model);
        continue;
      }
      if (isEmptyFilterModel(model)) continue;
      this._filterPopover.syncState(key, model);
      added.push({ key, predicate: filterModelPredicate(model), model });
    }
    this._filters = [...kept.filter(f => !added.some(a => a.key === f.key)), ...added];
    this._recomputeView();
    this.requestUpdate();
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

  // --- Public API: View State ---

  /**
   * The view as the user left it — column order, width, visibility and pinning, the sort and the filters — as
   * plain JSON. Keep it wherever suits (a profile, `localStorage`, a URL) and give it back to `applyViewState`;
   * `view-state-change` says when it is worth saving. Filters set with a bare predicate have no model and are
   * not in it (`filter-change` lists them as `unmodeled`).
   */
  getViewState(): TableViewState {
    return snapshotViewState(this.columns, this._columnWidths, this._sortCriteria, this.filters);
  }

  /**
   * Puts a saved view back. Every part is optional and only the parts given change. Columns the state does not
   * name keep their order and follow the named ones; names the table no longer has are skipped. Quiet like
   * `data` and `filters`: no events — the caller already knows. In server mode the sort and filters are shown but
   * not applied to rows; read them from `getViewState()` and fetch.
   */
  applyViewState(state: Partial<TableViewState>): void {
    if (Array.isArray(state.columns)) {
      const merged = mergeColumnViewState(this.columns, state.columns);
      for (const entry of merged.skipped) {
        // eslint-disable-next-line no-console -- the caller's stored state does not fit this table; say what
        console.warn('[@iyulab/flex-table] ignored a column in the view state that this table cannot place:', entry);
      }
      this.columns = merged.columns;
      for (const [key, width] of merged.widths) this._columnWidths.set(key, width);
    }
    if (Array.isArray(state.sort)) {
      const known = new Set(this.columns.map(c => c.key));
      this._sortCriteria = state.sort
        .filter(s => s && known.has(s.key) && (s.direction === 'asc' || s.direction === 'desc'))
        .map(s => ({ key: s.key, direction: s.direction }));
    }
    if (state.filters !== undefined) this.filters = state.filters;
    else if (state.sort !== undefined && this.dataMode !== 'server') this._recomputeView();
    this.requestUpdate();
  }

  private _emitViewState(reason: ViewStateChangeReason): void {
    this._emit('view-state-change', { reason, state: this.getViewState() });
  }

  /**
   * Explicitly request a re-render after external data mutations.
   * Useful when `data` array contents are mutated in-place without reassignment.
   */
  refreshData(): void {
    this.requestUpdate('data');
  }

  /** Undo the most recent action. */
  undo(): void {
    this._inUndoRedo = true;
    this._undo.undo();
    this._inUndoRedo = false;
    this.requestUpdate();
    this._dispatchUndoStateEvent();
  }

  /** Redo the most recently undone action. */
  redo(): void {
    this._inUndoRedo = true;
    this._undo.redo();
    this._inUndoRedo = false;
    this.requestUpdate();
    this._dispatchUndoStateEvent();
  }

  /** Clear all undo/redo history. */
  clearUndoHistory(): void {
    this._undo.clear();
    this._dispatchUndoStateEvent();
  }

  /**
   * Dispatches one of {@link FlexTableEventMap}'s events — bubbling and composed. Every event goes
   * through here, so a detail that drifts from the map fails to compile.
   */
  private _emit<K extends keyof FlexTableEventMap>(
    type: K,
    detail: FlexTableEventMap[K]['detail'],
    init?: { cancelable?: boolean },
  ): FlexTableEventMap[K] {
    const event = new CustomEvent(type, { detail, bubbles: true, composed: true, ...init }) as FlexTableEventMap[K];
    this.dispatchEvent(event);
    return event;
  }

  private _dispatchUndoStateEvent(): void {
    this._emit('undo-state-change', { canUndo: this.canUndo, canRedo: this.canRedo });
  }

  private _dispatchFilterEvent(): void {
    this._emit('filter-change', {
      keys: this.filterKeys,
      filteredCount: this.filteredRowCount,
      filters: this.filters,
      unmodeled: this._filters.filter(f => !f.model).map(f => f.key),
    });
    this._emitViewState('filter');
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
    this._emit('column-add', { column: def, index: insertAt });
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
    this._emit('column-delete', { column: removed, key, index: colIndex });
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
        this._emitViewState('column-order');
      },
      redo: () => {
        const cols = [...this.columns];
        cols.splice(oldIndex, 1);
        cols.splice(clampedNew, 0, col);
        this.columns = cols;
        this.requestUpdate();
        this._emitViewState('column-order');
      },
    });

    this.requestUpdate();
    this._emit('column-reorder', { key, oldIndex, newIndex: clampedNew });
    this._emitViewState('column-order');
    this._dispatchUndoStateEvent();
  }

  /** Hide a column by its key. Fires `column-visibility-change` event. */
  hideColumn(key: string): void {
    const idx = this.columns.findIndex(c => c.key === key);
    if (idx === -1) return;
    const prev = this.columns[idx].hidden ?? false;
    this._setColumnHidden(key, true);
    this._undo.push({
      label: 'column-visibility',
      undo: () => { this._setColumnHidden(key, prev); },
      redo: () => { this._setColumnHidden(key, true); },
    });
  }

  /** Show a previously hidden column by its key. Fires `column-visibility-change` event. */
  showColumn(key: string): void {
    const idx = this.columns.findIndex(c => c.key === key);
    if (idx === -1) return;
    const prev = this.columns[idx].hidden ?? false;
    this._setColumnHidden(key, false);
    this._undo.push({
      label: 'column-visibility',
      undo: () => { this._setColumnHidden(key, prev); },
      redo: () => { this._setColumnHidden(key, false); },
    });
  }

  private _setColumnHidden(key: string, hidden: boolean): void {
    const idx = this.columns.findIndex(c => c.key === key);
    if (idx === -1) return;
    this.columns = this.columns.map((c, i) => i === idx ? { ...c, hidden } : c);
    this._emit('column-visibility-change', { key, hidden });
    this._emitViewState('column-visibility');
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
    this._emit('row-add', { row: newRow, index: insertAt });
    this._dispatchUndoStateEvent();

    return newRow;
  }

  /**
   * Delete rows at the specified data indices. Without indices it deletes the selected rows: the
   * checked rows when the grid is `selectable` (none checked — nothing is deleted), otherwise the
   * rows of the cell selection.
   */
  deleteRows(indices?: number[]): void {
    const toDelete = indices ?? (this.selectable ? this._selectionSnapshot().selectedIndices : this._getSelectedDataRows());
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

    // A deleted row's comments leave with it (and come back with it on undo).
    const removedComments = new Map<string, Map<string, string>>();
    for (const { row } of deleted) {
      const id = this.getRowId(row);
      const c = this._comments.get(id);
      if (c) {
        removedComments.set(id, c);
        this._comments.delete(id);
      }
    }

    this._undo.push({
      label: 'row-delete',
      undo: () => {
        for (const { index, row } of deleted) {
          this.data.splice(index, 0, row);
        }
        for (const [id, c] of removedComments) this._comments.set(id, c);
        this.requestUpdate();
      },
      redo: () => {
        const re = [...deleted].reverse();
        for (const { index } of re) {
          this.data.splice(index, 1);
        }
        for (const id of removedComments.keys()) this._comments.delete(id);
        this.requestUpdate();
      },
    });

    // A deleted row leaves the row selection (its id may be a key that another page could show again).
    const deselected = deleted.map(d => this.getRowId(d.row)).filter(id => this._rowSelection.isSelected(id));
    if (deselected.length > 0) {
      this._rowSelection.deselectMany(deselected);
      this._rowSelectionVersion++;
      this._dispatchRowSelectionEvent();
    }

    // Clear selection if active cell is in deleted range
    if (this._activeCell) {
      const activeDR = this._toDataIndex(this._activeCell.row);
      if (toDelete.includes(activeDR)) {
        this._selection.clear();
        this._activeCell = null;
      }
    }

    this.requestUpdate();
    this._emit('row-delete', { indices: deleted.map(d => d.index), rows: deleted.map(d => d.row) });
    this._dispatchUndoStateEvent();
  }

  /**
   * Apply multiple cell changes as a single undo-able operation.
   * @param changes Array of { row (data index), key, value } objects.
   */
  updateRows(changes: Array<{ row: number; key: string; value: unknown }>): void {
    if (changes.length === 0) return;

    const saved: Array<{ row: number; key: string; oldValue: unknown; newValue: unknown }> = [];
    // Undo writes the row objects, not positions: `data` can change between the edit and its undo.
    const targets: DataRow[] = [];

    for (const change of changes) {
      if (change.row < 0 || change.row >= this.data.length) continue;
      const oldValue = getCellValue(this.data[change.row], change.key);
      setCellValue(this.data[change.row], change.key, change.value);
      saved.push({ row: change.row, key: change.key, oldValue, newValue: change.value });
      targets.push(this.data[change.row]);
    }

    if (saved.length === 0) return;

    this._undo.push({
      label: 'batch-update',
      undo: () => {
        saved.forEach((s, i) => { setCellValue(targets[i], s.key, s.oldValue); });
        this.requestUpdate();
      },
      redo: () => {
        saved.forEach((s, i) => { setCellValue(targets[i], s.key, s.newValue); });
        this.requestUpdate();
      },
    });

    this.requestUpdate();
    this._emit('batch-update', { changes: saved });
    this._dispatchUndoStateEvent();
  }

  private _createEmptyRow(): DataRow {
    const row: DataRow = {};
    for (const col of this.columns) {
      switch (col.type) {
        case 'number': setCellValue(row, col.key, 0); break;
        case 'boolean': setCellValue(row, col.key, false); break;
        default: setCellValue(row, col.key, '');
      }
    }
    return row;
  }

  // --- Public API: Export ---

  /**
   * Export table data to string in the specified format. Synchronous — XLSX comes back as an
   * uncompressed workbook; use `exportToBlob` for a compressed one.
   * @param options.selectionOnly - Export only the currently selected range
   * @param options.rows - Export these rows with the table's visible columns instead of the rows it holds —
   *   a server-paged table holds one page, so pass `await source.fetchAll()` for the whole result
   */
  exportToString(
    format: ExportFormat,
    options?: TableExportOptions
  ): string | Uint8Array<ArrayBuffer> {
    const slice = this._exportSlice(options);
    return slice ? exportData(slice.rows, slice.cols, format, { bom: options?.bom }) : '';
  }

  /**
   * Export table data as a `Blob` of the format's MIME type. XLSX is DEFLATE-compressed.
   * @param options - `selectionOnly` or `rows`, as for `exportToString`
   */
  async exportToBlob(format: ExportFormat, options?: TableExportOptions): Promise<Blob> {
    const slice = this._exportSlice(options) ?? { rows: [], cols: [] };
    return exportDataBlob(slice.rows, slice.cols, format, { bom: options?.bom });
  }

  /**
   * Export table data and trigger file download. XLSX is DEFLATE-compressed; the promise settles
   * once the download has been handed to the browser.
   * @param options - `selectionOnly` or `rows`, as for `exportToString`
   */
  async exportToFile(format: ExportFormat, filename?: string, options?: TableExportOptions): Promise<void> {
    // 내려받는 파일은 사람이 스프레드시트로 연다 — CSV/TSV 는 BOM 을 기본으로 붙인다(없으면 Excel 이 시스템 코드 페이지로 읽는다).
    const blob = await this.exportToBlob(format, { ...options, bom: options?.bom ?? true } as TableExportOptions);
    downloadBlob(blob, filename ?? `export${getExportExtension(format)}`);
  }

  /**
   * 내보낼 행·열 — 행을 받았으면 그 행 · 보이는 열(서버 페이지 표가 «조회 결과 전체» 를 내보내는 길 — 열과 형식은 표,
   * 질의는 소스가 안다), 선택만이면 선택 범위(없으면 `null`), 아니면 정렬 순서의 전체 행 · 보이는 열.
   */
  private _exportSlice(options?: TableExportOptions): { rows: DataRow[]; cols: ColumnDefinition[] } | null {
    if (options && 'rows' in options && options.rows) return { rows: options.rows, cols: this.visibleColumns };
    if (options?.selectionOnly) {
      const range = this._selection.getEffectiveRange();
      if (!range) return null;
      const cols = this.visibleColumns.slice(range.startCol, range.endCol + 1);
      const rows: DataRow[] = [];
      for (let r = range.startRow; r <= range.endRow; r++) {
        rows.push(this.data[this._toDataIndex(r)]);
      }
      return { rows, cols };
    }
    return { rows: this._sortedIndices.map(i => this.data[i]), cols: this.visibleColumns };
  }

  // --- Public API: Comments ---

  /**
   * Set a comment on the cell at the given data index and column key.
   * Pass an empty string or null to remove the comment.
   */
  setComment(dataIndex: number, colKey: string, text: string | null): void {
    const row = this.data[dataIndex];
    if (!row) return;
    // The comment belongs to the row, so undo finds it wherever the row has moved since.
    const id = this.getRowId(row);
    const prev = this._comments.get(id)?.get(colKey) ?? null;
    this._applyComment(id, colKey, text);
    this._undo.push({
      label: 'comment',
      undo: () => { this._applyComment(id, colKey, prev); },
      redo: () => { this._applyComment(id, colKey, text); },
    });
  }

  private _applyComment(id: string, colKey: string, text: string | null): void {
    if (!text) {
      const row = this._comments.get(id);
      if (row) {
        row.delete(colKey);
        if (row.size === 0) this._comments.delete(id);
      }
    } else {
      if (!this._comments.has(id)) this._comments.set(id, new Map());
      this._comments.get(id)!.set(colKey, text);
    }
    const dataIndex = this.data.findIndex(r => this.getRowId(r) === id);
    this._emit('comment-change', { dataIndex, id, colKey, text: text ?? null });
    this.requestUpdate();
  }

  /**
   * Get the comment for a cell (by data index and column key). Returns null if none.
   */
  getComment(dataIndex: number, colKey: string): string | null {
    const row = this.data[dataIndex];
    return row ? this._comments.get(this.getRowId(row))?.get(colKey) ?? null : null;
  }

  /**
   * Every comment on a row `data` holds, in `data` order — with the row's current index and its id.
   */
  getAllComments(): Array<{ dataIndex: number; id: string; colKey: string; text: string }> {
    const result: Array<{ dataIndex: number; id: string; colKey: string; text: string }> = [];
    if (this._comments.size === 0) return result;
    this.data.forEach((row, dataIndex) => {
      const id = this.getRowId(row);
      for (const [colKey, text] of this._comments.get(id) ?? []) result.push({ dataIndex, id, colKey, text });
    });
    return result;
  }

  /**
   * Clear all comments.
   */
  clearComments(): void {
    const snapshot = new Map([...this._comments].map(([k, v]) => [k, new Map(v)]));
    this._comments.clear();
    this.requestUpdate();
    this._undo.push({
      label: 'clear-comments',
      undo: () => { this._comments = snapshot; this.requestUpdate(); },
      redo: () => { this._comments.clear(); this.requestUpdate(); },
    });
  }

  // --- Public API: Import ---

  /**
   * Imports an `.xlsx`, `.csv` or `.tsv` file — the first row is the header, matched to columns by `label` or
   * `importAliases`, and each cell is read as its column's type. Replaces `data` (undoable) and fires `data-import`.
   * Returns the report of what came in and what did not (headers no column matched, columns the file lacks, cells
   * that are not their column's type — those keep their text); `null` for a file type it does not read.
   * A CSV may be separated by commas or semicolons; a leading byte-order mark is not part of the first header.
   */
  async importFromFile(file: File): Promise<ImportReport | null> {
    const name = file.name.toLowerCase();
    let sheet: ImportedSheet;
    if (name.endsWith('.xlsx')) {
      sheet = await readXlsx(await file.arrayBuffer());
    } else if (name.endsWith('.csv') || name.endsWith('.tsv')) {
      sheet = readDelimited(await file.text(), name.endsWith('.tsv') ? 'tsv' : 'csv');
    } else {
      // eslint-disable-next-line no-console -- a developer diagnostic: the caller passed a file type this reader does not take
      console.warn(`[@iyulab/flex-table] importFromFile: unsupported file type "${file.name}" — use .csv, .tsv, .json or .xlsx.`);
      return null;
    }
    return this._applyImportedSheet(sheet);
  }

  private _applyImportedSheet(sheet: ImportedSheet): ImportReport {
    const { rows: imported, report } = buildImport(sheet, this.columns);
    const prev = [...this.data];
    this.data = imported;
    this._undo.push({
      label: 'import',
      undo: () => { this.data = prev; this.requestUpdate(); },
      redo: () => { this.data = imported; this.requestUpdate(); },
    });
    this._emit('data-import', report);
    return report;
  }

  private _onDragover(e: DragEvent): void {
    if (!this.importEnabled) return;
    const hasFiles = e.dataTransfer?.types.includes('Files') ?? false;
    if (!hasFiles) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
    this._isDragOver = true;
  }

  private _onDragleave(): void {
    this._isDragOver = false;
  }

  private async _onDrop(e: DragEvent): Promise<void> {
    this._isDragOver = false;
    if (!this.importEnabled) return;
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file) await this.importFromFile(file);
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

  private get _frozenRowCount(): number {
    return Math.min(this.frozenRows, this._visibleRowCount);
  }

  private get frozenRowsHeight(): number {
    return this._frozenRowCount * this.rowHeight;
  }

  /**
   * 포인터의 뷰포트 y → 행 좌표(행 영역 맨 위 = 0, 픽셀). 고정 행 띠는 `position: sticky` 라
   * 스크롤해도 제자리이므로, 그 띠 위에서는 스크롤 양을 더하지 않는다 — 더하면 띠 뒤에 가려진
   * 본문 행을 가리킨다. 행 끌기·채우기 핸들이 같은 식을 쓴다.
   */
  private _rowSpaceY(clientY: number): number {
    const y = clientY - this.getBoundingClientRect().top - this.headerHeight;
    return y < this.frozenRowsHeight ? y : y + this._scrollTop;
  }

  /** 행 경계 `index`(행 `index` 의 위 선)의 뷰포트 y(호스트 기준). 고정 띠 뒤로 가려지는 본문 경계는 띠 아래 선에 붙인다. */
  private _rowBoundaryViewportY(index: number): number {
    const top = this.headerHeight + index * this.rowHeight;
    if (index <= this._frozenRowCount) return top;
    return Math.max(this.headerHeight + this.frozenRowsHeight, top - this._scrollTop);
  }

  private get totalBodyHeight(): number {
    return Math.max(0, this._visibleRowCount - this._frozenRowCount) * this.rowHeight;
  }

  private get visibleRange(): { start: number; end: number } {
    const fr = this._frozenRowCount;
    // The header and the frozen band are sticky in the scroll flow: body row k sits `k * rowHeight`
    // below the band's lower edge, and `scrollTop` is how far that edge has scrolled — so the first
    // body row in view is `scrollTop / rowHeight` (subtracting the band again over-renders above).
    const firstBodyRow = fr + Math.floor(Math.max(0, this._scrollTop) / this.rowHeight);
    const start = Math.max(fr, firstBodyRow - OVERSCAN);
    const bodyViewport = Math.max(0, this._viewportHeight - this.headerHeight - this.frozenRowsHeight);
    const visibleCount = Math.ceil(bodyViewport / this.rowHeight) + 1;
    const end = Math.min(this._visibleRowCount, firstBodyRow + visibleCount + OVERSCAN);
    return { start, end };
  }

  /** 런타임 로캘 전환 구독 — 이 요소는 `LitElement` 를 직접 잇기에 `@iyulab/components` 의 `UElement` 구독을 받지 못한다. */
  private _unsubscribeLocale?: () => void;
  private _detachedLocaleRevision?: number;

  connectedCallback(): void {
    super.connectedCallback();
    // 이미 그려진 문장(머리 메뉴 · 필터 · 빈 상태 · 셀 오류)을 새 언어로 다시 그린다. 떨어져 있던 동안의 전환은 지금 따라간다.
    this._unsubscribeLocale = Locale.subscribe(() => this.requestUpdate());
    if (this._detachedLocaleRevision !== undefined && this._detachedLocaleRevision !== Locale.revision) this.requestUpdate();
    this._detachedLocaleRevision = undefined;
    this._onScroll = this._onScroll.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onDocumentClick = this._onDocumentClick.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);
    this._onDragover = this._onDragover.bind(this);
    this._onDragleave = this._onDragleave.bind(this);
    this._onDrop = this._onDrop.bind(this);
    this.addEventListener('scroll', this._onScroll, { passive: true });
    this.addEventListener('keydown', this._onKeyDown);
    this.addEventListener('focus', this._onHostFocus);
    this.renderRoot.addEventListener('focusin', this._onFocusIn as EventListener);
    this.renderRoot.addEventListener('focusout', this._onFocusOut as EventListener);
    this.addEventListener('contextmenu', this._onContextMenu);
    this.addEventListener('dragover', this._onDragover as unknown as EventListener);
    this.addEventListener('dragleave', this._onDragleave as unknown as EventListener);
    this.addEventListener('drop', this._onDrop as unknown as EventListener);

    if (!this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0');
    }
    this.setAttribute('role', 'grid');

    // ResizeObserver — host의 client size 변화만 감시.
    // 이전 구현은 `updated()`에서 매번 _measureViewport()를 호출하여 @state를 갱신했는데,
    // scrollbar 출현으로 clientWidth가 진동하는 경우 무한 reflow loop 발생 (실사용에서 관측:
    // 개발자도구에서 <html> 요소가 빠르게 깜빡이는 현상).
    // ResizeObserver는 ResizeObserverLoop 보호 메커니즘이 있어 안전.
    if (typeof ResizeObserver !== 'undefined') {
      this._hostResizeObserver = new ResizeObserver(() => this._measureViewport());
      this._hostResizeObserver.observe(this);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubscribeLocale?.();
    this._unsubscribeLocale = undefined;
    this._detachedLocaleRevision = Locale.revision;
    this.removeEventListener('scroll', this._onScroll);
    this.removeEventListener('keydown', this._onKeyDown);
    this.removeEventListener('focus', this._onHostFocus);
    this.renderRoot.removeEventListener('focusin', this._onFocusIn as EventListener);
    this.renderRoot.removeEventListener('focusout', this._onFocusOut as EventListener);
    this.removeEventListener('contextmenu', this._onContextMenu);
    this.removeEventListener('dragover', this._onDragover as unknown as EventListener);
    this.removeEventListener('dragleave', this._onDragleave as unknown as EventListener);
    this.removeEventListener('drop', this._onDrop as unknown as EventListener);
    document.removeEventListener('click', this._onDocumentClick);
    this._commentPopup.dispose();
    this._isDragging = false;
    this._wasDrag = false;
    // Clean up any in-progress resize listeners
    if (this._columnGestures.resizeCleanup) {
      this._columnGestures.resizeCleanup();
      this._columnGestures.resizeCleanup = null;
    }
    if (this._hostResizeObserver) {
      this._hostResizeObserver.disconnect();
      this._hostResizeObserver = null;
    }
  }

  protected firstUpdated(): void {
    this._readDensityTokens();
    this._measureViewport();
    // Lit adopts the grid's own compiled styles into the shadow root once, before this runs —
    // capture that base set now so `stylesheets` can be merged in without ever dropping it.
    // Environments without constructable-stylesheet support (Lit's `<style>`-tag fallback path)
    // never populate this, so guard rather than assume an iterable.
    if (this.shadowRoot && Array.isArray(this.shadowRoot.adoptedStyleSheets)) {
      this._baseStyleSheets = [...this.shadowRoot.adoptedStyleSheets];
    }
    this._syncStylesheets();
  }

  private _syncStylesheets(): void {
    if (!this.shadowRoot || !Array.isArray(this.shadowRoot.adoptedStyleSheets)) return;
    this.shadowRoot.adoptedStyleSheets = [...this._baseStyleSheets, ...this.stylesheets];
  }

  /**
   * `--ft-row-height` 를 판독해 가상화 계산에 넣는다.
   *
   * ⚠**`_measureViewport` 안에 두지 않는다** — 그쪽은 ResizeObserver 가 호스트 크기가
   * 바뀔 때마다 부른다. `getComputedStyle` 은 그 빈도로 돌릴 것이 아니다. 이 토큰은
   * 문서 스코프의 정적 선언으로 쓰이므로 첫 렌더에 한 번 읽으면 충분하다.
   */
  private _readDensityTokens(): void {
    const style = getComputedStyle(this);
    // px 이외 단위(em·%)는 여기서 해석할 수 없다 — 조용히 기본값을 유지한다.
    const readPx = (name: string): number | undefined => {
      const raw = style.getPropertyValue(name).trim();
      const px = parseFloat(raw);
      return raw && Number.isFinite(px) && px > 0 && /px\s*$/.test(raw) ? px : undefined;
    };
    const old = this.rowHeight;
    const rowPx = readPx('--ft-row-height');
    if (rowPx !== undefined) this._rowHeightFromCss = rowPx;
    // 호스트 하한(`--u-target-size`) — 행 높이를 CSS 가 아니라 이 컴포넌트가 계산하므로(가상 스크롤) 여기서 읽는다.
    this._targetFloor = readPx('--u-target-size') ?? 0;
    if (this.rowHeight !== old) this.requestUpdate('rowHeight', old);
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
      this._followEditingRow();
      this._computeAggregates();
    }
    this._updateColOffsets();
    this._selection.setDimensions(this._visibleRowCount, this.visibleColumns.length);
  }

  protected updated(changedProps: PropertyValues): void {
    // _measureViewport()는 더 이상 여기서 호출하지 않는다.
    // 호출 시 @state 갱신 → 무한 update 루프 위험 (위 connectedCallback의 ResizeObserver 주석 참조).
    // 크기 변화는 ResizeObserver가 비동기로 처리한다.
    this._focusEditor();
    this._editorMoving = false;
    this._syncGridFocus();
    this._adjustFilterDropdown();
    if (changedProps.has('_headerMenu')) this._keepMenuInView('.ft-header-menu');
    if (changedProps.has('_bodyContextMenu') && this._bodyContextMenu) {
      this._keepMenuInView('.ft-body-context-menu');
      this.shadowRoot?.querySelector<HTMLElement>('.ft-body-context-menu [role="menuitem"]')?.focus();
    }
    if (changedProps.has('stylesheets')) this._syncStylesheets();
    // Update ARIA live attributes — guard against no-op setAttribute calls that
    // can trigger MutationObserver → requestUpdate() in Lit dev mode.
    // 행 수는 머리글(1)·푸터 행을 포함한다(APG Data Grid) — 인덱스 1 이 머리글, 2 부터 데이터다.
    const rowCount = String(1 + this._visibleRowCount + (this._hasFooter ? 1 : 0));
    const colCount = String(this.visibleColumns.length);
    if (this.getAttribute('aria-rowcount') !== rowCount) this.setAttribute('aria-rowcount', rowCount);
    if (this.getAttribute('aria-colcount') !== colCount) this.setAttribute('aria-colcount', colCount);
    if (this.loading) {
      if (this.getAttribute('aria-busy') !== 'true') this.setAttribute('aria-busy', 'true');
    } else if (this.hasAttribute('aria-busy')) {
      this.removeAttribute('aria-busy');
    }
    this._commentPopup.afterRender();
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
      this._emit('filter-error', { error, row, filterKey: filter.key });
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

  /**
   * Keeps an open editor on the row it was started on after the view changed under it (a refresh put
   * rows above it, a sort moved it). A row that left `data`, or that a filter hid, ends the edit.
   */
  private _followEditingRow(): void {
    const ed = this._editing.current;
    if (!ed) return;
    const dataIndex = this.data.indexOf(ed.row);
    const visual = dataIndex < 0 ? -1 : this._sortedIndices.indexOf(dataIndex);
    if (visual < 0) {
      this._cancelEdit();
      return;
    }
    if (visual === ed.position.row) return;
    // The editor is drawn again in the row's new place — carry what was typed so far into it.
    const editor = this.shadowRoot?.querySelector<HTMLElement & { value?: unknown }>('.ft-editor');
    if (editor && 'value' in editor) ed.draft = editor.value;
    this._editorMoving = true;
    ed.position = { row: visual, col: ed.position.col };
    this._editingCell = { ...ed.position };
    this._activeCell = this._selection.setActive(visual, ed.position.col);
  }

  /** Map visual row index to data row index */
  private _toDataIndex(visualRow: number): number {
    return this._sortedIndices[visualRow] ?? visualRow;
  }

  /** Set while the edited row's editor is drawn again in the row's new place (cleared after that update). */
  private _editorMoving = false;

  /**
   * Blur commits the edit — except the blur of the editor the update is replacing because its row
   * moved (Chromium fires it while removing the element) or of one already gone.
   */
  private _onEditorBlur = (e: FocusEvent): void => {
    if (this._editorMoving || !(e.currentTarget as Element | null)?.isConnected) return;
    this._commitEdit();
  };

  private _focusEditor(): void {
    if (!this._editingCell) return;
    const input = this.shadowRoot?.querySelector('.ft-editor') as HTMLInputElement | null;
    // The editor was drawn again because its row moved: give it the text typed so far, keep the caret at the end.
    const ed = this._editing.current;
    if (input && ed?.draft !== undefined) {
      const draft = ed.draft;
      ed.draft = undefined;
      input.value = draft as string;
      input.focus();
      if (input.type === 'text') input.setSelectionRange(input.value.length, input.value.length);
      return;
    }
    // Once, when editing starts: this runs on every update, and the editor lives in this shadow
    // tree — `document.activeElement` is the host there, so comparing with it re-selected the text
    // on each update and the next typed key replaced what was typed (an autocomplete list updates
    // on every key).
    if (!input || this.shadowRoot!.activeElement === input) return;
    if (input.localName === 'u-date-picker') {
      // A custom element renders after this update — focus its text box once it exists, and
      // select the text as the text editors do, so a typed key replaces it.
      const picker = input as unknown as HTMLElement & { updateComplete: Promise<unknown> };
      void picker.updateComplete.then(() => {
        if (!picker.isConnected || this.shadowRoot!.activeElement === picker) return;
        picker.focus();
        picker.shadowRoot?.querySelector<HTMLInputElement>('[part~="input"]')?.select();
      });
      return;
    }
    input.focus();
    if (input.type === 'text') {
      input.select();
    }
  }

  private _measureViewport(): void {
    const h = this.clientHeight;
    const w = this.clientWidth;
    if (h !== this._viewportHeight) this._viewportHeight = h;
    if (w !== this._viewportWidth) this._viewportWidth = w;
    this._warnIfUnconstrained();
  }

  private _warnedUnconstrained = false;

  /**
   * 개발 모드 사용 안내: 행이 많은데 호스트가 스크롤 컨테이너가 아니면 — 호스트가 내용
   * 높이만큼 자라 스크롤할 것이 없으면 — 가상화가 꺼진 것이다. 오류가 없어 아무도 모른다.
   * 한 번만, 개발 모드에서만. ResizeObserver 경로에서 불리지만 판정은 프로퍼티 둘을 읽는 것뿐이다.
   */
  private _warnIfUnconstrained(): void {
    if (this._warnedUnconstrained || process.env.NODE_ENV === 'production') return;
    if (this._visibleRowCount < UNCONSTRAINED_WARN_ROWS) return;
    if (this.scrollHeight > this.clientHeight + 1) return; // 스크롤 컨테이너다 — 가상화가 살아 있다
    this._warnedUnconstrained = true;
    // eslint-disable-next-line no-console -- a development-only diagnostic (skipped in production builds)
    console.warn(
      `[@iyulab/flex-table] ${this._visibleRowCount} rows but the host has no height constraint — it grew to fit every row, ` +
      'so virtual scrolling is off and all rows are rendered. Give the host a height (e.g. height: 400px, ' +
      'or flex: 1 1 auto with min-height: 0 inside a sized parent) so it becomes the scroll container.',
    );
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
    if (!cellEl) {
      // The context-menu key (or Shift+F10) on the header row opens that column's menu.
      if (path[0] === this && this._headerCol !== null) {
        const col = this.visibleColumns[this._headerCol];
        if (col) {
          e.preventDefault();
          this._openColumnMenu(col);
        }
      }
      return;
    }

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

    const ctxEvent = this._emit('context-menu', {
      x: e.clientX,
      y: e.clientY,
      row: dataIndex,
      col: colIndex,
      key: col.key,
      value: getCellValue(this.data[dataIndex], col.key),
      rowData: this.data[dataIndex],
    }, { cancelable: true });

    // Close any open comment popup (save its content) before showing new context menu
    this._commentPopup.cancel();

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
    const extendsSelection = e.shiftKey || e.ctrlKey || e.metaKey;
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
    // A plain click opens the row — the pointer half of `row-activate` (Enter is the keyboard half).
    // A click that extends a selection, or presses a control the cell renders, is that act's, not this one.
    if (!extendsSelection && !isFromControl(e, e.currentTarget as EventTarget)) {
      this._fireRowActivate(this.visibleColumns[colIndex], 'click');
    }
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
    // Synthetic click following a real row-drag reorder — not a select intent.
    if (this._wasRowDrag) {
      this._wasRowDrag = false;
      return;
    }
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

  /** Whether a cell may change: the table's `editable`, then the column's — a function decides per row. */
  private _isCellEditable(col: ColumnDefinition, row: DataRow | undefined): boolean {
    if (!this.editable) return false;
    if (typeof col.editable === 'function') return row != null && col.editable(row, col);
    return col.editable !== false;
  }

  /** The active cell's data row — `undefined` when nothing is active. */
  private _activeRow(): DataRow | undefined {
    return this._activeCell ? this.data[this._toDataIndex(this._activeCell.row)] : undefined;
  }

  /**
   * Enter가 non-editable 셀에서 눌렸을 때 "이 행을 확정한다"는 신호를 호스트에
   * 공식적으로 알린다. 그리드가 자체 `keydown` 핸들러에서 Enter를 먼저 처리하므로,
   * 호스트가 같은 엘리먼트에 직접 붙인 리스너는 등록 순서에 의존하게 되어 안전한
   * 공개 계약이 못 된다 — 이 이벤트가 유일한 보장된 훅이다.
   */
  private _fireRowActivate(col: ColumnDefinition | undefined, via: 'click' | 'keyboard'): void {
    if (!this._activeCell) return;
    const dataIndex = this._toDataIndex(this._activeCell.row);
    const row = this.data[dataIndex];
    if (!row) return;
    this._emit('row-activate', { row, id: this.getRowId(row), via, index: dataIndex, col: this._activeCell.col, key: col?.key });
  }

  private _startEdit(): void {
    if (!this._activeCell) return;
    const cols = this.visibleColumns;
    const col = cols[this._activeCell.col];
    if (!col || !this._isCellEditable(col, this._activeRow())) return;

    // Boolean: toggle immediately, don't enter edit mode
    if (col.type === 'boolean') {
      const row = this.data[this._toDataIndex(this._activeCell.row)];
      const currentValue = getCellValue(row, col.key);
      this._applyEdit(!currentValue);
      return;
    }

    const dataRow = this._toDataIndex(this._activeCell.row);
    const row = this.data[dataRow];
    this._editing.start(this._activeCell, getCellValue(row, col.key), row);
    this._editingCell = { ...this._activeCell };

    this._emit('cell-edit-start', { row: dataRow, col: this._activeCell.col, key: col.key, value: getCellValue(row, col.key) });
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

    if (col.type === 'date' || col.type === 'datetime') {
      const picker = this.shadowRoot?.querySelector('u-date-picker.ft-editor') as DatePickerEditor | null;
      if (!picker) {
        this._cancelEdit();
        return;
      }
      // Text the picker could not read: hand that text to the same check the text editor used, so
      // the cell keeps its value and reports why. The text box is the picker's published `input` part.
      if (picker.validity?.badInput) {
        const typed = picker.shadowRoot?.querySelector<HTMLInputElement>('[part~="input"]')?.value ?? '';
        this._applyEdit(typed);
        return;
      }
      // The picker's datetime value carries seconds and the browser's offset; the cell keeps the
      // local `YYYY-MM-DDTHH:mm` a typed edit has always stored.
      const v = picker.value || null;
      const picked = v && col.type === 'datetime' ? v.slice(0, 16) : v;
      // A value the person did not change, in a form an edit would not store (a server `…Z`, a `Date`), was
      // handed to the picker as its local wall clock and comes back as that. Writing it would replace the
      // server's value with a local string and record an edit nobody made — the edit ends without a write.
      const original = this._editing.current?.originalValue;
      if (picked && picked !== original && picked === pickerValue(original, col.type === 'datetime')) {
        this._cancelEdit();
        return;
      }
      this._applyEdit(picked);
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

    // The edit belongs to the row it was started on, wherever `data` has moved it since — and a row
    // `data` no longer holds has nothing to write to.
    const { col } = editState.position;
    const target = editState.row;
    const dataRow = this.data.indexOf(target);
    if (dataRow < 0) {
      this._emit('cell-edit-cancel', { row: -1, col });
      return;
    }
    const colDef = this.visibleColumns[col];
    const oldValue = editState.originalValue;

    // Strict autocomplete: value must be in existing column values
    if (colDef.autocomplete === 'strict' && newValue != null && newValue !== '') {
      const allCandidates = this._getAutocompleteCandidates(colDef, '');
      if (!allCandidates.includes(String(newValue))) {
        const error = t('notInList');
        this._markCellInvalid(target, colDef, () => t('notInList'));
        this._emit('validation-error', { row: dataRow, col, key: colDef.key, value: newValue, error });
        return;
      }
    }

    // A number column keeps text it cannot read as a number (the paste contract) — but an edit is
    // the person typing into the cell, so tell them instead of storing text in a number column.
    const unreadable = (colDef.type === 'number' && typeof newValue === 'string')
      || (colDef.type === 'date' && typeof newValue === 'string' && parseDate(newValue) === null)
      || (colDef.type === 'datetime' && typeof newValue === 'string' && parseDateTime(newValue) === null);
    if (unreadable) {
      const key = colDef.type === 'number' ? 'notANumber' : colDef.type === 'date' ? 'notADate' : 'notADateTime';
      const error = t(key);
      this._markCellInvalid(target, colDef, () => t(key));
      this._emit('validation-error', { row: dataRow, col, key: colDef.key, value: newValue, error });
      return;
    }

    // Run validator if present
    if (colDef.validator) {
      const error = colDef.validator(newValue, target, colDef);
      if (error) {
        this._markCellInvalid(target, colDef, error);
        this._emit('validation-error', { row: dataRow, col, key: colDef.key, value: newValue, error });
        return;
      }
    }

    // Mutate data — the row object, which undo and redo write too (`data` can change in between)
    setCellValue(target, colDef.key, newValue);

    // Push undo action
    this._undo.push({
      label: 'cell-edit',
      undo: () => {
        setCellValue(target, colDef.key, oldValue);
        this.requestUpdate();
      },
      redo: () => {
        setCellValue(target, colDef.key, newValue);
        this.requestUpdate();
      },
    });

    this.requestUpdate();

    this._emit('cell-edit-commit', { row: dataRow, col, key: colDef.key, oldValue, newValue });
    this._dispatchUndoStateEvent();
  }

  private _cancelEdit(): void {
    this._autocompleteState = null;
    const editState = this._editing.cancel();
    this._editingCell = null;
    if (editState) {
      this._emit('cell-edit-cancel', { row: this.data.indexOf(editState.row), col: editState.position.col });
    }
  }

  private _onEditorKeyDown(e: KeyboardEvent): void {
    // IME 조합 중인 키(한국어 등)는 입력기의 것이다 — 조합을 확정하는 Enter 로 확정·이동·제출하지 않는다.
    if (isImeComposing(e)) return;
    // 날짜 편집기의 달력은 자기 키를 갖는다 — 날짜 칸의 Enter 는 고르기, Escape 는 달력 닫기다.
    // 달력 안에서 난 키와, 달력이 열린 동안의 Escape 는 피커에게 맡긴다(고르기는 `change` 로 확정된다).
    const editor = e.currentTarget as Element | null;
    if (editor?.localName === 'u-date-picker') {
      const inCalendar = e.composedPath().some(n => n instanceof Element && n.part?.contains('popover'));
      if (inCalendar || (e.key === 'Escape' && calendarOpen(editor))) return;
    }
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

  /** `composing` — `text` 의 마지막 음절이 아직 IME 로 조합 중이다(검색 일치가 자모 앞부분으로 견준다). */
  private _getAutocompleteCandidates(col: ColumnDefinition, text: string, composing = false): string[] {
    const seen = new Set<string>();
    const results: string[] = [];
    for (const row of this.data) {
      const v = getCellValue(row, col.key);
      if (v == null) continue;
      const s = String(v);
      if (!seen.has(s) && (text === '' || Locale.matchesSearch(s, text, { composing }))) {
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
    const { query, composing } = this._editorIme.searchQuery(input);
    const candidates = this._getAutocompleteCandidates(col, query, composing).filter(c => c !== text);
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
    if (this._activeCell) this._headerCol = null;
    this._scrollToActiveCell();
    this._dispatchSelectionEvent();
  }

  // --- Navigation ---

  private _onKeyDown(e: KeyboardEvent): void {
    if (this._editing.current) return;
    // Keys pressed in the filter dropdown are the dropdown's. Most of its controls stop them; a date
    // bound lets Escape through while its calendar is open, for the overlay layer to close the calendar.
    if (this._openFilterKey && e.composedPath().some(n => n instanceof Element && n.classList.contains('ft-filter-dropdown'))) return;

    const cols = this.visibleColumns;

    // Ctrl shortcuts that work globally (no active cell required)
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (['f', 'h', 'z', 'y'].includes(k)) {
        if (this._handleCtrlKey(e)) return;
      }
    }

    if (cols.length === 0) return;

    // The grid's cell keys belong to the grid itself (the host holds focus for it). A key pressed on a
    // control inside it — a column menu button, a row checkbox, a button a cell renders — is that
    // control's: Enter and Space activate it rather than editing the active cell. Ctrl/Cmd shortcuts
    // (copy, undo, fill…) still apply.
    if (!this._isGridSurface(e.composedPath()[0]) && !e.ctrlKey && !e.metaKey) return;

    if (this._headerCol !== null) {
      this._onHeaderKeyDown(e, cols);
      return;
    }
    // An empty body leaves the header row as the grid's only keyboard position.
    if (this._visibleRowCount === 0) {
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        this._headerCol = 0;
      }
      return;
    }

    // Enter/F2 to start editing; Enter on a non-editable cell fires `row-activate` instead
    if ((e.key === 'Enter' || e.key === 'F2') && this._activeCell && !isImeComposing(e)) {
      e.preventDefault();
      const col = cols[this._activeCell.col];
      if (col && this._isCellEditable(col, this._activeRow())) {
        this._startEdit();
      } else if (e.key === 'Enter') {
        this._fireRowActivate(col, 'keyboard');
      }
      return;
    }

    // If no active cell, set to first cell on any nav key
    if (!this._selection.activeCell) {
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        this._selection.setActive(0, 0);
        this._syncActiveCell();
        e.preventDefault();
        return;
      }
      // Allow Escape to close find panel even without active cell
      if (e.key === 'Escape' && this._find.state) {
        this._find.close();
        e.preventDefault();
        return;
      }
      return;
    }

    if (this._handleCtrlKey(e)) return;
    if (this._handleAltKey(e, cols)) return;

    // Shift+Space selects the active cell's row (the spreadsheet convention) — Space alone types into an
    // editable cell. It is the keyboard path to row selection: the row checkboxes are not Tab stops.
    if (e.key === ' ' && e.shiftKey && this.selectable && this._activeCell && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const row = this.data[this._toDataIndex(this._activeCell.row)];
      if (!row) return;
      const id = this.getRowId(row);
      this._rowSelection.toggle(id);
      this._lastCheckboxRowId = id;
      this._rowSelectionVersion++;
      this._dispatchRowSelectionEvent();
      return;
    }

    // Printable character starts editing with that character
    if (this._activeCell && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const col = cols[this._activeCell.col];
      if (col && this._isCellEditable(col, this._activeRow())) {
        this._startEdit();
      }
      return;
    }

    // ArrowUp from the first row moves onto its column's header cell.
    if (e.key === 'ArrowUp' && !e.shiftKey && !e.altKey && this._activeCell?.row === 0) {
      e.preventDefault();
      this._enterHeader(this._activeCell.col);
      return;
    }

    const handled = this._handleNavigation(e);

    if (handled) {
      e.preventDefault();
      this._syncActiveCell();
    }
  }

  /**
   * The keyboard on the header row: arrows / Home / End move along it, ArrowDown returns to the body,
   * Enter or Space sorts (Shift adds to the sort), Alt+ArrowDown opens the column menu, Alt+Arrow
   * resizes. Tab leaves the grid.
   */
  private _onHeaderKeyDown(e: KeyboardEvent, cols: ColumnDefinition[]): void {
    if (e.ctrlKey || e.metaKey) return;
    const at = Math.min(this._headerCol ?? 0, cols.length - 1);
    const col = cols[at];
    let next: number;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
        if (e.altKey) {
          e.preventDefault();
          this._resizeColumnBy(col.key, e.key === 'ArrowRight' ? COLUMN_RESIZE_STEP : -COLUMN_RESIZE_STEP);
          return;
        }
        next = e.key === 'ArrowLeft' ? Math.max(0, at - 1) : Math.min(cols.length - 1, at + 1);
        break;
      case 'Home': next = 0; break;
      case 'End': next = cols.length - 1; break;
      case 'ArrowDown':
        e.preventDefault();
        if (e.altKey) this._openColumnMenu(col);
        else if (this._visibleRowCount > 0) {
          this._selection.setActive(0, at);
          this._syncActiveCell();
        }
        return;
      case 'Enter':
      case ' ':
        if (isImeComposing(e)) return;
        e.preventDefault();
        if (col.sortable !== false) this._toggleSort(col, e.shiftKey);
        return;
      default:
        return;
    }
    e.preventDefault();
    this._headerCol = next;
    this._scrollColumnIntoView(next);
  }

  /** Move the keyboard from the body onto the header cell of visible column `colIndex`. */
  private _enterHeader(colIndex: number): void {
    this._selection.clear();
    this._syncActiveCell();
    this._headerCol = colIndex;
    this._scrollColumnIntoView(colIndex);
  }

  /**
   * Keyboard focus arriving on a grid with nothing active places it on the first cell (the first header
   * cell when the body is empty), so the first arrow already moves and Tab is not spent entering. A
   * pointer focus places the cell it pressed instead.
   */
  private _onHostFocus = (e: FocusEvent): void => {
    if (e.composedPath()[0] !== this || this._activeCell || this._headerCol !== null) return;
    if (this.visibleColumns.length === 0 || !this.matches(':focus-visible')) return;
    if (this._visibleRowCount > 0) {
      this._selection.setActive(0, 0);
      this._syncActiveCell();
    } else {
      this._headerCol = 0;
    }
  };

  /**
   * The grid's own keyboard surface: the host, the active body cell, the active header cell. Keys on
   * anything else inside it (an editor, a menu, a button a cell renders) belong to that control.
   */
  private _isGridSurface(target: EventTarget | undefined): boolean {
    if (target === this) return true;
    return target instanceof HTMLElement
      && (target.classList.contains('ft-cell') || target.classList.contains('ft-header-cell'))
      && !target.classList.contains('ft-editing');
  }

  /**
   * The element the keyboard is on — the active header cell, else the active body cell — when it is
   * rendered (the body scrolls it out of the virtual window), else `null`.
   */
  private _keyboardCellEl(): HTMLElement | null {
    const root = this.shadowRoot;
    if (!root) return null;
    if (this._headerCol !== null) {
      return root.querySelector<HTMLElement>(`.ft-header-cell[data-col-index="${this._headerCol}"]`);
    }
    const ac = this._activeCell;
    if (!ac) return null;
    return root.querySelector<HTMLElement>(
      `.ft-row[aria-rowindex="${ac.row + 2}"] .ft-cell[data-col-index="${ac.col}"]`);
  }

  /**
   * Roving focus: while the grid holds the focus, the focus sits on the cell the keyboard is on, so
   * assistive technology announces each move (the host cannot point `aria-activedescendant` into its
   * own shadow tree). It moves only between the host and the grid's cells — never out of an editor,
   * a menu or a control that holds it.
   */
  private _syncGridFocus(): void {
    const root = this.shadowRoot;
    if (!root) return;
    const current = root.activeElement as HTMLElement | null;
    const hasFocus = document.activeElement === this;
    if (!hasFocus) {
      // A re-render dropped the focused cell (scrolled out of the virtual window): the focus fell to the
      // page. Take it back onto the grid.
      if (this._focusedCellEl && !this._focusedCellEl.isConnected
        && (document.activeElement === document.body || document.activeElement === null)) {
        this._focusedCellEl = null;
        (this._keyboardCellEl() ?? this).focus({ preventScroll: true });
      }
      return;
    }
    if (current && !this._isGridSurface(current)) return;
    // Scrolled out of the virtual window, the cell's element is reused for another row: the focus waits
    // on the host rather than on a cell that now means something else.
    const target = this._keyboardCellEl() ?? this;
    if (target !== (current ?? this)) target.focus({ preventScroll: true });
  }

  private _onFocusIn = (e: FocusEvent): void => {
    const target = e.composedPath()[0];
    if (target !== this && this._isGridSurface(target)) {
      this._focusedCellEl = target as HTMLElement;
      // The host steps out of the Tab order while a cell holds the focus, so Shift+Tab leaves the grid
      // instead of landing on the host. Restored when the focus leaves.
      if (this.tabIndex === 0) {
        this._hostTabIndexLowered = true;
        this.tabIndex = -1;
      }
    }
  };

  private _onFocusOut = (e: FocusEvent): void => {
    const next = e.relatedTarget as Node | null;
    if (next && (next === this || this.contains(next) || this.shadowRoot?.contains(next))) return;
    const left = e.composedPath()[0];
    requestAnimationFrame(() => {
      // Removed by a re-render: `_syncGridFocus` takes the focus back. Otherwise the focus really left.
      if (left instanceof HTMLElement && left === this._focusedCellEl && !left.isConnected) {
        this._syncGridFocus();
        return;
      }
      if (document.activeElement === this) return;
      this._focusedCellEl = null;
      if (this._hostTabIndexLowered) {
        this._hostTabIndexLowered = false;
        this.tabIndex = 0;
      }
    });
  };

  private _hostTabIndexLowered = false;

  private _handleCtrlKey(e: KeyboardEvent): boolean {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;

    switch (e.key.toLowerCase()) {
      case 'z':
        e.preventDefault();
        if (e.shiftKey) { this.redo(); } else { this.undo(); }
        return true;
      case 'y':
        e.preventDefault();
        this.redo();
        return true;
      // Copy, cut and paste leave the key to the browser (not prevented) — see ClipboardController.
      case 'c':
      case 'x':
        this._clipboard.onCopyKey(e);
        return true;
      case 'v':
        this._clipboard.onPasteKey(e);
        return true;
      case 'd':
        e.preventDefault();
        if (this.editable) this._rangeEdit.fillDown();
        return true;
      case 'r':
        e.preventDefault();
        if (this.editable) this._rangeEdit.fillRight();
        return true;
      case 'f':
        e.preventDefault();
        this._find.toggle('find');
        return true;
      case 'h':
        e.preventDefault();
        // A table that cannot change offers find only — a replace field there would do nothing.
        this._find.toggle(this.editable ? 'replace' : 'find');
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

    this._resizeColumnBy(col.key, e.key === 'ArrowRight' ? COLUMN_RESIZE_STEP : -COLUMN_RESIZE_STEP);
    return true;
  }

  /** Widen (positive) or narrow (negative) a visible column by `delta` px, never below its minimum. */
  private _resizeColumnBy(key: string, delta: number): void {
    const colIndex = this.visibleColumns.findIndex(c => c.key === key);
    const col = this.visibleColumns[colIndex];
    if (!col) return;
    const currentWidth = this._columnWidths.get(col.key) ?? col.width ?? DEFAULT_COL_WIDTH;
    const minW = col.minWidth ?? MIN_COL_WIDTH;
    const newWidth = Math.max(minW, currentWidth + delta);
    this._columnWidths.set(col.key, newWidth);
    this.requestUpdate();
    this._emit('column-resize', { key: col.key, width: newWidth, colIndex });
    this._emitViewState('column-width');
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
      case 'Tab': {
        // Tab walks the cells and, past the last (Shift+Tab: before the first), leaves the grid like
        // any other Tab stop — the grid never keeps the focus (WCAG 2.1.2).
        const from = this._selection.activeCell;
        const to = e.shiftKey ? this._selection.movePrev() : this._selection.moveNext();
        return !(from && to && from.row === to.row && from.col === to.col);
      }
      case 'Home':
        e.ctrlKey ? this._selection.moveToStart() : this._selection.moveToRowStart();
        return true;
      case 'End':
        e.ctrlKey ? this._selection.moveToEnd() : this._selection.moveToRowEnd();
        return true;
      case 'Escape':
        if (this._find.state) {
          this._find.close();
          return true;
        }
        this._selection.clear();
        return true;
      case 'Delete':
      case 'Backspace':
        if (this.editable) this._rangeEdit.clearSelection();
        return true;
      default:
        return false;
    }
  }

  private _scrollToActiveCell(): void {
    if (!this._activeCell) return;

    // Vertical scroll
    const rowTop = this._activeCell.row * this.rowHeight + this.headerHeight;
    const rowBottom = rowTop + this.rowHeight;

    // Frozen rows are always visible — no scroll needed
    if (this._activeCell.row < this._frozenRowCount) {
      // Only handle horizontal scroll below
    } else if (rowTop < this.scrollTop + this.headerHeight + this.frozenRowsHeight) {
      this.scrollTop = rowTop - this.headerHeight - this.frozenRowsHeight;
    } else if (rowBottom > this.scrollTop + this.clientHeight) {
      this.scrollTop = rowBottom - this.clientHeight;
    }

    this._scrollColumnIntoView(this._activeCell.col);
  }

  /** Scroll horizontally so the visible column at `colIndex` is in view — cached column offsets. */
  private _scrollColumnIntoView(colIndex: number): void {
    const cols = this.visibleColumns;
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
    const ac = this._activeCell;
    const row = ac ? this.data[this._toDataIndex(ac.row)] : undefined;
    this._emit('cell-select', ac ? { ...ac, id: row ? this.getRowId(row) : '' } : null);
  }

  // --- Sorting ---

  private _onHeaderClick(e: MouseEvent, col: ColumnDefinition): void {
    // Synthetic click following a resize or column-drag mouseup — not a sort intent.
    if (this._wasHeaderDrag) {
      this._wasHeaderDrag = false;
      return;
    }

    const colIndex = this.visibleColumns.indexOf(col);

    // Ctrl+Click or Meta+Click → column selection
    if (e.ctrlKey || e.metaKey) {
      this._selectColumn(colIndex);
      return;
    }

    if (col.sortable === false) return;
    this._toggleSort(col, e.shiftKey);
  }

  /** Cycle `col`'s sort (asc → desc → none); `multi` adds it to the existing criteria (Shift). */
  private _toggleSort(col: ColumnDefinition, multi: boolean): void {
    this._sortCriteria = toggleSort(this._sortCriteria, col.key, multi);

    // In server mode, only dispatch the event — don't recompute locally
    if (this.dataMode !== 'server') {
      this._recomputeView();
    }
    this.requestUpdate();

    this._emit('sort-change', { criteria: [...this._sortCriteria] });

    this._emitViewState('sort');
  }

  private _selectColumn(colIndex: number): void {
    const rowCount = this._visibleRowCount;
    if (rowCount === 0 || colIndex < 0) return;

    this._selection.setActive(0, colIndex);
    this._selection.setActiveWithRange(rowCount - 1, colIndex);
    this._activeCell = { row: 0, col: colIndex };
    this.requestUpdate();

    this._emit('column-select', {
        colIndex,
        key: this.visibleColumns[colIndex]?.key,
        rowCount,
      });
  }

  /** Public API: select an entire column by index. */
  selectColumn(colIndex: number): void {
    this._selectColumn(colIndex);
  }

  /** Calculate cumulative left offset for a left-pinned column */
  private _getPinnedLeft(colIndex: number): number {
    const cols = this.visibleColumns;
    let left = 0;
    if (this.selectable) left += this._checkboxColWidth;
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

  /**
   * X offset for a right-pinned column, in the same content coordinate space the
   * left-pinned branch uses (origin = the row/header box, prefix columns included).
   *
   * A CSS `right` cannot express this. Cells are absolutely positioned inside a box
   * whose width is the full row width, so a fixed `right` rides the content instead of
   * the viewport, and a scroll-compensating negative `right` pushes the cell past that
   * box — which extends the scrollable area, so every scroll widens it again.
   *
   * Sticking is therefore expressed as a `left` clamped to the column's natural offset:
   * the column tracks the viewport's right edge while the content is scrolled past it,
   * and rests in place once the viewport reaches it.
   */
  private _getPinnedRightLeft(colIndex: number): number {
    const cols = this.visibleColumns;
    const natural = this._colLeftOffsets[colIndex] ?? 0;
    // Before the first measurement the viewport width is unknown, not zero — falling
    // through to the clamp would slam the column to the far left for one frame.
    if (this._viewportWidth <= 0) return natural;
    const width = this._getColWidth(cols[colIndex]);
    const stuck = this._scrollLeft + this._viewportWidth - this._getPinnedRight(colIndex) - width;
    return Math.min(natural, stuck);
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
    const headerAlign = col.headerAlign ?? effectiveAlign(col);

    const classes = [
      'ft-header-cell',
      sortable ? 'ft-sortable' : '',
      isPinned ? 'ft-pinned' : '',
      headerAlign === 'center' ? 'ft-header-align-center' : '',
      headerAlign === 'end' ? 'ft-header-align-end' : '',
      this._headerCol === colIndex ? 'ft-header-active' : '',
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
      cellStyle = `position: absolute; top: 0; left: ${this._getPinnedRightLeft(colIndex)}px; width: ${width}px; height: ${hdrH}px; z-index: 4;`;
    } else {
      cellStyle = `left: ${left}px; width: ${width}px; height: ${hdrH}px;`;
    }

    const isDraggingThis = this._columnGestures.colDrag?.active && this._columnGestures.colDrag.colIndex === colIndex;
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
        tabindex="-1"
        aria-colindex=${colIndex + 1}
        data-col-index=${colIndex}
        style=${cellStyle}
        aria-sort=${ariaSortValue ?? nothing}
        @contextmenu=${(e: MouseEvent) => this._onHeaderContextMenu(e, col)}
        @mousedown=${(e: MouseEvent) => this._columnGestures.headerMouseDown(e, col, colIndex)}
        @click=${sortable ? (e: MouseEvent) => this._onHeaderClick(e, col) : undefined}>
        ${showHiddenIndicator ? html`
          <button class="ft-hidden-col-indicator" tabindex="-1"
            title=${t('showHiddenColumns')}
            @click=${(e: MouseEvent) => { e.stopPropagation(); this._showHiddenBefore(col); }}>&#x276F;</button>
        ` : ''}
        <span>${col.label}</span>
        ${criterion ? html`<span class="ft-sort-indicator">${criterion.direction === 'asc' ? '\u25B2' : '\u25BC'}</span>` : ''}
        ${sortIndex >= 0 ? html`<span class="ft-sort-order">${sortIndex + 1}</span>` : ''}
        <button class="ft-column-menu-btn ${hasFilter ? 'ft-filter-active' : ''}"
          type="button"
          tabindex="-1"
          data-key=${col.key}
          title=${t('columnMenu')}
          aria-label=${t('columnMenuFor', { header: col.label })}
          aria-haspopup="menu"
          aria-expanded=${this._headerMenu?.key === col.key ? 'true' : 'false'}
          @mousedown=${(e: MouseEvent) => e.stopPropagation()}
          @click=${(e: MouseEvent) => this._onColumnMenuBtnClick(e, col)}>
          \u22EE
        </button>
        <div class="ft-resize-handle"
          @mousedown=${(e: MouseEvent) => { e.stopPropagation(); this._wasHeaderDrag = true; this._columnGestures.startResize(e, colIndex); }}
          @dblclick=${(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); this._columnGestures.autoFit(col.key); }}></div>
      </div>
      ${this._openFilterKey === col.key ? this._filterPopover.renderDropdown(col) : ''}
    `;
  }

  /** Hidden columns directly adjacent to `col` (before and after) — the ones its menu can show again. */
  private _hiddenNeighbors(col: ColumnDefinition): ColumnDefinition[] {
    const allCols = this.columns;
    const thisIdx = allCols.findIndex(c => c.key === col.key);
    const hiddenNeighbors: ColumnDefinition[] = [];
    for (let i = thisIdx - 1; i >= 0; i--) {
      if (allCols[i].hidden) hiddenNeighbors.push(allCols[i]);
      else break;
    }
    for (let i = thisIdx + 1; i < allCols.length; i++) {
      if (allCols[i].hidden) hiddenNeighbors.push(allCols[i]);
      else break;
    }
    return hiddenNeighbors;
  }

  private _onHeaderContextMenu(e: MouseEvent, col: ColumnDefinition): void {
    e.preventDefault();
    this._openFilterKey = null;
    this._headerMenu = { key: col.key, x: e.clientX, y: e.clientY, hiddenNeighbors: this._hiddenNeighbors(col) };
    this._emit('header-context-menu', { key: col.key, label: col.label, x: e.clientX, y: e.clientY });
    requestAnimationFrame(() => {
      document.addEventListener('click', this._onDocumentClick, { once: true });
    });
  }

  /**
   * The header's column menu button — the same menu a right-click opens, anchored under the button.
   * It is the pointer-sized, keyboard-reachable way to every per-column action: filtering, hiding,
   * and resizing without dragging the 6px handle (WCAG 2.2 SC 2.5.7 / 2.5.8).
   */
  private _onColumnMenuBtnClick(e: MouseEvent, col: ColumnDefinition): void {
    e.preventDefault();
    e.stopPropagation();
    if (this._headerMenu?.key === col.key) {
      this._headerMenu = null;
      return;
    }
    this._openColumnMenu(col, e.currentTarget as HTMLElement);
  }

  /** Open `col`'s column menu under `anchor` (its menu button by default) and focus the first item. */
  private _openColumnMenu(col: ColumnDefinition, anchor = this._columnMenuButton(col.key)): void {
    const rect = anchor?.getBoundingClientRect();
    this._openFilterKey = null;
    this._headerMenu = { key: col.key, x: rect?.left ?? 0, y: rect?.bottom ?? 0, hiddenNeighbors: this._hiddenNeighbors(col) };
    requestAnimationFrame(() => {
      document.addEventListener('click', this._onDocumentClick, { once: true });
    });
    void this.updateComplete.then(() => this._menuItems()[0]?.focus());
  }

  private _menuItems(): HTMLElement[] {
    return Array.from(this.shadowRoot?.querySelectorAll<HTMLElement>('.ft-header-menu [role="menuitem"]') ?? []);
  }

  private _columnMenuButton(key: string): HTMLElement | null {
    const colIndex = this.visibleColumns.findIndex(c => c.key === key);
    return this.shadowRoot?.querySelector<HTMLElement>(
      `.ft-header-cell[data-col-index="${colIndex}"] .ft-column-menu-btn`,
    ) ?? null;
  }

  private _closeHeaderMenu(returnFocus: boolean): void {
    const key = this._headerMenu?.key;
    this._headerMenu = null;
    if (!returnFocus || !key) return;
    // Opened from the header row → back to the grid, which keeps the header cell; from the button → the button.
    if (this._headerCol !== null) this.focus();
    else this._columnMenuButton(key)?.focus();
  }

  private _onHeaderMenuKeydown(e: KeyboardEvent): void {
    this._onMenuKeydown(e, '.ft-header-menu', (returnFocus) => this._closeHeaderMenu(returnFocus));
  }

  /**
   * Menu keyboard pattern shared by the column menu and the cell context menu: arrows and Home/End
   * move focus between the items (wrapping), Escape closes and returns focus, Tab closes.
   */
  private _onMenuKeydown(e: KeyboardEvent, menuSelector: string, close: (returnFocus: boolean) => void): void {
    const items = Array.from(
      this.shadowRoot?.querySelectorAll<HTMLElement>(`${menuSelector} [role="menuitem"]`) ?? [],
    );
    const current = items.indexOf(e.target as HTMLElement);
    let next = -1;
    switch (e.key) {
      case 'ArrowDown': next = current < 0 ? 0 : (current + 1) % items.length; break;
      case 'ArrowUp': next = current <= 0 ? items.length - 1 : current - 1; break;
      case 'Home': next = 0; break;
      case 'End': next = items.length - 1; break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        close(true);
        return;
      case 'Tab':
        close(false);
        return;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    items[next]?.focus();
  }

  /** Open the filter dropdown for `key` from its column menu, focusing its first control. */
  private _openFilterFromMenu(key: string): void {
    this._headerMenu = null;
    this._openFilterKey = key;
    requestAnimationFrame(() => {
      document.addEventListener('click', this._onDocumentClick, { once: true });
    });
    void this.updateComplete.then(async () => {
      const first = this.shadowRoot?.querySelector<HTMLElement & { updateComplete?: Promise<unknown> }>(
        '.ft-filter-dropdown input, .ft-filter-dropdown select, .ft-filter-dropdown u-date-picker');
      // A date bound is a custom element that renders after this update — focus it once its text box exists.
      await first?.updateComplete;
      first?.focus();
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

    const hasFilter = this._filters.some(f => f.key === key);
    // 🔴항목 클릭은 문서까지 올라가지 않게 한다 — 문서 클릭은 «열린 것을 전부 닫기» 라, 메뉴에서 연 필터
    //   드롭다운을 같은 클릭이 곧바로 닫는다. 폭 조절 둘은 연달아 누르도록 메뉴를 열어 둔다.
    const item = (action: string, label: unknown, run: () => void, keepOpen = false) => html`
      <button type="button" role="menuitem" class="ft-header-menu-item" data-action=${action}
        @click=${(e: MouseEvent) => {
          e.stopPropagation();
          if (!keepOpen) this._headerMenu = null;
          run();
        }}>${label}</button>
    `;

    return html`
      <div class="ft-header-menu" role="menu" aria-label=${t('columnMenuRegion', { header: col.label })}
        style="position: fixed; left: ${x}px; top: ${y}px; z-index: var(--u-layer-floating, 1000);"
        @mousedown=${(e: MouseEvent) => e.stopPropagation()}
        @keydown=${(e: KeyboardEvent) => this._onHeaderMenuKeydown(e)}>
        ${col.sortable !== false ? html`
          ${item('sort-asc', t('sortAscending'), () => this._applySortFromMenu(key, 'asc'))}
          ${item('sort-desc', t('sortDescending'), () => this._applySortFromMenu(key, 'desc'))}
          <div class="ft-header-menu-separator" role="separator"></div>
        ` : nothing}
        ${this.showFilters ? html`
          ${item('filter', t('filter'), () => this._openFilterFromMenu(key))}
          ${hasFilter ? item('clear-filter', t('clearFilter'), () => this._filterPopover.clearColumn(key)) : nothing}
          <div class="ft-header-menu-separator" role="separator"></div>
        ` : nothing}
        ${item('hide', t('hideColumn'), () => this._setColumnHidden(key, true))}
        ${hiddenNeighbors.map(h => item('show', t('showColumn', { header: h.label }), () => this._setColumnHidden(h.key, false)))}
        <div class="ft-header-menu-separator" role="separator"></div>
        ${item('autofit', t('autoFitWidth'), () => this._columnGestures.autoFit(key))}
        ${item('wider', t('wider'), () => this._resizeColumnBy(key, COLUMN_RESIZE_STEP), true)}
        ${item('narrower', t('narrower'), () => this._resizeColumnBy(key, -COLUMN_RESIZE_STEP), true)}
      </div>
    `;
  }

  private _renderBodyContextMenu() {
    if (!this._bodyContextMenu) return nothing;
    const { colIndex, dataIndex, x, y } = this._bodyContextMenu;
    const col = this.visibleColumns[colIndex];
    if (!col) return nothing;
    const value = getCellValue(this.data[dataIndex], col.key);
    const hasFilter = this._filters.some(f => f.key === col.key);
    const close = (returnFocus = false) => {
      this._bodyContextMenu = null;
      if (returnFocus) this.focus();
    };
    const hasComment = !!this.getComment(dataIndex, col.key);
    const item = (label: string, run: () => void, danger = false) => html`
      <button type="button" role="menuitem"
        class="ft-context-menu-item ${danger ? 'ft-context-menu-danger' : ''}"
        @click=${() => { run(); close(); }}>${label}</button>
    `;
    const separator = html`<div class="ft-context-menu-separator" role="separator"></div>`;

    // Opens at the pointer; `updated()` moves it back inside the viewport once its real size is known.
    return html`
      <div class="ft-body-context-menu" role="menu" aria-label=${t('cellActions')}
        style="position: fixed; left: ${x}px; top: ${y}px; z-index: var(--u-layer-floating, 1000);"
        @mousedown=${(e: MouseEvent) => e.stopPropagation()}
        @keydown=${(e: KeyboardEvent) => this._onMenuKeydown(e, '.ft-body-context-menu', close)}>
        ${item(t('copy'), () => this._clipboard.copyFromMenu())}
        ${separator}
        ${item(t('insertRowAbove'), () => this.addRow(undefined, dataIndex))}
        ${item(t('insertRowBelow'), () => this.addRow(undefined, dataIndex + 1))}
        ${item(t('deleteRow'), () => this.deleteRows([dataIndex]), true)}
        ${separator}
        ${item(t('hideColumn'), () => this._setColumnHidden(col.key, true))}
        ${separator}
        ${item(`${t('sortAscending')} ↑`, () => this._applySortFromMenu(col.key, 'asc'))}
        ${item(`${t('sortDescending')} ↓`, () => this._applySortFromMenu(col.key, 'desc'))}
        ${separator}
        ${item(t('filterByThisValue'), () => this.setFilter(col.key, value === null || ['string', 'number', 'boolean'].includes(typeof value) ? { type: 'equals', value: value as string | number | boolean | null } : (v) => v === value))}
        ${hasFilter ? item(t('clearFilter'), () => this.removeFilter(col.key)) : nothing}
        ${separator}
        ${item(hasComment ? t('editComment') : t('addComment'), () => this._commentPopup.open(dataIndex, col.key, x, y))}
        ${hasComment ? item(t('deleteComment'), () => this.setComment(dataIndex, col.key, null), true) : nothing}
      </div>
    `;
  }

  /**
   * Sort by one column from a menu — the column menu (the keyboard path to sorting) and the cell
   * context menu. Same contract as a header click: server mode only reports, and `sort-change`
   * carries `{ criteria }`.
   */
  private _applySortFromMenu(key: string, dir: 'asc' | 'desc'): void {
    const col = this.columns.find(c => c.key === key);
    if (!col || col.sortable === false) return;
    this._sortCriteria = [{ key, direction: dir }];
    if (this.dataMode !== 'server') {
      this._recomputeView();
    }
    this.requestUpdate();
    this._emit('sort-change', { criteria: [...this._sortCriteria] });
    this._emitViewState('sort');
  }

  // --- Filter UI ---

  /** Keep a fixed-position menu inside the viewport — a menu opened near the right or bottom edge would spill off-screen. */
  private _keepMenuInView(selector: string): void {
    const menu = this.shadowRoot?.querySelector<HTMLElement>(selector);
    if (!menu) return;
    const margin = 4;
    const rect = menu.getBoundingClientRect();
    // 🔴창 크기가 아니라 «보이는 영역» 이다 — `innerWidth` 는 스크롤바를 포함해, 그 값에 맞추면 메뉴 끝이 스크롤바 밑에 깔린다.
    const viewWidth = document.documentElement.clientWidth;
    const viewHeight = document.documentElement.clientHeight;
    if (rect.right > viewWidth - margin) {
      menu.style.left = `${Math.max(margin, viewWidth - rect.width - margin)}px`;
    }
    if (rect.bottom > viewHeight - margin) {
      menu.style.top = `${Math.max(margin, viewHeight - rect.height - margin)}px`;
    }
  }

  private _adjustFilterDropdown(): void {
    if (!this._openFilterKey) return;
    const dropdown = this.shadowRoot?.querySelector('.ft-filter-dropdown') as HTMLElement | null;
    const header = dropdown?.previousElementSibling as HTMLElement | null;
    if (!dropdown || !header) return;

    // 🔴표 «밖» 에 띄운다(position: fixed — 열 메뉴·본문 메뉴와 같은 방식). 표 안에 절대 배치하면 표의 스크롤
    //   영역(호스트 overflow: auto)이 잘라, 짧은 표나 큰 타깃(--u-target-size)에서 아래쪽 컨트롤이 보이지도 눌리지도 않았다.
    //   매 갱신마다 머리 칸에 다시 붙인다 — 가로 스크롤로 머리 칸이 움직여도 따라간다.
    const margin = 4;
    const cell = header.getBoundingClientRect();
    const rect = dropdown.getBoundingClientRect();
    const viewWidth = document.documentElement.clientWidth;
    const viewHeight = document.documentElement.clientHeight;
    // 아래에 자리가 없으면 머리 칸 위로 — 위에도 없으면 창 안에 들도록 민다.
    let top = cell.bottom;
    if (top + rect.height > viewHeight - margin) {
      top = cell.top - rect.height >= margin ? cell.top - rect.height : Math.max(margin, viewHeight - rect.height - margin);
    }
    const left = Math.max(margin, Math.min(cell.left, viewWidth - rect.width - margin));
    dropdown.style.left = `${left}px`;
    dropdown.style.top = `${top}px`;
  }

  /**
   * Close the filter dialog. From the keyboard (Escape) focus goes back to the column's menu button — the
   * dialog leaves the DOM, and focus inside it would otherwise drop to the page (APG dialog). A click
   * outside closes it without moving focus: the click already put focus where the user meant.
   */
  private _closeFilterDropdown(restoreFocus = true): void {
    const key = this._openFilterKey;
    this._openFilterKey = null;
    if (!restoreFocus || key === null) return;
    if (this._headerCol !== null) {
      this.focus();
      return;
    }
    void this.updateComplete.then(() => {
      const btn = [...(this.shadowRoot?.querySelectorAll<HTMLButtonElement>('.ft-column-menu-btn') ?? [])]
        .find((b) => b.dataset.key === key);
      btn?.focus();
    });
  }

  /** 셀 오류 표시 — 우리 문장은 «그릴 때 찾는» 함수로(로캘 전환에 따라오게), 소비자 `validator` 문장은 그대로. */
  private _invalidCells: Map<string, { error: string | (() => string); timer: ReturnType<typeof setTimeout> }> = new Map();

  /** A cell named by its row's id and its column's key — so the mark stays on the cell when the view reorders. */
  private _cellKey(row: DataRow, col: ColumnDefinition): string {
    return `${this.getRowId(row)}\u0000${col.key}`;
  }

  private _markCellInvalid(row: DataRow, col: ColumnDefinition, error: string | (() => string)): void {
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

  private _isCellInvalid(row: DataRow, col: ColumnDefinition): string | null {
    const entry = this._invalidCells.get(this._cellKey(row, col));
    if (!entry) return null;
    return typeof entry.error === 'function' ? entry.error() : entry.error;
  }

  /**
   * 텍스트 필터 · 찾기 칸의 IME 조합. 조합 중인 음절(«서울» 의 가는 길 «ㅅ» · «성»)로 거르면 찾는 행을 숨기고 «결과 없음» 을
   * 보이며, 필터는 그 술어를 바깥에도 알린다 — 조합 중에는 글자만 담고 적용은 조합이 끝날 때 한다(같은 처리기를 다시 부른다).
   * 칸의 값이 상태에 묶여 있어(`.value=`) 상태에는 늘 상자의 글자 전체를 둔다.
   */
  private readonly _textEntryIme = new CompositionTracker(replayInput);
  /** The find / replace panel — its state, search and replace steps. */
  private readonly _find = new FindReplaceController({
    columns: () => this.visibleColumns,
    rowCount: () => this._visibleRowCount,
    dataIndex: (row) => this._toDataIndex(row),
    data: () => this.data,
    isEditable: (col, row) => this._isCellEditable(col, row),
    pushUndo: (step) => { this._undo.push(step); this._dispatchUndoStateEvent(); },
    emitReplace: (detail) => { this._emit('find-replace', detail); },
    reveal: (row, col) => {
      this._selection.setActive(row, col);
      this._activeCell = { row, col };
      this._scrollToActiveCell();
    },
    invalidate: () => this.requestUpdate(),
    focusInput: () => { this.shadowRoot?.querySelector<HTMLInputElement>('.ft-find-input')?.focus(); },
    ime: this._textEntryIme,
  });
  /** The cell comment's small editor. */
  private readonly _commentPopup = new CommentPopupController({
    root: () => this.shadowRoot,
    getComment: (dataIndex, colKey) => this.getComment(dataIndex, colKey),
    setComment: (dataIndex, colKey, text) => this.setComment(dataIndex, colKey, text),
    invalidate: () => this.requestUpdate(),
  });
  /** Fill down / right and clear over the selection's blocks — the keys, and the clipboard's cut. */
  private readonly _rangeEdit = new RangeEditController({
    columns: () => this.visibleColumns,
    data: () => this.data,
    dataIndex: (row) => this._toDataIndex(row),
    isEditable: (col, row) => this._isCellEditable(col, row),
    selection: this._selection,
    updateRows: (changes) => this.updateRows(changes),
    pushUndo: (step) => { this._undo.push(step); this._dispatchUndoStateEvent(); },
    invalidate: () => this.requestUpdate(),
  });
  /** Copy, cut and paste of the selection as TSV — the keys, the context menu's Copy, and their events. */
  private readonly _clipboard = new ClipboardController({
    columns: () => this.visibleColumns,
    data: () => this.data,
    sortedIndices: () => this._sortedIndices,
    rowCount: () => this._visibleRowCount,
    dataIndex: (row) => this._toDataIndex(row),
    isEditable: (col, row) => this._isCellEditable(col, row),
    editable: () => this.editable,
    maxRows: () => this.maxRows,
    createEmptyRow: () => this._createEmptyRow(),
    recomputeView: () => this._recomputeView(),
    selection: this._selection,
    activeCell: () => this._activeCell,
    setActiveCell: (position) => { this._activeCell = position; },
    clearRanges: (ranges) => this._rangeEdit.clear(ranges),
    pushUndo: (step) => { this._undo.push(step); this._dispatchUndoStateEvent(); },
    emit: (name, detail) => { this._emit(name, detail); },
    invalidate: () => this.requestUpdate(),
  });
  /** The fill handle at the selection's corner — drag to repeat the selection or continue a numeric series. */
  private readonly _fillHandle = new FillHandleController({
    host: this,
    columns: () => this.visibleColumns,
    data: () => this.data,
    rowCount: () => this._visibleRowCount,
    dataIndex: (row) => this._toDataIndex(row),
    isEditable: (col, row) => this._isCellEditable(col, row),
    editable: () => this.editable,
    selection: this._selection,
    rowHeight: () => this.rowHeight,
    headerHeight: () => this.headerHeight,
    scrollLeft: () => this._scrollLeft,
    scrollTop: () => this._scrollTop,
    prefixWidth: () => this._prefixWidth,
    colLeftOffsets: () => this._colLeftOffsets,
    colWidth: (col) => this._getColWidth(col),
    rowSpaceY: (clientY) => this._rowSpaceY(clientY),
    pushUndo: (step) => { this._undo.push(step); this._dispatchUndoStateEvent(); },
    emitApply: (detail) => { this._emit('fill-handle-apply', detail); },
    invalidate: () => this.requestUpdate(),
  });
  /** Drag a row by its number to move it. */
  private readonly _rowReorder = new RowReorderController({
    host: this,
    columns: () => this.visibleColumns,
    data: () => this.data,
    setData: (rows) => { this.data = rows; },
    rowCount: () => this._visibleRowCount,
    dataIndex: (row) => this._toDataIndex(row),
    rowHeight: () => this.rowHeight,
    headerHeight: () => this.headerHeight,
    rowSpaceY: (clientY) => this._rowSpaceY(clientY),
    rowBoundaryViewportY: (index) => this._rowBoundaryViewportY(index),
    markRowDrag: () => { this._wasRowDrag = true; },
    pushUndo: (step) => { this._undo.push(step); this._dispatchUndoStateEvent(); },
    emitReorder: (detail) => { this._emit('row-reorder', detail); },
    invalidate: () => this.requestUpdate(),
  });
  /** The column filter popover — its controls and the per-column state they hold. */
  private readonly _filterPopover = new FilterPopoverController({
    commit: (key, predicate, model) => this._commitFilter(key, predicate, model),
    remove: (key) => this.removeFilter(key),
    close: (restoreFocus) => this._closeFilterDropdown(restoreFocus),
    ime: this._textEntryIme,
  });
  /** 자동완성 편집기의 IME 조합 — 후보는 검색 질의(`searchQuery` — 글 끝 한글 조합은 자모 앞부분으로)로 고른다. */
  private readonly _editorIme = new CompositionTracker(replayInput);

  // --- Rendering ---

  render() {
    const cols = this.visibleColumns;
    const importOverlay = this.importEnabled && this._isDragOver
      ? html`<div class="ft-import-overlay">${t('dropFileToImport')}</div>`
      : nothing;
    const loadingOverlay = this.loading
      ? html`<div class="ft-loading-overlay"></div>`
      : nothing;

    if (cols.length === 0) {
      return html`${importOverlay}${loadingOverlay}<div class="ft-empty">${t('noColumnsDefined')}</div>`;
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
            style="position: absolute; top: 0; left: ${sl + prefixLeft}px; width: ${this._checkboxColWidth}px; height: ${hdrH}px; z-index: 4;">
          ${this._rowSelection.mode === 'multi' ? html`
            <!-- 칸 전체가 누르는 자리다(라벨) — 체크 상자는 16px 그대로. -->
            <label class="ft-checkbox-hit"><input type="checkbox" tabindex="-1" aria-label=${t('selectAllRows')}
              .checked=${this._rowSelection.isAllSelected(this._visibleRowIds())}
              .indeterminate=${this._rowSelection.isSomeSelected(this._visibleRowIds())}
              @change=${this._onSelectAllChange}></label>
          ` : ''}
        </div>`
      : '';
    if (this.selectable) prefixLeft += this._checkboxColWidth;

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

    const dropIndicator = this._columnGestures.dragIndicatorLeft != null
      ? html`<div class="ft-drop-indicator" style="left:${this._columnGestures.dragIndicatorLeft}px"></div>`
      : '';

    if (this.error || this.data.length === 0 || this._visibleRowCount === 0) {
      const msg = this.error
        ? html`<div class="ft-empty ft-error" role="alert">${this.error.message}</div>`
        : html`<div class="ft-empty">${this.data.length === 0 ? (this.emptyMessage || t('noData')) : (this.noMatchingMessage || t('noMatchingData'))}</div>`;
      return html`
        ${loadingOverlay}
        <div class="ft-header" role="row" aria-rowindex="1" style="width: ${tw}px; height: ${hdrH}px;">
          ${selectAllHeader}${rowNumHeader}
          ${headerCells}
          ${dropIndicator}
        </div>
        ${msg}
      `;
    }

    const { start, end } = this.visibleRange;
    const fr = this._frozenRowCount;
    const rows = [];
    for (let i = start; i < end; i++) {
      rows.push(this._renderRow(i, colStart, colEnd, pinnedIndices, (i - fr) * this.rowHeight));
    }

    const fillHandle = this._fillHandle.render();
    const rowDropIndicator = this._rowReorder.indicatorY != null
      // `tw` (_totalRowWidth) already starts at _prefixWidth — adding it again drew the
      // indicator past the last column by the width of the checkbox/row-number gutter.
      ? html`<div class="ft-row-drop-indicator" style="top:${this._rowReorder.indicatorY}px;width:${tw}px;"></div>`
      : '';

    return html`
      ${importOverlay}
      ${loadingOverlay}
      ${this._find.render()}
      <div class="ft-header" role="row" aria-rowindex="1" style="width: ${tw}px; height: ${hdrH}px;">
        ${selectAllHeader}${rowNumHeader}
        ${headerCells}
        ${dropIndicator}
      </div>
      ${this._renderFrozenRows(colStart, colEnd, pinnedIndices)}
      <div class="ft-body" style="height: ${this.totalBodyHeight}px; width: ${tw}px;">
        ${rows}
      </div>
      ${this._hasFooter ? this._renderFooter(colStart, colEnd, pinnedIndices) : ''}
      ${rowDropIndicator}
      ${fillHandle}
      ${this._renderHeaderContextMenu()}
      ${this._renderBodyContextMenu()}
      ${this._commentPopup.render()}
    `;
  }

  private _onSelectAllChange(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    // The rows in view — rows selected on another page are not in view and stay as they are.
    if (checked) {
      this._rowSelection.selectAll(this._visibleRowIds());
    } else {
      this._rowSelection.deselectMany(this._visibleRowIds());
    }
    this._rowSelectionVersion++;
    this._dispatchRowSelectionEvent();
  }

  private _onRowCheckboxChange(e: Event, rowIndex: number): void {
    e.stopPropagation();
    const row = this.data[this._toDataIndex(rowIndex)];
    if (!row) return;
    const id = this.getRowId(row);
    if (this._checkboxShiftPending && this._lastCheckboxRowId !== null) {
      this._rowSelection.selectRange(this._visibleRowIds(), this._lastCheckboxRowId, id);
    } else {
      this._rowSelection.toggle(id);
    }
    this._lastCheckboxRowId = id;
    this._checkboxShiftPending = false;
    this._rowSelectionVersion++;
    this._dispatchRowSelectionEvent();
  }

  /**
   * Captures shiftKey from the checkbox's own click (MouseEvent) — the subsequent native
   * `change` event does not carry modifier keys. Click always fires before change for a
   * checkbox input, so this reliably primes `_onRowCheckboxChange` for the same interaction.
   */
  private _onRowCheckboxClick(e: MouseEvent): void {
    this._checkboxShiftPending = e.shiftKey;
  }

  private _renderFrozenRows(colStart: number, colEnd: number, pinnedIndices: number[]) {
    const fr = this._frozenRowCount;
    if (fr === 0) return nothing;

    const tw = this._totalRowWidth;
    const frozenRows = [];
    for (let i = 0; i < fr; i++) {
      frozenRows.push(this._renderRow(i, colStart, colEnd, pinnedIndices, i * this.rowHeight));
    }
    return html`
      <div class="ft-frozen-rows" style="top: ${this.headerHeight}px; height: ${this.frozenRowsHeight}px; width: ${tw}px;">
        ${frozenRows}
      </div>
    `;
  }

  /** A footer row shows when `footerData` is set or a shown column has an `aggregate` (client mode). */
  private get _hasFooter(): boolean {
    return !!this.footerData || (this.dataMode !== 'server' && this.visibleColumns.some(c => c.aggregate));
  }

  private _computeAggregates(): void {
    const cols = this.dataMode === 'server' ? [] : this.visibleColumns.filter(c => c.aggregate);
    if (cols.length === 0) {
      this._aggregates = null;
      return;
    }
    const rows = this._sortedIndices.map(i => this.data[i]);
    const out: Record<string, unknown> = {};
    for (const col of cols) {
      try {
        out[col.key] = computeAggregate(col.aggregate!, rows.map(r => getCellValue(r, col.key)), rows);
      } catch (e) {
        // 소비자 함수의 예외가 표 렌더를 깨지 않게 — 필터 술어(`filter-error`)와 같은 대우: 그 칸만 비운다.
        // eslint-disable-next-line no-console -- the column's aggregate function threw; say which column
        console.warn('[@iyulab/flex-table] the aggregate for column "%s" threw:', col.key, e);
        out[col.key] = undefined;
      }
    }
    this._aggregates = out;
  }

  /** A footer cell: the `footerData` entry, else the column's aggregate written like its cells. */
  private _footerContent(col: ColumnDefinition): unknown {
    const given = this.footerData?.[col.key];
    if (given !== undefined && typeof given !== 'number') return given;
    const value = given ?? this._aggregates?.[col.key];
    if (value == null) return '';
    // 개수는 열의 서식(날짜 패턴 등)과 무관한 수 — 기본 숫자 표기로.
    if (given === undefined && col.aggregate === 'count') return renderCell(value, {}, { ...col, render: undefined, format: undefined, type: 'number' });
    return renderCell(value, {}, { ...col, render: undefined, conditionalRules: undefined });
  }

  private _renderFooter(colStart: number, colEnd: number, pinnedIndices: number[]) {
    if (!this._hasFooter) return '';
    const cols = this.visibleColumns;
    const rowH = this.rowHeight;
    const tw = this._totalRowWidth;

    // Footer prefix cells — absolute positioning with scrollLeft compensation
    const sl = this._scrollLeft;
    let prefixLeft = 0;
    const checkboxFooter = this.selectable
      ? html`<div class="ft-footer-cell ft-checkbox-cell"
            style="position: absolute; top: 0; left: ${sl + prefixLeft}px; width: ${this._checkboxColWidth}px; height: ${rowH}px; z-index: 2;"></div>`
      : '';
    if (this.selectable) prefixLeft += this._checkboxColWidth;

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
        ? `position: absolute; top: 0; left: ${this._getPinnedRightLeft(pi)}px; width: ${width}px; height: ${rowH}px; z-index: 2;`
        : `position: absolute; top: 0; left: ${sl + this._getPinnedLeft(pi)}px; width: ${width}px; height: ${rowH}px; z-index: 2;`;
      footerCells.push(html`
        <div class="ft-footer-cell ft-pinned" role="gridcell" aria-colindex=${pi + 1} style=${pStyle}>
          ${this._footerContent(col)}</div>
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
        <div class="ft-footer-cell ${isPinned ? 'ft-pinned' : ''}" role="gridcell" aria-colindex=${i + 1} style=${cellStyle}>
          ${this._footerContent(col)}</div>
      `);
    }

    return html`
      <div class="ft-footer" role="row" aria-rowindex=${this._visibleRowCount + 2} style="width: ${tw}px; height: ${rowH}px;">
        ${checkboxFooter}${rowNumFooter}
        ${footerCells}
      </div>
    `;
  }

  private _renderRow(index: number, colStart: number, colEnd: number, pinnedIndices: number[], topOverride?: number) {
    const cols = this.visibleColumns;
    const dataIndex = this._toDataIndex(index);
    const row = this.data[dataIndex];
    const top = topOverride ?? index * this.rowHeight;
    const rowH = this.rowHeight;
    const tw = this._totalRowWidth;
    const parity = index % 2 === 0 ? 'ft-row-even' : 'ft-row-odd';
    const isRowSelected = this.selectable && row !== undefined && this._rowSelection.isSelected(this.getRowId(row));

    // Prefix cells — use absolute positioning with scrollLeft compensation
    // (position: sticky inside scrollable containers causes inline whitespace gaps)
    const sl = this._scrollLeft;
    let prefixLeft = 0;
    const checkboxCell = this.selectable ? html`
      <div class="ft-checkbox-cell"
        style="position: absolute; top: 0; left: ${sl + prefixLeft}px; width: ${this._checkboxColWidth}px; height: ${rowH}px; z-index: 2;">
        <!-- 행 체크박스는 Tab 정지점이 아니다 — 그리드(호스트)가 하나의 정지점이고 행 선택은 Shift+Space 다.
             렌더된 행마다 정지점이면 표 하나를 지나는 데 Tab 이 행 수만큼 든다. -->
        <label class="ft-checkbox-hit"><input type="checkbox" tabindex="-1" aria-label=${t('selectRow')}
          .checked=${isRowSelected}
          @click=${(e: MouseEvent) => this._onRowCheckboxClick(e)}
          @change=${(e: Event) => this._onRowCheckboxChange(e, index)}></label>
      </div>
    ` : '';
    if (this.selectable) prefixLeft += this._checkboxColWidth;

    const isDraggingRow = this._rowReorder.isDragging(index);
    const rowNumCell = this.showRowNumbers ? html`
      <div class="ft-row-num ${isDraggingRow ? 'ft-col-dragging' : ''}"
        style="position: absolute; top: 0; left: ${sl + prefixLeft}px; width: 48px; height: ${rowH}px; z-index: 2; cursor: grab;"
        @mousedown=${(e: MouseEvent) => this._rowReorder.onNumMouseDown(e, index)}
        @click=${() => this._onRowNumberClick(index)}>${dataIndex + 1}</div>
    ` : '';

    // Data cells: pinned outside range + visible range
    const cells = [];
    for (const pi of pinnedIndices) {
      cells.push(this._renderCell(row, cols[pi], index, pi, this._mergeState(cols[pi], index)));
    }
    for (let i = colStart; i < colEnd; i++) {
      cells.push(this._renderCell(row, cols[i], index, i, this._mergeState(cols[i], index)));
    }

    return html`
      <div class="ft-row ${parity} ${isRowSelected ? 'ft-row-selected' : ''}" role="row" aria-rowindex=${index + 2}
        style="top: ${top}px; height: ${rowH}px; width: ${tw}px;">
        ${checkboxCell}${rowNumCell}
        ${cells}
      </div>
    `;
  }

  /** Does visual row `index` continue the `mergeRepeated` run of the row above it? */
  private _continuesRun(col: ColumnDefinition, index: number): boolean {
    const rule = col.mergeRepeated;
    if (!rule || index <= 0 || index >= this._visibleRowCount) return false;
    const row = this.data[this._toDataIndex(index)];
    const prev = this.data[this._toDataIndex(index - 1)];
    if (!row || !prev) return false;
    if (typeof rule === 'function') return rule(row, prev, col);
    const value = getCellValue(row, col.key);
    if (value == null || value === '') return false;
    const before = getCellValue(prev, col.key);
    return value instanceof Date && before instanceof Date
      ? value.getTime() === before.getTime()
      : Object.is(value, before);
  }

  /**
   * Rows where a run starts again whatever the row above holds: the first body row below the
   * frozen band, and the first body row in view — otherwise a run scrolled half out of view
   * shows no value at all.
   */
  private _isForcedRunHead(index: number): boolean {
    const fr = this._frozenRowCount;
    if (index === fr) return true;
    if (index < fr) return false;
    // The header and the frozen band are sticky in the scroll flow, so body row k sits
    // `k * rowHeight` below the band's lower edge and `scrollTop` is how far that edge has
    // scrolled. The head goes on the first row that is at least half in view.
    return index === fr + Math.floor((this._scrollTop + this.rowHeight / 2) / this.rowHeight);
  }

  /** How a `mergeRepeated` cell joins its neighbours, or `null` when the column does not merge. */
  private _mergeState(col: ColumnDefinition, index: number): MergeState | null {
    if (!col.mergeRepeated) return null;
    const continues = !this._isForcedRunHead(index) && this._continuesRun(col, index);
    const opensDown = !this._isForcedRunHead(index + 1) && this._continuesRun(col, index + 1);
    if (!continues && !opensDown) return null;
    // The run takes the background of the row it starts on, so the merged cell is one surface.
    let head = index;
    while (head > 0 && !this._isForcedRunHead(head) && this._continuesRun(col, head)) head--;
    return { continues, opensDown, headParity: head % 2 === 0 ? 'even' : 'odd' };
  }

  private _renderCell(row: DataRow, col: ColumnDefinition, rowIndex: number, colIndex: number, merge: MergeState | null = null) {
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
      cellStyle = `position: absolute; top: 0; left: ${this._getPinnedRightLeft(colIndex)}px; width: ${width}px; height: ${rowH}px; z-index: 2;`;
    } else {
      cellStyle = `left: ${left}px; width: ${width}px; height: ${rowH}px;`;
    }

    const readonly = !this._isCellEditable(col, row);

    // Apply conditional formatting rules
    if (col.conditionalRules && col.conditionalRules.length > 0) {
      const value = getCellValue(row, col.key);
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
          aria-colindex=${colIndex + 1}
          data-col-index=${colIndex}
          aria-selected="true"
          aria-readonly=${readonly ? 'true' : nothing}
          style=${cellStyle}>
          ${this._renderEditor(row, col)}
        </div>
      `;
    }

    const selected = isActive || isSelected;
    const validationError = this._isCellInvalid(row, col);
    const findResults = this._find.state?.results ?? [];
    const findMatchIdx = findResults.findIndex(r => r.row === rowIndex && r.col === colIndex);
    const isFindMatch = findMatchIdx >= 0;
    const isFindCurrent = isFindMatch && findMatchIdx === this._find.state!.currentIndex;
    const classes = [
      'ft-cell',
      `ft-type-${col.type ?? 'text'}`,
      `ft-align-${effectiveAlign(col)}`,
      isActive ? 'ft-active' : '',
      isSelected ? 'ft-selected' : '',
      isPinned ? 'ft-pinned' : '',
      validationError ? 'ft-invalid' : '',
      isFindCurrent ? 'ft-find-current' : (isFindMatch ? 'ft-find-match' : ''),
      merge ? `ft-merge-${merge.headParity}` : '',
      merge?.continues ? 'ft-merge-continued' : '',
      merge?.opensDown ? 'ft-merge-open' : '',
      col.reveal === 'hover' ? 'ft-reveal-hover' : '',
    ].filter(Boolean).join(' ');

    const commentText = this._comments.size > 0 ? this._comments.get(this.getRowId(row))?.get(col.key) ?? null : null;
    const hasComment = commentText !== null;
    const commentTooltip = hasComment
      ? html`<div class="ft-comment-indicator" title=${commentText}></div>`
      : nothing;

    return html`
      <div class=${hasComment ? classes + ' ft-has-comment' : classes}
        role="gridcell"
        tabindex="-1"
        aria-colindex=${colIndex + 1}
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
        ${commentTooltip}
        ${renderCell(getCellValue(row, col.key), row, col)}
      </div>
    `;
  }

  private _renderEditor(row: DataRow, col: ColumnDefinition) {
    // Use custom editor if provided
    if (col.editor) {
      return col.editor(getCellValue(row, col.key), row, col);
    }

    const value = getCellValue(row, col.key);
    const strValue = value == null ? '' : String(value);

    if (col.type === 'number') {
      return html`
        <input class="ft-editor ft-editor-number" type="text" inputmode="decimal" aria-label=${col.label}
          .value=${typeof value === 'number' ? editableNumber(value) : strValue}
          @keydown=${this._onEditorKeyDown}
          @blur=${this._onEditorBlur}>
      `;
    }

    if (col.type === 'date' || col.type === 'datetime') {
      // `u-date-picker`, not the native date input: that one shows the browser's UI language
      // (`10/02/2026` in an English browser). The picker's text box reads and shows the same
      // `YYYY-MM-DD` (`YYYY-MM-DD HH:mm`) the text editor did, with a calendar beside it. A day and
      // a time are applied together (`confirm`), so picking the day does not end the edit early.
      const datetime = col.type === 'datetime';
      return html`
        <u-date-picker class="ft-editor ft-editor-${col.type}" size="sm" aria-label=${col.label}
          mode=${datetime ? 'datetime' : 'date'} ?confirm=${datetime}
          .value=${pickerValue(value, datetime)}
          @keydown=${this._onEditorKeyDown}
          @change=${() => this._commitEdit()}
          @blur=${this._onEditorBlur}></u-date-picker>
      `;
    }

    if (col.type === 'select' && col.options && col.options.length > 0) {
      const opts = col.options;
      const isStringArray = typeof opts[0] === 'string';
      return html`
        <select class="ft-editor" aria-label=${col.label}
          @keydown=${this._onEditorKeyDown}
          @blur=${this._onEditorBlur}
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
        <input class="ft-editor" type="text" aria-label=${col.label}
          role="combobox" aria-autocomplete="list"
          aria-expanded=${candidates.length > 0 ? 'true' : 'false'}
          aria-controls="ft-autocomplete-list"
          aria-activedescendant=${activeIdx >= 0 && candidates.length > 0 ? `ft-autocomplete-${activeIdx}` : nothing}
          .value=${strValue}
          @compositionstart=${this._editorIme}
          @compositionupdate=${this._editorIme}
          @compositionend=${this._editorIme}
          @input=${(e: Event) => this._onAutocompleteInput(e, col)}
          @keydown=${this._onEditorKeyDown}
          @blur=${this._onEditorBlur}>
        ${candidates.length > 0 ? html`
          <div class="ft-autocomplete-dropdown" id="ft-autocomplete-list" role="listbox" aria-label=${col.label}>
            ${candidates.map((c, i) => html`
              <div class="ft-autocomplete-item ${i === activeIdx ? 'ft-autocomplete-active' : ''}"
                id=${`ft-autocomplete-${i}`} role="option" aria-selected=${i === activeIdx ? 'true' : 'false'}
                @mousedown=${(e: MouseEvent) => { e.preventDefault(); this._selectAutocompleteCandidate(c); }}>
                ${c}
              </div>
            `)}
          </div>
        ` : nothing}
      `;
    }

    // 편집기의 이름은 그 열의 머리글이다(그리드 셀의 이름이 그것이듯) — 이름이 없으면 «편집 상자» 만 들린다.
    return html`
      <input class="ft-editor" type="text" aria-label=${col.label}
        .value=${strValue}
        @keydown=${this._onEditorKeyDown}
        @blur=${this._onEditorBlur}>
    `;
  }
}

/** What the editor reads from `u-date-picker` — its value and its form validity. */
type DatePickerEditor = HTMLElement & { value?: string; readonly validity?: ValidityState };

/**
 * A cell value as the picker takes it: `YYYY-MM-DD`, or the local wall-clock `YYYY-MM-DDTHH:mm` for a
 * datetime (a value with an offset is shown in local time, as the text editor showed it). A value
 * that is not a date — text a paste kept — opens an empty picker; Escape keeps the cell as it was.
 */
function pickerValue(value: unknown, datetime: boolean): string | undefined {
  if (datetime) {
    const text = editableDateTime(value);
    return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(text) ? text.replace(' ', 'T') : undefined;
  }
  const text = editableDate(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}

/**
 * Typed listeners for {@link FlexTableEventMap} — the DOM's own pattern (`HTMLMediaElement` with
 * `HTMLMediaElementEventMap`). Element-scoped on purpose: several names are generic and would
 * collide on the global event map.
 */
export interface FlexTable {
  addEventListener<K extends keyof FlexTableEventMap>(type: K, listener: (this: FlexTable, ev: FlexTableEventMap[K]) => unknown, options?: boolean | AddEventListenerOptions): void;
  addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: FlexTable, ev: HTMLElementEventMap[K]) => unknown, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof FlexTableEventMap>(type: K, listener: (this: FlexTable, ev: FlexTableEventMap[K]) => unknown, options?: boolean | EventListenerOptions): void;
  removeEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: FlexTable, ev: HTMLElementEventMap[K]) => unknown, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'flex-table': FlexTable;
  }
}
