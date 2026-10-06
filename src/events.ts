import type { CellPosition, CellRange } from './core/selection.js';
import type { SortCriteria } from './core/sorting.js';
import type { ColumnDefinition, DataRow } from './models/types.js';

/** One cell a bulk operation wrote: data row index, column key, value before and after. */
export interface CellChange {
  row: number;
  key: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Every event `<flex-table>` dispatches, by name. All bubble and are composed.
 *
 * This map is the single source: the element dispatches through a typed helper keyed on it, so a
 * detail that drifts from what is written here fails to compile. Listeners get the same types —
 * `table.addEventListener('sort-change', (e) => e.detail.criteria)` — and so does the React
 * wrapper's `onSortChange`. The names are element-scoped (not on the global event map) because
 * several are generic (`sort-change`, `selection-change`) and other libraries use them too.
 */
export interface FlexTableEventMap {
  /** Row selection changed (`selectable`). Indices are data indices. */
  'selection-change': CustomEvent<{ selectedIndices: number[]; selectedRows: DataRow[] }>;
  /** After any undoable change, undo or redo. */
  'undo-state-change': CustomEvent<{ canUndo: boolean; canRedo: boolean }>;
  /** The set of column filters changed. `filteredCount` is the rows left visible. */
  'filter-change': CustomEvent<{ keys: string[]; filteredCount: number }>;
  /** A column filter predicate threw for a row; the row is kept. */
  'filter-error': CustomEvent<{ error: unknown; row: DataRow; filterKey: string }>;
  'column-add': CustomEvent<{ column: ColumnDefinition; index: number }>;
  'column-delete': CustomEvent<{ column: ColumnDefinition; key: string; index: number }>;
  'column-reorder': CustomEvent<{ key: string; oldIndex: number; newIndex: number }>;
  'column-visibility-change': CustomEvent<{ key: string; hidden: boolean }>;
  /** A column was resized — during the drag and once more when it ends. `colIndex` is the visible index. */
  'column-resize': CustomEvent<{ key: string; width: number; colIndex: number }>;
  /** A whole column was selected. `colIndex` is the visible index. */
  'column-select': CustomEvent<{ colIndex: number; key: string | undefined; rowCount: number }>;
  'row-add': CustomEvent<{ row: DataRow; index: number }>;
  'row-delete': CustomEvent<{ indices: number[]; rows: DataRow[] }>;
  /** A row was dragged to a new place. Both are data indices. */
  'row-reorder': CustomEvent<{ from: number; to: number }>;
  /** Enter on a non-editable cell — "activate this row". `index` is the data index, `col` the visible column index. */
  'row-activate': CustomEvent<{ row: DataRow; index: number; col: number; key: string | undefined }>;
  /** `batchUpdate()` applied its changes. */
  'batch-update': CustomEvent<{ changes: CellChange[] }>;
  /** The active cell moved; `null` when there is none. */
  'cell-select': CustomEvent<CellPosition | null>;
  /** `row` is the data index, `col` the visible column index. */
  'cell-edit-start': CustomEvent<{ row: number; col: number; key: string; value: unknown }>;
  'cell-edit-commit': CustomEvent<{ row: number; col: number; key: string; oldValue: unknown; newValue: unknown }>;
  /** `row` and `col` are visible positions. */
  'cell-edit-cancel': CustomEvent<{ row: number; col: number }>;
  /** An edit was rejected (type, `required` or `validator`); the value was not written. */
  'validation-error': CustomEvent<{ row: number; col: number; key: string; value: unknown; error: string }>;
  'comment-change': CustomEvent<{ dataIndex: number; colKey: string; text: string | null }>;
  /** Rows were imported from a file; `count` is how many. */
  'data-import': CustomEvent<{ count: number }>;
  'sort-change': CustomEvent<{ criteria: SortCriteria[] }>;
  /**
   * Right-click on a body cell. Cancelable: `preventDefault()` keeps the built-in menu closed so you
   * can show your own. `row` is the data index, `col` the visible column index.
   */
  'context-menu': CustomEvent<{
    x: number;
    y: number;
    row: number;
    col: number;
    key: string;
    value: unknown;
    rowData: DataRow | undefined;
  }>;
  'header-context-menu': CustomEvent<{ key: string; label: string; x: number; y: number }>;
  /** Text reached the clipboard (`range` is in visible positions). */
  'clipboard-copy': CustomEvent<{ range: CellRange; text: string }>;
  /** Like `clipboard-copy`, and the range was cleared afterwards. */
  'clipboard-cut': CustomEvent<{ range: CellRange; text: string }>;
  /** A paste was applied. `addedRows` counts rows appended to fit it. */
  'clipboard-paste': CustomEvent<{ changes: Array<CellChange & { col: number }>; addedRows: number }>;
  /** The clipboard refused a copy or paste (permission, focus, no secure context). */
  'clipboard-error': CustomEvent<{ action: 'copy' | 'paste'; error: unknown }>;
  /** The fill handle wrote `cells` (data row index and key). */
  'fill-handle-apply': CustomEvent<{
    sourceRange: CellRange;
    targetRange: CellRange;
    cells: Array<{ dataRow: number; key: string; oldValue: unknown; newValue: unknown }>;
  }>;
  /** Replace or replace-all from the find panel. `row` is the data index, `col` the column key. */
  'find-replace': CustomEvent<{
    type: 'replace' | 'replace-all';
    cells: Array<{ row: number; col: string; oldValue: unknown; newValue: unknown }>;
  }>;
}
