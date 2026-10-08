# flex-table API reference

All names below are members of the `FlexTable` class (`<flex-table>`).

## Properties

| Property | Attribute | Type | Default | Notes |
|---|---|---|---|---|
| `columns` | — | `ColumnDefinition[]` | `[]` | Column definitions |
| `data` | — | `DataRow[]` | `[]` | Rows; mutated in place by the grid |
| `rowHeight` | `row-height` | `number` | `32` | Explicit value > `--ft-row-height` token > 32 |
| `showRowNumbers` | `show-row-numbers` | `boolean` | `false` | Sticky row-number column |
| `theme` | `theme` | `'light' \| 'dark' \| undefined` | auto | Auto follows `prefers-color-scheme` |
| `editable` | `editable` | `boolean` | `true` | `false` = read-only grid; Enter then fires `row-activate` |
| `showFilters` | `show-filters` | `boolean` | `false` | Adds **Filter…** to each column menu |
| `showContextMenu` | `show-context-menu` | `boolean` | `false` | Built-in cell context menu |
| `frozenRows` | `frozen-rows` | `number` | `0` | Rows kept visible at the top |
| `maxRows` | `max-rows` | `number` | `0` | 0 = unlimited; blocks `addRow()` and paste expansion |
| `maxUndoSize` | `max-undo-size` | `number` | `100` | Undo stack size |
| `selectable` | `selectable` | `boolean` | `false` | Row checkbox selection |
| `selectionMode` | `selection-mode` | `'single' \| 'multi'` | `'multi'` | |
| `dataMode` | `data-mode` | `'client' \| 'server'` | `'client'` | Server mode only emits sort/filter events |
| `footerData` | `footer-data` | `Record<string, string \| TemplateResult> \| null` | `null` | Summary row keyed by column key |
| `emptyMessage` | `empty-message` | `string` | `''` | Empty: locale `noData` |
| `noMatchingMessage` | `no-matching-message` | `string` | `''` | All rows hidden by filters. Empty: locale `noMatchingData` |
| `error` | — | `{ message: string } \| null` | `null` | Load failure shown as an alert instead of rows / empty state (a source's `error` as is) |
| `loading` | `loading` | `boolean` | `false` | Loading overlay + `aria-busy` |
| `importEnabled` | `import-enabled` | `boolean` | `false` | Drag-and-drop `.xlsx` / `.csv` import |
| `clearUndoOnDataChange` | `clear-undo-on-data-change` | `boolean` | `false` | Replacing `data` clears undo history |
| `clearSelectionOnDataChange` | `clear-selection-on-data-change` | `boolean` | `false` | Replacing `data` clears row selection (otherwise keyed rows stay selected across pages) |
| `rowKey` | `row-key` | `string \| (row) => unknown` | `'_id'` | Names a row; selection is kept by this id. A row without a key gets a session-local `#n` |
| `stylesheets` | — | `CSSStyleSheet[]` | `[]` | Adopted into the shadow root; styles `render` output |

Replacing `data` with the same array reference does not trigger the clear-on-change behaviors.

### Read-only

| Getter | Type |
|---|---|
| `visibleColumns` | `ColumnDefinition[]` (non-hidden) |
| `filteredRowCount` | `number` |
| `filterKeys` | `string[]` |
| `sortCriteria` | `SortCriteria[]` — `{ key, direction: 'asc' \| 'desc' }`. Settable too (no `sort-change`): a source's sort goes in as is |
| `activeCell` / `editingCell` | `CellPosition \| null` — `{ row, col }` |
| `canUndo` / `canRedo` | `boolean` |

## Column definition

`ColumnDefinition<T = DataRow>` fields:

| Field | Type | Notes |
|---|---|---|
| `key` | `string` | Property name in the row, or a dot path into a nested record (`'Customer.Name'`) — display, sort, filter, copy, edit, import and export all read it the same way; a property named by the whole key (`'@odata.etag'`) wins over the path (required) |
| `label` | `string` | Header text (required) |
| `type` | `ColumnType` | `'text' \| 'number' \| 'boolean' \| 'date' \| 'datetime' \| 'select'`; other strings act as text |
| `width` / `minWidth` | `number` | px; `minWidth` defaults to 40 |
| `hidden` | `boolean` | |
| `sortable` | `boolean` | default `true` |
| `align` | `'start' \| 'center' \| 'end'` | Default from type: number → end, boolean → center, else start |
| `headerAlign` | `'start' \| 'center' \| 'end'` | Defaults to the cell alignment |
| `editable` | `boolean` | Per-column; the global `editable` still applies |
| `pinned` | `'left' \| 'right'` | |
| `options` | `string[] \| SelectOption[]` | For `select`; `SelectOption` = `{ label, value }` |
| `autocomplete` | `boolean \| 'strict'` | Suggest existing values; `'strict'` rejects others |
| `format` | `string \| (value, row, col) => string` | Display only |
| `render` | `CellRenderer<T>` | `(value, row, col) => TemplateResult \| string` |
| `editor` | `CellEditor<T>` | `(value, row, col) => TemplateResult` with an `.ft-editor` element |
| `validator` | `CellValidator<T>` | `(value, row, col) => string \| null \| undefined` |
| `conditionalRules` | `ConditionalRule<T>[]` | `{ when(value, row, col): boolean, style: CellStyle }` |
| `mergeRepeated` | `boolean \| (row, previousRow, col) => boolean` | Draw a run of repeated values as one merged cell; values, sort, filter and export are unchanged |
| `reveal` | `'always' \| 'hover'` | `'hover'`: content shows only while the row is hovered, focused or selected — for a row-actions column; stays focusable, always shown without hover, not printed |

`CellStyle` = `{ background?, color?, fontWeight?: 'bold' | 'normal', fontStyle?: 'italic' | 'normal' }`.

```ts
import { html } from 'lit';

table.columns = [
  { key: 'total', label: 'Total', type: 'number', format: '#,##0.00' },
  { key: 'status', label: 'Status',
    conditionalRules: [{ when: (v) => v === 'overdue', style: { color: '#dc2626', fontWeight: 'bold' } }] },
  { key: 'age', label: 'Age', type: 'number',
    validator: (v) => (Number(v) < 0 ? 'Must be positive' : null) },
  { key: 'color', label: 'Color',
    editor: (v) => html`<input class="ft-editor" type="color" .value=${String(v ?? '#000000')}>` },
];
```

Custom editors: clicking another cell auto-commits; handle `@keydown` / `@blur` in the template for
Enter/Escape and blur-to-commit behavior.

## Methods

### Rows

| Method | Returns | Notes |
|---|---|---|
| `addRow(row?, index?)` | `DataRow \| null` | `null` when `maxRows` reached |
| `deleteRows(indices?)` | `void` | Data indices; default = the checked rows when `selectable`, else the cell selection's rows |
| `updateRows(changes)` | `void` | `Array<{ row, key, value }>`, one undo step |
| `refreshData()` | `void` | Re-render after in-place mutation |

### Columns

| Method | Returns |
|---|---|
| `addColumn(def, index?)` | `ColumnDefinition` |
| `deleteColumn(key)` | `void` (also clears its filter, sort and width) |
| `moveColumn(key, newIndex)` | `void` (index clamped) |
| `hideColumn(key)` / `showColumn(key)` | `void` |
| `getHiddenColumns()` | `ColumnDefinition[]` |
| `getColumnWidth(key)` | `number \| undefined` (resized width) |
| `selectColumn(colIndex)` | `void` (range-selects the column) |

### Row selection

| Method | Notes |
|---|---|
| `selectAll()` / `deselectAll()` | `selectAll`: the rows in view (multi mode only) · `deselectAll`: every page |
| `selectWhere(predicate)` | `(row, dataIndex) => boolean` over the visible rows |
| `setSelection(ids)` | Replace with these row ids; the same set again fires nothing |
| `getSelectedRows()` | `DataRow[]` — the selected rows `data` holds (as `u-rich-table`) · ids of every page: `selectedRowIds` |
| `getRowId(row)` · `selectedRowIds` | A row's id · the selected ids (all pages) |

### Filtering, undo, comments, import/export

| Method | Notes |
|---|---|
| `setFilter(key, predicate)` / `removeFilter(key)` / `clearFilters()` | `predicate: (value, row) => boolean`; filters combine with AND |
| `undo()` / `redo()` / `clearUndoHistory()` | |
| `setComment(dataIndex, colKey, text)` | `null` or `''` removes; undoable |
| `getComment(dataIndex, colKey)` / `clearComments()` | |
| `importFromFile(file)` | `Promise<ImportReport \| null>`; `.xlsx`, `.csv` (comma or semicolon), `.tsv`; headers match `label` or `importAliases`; fires `data-import` with the same report — `{ count, unmatchedHeaders, missingColumns, coercionFailures }`; a cell that is not its column's type keeps its text and is reported (an unread boolean is not `false`) |
| `exportToString(format, { selectionOnly? } \| { rows })` | `string \| Uint8Array`; format `'csv' \| 'tsv' \| 'json' \| 'xlsx'` (xlsx returns uncompressed bytes — synchronous). `rows`: export these rows with the visible columns |
| `exportToBlob(format, options?)` | `Promise<Blob>` typed with the format's MIME; xlsx is DEFLATE-compressed |
| `exportToFile(format, filename?, options?)` | `Promise<void>` — triggers a download (xlsx compressed); CSV/TSV start with a UTF-8 BOM unless `{ bom: false }` |

A server-paged table holds one page. Export the list's whole result with
`table.exportToFile('xlsx', 'x.xlsx', { rows: await source.fetchAll() })` — never the table's own rows there.
Table-less: `exportDataBlob(rows, columns, format, { bom? })` + `downloadBlob(blob, name)` from the root entry.

A column's `exportValue(value, row)` is what export writes for it (default: the raw value — `format`/`render` do not
apply). In XLSX a `date`/`datetime` column's ISO strings become date cells, at the wall-clock time the table shows.

## Events

All are `CustomEvent`s with `bubbles: true, composed: true`. `row`/`index` are data indices.
Typed by `FlexTableEventMap` (exported): `table.addEventListener('sort-change', (e) => e.detail.criteria)` needs no
cast, and the React `on*` props carry the same types.

| Event | `detail` |
|---|---|
| `cell-select` | `{ row, col, id }` (or `null`) — focus moved (also when the keyboard arrives); `row`/`col` visible positions |
| `cell-edit-start` | `{ row, col, key, value }` |
| `cell-edit-commit` | `{ row, col, key, oldValue, newValue }` |
| `cell-edit-cancel` | `{ row, col }` — `row`: data index (`-1` once the row left `data`) |
| `validation-error` | `{ row, col, key, value, error }` |
| `row-add` | `{ row, index }` |
| `row-delete` | `{ indices, rows }` |
| `row-activate` | `{ row, id, via, index, col, key }` — a plain click on a cell (`via: 'click'`) or Enter on a non-editable cell (`'keyboard'`); not a Shift/Ctrl/Cmd click, a drag, or a control in the cell |
| `row-reorder` | `{ from, to }` |
| `batch-update` | `{ changes }` |
| `column-add` | `{ column, index }` |
| `column-delete` | `{ column, key, index }` |
| `column-reorder` | `{ key, oldIndex, newIndex }` |
| `column-resize` | `{ key, width, colIndex }` |
| `column-select` | `{ colIndex, key, rowCount }` |
| `column-visibility-change` | `{ key, hidden }` |
| `sort-change` | `{ criteria }` |
| `filter-change` | `{ keys, filteredCount }` |
| `filter-error` | `{ error, row, filterKey }` |
| `selection-change` | `{ selectedIds, selectedIndices, selectedRows }` |
| `clipboard-copy` / `clipboard-cut` | `{ range, text }` (TSV) |
| `clipboard-paste` | `{ changes, addedRows }` |
| `clipboard-error` | `{ action: 'copy' \| 'paste', error }` — copy could not put the text on the clipboard (no `clipboard-copy`/`clipboard-cut` follows; a cut clears nothing), or paste could not read it |
| `fill-handle-apply` | `{ sourceRange, targetRange, cells }` |
| `find-replace` | `{ type: 'replace' \| 'replace-all', cells }` |
| `comment-change` | `{ dataIndex, id, colKey, text }` |
| `data-import` | `ImportReport` — `{ count, unmatchedHeaders, missingColumns, coercionFailures }` |
| `undo-state-change` | `{ canUndo, canRedo }` |
| `context-menu` | `{ x, y, row, col, key, value, rowData }` — cancelable; `preventDefault()` suppresses the built-in menu |
| `header-context-menu` | `{ key, label, x, y }` |

## Other exports

`exportData(rows, columns, format)`, `renderCell`, `effectiveAlign(col)`, `RowSelectionState`,
`UndoStack`, `flexTableLocale`, and the types `CellPosition`, `CellRange`, `SortCriteria`,
`SortDirection`, `ColumnFilter`, `FilterPredicate`, `FilterErrorCallback`, `ExportFormat`,
`UndoAction`, `FlexTableMessageKey`.
