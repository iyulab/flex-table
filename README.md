# flex-table

A lightweight, schema-agnostic data grid web component built with [Lit](https://lit.dev/).

Designed for effortless data input and crystal-clear visibility. Bridges the gap between spreadsheet freedom and database structural integrity.

**`flex-table` vs. `URichTable`** (`@iyulab/data-components`): both can consume external data
sources such as OData — the choice is about scale and interaction, not the data source.

- **`flex-table`** — large datasets, cell-level editing, spreadsheet-grade interaction
- **`URichTable`** — small-to-medium datasets, row-level CRUD, selection/filter-focused UX

## Install

```bash
npm install @iyulab/flex-table
```

## Quick Start

```html
<!-- The table is its own scroll container, so give it a height — see Sizing below. -->
<flex-table style="height: 400px" row-height="32" show-row-numbers></flex-table>

<script type="module">
  import '@iyulab/flex-table';

  const table = document.querySelector('flex-table'); // the tag gives the element its type

  table.columns = [
    { key: 'name', label: 'Name', type: 'text', width: 200 },
    { key: 'age', label: 'Age', type: 'number', width: 100 },
    { key: 'active', label: 'Active', type: 'boolean', width: 80 },
  ];

  table.data = [
    { name: 'Alice', age: 30, active: true },
    { name: 'Bob', age: 25, active: false },
  ];
</script>
```

## Features

- **Virtual Scroll** — Smooth scrolling through 100,000+ rows (horizontal + vertical)
- **Keyboard Navigation** — Arrow, Tab, Home, End, Ctrl+Home/End
- **Inline Editing** — Enter/F2 to edit, Escape to cancel, type-aware editors
- **Custom Editor** — `editor` callback for fully custom cell editing UI
- **Validation** — `validator` callback with visual feedback (red border + `aria-invalid`)
- **Range Selection** — Shift+Arrow, Shift+Click for multi-cell selection
- **Column Selection** — Ctrl+Click header or `selectColumn()` API
- **Row Selection** — Checkbox-based row selection (`selectable`, single/multi mode)
- **Clipboard** — Ctrl+C/X/V with TSV format (Excel/Google Sheets compatible, RFC 4180), through the browser's own copy/cut/paste where it fires and the Clipboard API where it does not (Safari)
- **Sorting** — Click header to sort (asc/desc/none), Shift+click for multi-sort
- **Column Menu** — A 24×24 button in every header opens the column's menu: sort, filter, hide/show, auto-fit, wider/narrower (also opens on header right-click)
- **Column Resize** — Drag header border, double-click to auto-fit, Alt+Arrow keyboard resize, or the column menu
- **Column Operations** — `addColumn()`, `deleteColumn()`, `moveColumn()` with undo
- **Pinned Columns** — Freeze columns to left or right (`pinned: 'left' | 'right'`)
- **Filtering** — Programmatic API + built-in header filter UI (`show-filters`)
- **Filter Types** — Text search, number range, boolean toggle, date/datetime range picker
- **Row Operations** — `addRow()`, `deleteRows()`, `updateRows()` with undo
- **Undo/Redo** — Ctrl+Z / Ctrl+Y for all operations; configurable stack size
- **Export** — CSV, TSV, JSON, XLSX; full data or selection-only
- **Dark Theme** — Auto via `prefers-color-scheme`, or manual `theme="dark"`
- **Row Numbers** — Optional `show-row-numbers` attribute with sticky positioning
- **Footer Row** — Summary/aggregate row via `footer-data` property
- **Data Mode** — Client-side or server-side sorting/filtering (`dataMode`)
- **Context Menu** — `context-menu` event for custom right-click menus; Shift+F10 or the context-menu key opens it on the active cell
- **React Wrapper** — `@iyulab/flex-table/react` subpath for idiomatic React usage
- **ARIA** — `role="grid"` with roving focus (the focus sits on the active cell or header cell, so screen readers announce each move), `aria-sort`, `aria-selected`, `aria-readonly`, `aria-invalid`, `aria-rowcount`, `aria-colcount`, `aria-rowindex`, `aria-colindex`

## Sizing

The table is its own scroll container (`overflow: auto` on the host) and it measures the viewport
from the host's own height. **Give it a height** — directly, or through a constrained parent:

```css
flex-table { height: 400px; }
```

```css
/* or let a flex parent constrain it */
.page      { height: 100%; display: flex; flex-direction: column; }
.page flex-table { flex: 1 1 auto; min-height: 0; }
```

⚠ **Without a height constraint the virtual scroll has nothing to virtualise against.** The body
carries the full content height, so an unconstrained host grows to match it and the viewport
measurement ends up equal to the content — every row is rendered. Measured with 1,000 rows and no
height: the element becomes ~32,000px tall and all 1,000 rows are in the DOM. The same data in a
300px-tall host renders only the visible window (well under a fifth of the rows). That is the
difference between the "100,000+ rows" claim in Features and a page that stalls.

Small fixed data sets are fine unconstrained — the point is that the virtual-scroll guarantee is a
guarantee about a *constrained* host. `height-model.browser.test.ts` pins both sides of this.

## Properties

| Property | Attribute | Type | Default | Description |
|----------|-----------|------|---------|-------------|
| `columns` | — | `ColumnDefinition[]` | `[]` | Column definitions |
| `data` | — | `DataRow[]` | `[]` | Data rows (`Record<string, unknown>[]`) |
| `rowHeight` | `row-height` | `number` | `32` | Row height in pixels. Falls back to the `--ft-row-height` token when not set — see [Density](#density-and-header-hierarchy) |
| `showRowNumbers` | `show-row-numbers` | `boolean` | `false` | Show row number column |
| `theme` | `theme` | `'light' \| 'dark'` | auto | Force theme; auto-detects `prefers-color-scheme` |
| `editable` | `editable` | `boolean` | `true` | Global read-only mode when `false`. Defaults to `true` — a purely read-only grid should set this explicitly rather than relying on per-column `editable: false` alone, since it's also what makes Enter fire `row-activate` (see [Events](#events)) instead of entering edit mode |
| `showFilters` | `show-filters` | `boolean` | `false` | Offer the built-in filter dropdowns through each column menu («Filter…») |
| `maxRows` | `max-rows` | `number` | `0` | Max row count (0 = unlimited); blocks `addRow()` and paste expansion |
| `maxUndoSize` | `max-undo-size` | `number` | `100` | Max undo history stack size |
| `selectable` | `selectable` | `boolean` | `false` | Enable row-level checkbox selection |
| `selectionMode` | `selection-mode` | `'single' \| 'multi'` | `'multi'` | Row selection mode |
| `dataMode` | `data-mode` | `'client' \| 'server'` | `'client'` | Client-side or server-side data processing |
| `footerData` | `footer-data` | `Record<string, string \| TemplateResult> \| null` | `null` | Footer/summary row data (keys match column keys) |
| `emptyMessage` | `empty-message` | `string` | `'No data'` | Shown when `data` is empty |
| `noMatchingMessage` | `no-matching-message` | `string` | `'No matching data'` | Shown when `data` has rows but every one is hidden by an active column filter |
| `error` | — | `{ message: string } \| null` | `null` | The last load failure. While set, `error.message` is shown as an alert where the rows or the empty state would be, so a failed query does not look like "no data". Pass a data source's `error` as is |
| `stylesheets` | — | `CSSStyleSheet[]` | `[]` | Constructable stylesheets adopted into the shadow root alongside the grid's own styles — the escape hatch for styling content a `render` function inserts, since document CSS doesn't cross the shadow boundary. Reassigning swaps the previous set, it doesn't accumulate |

### Read-only Properties

| Property | Type | Description |
|----------|------|-------------|
| `visibleColumns` | `ColumnDefinition[]` | Columns where `hidden !== true` |
| `filteredRowCount` | `number` | Number of rows after filtering |
| `canUndo` | `boolean` | Whether undo is available |
| `canRedo` | `boolean` | Whether redo is available |
| `activeCell` | `CellPosition \| null` | Currently focused cell `{ row, col }` |
| `editingCell` | `CellPosition \| null` | Currently editing cell `{ row, col }` |
| `sortCriteria` | `SortCriteria[]` | Active sort criteria `[{ key, direction }]` |
| `filterKeys` | `string[]` | Column keys with active filters |

## Column Definition

```typescript
interface ColumnDefinition {
  key: string;             // Unique key matching data property names
  label: string;           // Column header text
  type?: ColumnType;       // 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'select' (any other string falls back to 'text')
  width?: number;          // Column width in pixels (default: auto)
  minWidth?: number;       // Minimum width in pixels (default: 40, enforced in rendering)
  hidden?: boolean;        // Hide column from view
  sortable?: boolean;      // Enable sorting (default: true)
  align?: 'start' | 'center' | 'end';       // Cell alignment (default from type: number → end, boolean → center, else start)
  headerAlign?: 'start' | 'center' | 'end'; // Header alignment (default: the cell alignment above)
  editable?: boolean;      // Per-column edit control (follows global editable)
  pinned?: 'left' | 'right'; // Freeze column during horizontal scroll
  options?: string[] | SelectOption[]; // Allowed values for type: 'select' (SelectOption = { label, value })
  autocomplete?: boolean | 'strict'; // Suggest existing column values while editing; 'strict' rejects values not in the list
  format?: string | ((value, row, col) => string); // Display format, see "format vs render" below
  render?: CellRenderer;   // Custom cell render: (value, row, col) => TemplateResult | string
  editor?: CellEditor;     // Custom cell editor: (value, row, col) => TemplateResult
  validator?: CellValidator; // Validate before commit: (value, row, col) => string | null
  conditionalRules?: ConditionalRule[]; // Per-cell style rules, see below
  mergeRepeated?: boolean | ((row, previousRow, col) => boolean); // Merge runs of repeated values, see below
  reveal?: 'always' | 'hover';   // 'hover': show only while the row is hovered, focused or selected (row actions)
}
```

The `editor` callback must return a Lit `TemplateResult` containing an input element with class `"ft-editor"`. The component reads `.value` from that element on commit. See [Custom Editor](#custom-editor) for details.

The `validator` callback returns `null` if valid, or an error message string. On failure, the cell shows a red border for 3 seconds and a `validation-error` event is dispatched.

A `number` column's built-in editor reads numbers the way people type them in the active `Locale` — `1,5` on a comma-decimal page is 1.5, `1.234,5` is 1234.5 — and shows the value with that locale's decimal separator. Text that is not a number is rejected the same way as a validator failure (`error` is the localized "Enter a number"). The number filter's conditions and pasted values are read the same way; pasted text that is not a number stays text.

A `date` column's built-in editor is `u-date-picker` from `@iyulab/components`: a text box that shows and takes `YYYY-MM-DD` in every browser language (the native date input would show the browser's UI language, e.g. `10/02/2026`), with a calendar beside it — click the box or press ArrowDown, and a picked day is the new value. It also reads `2026/10/2`, `20261002` and `10-02` (this year), stores the ISO date string, and rejects text that is not a date (`error` is the localized "Enter a date as YYYY-MM-DD"). Pasted dates are read the same way. A `datetime` column's editor works the same with a time: it shows `YYYY-MM-DD HH:mm` in local time, reads `2026-10-02 14:05` (a date alone is midnight), and stores the local `YYYY-MM-DDTHH:mm` string; in its calendar a day and a time are applied together with Apply. While the calendar is open, Escape closes the calendar; the next Escape cancels the edit.

### `format` vs `render`

Both control how a cell's raw value is displayed, but they differ in what they replace:

- **`format`**: a plain string pattern (Excel-style, e.g. `'#,##0.00'`, `'0.00%'`, `'$#,##0'`, `'yyyy-MM-dd'`) or a `(value, row, col) => string` function. Only the *displayed text* changes — editing, sorting, filtering, and export all keep operating on the raw underlying value. Use this for number/date/currency display formatting.
- **`render`**: a `(value, row, col) => TemplateResult | string` function that replaces the cell's rendered content entirely — badges, links, icons, multi-field composites. Sorting/filtering still use the raw value, but the visual output is fully custom.

```typescript
const columns: ColumnDefinition<Order>[] = [
  { key: 'total', label: 'Total', format: '#,##0.00' },                 // "1,234.50"
  { key: 'placedAt', label: 'Placed', format: 'yyyy-MM-dd' },           // date pattern
  { key: 'status', label: 'Status', render: (v) => html`<span class="badge badge-${v}">${v}</span>` },
];
```

If both are set on the same column, `render` takes precedence — `format` has no effect once a custom `render` fully controls the cell's output.

### Conditional Formatting

`conditionalRules` applies a style to a cell when its `when` predicate matches — a declarative alternative to writing a `render` function just to color-code status/threshold values:

```typescript
const columns: ColumnDefinition<Order>[] = [
  {
    key: 'status',
    label: 'Status',
    conditionalRules: [
      { when: (v) => v === 'overdue', style: { color: '#dc2626', fontWeight: 'bold' } },
      { when: (v) => v === 'paid', style: { color: '#16a34a' } },
    ],
  },
];
```

Rules are evaluated in order and combined; later matching rules override earlier ones for overlapping style properties.

### Row actions that appear on hover

A column of row actions (edit, a "more" menu) repeated on every row turns a list into a wall of
buttons. `reveal: 'hover'` shows that column's content only while its row is hovered, holds focus or
is selected. The controls stay in the DOM and focusable — Tab reveals them — touch screens (no
hover) always show them, and they are not printed.

```ts
{ key: 'actions', label: '', width: 72, editable: false, reveal: 'hover',
  render: (_, row) => html`<u-button size="sm" appearance="plain" aria-label="Edit">…</u-button>` }
```

### Merging Repeated Values

A list of child rows under a parent — order lines under an order, boxes under a shipment — repeats the parent's columns on every line. `mergeRepeated` draws each run of repeated values as one merged cell: the value shows once, on the run's first row, and the lines between the run's rows are dropped.

```typescript
const columns: ColumnDefinition<OrderLine>[] = [
  { key: 'orderNo', label: 'Order', mergeRepeated: true },
  // Two adjacent orders can share a customer — merge only within one order.
  { key: 'customer', label: 'Customer', mergeRepeated: (row, prev) => row.orderNo === prev.orderNo },
  { key: 'product', label: 'Product' },
  { key: 'qty', label: 'Qty', type: 'number' },
];
```

Every row keeps its own value. Sorting, filtering, copying, CSV/XLSX export and screen readers see each row exactly as without merging — a filter that drops a run's first row leaves the rest of the run labelled, and an export pivots. Rows are compared in display order, so sort by the merged column (or keep the server's order) for runs to form. The value is drawn again on the first row in view and on the first row below frozen rows, so scrolling or paging through a run never hides it. With `true`, empty values (`null`, `undefined`, `''`) never merge.

## Methods

### Row Operations

| Method | Returns | Description |
|--------|---------|-------------|
| `addRow(row?, index?)` | `DataRow \| null` | Add a row. Returns `null` if `maxRows` reached |
| `deleteRows(indices?)` | `void` | Delete rows by data index (default: selected rows) |
| `updateRows(changes)` | `void` | Batch update cells as single undo action. `changes: Array<{ row, key, value }>` |
| `refreshData()` | `void` | Force re-render after in-place data mutation |

### Column Operations

| Method | Returns | Description |
|--------|---------|-------------|
| `addColumn(def, index?)` | `ColumnDefinition` | Add column at position (default: end) |
| `deleteColumn(key)` | `void` | Remove column + cleanup filters/sort/widths. Row objects keep that key's values (undo restores the column with them); delete the key from `data` yourself if you need it gone |
| `moveColumn(key, newIndex)` | `void` | Reorder column to target index (clamped) |
| `getColumnWidth(key)` | `number \| undefined` | Get internal resize width for column |
| `selectColumn(colIndex)` | `void` | Select entire column (range selection) |

### Row Selection

| Method | Returns | Description |
|--------|---------|-------------|
| `selectAll()` | `void` | Select all visible rows (multi mode only) |
| `deselectAll()` | `void` | Deselect all rows |
| `getSelectedRows()` | `{ selectedIndices, selectedRows }` | Get selected row data |

Row selection is index-based (there is no row-key concept), so replacing `data` with a same-length but different set of rows leaves the selection pointing at the new rows occupying the old indices. If selection drives a bulk action (status changes, bulk delete, etc.), set `clear-selection-on-data-change` so a `data` swap always resets selection and re-fires `selection-change` with an empty selection:

```html
<flex-table selectable clear-selection-on-data-change></flex-table>
```

Default is `false`, matching `clear-undo-on-data-change`.

### Filtering

| Method | Returns | Description |
|--------|---------|-------------|
| `setFilter(key, predicate)` | `void` | Set column filter. `predicate: (value, row) => boolean` |
| `removeFilter(key)` | `void` | Remove filter for a column |
| `clearFilters()` | `void` | Remove all filters |

### Export

| Method | Returns | Description |
|--------|---------|-------------|
| `exportToString(format, options?)` | `string \| Uint8Array` | Export to `'csv'` / `'tsv'` / `'json'` (a string) or `'xlsx'` (bytes, uncompressed). Pass `{ selectionOnly: true }` for selection range |
| `exportToBlob(format, options?)` | `Promise<Blob>` | The same export as a `Blob` of the format's MIME type — `'xlsx'` is DEFLATE-compressed |
| `exportToFile(format, filename?)` | `Promise<void>` | Export and trigger browser file download (`'xlsx'` compressed) |

## Events

All events use `CustomEvent` with `bubbles: true, composed: true`. They are typed: `FlexTableEventMap` maps
each name to its `CustomEvent<detail>`, and `addEventListener` on a `FlexTable` (for example from
`document.querySelector('flex-table')`) uses it — `table.addEventListener('sort-change', (e) => e.detail.criteria)`
type-checks without a cast. The React wrapper's `on*` props carry the same types.

### Cell Events

| Event | Detail | Description |
|-------|--------|-------------|
| `cell-select` | `{ row, col }` or `null` | Cell focus changed (`null` when no cell is active) |
| `cell-edit-start` | `{ row, col, key, value }` | Cell editing started |
| `cell-edit-commit` | `{ row, col, key, oldValue, newValue }` | Cell value committed |
| `cell-edit-cancel` | `{ row, col }` | Cell edit cancelled (Escape) |
| `validation-error` | `{ row, col, key, value, error }` | Cell validator rejected value, or a `number` cell got text that is not a number |

### Data Events

| Event | Detail | Description |
|-------|--------|-------------|
| `row-add` | `{ row, index }` | Row added |
| `row-delete` | `{ indices, rows }` | Rows deleted |
| `row-activate` | `{ row, index, col, key }` | Enter pressed on a non-editable cell — the grid's own contract for "activate this row" (e.g. navigate to a detail view), guaranteed even though the internal Enter handler prevents the keystroke from reliably reaching a listener the host attaches to the same element |
| `batch-update` | `{ changes: [{ row, key, oldValue, newValue }] }` | Batch update applied |
| `row-reorder` | `{ from, to }` | Row dragged to a new place (data indices) |
| `data-import` | `{ count }` | Rows imported from a file |
| `fill-handle-apply` | `{ sourceRange, targetRange, cells }` | Fill handle wrote `cells` (`{ dataRow, key, oldValue, newValue }`) |
| `find-replace` | `{ type, cells }` | Replace (`type: 'replace'`) or replace-all from the find panel; `cells` are `{ row, col, oldValue, newValue }` with `col` the column key |
| `comment-change` | `{ dataIndex, colKey, text }` | Cell comment set, changed or removed (`text: null`) |

### Column Events

| Event | Detail | Description |
|-------|--------|-------------|
| `column-add` | `{ column, index }` | Column added |
| `column-delete` | `{ column, key, index }` | Column removed |
| `column-reorder` | `{ key, oldIndex, newIndex }` | Column moved |
| `column-resize` | `{ key, width, colIndex }` | Column resized (drag, auto-fit, or keyboard) |
| `column-select` | `{ colIndex, key, rowCount }` | Entire column selected |
| `column-visibility-change` | `{ key, hidden }` | Column hidden or shown |
| `header-context-menu` | `{ key, label, x, y }` | Right-click on a column header |

### Sort & Filter Events

| Event | Detail | Description |
|-------|--------|-------------|
| `sort-change` | `{ criteria: [{ key, direction }] }` | Sort criteria changed |
| `filter-change` | `{ keys, filteredCount }` | Filter added/removed |
| `filter-error` | `{ error, row, filterKey }` | Filter predicate threw an error |

### Selection Events

| Event | Detail | Description |
|-------|--------|-------------|
| `selection-change` | `{ selectedIndices, selectedRows }` | Row checkbox selection changed |

### Clipboard Events

| Event | Detail | Description |
|-------|--------|-------------|
| `clipboard-copy` | `{ range, text }` | Range copied as TSV |
| `clipboard-cut` | `{ range, text }` | Range cut as TSV |
| `clipboard-paste` | `{ changes, addedRows }` | Data pasted from clipboard |
| `clipboard-error` | `{ action, error }` | Copy (`action: 'copy'`) could not put the text on the clipboard — no `clipboard-copy`/`clipboard-cut` follows and a cut clears nothing — or paste (`'paste'`) could not read it |

### State Events

| Event | Detail | Description |
|-------|--------|-------------|
| `undo-state-change` | `{ canUndo, canRedo }` | Undo/redo availability changed |
| `context-menu` | `{ x, y, row, col, key, value, rowData }` | Right-click on a cell, or Shift+F10 / the context-menu key on the active cell. Cancelable — `preventDefault()` suppresses the built-in menu |

## CSS Custom Properties

All colors and styles are customizable via CSS custom properties.

**Two levels, pick whichever fits.** Since 0.22.0 every `--ft-*` colour is derived from
the `@iyulab/components` design tokens, so if you already load that token sheet the table
follows your brand with no per-table configuration:

```css
:root { --u-primary-color: #7b1fa2; }   /* the table's accent, selection and boolean
                                           markers follow — so do the buttons and shell */
```

Override an individual `--ft-*` when you want the table to differ from the rest of the app:

```css
flex-table {
  --ft-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --ft-font-size: 14px;

  /* Surfaces and text            derived from */
  --ft-bg: #fff;                     /* --u-bg-color */
  --ft-text-color: #202124;          /* --u-txt-color */
  --ft-border-color: #e0e0e0;        /* --u-border-color */
  --ft-header-bg: #f8f9fa;           /* --u-bg-color-raised */
  --ft-header-hover-bg: #e8eaed;     /* --u-bg-color-active */
  --ft-header-text-color: #202124;   /* --u-txt-color */
  --ft-row-even-bg: #fff;            /* --u-bg-color */
  --ft-row-odd-bg: #fafafa;          /* --u-bg-color-raised */
  --ft-row-hover-bg: #f0f4ff;        /* --u-bg-color-hover */
  --ft-row-odd-hover-bg: #f0f4ff;    /* --u-bg-color-raised-hover — odd row's hover, independent of --ft-row-hover-bg */
  --ft-editor-bg: #fff;              /* --u-input-bg-color */
  --ft-sort-indicator-color: #5f6368;/* --u-txt-color-weak */
  --ft-empty-color: #5f6368;         /* --u-txt-color-weak */

  /* Accent */
  --ft-active-color: #1a73e8;        /* --u-primary-color */
  --ft-selection-bg: #e8f0fe;        /* --u-primary-bg-color */
  --ft-bool-color: #2196f3;          /* --u-primary-color */

  /* State overlays — these are translucent on purpose, so the row striping and
     selection underneath stay visible. Set the *-color and the background follows. */
  --ft-invalid-color: #d93025;       /* --u-danger-color */
  --ft-drop-color: #1a73e8;          /* --u-primary-color */
  --ft-find-color: #f9a825;          /* --u-warning-color */
}
```

### Density and header hierarchy

Since 0.23.0 the vertical rhythm and the header's typographic weight are adjustable, so a
table can be matched to the other tables on the page:

```css
flex-table {
  --ft-row-height: 32px;           /* body row height */
  --ft-cell-padding-block: 6px;    /* text placement inside that height */
  --ft-cell-padding-inline: 12px;
  --ft-header-font-size: 14px;     /* defaults to --ft-font-size */
  --ft-header-font-weight: 600;
}
```

⚠ **`--ft-row-height` is read once, at first render.** The grid is virtualised — rows are
positioned at `index × rowHeight`, so the height cannot come from the cascade the way
padding does. Declare it in a stylesheet that is in effect before the table is attached; to
change it later, set the `rowHeight` property (or the `row-height` attribute) instead. An
explicitly set property or attribute always wins over the token, and a value in any unit
other than `px` is ignored.

⚠ **Row height is fixed, and padding places the text within it.** Cells are single-line
(`nowrap` + ellipsis) by design. If you reduce `--ft-row-height`, reduce
`--ft-cell-padding-block` to match — keep `padding-block × 2 + line box ≤ row-height`, or
the text is clipped at the bottom.

**Without the token sheet nothing changes.** Every reference carries the literal above as
its fallback, and the built-in dark theme (`prefers-color-scheme` or `theme="dark"`) still
applies — the table remains usable standalone. Referencing the tokens does not add a
package dependency; CSS custom properties are resolved at render time, not imported.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Arrow keys | Navigate cells (ArrowUp from the first row moves onto the header row) |
| Tab / Shift+Tab | Move to next/previous cell; past the last (before the first) cell, leave the table |
| Enter / F2 | Start editing (Enter on a non-editable cell fires `row-activate`) |
| Typing a printable character | Start editing an editable cell with that character |
| Escape | Cancel edit / clear selection / close the find panel |
| Home / End | Row start/end |
| Ctrl+Home / Ctrl+End | Table start/end |
| Shift+Arrow / Shift+Click | Extend selection range |
| Shift+Space | Select / deselect the active cell's row (when `selectable` — the row checkboxes are not Tab stops) |
| Ctrl+C / Ctrl+X | Copy/Cut selection as TSV |
| Ctrl+V | Paste TSV data |
| Ctrl+D / Ctrl+R | Fill down / fill right |
| Ctrl+F / Ctrl+H | Find / find and replace |
| Delete / Backspace | Clear selected cells |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Alt+ArrowLeft / Alt+ArrowRight | Resize current column (±20px) |
| Ctrl+Click header | Select entire column |
| ArrowLeft / ArrowRight / Home / End (header row) | Move along the header; ArrowDown returns to the first row |
| Enter / Space (header row) | Sort the column (ascending → descending → none); with Shift, add it to the sort |
| Alt+ArrowDown or the context-menu key (header row) | Open the column menu |
| Shift+F10 or the context-menu key (a body cell) | Open the cell menu (`show-context-menu`) at the active cell / fire `context-menu` |
| Enter / Space on a column menu button | Open the column menu |
| ArrowUp / ArrowDown / Home / End (column menu) | Move between menu items |
| Escape (column menu) | Close the menu and return focus to where it was opened from |

The table is one Tab stop: keyboard focus arriving on it activates the first cell (the first header cell
when there are no rows), and the column menu buttons and row checkboxes are reached by keys, not Tab.
While the table has the focus, the focus sits on the active cell (or header cell) itself — `document.activeElement`
is the table, and its `shadowRoot.activeElement` is that cell.

## Localization

The text the table draws itself — filter menus, the find-and-replace panel, the column menu, the
empty-state message — resolves through a locale namespace. English and Korean ship with the package
and follow whatever locale `@iyulab/components` has active:

```ts
import { Locale } from '@iyulab/components';

Locale.set('ko');   // the table's own chrome follows
```

Register another language, or reword the built-in strings, through the exported namespace. Partial
tables are merged, so you only pass the keys you want to change:

```ts
import { flexTableLocale, type FlexTableMessageKey } from '@iyulab/flex-table';

flexTableLocale.register('ja', {
  contains: '含む',
  startsWith: '前方一致',
  matchCase: '大文字と小文字を区別',
});

flexTableLocale.register('en', { replaceAll: 'Replace everything' });  // reword one string
```

The keys are grouped by where they appear: the column header and its menu, the items inside that
menu, the cell context menu, cell comments, the filter panel, find-and-replace, and the import drop
target. **`FlexTableMessageKey` is the list** — it is exported, so your editor completes it and a
misspelled key is a type error rather than a string that silently falls back to its own name.

> This paragraph used to enumerate every key by hand. It went stale once, and a hand-copied list is
> the only thing here that can: the type cannot. If you want the full set, hover `FlexTableMessageKey`
> or open `src/locale.ts`.

Three of those keys name a column, and word order differs between languages, so they carry a
`{header}` placeholder rather than being assembled by concatenation:

```ts
flexTableLocale.register('ja', {
  columnMenuFor: '{header} の列メニュー',  // the column menu button's accessible name
  columnMenuRegion: '{header} 列',                    // the open menu's accessible name
  showColumn: '{header} を表示',                  // "show this hidden neighbour again"
});
```

The filter operators `AND` and `OR` are not in the table, and neither are the glyphs that stand in
for icons. They read the same in every language, and translating them makes them harder to
recognise rather than easier.

## Accessibility

The baseline is **WCAG 2.2**. The table lists what this package **measures in tests** — it is not a
conformance claim for the success criteria it does not list.

| Success criterion | Guarantee | Measured by |
|---|---|---|
| SC 2.5.8 Target Size (Minimum) | Sortable headers, column menu buttons, the open column menu, the open filter dropdown (text and number), the find/replace bar, the cell context menu and row selection checkboxes are at least 24×24 CSS px or meet the spacing exception (24px between centers, counting the neighbouring resize handles), and are actually hit at that position. Two small targets use the equivalent-control exception: the 6px column resize handle (every resize is also in the column menu) and the hidden-column marker (its column menu offers **Show: …**) | `tests/browser/target-size.browser.test.ts` (real Chromium) |
| SC 2.1.1 Keyboard (pointer-cursor check) | Nothing the grid renders shows a pointer cursor without being an interactive element. Sorting by header click also has a keyboard path — the column menu's **Sort ascending** / **Sort descending** (the check alone cannot see that, because the header cell wraps the menu button) | `tests/browser/target-size.browser.test.ts` · `src/flex-table.test.ts` |
| SC 2.4.3 Focus Order · SC 2.1.2 No Keyboard Trap | The column filter is a dialog named for its column: opening it from the column menu moves focus into it, Tab and Shift+Tab cycle inside it, and Escape closes it and returns focus to that column's menu button (Escape is the way out) | `tests/browser/column-menu.browser.test.ts` |
| SC 2.5.7 Dragging Movements | Resizing never requires a drag — the column menu's **Auto-fit width**, **Wider** and **Narrower** are single clicks | `tests/browser/column-menu.browser.test.ts` |
| SC 1.3.1 Info and Relationships (virtualized grid) | Only the visible rows and columns are in the DOM, so every row carries `aria-rowindex` and every cell `aria-colindex` (1-based, in display order), and the grid's `aria-rowcount` / `aria-colcount` give the full size — the header row is row 1, data rows start at 2, and the footer row (if any) is last. A screen reader announces "row 621 of 10001" after scrolling instead of counting the rows that happen to be rendered. The footer row's cells are grid cells | `tests/browser/aria-grid-index.browser.test.ts` |

Not yet measured: the boolean and date filter dropdowns and the comment popup. Color contrast comes
from the `@iyulab/components` tokens this package reads.

For **KWCAG 2.2** (the Korean web accessibility standard), the `@iyulab/components` README has a table of all 33 check items — which are guaranteed by a test across the sibling packages, which are shared with the app, and which do not apply: [KWCAG 2.2 대응표](https://github.com/iyulab/node-components#kwcag-22-대응표).

## Usage Guide

### React

Install peer dependencies and import the React wrapper:

```bash
npm install @iyulab/flex-table @lit/react react
```

```tsx
import { FlexTableReact } from '@iyulab/flex-table/react';

function App() {
  const columns = [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'age', label: 'Age', type: 'number' },
  ];

  const data = [
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 },
  ];

  return (
    <FlexTableReact
      columns={columns}
      data={data}
      showRowNumbers
      onCellEditCommit={(e) => console.log('Edited:', e.detail)}
      onSortChange={(e) => console.log('Sort:', e.detail)}
    />
  );
}
```

All `<flex-table>` properties are available as React props, and all custom events are mapped to `on*` callbacks (e.g., `cell-edit-commit` → `onCellEditCommit`).

#### Imperative API via `ref`

`FlexTableReact` forwards `ref` to the underlying `FlexTable` custom element instance, so all [Methods](#methods) (`addRow`, `deleteRows`, `selectAll`, `setFilter`, etc.) are reachable without re-rendering the whole table:

```tsx
import { useRef } from 'react';
import { FlexTableReact, type FlexTable } from '@iyulab/flex-table/react';

function App() {
  const tableRef = useRef<FlexTable>(null);

  return (
    <>
      <button onClick={() => tableRef.current?.addRow({ name: '', age: 0 })}>Add row</button>
      <button onClick={() => tableRef.current?.deleteRows()}>Delete selected</button>
      <FlexTableReact ref={tableRef} columns={columns} data={data} selectable />
    </>
  );
}
```

#### Typed rows (generics)

`FlexTableReact` and `ColumnDefinition` are generic over your row type — no `as unknown as` casts needed in `data`, `columns`, or callbacks:

```tsx
import { FlexTableReact, type ColumnDefinition } from '@iyulab/flex-table/react';

interface Order {
  id: string;
  total: number;
  currency: string;
}

const columns: ColumnDefinition<Order>[] = [
  { key: 'id', label: 'ID' },
  { key: 'total', label: 'Total', render: (_value, row) => `${row.total} ${row.currency}` },
];

<FlexTableReact<Order> data={orders} columns={columns} />
```

Omitting the type argument defaults to the previous `DataRow` (`Record<string, unknown>`) behavior — fully backward compatible.

### Custom Editor

The `editor` callback lets you provide a fully custom editing UI. The component reads `.value` from the element with class `ft-editor` when committing.

```typescript
import { html } from 'lit';

table.columns = [
  {
    key: 'color',
    label: 'Color',
    type: 'text',
    editor: (value) => html`
      <input class="ft-editor" type="color" .value=${String(value ?? '#000000')}
        @blur=${(e) => e.target.dispatchEvent(new Event('change', { bubbles: true }))}
        @keydown=${(e) => {
          if (e.key === 'Escape') e.target.blur();
        }}>
    `,
  },
];
```

**Key rules:**
- Must include an element with class `ft-editor` — the component reads its `.value` on commit
- Clicking another cell auto-commits the editor
- For Enter/Escape support, handle `@keydown` in your template
- For blur-to-commit, handle `@blur` in your template

### Validation

Use the `validator` callback to validate input before committing. Returns `null` if valid, or an error message:

```typescript
table.columns = [
  {
    key: 'age',
    label: 'Age',
    type: 'number',
    validator: (value) => {
      const n = Number(value);
      if (n < 0 || n > 150) return 'Age must be 0–150';
      return null;
    },
  },
];
```

When validation fails, the cell displays a red border for 3 seconds and the `validation-error` event fires.

### Pinned Columns

Freeze columns on either side during horizontal scroll:

```typescript
table.columns = [
  { key: 'id', label: 'ID', pinned: 'left' },
  { key: 'name', label: 'Name' },
  // ... many columns ...
  { key: 'actions', label: 'Actions', pinned: 'right' },
];
```

### Data Mutation

The `data` property uses in-place mutation for performance. Direct changes to data objects are **not** automatically detected:

```typescript
// Will NOT trigger re-render:
table.data[0].name = 'Alice';

// Options to trigger re-render:
table.refreshData();             // Force re-render
table.updateRows([               // Recommended — includes undo support
  { row: 0, key: 'name', value: 'Alice' }
]);
```

Use `updateRows()` for programmatic edits — it provides undo/redo and dispatches the `batch-update` event.

### Built-in Filter UI

Enable with `show-filters` attribute. Each column menu (the `⋮` button in the header) then offers **Filter…**,
which opens that column's filter dropdown, and **Clear filter** while the column is filtered. The menu
button is highlighted while its column has an active filter.

- **text**: case-insensitive substring search
- **number**: min/max range inputs
- **boolean**: All / True / False select
- **date**: **From** and **To** `u-date-picker`s (`@iyulab/components`) — the cell editor's control, so the
  bounds read and show `YYYY-MM-DD` in every browser language, with a calendar beside each. Either
  bound may stay empty; the end day is inclusive, and each calendar stops at the other bound.
- **datetime**: the same pickers with a time (`YYYY-MM-DD HH:mm`)

A bound applies when it is committed — Enter, leaving the box, or a day picked in its calendar. While a
calendar is open, Escape closes the calendar; the next Escape closes the filter.

Filters set via the UI and the programmatic API (`setFilter()`) share the same filter state. Filter dropdowns automatically flip upward when near the viewport bottom.

### Server-Side Mode

Set `data-mode="server"` to disable client-side sorting/filtering. The component dispatches `sort-change` and `filter-change` events but does not recompute data — your server provides pre-sorted/filtered data:

```typescript
table.dataMode = 'server';
table.addEventListener('sort-change', (e) => {
  fetchData({ sort: e.detail.criteria }).then(data => {
    table.data = data;
  });
});
```

### OData Source Hook (React)

`useODataSource(url, options)` fetches paginated/sorted/filtered data from an OData v4 endpoint and returns props ready to bind to `<FlexTableReact dataMode="server" ...>`.

```tsx
import { useODataSource } from '@iyulab/flex-table/react';

const source = useODataSource('/api/orders', {
  pageSize: 20,
  fetcher: httpClient.fetch,          // custom transport, e.g. an HttpClient instance
  onUnauthorized: () => navigate('/login'),
});
```

| Option | Default | Description |
|---|---|---|
| `pageSize` | `20` | Rows per page |
| `defaultOrderBy` | — | Initial `$orderby` (e.g. `'name asc'`) |
| `initialPage` | `0` | Initial page, **zero-based** — the same axis as the returned `page`/`setPage`, and `$skip` is `page * pageSize` |
| `initialSearch` | `''` | Initial search term |
| `initialSort` | — | Initial sort as `SortCriteria[]`. Takes precedence over `defaultOrderBy` — it is the shape `onSortChange` hands you, so a stored sort round-trips without re-serializing it |
| `fixedFilter` | — | Filter always applied in addition to search. Changing it resets the page to 0 — see below |
| `baseUrl` | `window.location.origin` | Override the request origin (proxy/BFF setups) |
| `fetcher` | global `fetch` | Custom transport — pass a wrapper that injects auth headers |
| `onUnauthorized` | — | Called on `401` responses, before the generic error is set. A `403` (signed in, not permitted) does not call it — it surfaces as `error` |
| `enabled` | `true` | While `false`, no request is made and `loading` stays `true` — see below |

`fetcher`/`onUnauthorized` are read when each request starts, so a fresh function on every render is fine — it neither refetches nor is ignored.

Changing `fixedFilter` resets the page to `0`, the same way `setSearch` and `onSortChange`
already do. All three change the size of the result set, so keeping the old `$skip` would
request a range the new set no longer has — a filter applied while on page 5 would come back
empty. Comparison is by value, not by reference, so passing a fresh object literal on every
render (`fixedFilter={{ IsActive: true }}`) does not reset anything on its own. The reset
does not run on mount, so it never overrides `initialPage`.

If a response reports fewer rows than the current page needs, the page falls back to the
last page that exists — a result set can shrink without you asking (another user deleting
rows, a `refresh` landing after a change), and holding the old `$skip` would leave an empty
table next to a non-zero total. Reaching that state costs one extra request, only in that
case; the page only ever moves down, so it cannot loop.

Set `enabled: false` while the query depends on a value that has not arrived yet — a default
filter the server decides, the current user, a selected parent record. Without it, the first
render requests with the wrong conditions (often the heaviest query: no filter) and then again
once the value arrives. The first request goes out the moment `enabled` turns `true`, with the
conditions of that render; until then `loading` is `true`, so the table shows loading rather
than "no data". Turning it `false` mid-request cancels that request, and `refresh()` does nothing
while disabled.

```tsx
const season = useDefaultSeason();   // resolves asynchronously
const source = useODataSource('/api/orders', {
  fixedFilter: season ? { Season: season } : undefined,
  enabled: season !== undefined,
});
```

The three `initial*` options are read **on the first render only** (the same contract
`defaultOrderBy` has always had); use `setPage`/`setSearch` to move afterwards. Reach for
them when a list has to come back the way the user left it — going to a detail screen and
returning, or restoring from a URL:

```tsx
const source = useODataSource('/api/orders', {
  pageSize: 20,
  initialPage: restored.page,       // no mount effect, no discarded first request
  initialSearch: restored.search,
  initialSort: restored.sort,
});
```

Setting them up front rather than calling `setPage(...)` from a mount effect matters for
two reasons that are otherwise hard to work around: the effect version issues a request for
page 0 that is thrown away as soon as the second one lands, and `setSearch` resets the page
to 0 by design — so "restore the page, then set the search term" is not expressible from
outside the hook. Passing an empty `initialSort: []` means *no sort*, and does not fall
back to `defaultOrderBy`.

The hook returns:

| Field | Description |
|---|---|
| `data` / `totalCount` | Current page rows and the server's total (`@odata.count`). When the server pages its response (`@odata.nextLink`, e.g. a page size smaller than `pageSize`), the hook follows the link until the page is filled; a link outside the request's origin, or one that returns to a page already read, is reported through `error` instead of showing a short page |
| `loading` | A request is in flight, or none has answered yet (true from the first render until the first response settles, and while `enabled: false`) |
| `error` | The last failed request, or `null`: `{ message, status?, code?, details?, body? }`. **Pass it to the table** (`error={source.error}`) or render `error.message` yourself — a failed request otherwise leaves the grid silently empty. Branch on `status` (HTTP), `code` (the server's rejection code, OData `error.code`) and `details` (OData `error.details`); `body` is the parsed response (or its text). A failure with no response — a network error, or a `@odata.nextLink` the hook refused — has a `message` only |
| `page` / `setPage` | Zero-based page index |
| `sortCriteria` / `onSortChange` | Bind `onSortChange` to the table's `sort-change` event |
| `search` / `setSearch` | Current search term and its setter (resets to page 0) |
| `refresh` | Re-run the current request |

#### Search semantics

`setSearch` takes **literal text, not an OData search expression**. Each whitespace-separated token is sent as a quoted `$search` phrase joined with `AND` — `red shirt` becomes `$search="red" AND "shirt"`, matching rows that contain both terms.

Terms are always quoted because OData 4.0 only allows letters in an unquoted `searchWord`, so `2026` or `ZT-E2E-A` would be rejected by servers that follow it (4.01 relaxed this, but [Microsoft.OData still lexes as 4.0](https://github.com/OData/odata.net/issues/2445)). Quoting keeps any term valid regardless of server version. Since a `$search` phrase cannot contain `"` and OData defines no escape for it, double quotes are stripped from the term.

The quoting/escaping logic above is also available standalone as `buildSearchExpression(term)`, for consumers that need the same `$search` encoding without the pagination hook (e.g. a typeahead/combobox that isn't a table). `parseOrderBy(orderBy)` (`'a asc, b desc'` → `SortCriteria[]`) is exported the same way, for consumers driving a sort UI that isn't `useODataSource` either. The `./odata` entry does not load React, so an app without React can use it (the hooks live on `./react`):

```ts
import { buildSearchExpression, parseOrderBy } from '@iyulab/flex-table/odata';

buildSearchExpression('red shirt'); // '"red" AND "shirt"'
buildSearchExpression('');          // undefined
parseOrderBy('name desc');          // [{ key: 'name', direction: 'desc' }]
```

`buildODataQuery(state)` is the step the hook runs on every request — table state in, OData query string out. Use it to drive server paging without React (a Lit table, a list that is not a table) with exactly the query the hook would send:

```ts
import { buildODataQuery } from '@iyulab/flex-table/odata';

buildODataQuery({
  page: 2, pageSize: 20,                          // 0-based page → $skip=40
  sortCriteria: [{ key: 'name', direction: 'desc' }], // else defaultOrderBy
  search: 'red shirt',                            // encoded by buildSearchExpression
  fixedFilter: { IsActive: true },                // odata-query filter object
});
// '?$filter=IsActive eq true&$orderby=name desc&$count=true&$top=20&$skip=40&$search=%22red%22%20AND%20%22shirt%22'
```

### OData Source without React

`useODataSource` is a thin adapter over a framework-neutral source, and that source is public: `createODataSource(url, options)` takes the same options and does everything the hook does — the request, `@odata.nextLink` following, page fallback, `fixedFilter` reset, `enabled`, cancellation and the structured `error`. Use it from a Lit element, another framework, or plain code.

```ts
import { createODataSource } from '@iyulab/flex-table/odata';

const orders = createODataSource<Order>('/api/orders', { pageSize: 20 });
const off = orders.subscribe(() => render(orders.getState())); // the first subscriber starts loading
orders.setSort([{ key: 'name', direction: 'asc' }]);           // also: setPage, setSearch, refresh
orders.update('/api/orders', { pageSize: 20, fixedFilter: { IsActive: true } }); // changed options
off();                                                          // the last unsubscribe cancels a request in flight
```

| Member | Description |
|---|---|
| `getState()` | `{ data, totalCount, loading, error, page, sortCriteria, search }` — the same fields the hook returns. A new object only when something changed |
| `subscribe(listener)` | Called on every change; returns the unsubscribe function. Requests go out only while someone is subscribed |
| `setPage(page)` | Zero-based |
| `setSort(criteria)` / `setSearch(term)` | Change the sort or search and go back to page 0 |
| `refresh()` | Re-read with the same conditions (nothing while `enabled: false`) |
| `update(url, options)` | New options. Only a changed request re-reads; a changed `fixedFilter` value goes back to page 0; `initial*` are read at creation only |

Changes made in the same tick become one request with the final conditions, so `setSearch` followed by `setPage` does not send the intermediate one.

For a Lit element, `ODataSourceController` ties a source to the element's lifecycle — it subscribes when the element connects, cancels when it disconnects, and re-renders it on every change:

```ts
import { ODataSourceController } from '@iyulab/flex-table/odata';

class OrdersPage extends LitElement {
  private orders = new ODataSourceController<Order>(this, '/api/orders', { pageSize: 20 });

  render() {
    const { data, loading, error } = this.orders.state;
    return html`
      <flex-table data-mode="server" .data=${data} .loading=${loading} .error=${error}
        @sort-change=${(e: CustomEvent) => this.orders.source.setSort(e.detail.criteria)}></flex-table>`;
  }
}
```

### Array Source Hook (React)

`useArraySource(data, options)` runs search/sort/pagination over an in-memory array and
returns the **same shape** as `useODataSource` — `data`/`totalCount`/`loading`/`error`/
`page`/`setPage`/`sortCriteria`/`onSortChange`/`search`/`setSearch`/`refresh` — so the
same `<FlexTableReact dataMode="server" ...>` binding code works with either source.

Paging is clamped to the data you pass: if the array shrinks below the current page — the
in-memory equivalent of narrowing a filter, usually `rows.filter(...)` upstream — the hook
falls back to the last page that exists instead of rendering an empty table. It only ever
moves the page down, so an array that changes identity on every poll without changing length
leaves the current page alone.

Reach for this when the rows come from a client-side join a server query can't express —
e.g. a lookup table whose display name lives on a different endpoint than the row itself,
so search/sort has to run after the join, in memory:

```tsx
import { useArraySource } from '@iyulab/flex-table/react';

const joined = useMemo(
  () => seasonPrices.map(p => ({ ...p, productName: productsById[p.productId]?.name ?? '' })),
  [seasonPrices, productsById]
);

const source = useArraySource(joined, {
  pageSize: 20,
  columns, // pass the same ColumnDefinition[] used by <FlexTableReact> for value-aware sort
});
```

| Option | Default | Description |
|---|---|---|
| `pageSize` | `20` | Rows per page |
| `defaultOrderBy` | — | Initial sort (e.g. `'name asc'`), same syntax as `useODataSource` |
| `initialPage` / `initialSearch` / `initialSort` | `0` / `''` / — | Same names, same meanings, same first-render-only contract as `useODataSource` — the shared shape covers initial state too, so swapping sources needs no other change |
| `columns` | — | `ColumnDefinition[]` — enables value-aware sort (numbers/dates/booleans compared by value, not as text). Omit and every column sorts as text. |
| `searchFields` | all values | `(row) => value[]` — narrows or widens what free-text search matches; the default searches every property on the row, including client-joined ones |

The returned fields mean the same thing as `useODataSource`'s, except `totalCount` is the
count after search (not a server-reported total), and `loading`/`error` are always
`false`/`null` — there's no request to fail. `refresh` is a no-op kept only so a
"refresh" button wired unconditionally against either hook doesn't need a branch.

## Development

```bash
npm install
npm run dev      # Dev server with demo
npm test         # Run tests
npm run build    # Build library
npm run lint     # ESLint check
```

## License

MIT
