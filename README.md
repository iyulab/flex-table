# flex-table

A lightweight, schema-agnostic data grid web component built with [Lit](https://lit.dev/).

Designed for effortless data input and crystal-clear visibility. Bridges the gap between spreadsheet freedom and database structural integrity.

## Install

```bash
npm install @iyulab/flex-table
```

## Quick Start

```html
<flex-table id="table" row-height="32" show-row-numbers></flex-table>

<script type="module">
  import '@iyulab/flex-table';

  const table = document.getElementById('table');

  table.columns = [
    { key: 'name', header: 'Name', type: 'text', width: 200 },
    { key: 'age', header: 'Age', type: 'number', width: 100 },
    { key: 'active', header: 'Active', type: 'boolean', width: 80 },
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
- **Clipboard** — Ctrl+C/X/V with TSV format (Excel/Google Sheets compatible, RFC 4180)
- **Sorting** — Click header to sort (asc/desc/none), Shift+click for multi-sort
- **Column Resize** — Drag header border, double-click to auto-fit, Alt+Arrow keyboard resize
- **Column Operations** — `addColumn()`, `deleteColumn()`, `moveColumn()` with undo
- **Pinned Columns** — Freeze columns to left or right (`pinned: 'left' | 'right'`)
- **Filtering** — Programmatic API + built-in header filter UI (`show-filters`)
- **Filter Types** — Text search, number range, boolean toggle, date/datetime range picker
- **Row Operations** — `addRow()`, `deleteRows()`, `updateRows()` with undo
- **Undo/Redo** — Ctrl+Z / Ctrl+Y for all operations; configurable stack size
- **Export** — CSV, TSV, JSON; full data or selection-only
- **Dark Theme** — Auto via `prefers-color-scheme`, or manual `theme="dark"`
- **Row Numbers** — Optional `show-row-numbers` attribute with sticky positioning
- **Footer Row** — Summary/aggregate row via `footer-data` property
- **Data Mode** — Client-side or server-side sorting/filtering (`dataMode`)
- **Context Menu** — `context-menu` event for custom right-click menus
- **React Wrapper** — `@iyulab/flex-table/react` subpath for idiomatic React usage
- **ARIA** — `role="grid"`, `aria-sort`, `aria-selected`, `aria-readonly`, `aria-invalid`, `aria-rowcount`, `aria-colcount`

## Properties

| Property | Attribute | Type | Default | Description |
|----------|-----------|------|---------|-------------|
| `columns` | — | `ColumnDefinition[]` | `[]` | Column definitions |
| `data` | — | `DataRow[]` | `[]` | Data rows (`Record<string, unknown>[]`) |
| `rowHeight` | `row-height` | `number` | `32` | Row height in pixels |
| `showRowNumbers` | `show-row-numbers` | `boolean` | `false` | Show row number column |
| `theme` | `theme` | `'light' \| 'dark'` | auto | Force theme; auto-detects `prefers-color-scheme` |
| `editable` | `editable` | `boolean` | `true` | Global read-only mode when `false` |
| `showFilters` | `show-filters` | `boolean` | `false` | Show built-in header filter dropdowns |
| `maxRows` | `max-rows` | `number` | `0` | Max row count (0 = unlimited); blocks `addRow()` and paste expansion |
| `maxUndoSize` | `max-undo-size` | `number` | `100` | Max undo history stack size |
| `selectable` | `selectable` | `boolean` | `false` | Enable row-level checkbox selection |
| `selectionMode` | `selection-mode` | `'single' \| 'multi'` | `'multi'` | Row selection mode |
| `dataMode` | `data-mode` | `'client' \| 'server'` | `'client'` | Client-side or server-side data processing |
| `footerData` | `footer-data` | `Record<string, string>` | `null` | Footer/summary row data (keys match column keys) |

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
  header: string;          // Display header text
  type?: ColumnType;       // 'text' | 'number' | 'boolean' | 'date' | 'datetime'
  width?: number;          // Column width in pixels (default: 120)
  minWidth?: number;       // Minimum width in pixels (default: 40, enforced in rendering)
  hidden?: boolean;        // Hide column from view
  sortable?: boolean;      // Enable sorting (default: true)
  editable?: boolean;      // Per-column edit control (follows global editable)
  pinned?: 'left' | 'right'; // Freeze column during horizontal scroll
  format?: string | ((value, row, col) => string); // Display format, see "format vs renderer" below
  renderer?: CellRenderer; // Custom cell render: (value, row, col) => TemplateResult | string
  editor?: CellEditor;     // Custom cell editor: (value, row, col) => TemplateResult
  validator?: CellValidator; // Validate before commit: (value, row, col) => string | null
  conditionalRules?: ConditionalRule[]; // Per-cell style rules, see below
}
```

The `editor` callback must return a Lit `TemplateResult` containing an input element with class `"ft-editor"`. The component reads `.value` from that element on commit. See [Custom Editor](#custom-editor) for details.

The `validator` callback returns `null` if valid, or an error message string. On failure, the cell shows a red border for 3 seconds and a `validation-error` event is dispatched.

### `format` vs `renderer`

Both control how a cell's raw value is displayed, but they differ in what they replace:

- **`format`**: a plain string pattern (Excel-style, e.g. `'#,##0.00'`, `'0.00%'`, `'$#,##0'`, `'yyyy-MM-dd'`) or a `(value) => string` function. Only the *displayed text* changes — editing, sorting, filtering, and export all keep operating on the raw underlying value. Use this for number/date/currency display formatting.
- **`renderer`**: a `(value, row, col) => TemplateResult | string` function that replaces the cell's rendered content entirely — badges, links, icons, multi-field composites. Sorting/filtering still use the raw value, but the visual output is fully custom.

```typescript
const columns: ColumnDefinition<Order>[] = [
  { key: 'total', header: 'Total', format: '#,##0.00' },                 // "1,234.50"
  { key: 'placedAt', header: 'Placed', format: 'yyyy-MM-dd' },           // date pattern
  { key: 'status', header: 'Status', renderer: (v) => html`<span class="badge badge-${v}">${v}</span>` },
];
```

If both are set on the same column, `renderer` takes precedence — `format` has no effect once a custom `renderer` fully controls the cell's output.

### Conditional Formatting

`conditionalRules` applies a style to a cell when its `when` predicate matches — a declarative alternative to writing a `renderer` just to color-code status/threshold values:

```typescript
const columns: ColumnDefinition<Order>[] = [
  {
    key: 'status',
    header: 'Status',
    conditionalRules: [
      { when: (v) => v === 'overdue', style: { color: '#dc2626', fontWeight: 'bold' } },
      { when: (v) => v === 'paid', style: { color: '#16a34a' } },
    ],
  },
];
```

Rules are evaluated in order and combined; later matching rules override earlier ones for overlapping style properties.

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
| `deleteColumn(key)` | `void` | Remove column + cleanup filters/sort/widths |
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
| `exportToString(format, options?)` | `string` | Export to `'csv'` / `'tsv'` / `'json'`. Pass `{ selectionOnly: true }` for selection range |
| `exportToFile(format, filename?)` | `void` | Export and trigger browser file download |

## Events

All events use `CustomEvent` with `bubbles: true, composed: true`.

### Cell Events

| Event | Detail | Description |
|-------|--------|-------------|
| `cell-select` | `{ row, col }` | Cell focus changed |
| `cell-edit-start` | `{ row, col, key, value }` | Cell editing started |
| `cell-edit-commit` | `{ row, col, key, oldValue, newValue }` | Cell value committed |
| `cell-edit-cancel` | `{ row, col }` | Cell edit cancelled (Escape) |
| `validation-error` | `{ row, col, key, value, error }` | Cell validator rejected value |

### Data Events

| Event | Detail | Description |
|-------|--------|-------------|
| `row-add` | `{ row, index }` | Row added |
| `row-delete` | `{ indices, rows }` | Rows deleted |
| `batch-update` | `{ changes: [{ row, key, oldValue, newValue }] }` | Batch update applied |

### Column Events

| Event | Detail | Description |
|-------|--------|-------------|
| `column-add` | `{ column, index }` | Column added |
| `column-delete` | `{ column, key, index }` | Column removed |
| `column-reorder` | `{ key, oldIndex, newIndex }` | Column moved |
| `column-resize` | `{ key, width, colIndex }` | Column resized (drag, auto-fit, or keyboard) |
| `column-select` | `{ colIndex, key, rowCount }` | Entire column selected |

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
| `clipboard-error` | `{ action, error }` | Clipboard API failed (`action`: `'copy'` or `'paste'`) |

### State Events

| Event | Detail | Description |
|-------|--------|-------------|
| `undo-state-change` | `{ canUndo, canRedo }` | Undo/redo availability changed |
| `context-menu` | `{ x, y, row, col, dataRow, column }` | Right-click on cell |

## CSS Custom Properties

All colors and styles are customizable via CSS custom properties:

```css
flex-table {
  --ft-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --ft-font-size: 14px;
  --ft-border-color: #e0e0e0;
  --ft-bg: #fff;
  --ft-text-color: #202124;
  --ft-header-bg: #f8f9fa;
  --ft-header-hover-bg: #e8eaed;
  --ft-header-text-color: #202124;
  --ft-row-even-bg: #fff;
  --ft-row-odd-bg: #fafafa;
  --ft-row-hover-bg: #f0f4ff;
  --ft-active-color: #1a73e8;
  --ft-selection-bg: #e8f0fe;
  --ft-bool-color: #2196f3;
  --ft-sort-indicator-color: #5f6368;
  --ft-editor-bg: #fff;
  --ft-empty-color: #999;
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Arrow keys | Navigate cells |
| Tab / Shift+Tab | Move to next/previous cell |
| Enter / F2 | Start editing |
| Escape | Cancel edit / clear selection |
| Home / End | Row start/end |
| Ctrl+Home / Ctrl+End | Table start/end |
| Shift+Arrow | Extend selection range |
| Ctrl+C / Ctrl+X | Copy/Cut selection as TSV |
| Ctrl+V | Paste TSV data |
| Delete / Backspace | Clear selected cells |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Alt+ArrowLeft / Alt+ArrowRight | Resize current column (±20px) |
| Ctrl+Click header | Select entire column |

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
    { key: 'name', header: 'Name', type: 'text' },
    { key: 'age', header: 'Age', type: 'number' },
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
  { key: 'id', header: 'ID' },
  { key: 'total', header: 'Total', renderer: (_value, row) => `${row.total} ${row.currency}` },
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
    header: 'Color',
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
    header: 'Age',
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
  { key: 'id', header: 'ID', pinned: 'left' },
  { key: 'name', header: 'Name' },
  // ... many columns ...
  { key: 'actions', header: 'Actions', pinned: 'right' },
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

Enable with `show-filters` attribute. Filter dropdowns appear in column headers:

- **text**: case-insensitive substring search
- **number**: min/max range inputs
- **boolean**: All / True / False select
- **date**: from/to date range picker (`<input type="date">`)
- **datetime**: from/to datetime range picker (`<input type="datetime-local">`)

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
import { useODataSource } from '@iyulab/flex-table/odata';

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
| `fixedFilter` | — | Filter always applied in addition to search |
| `baseUrl` | `window.location.origin` | Override the request origin (proxy/BFF setups) |
| `fetcher` | global `fetch` | Custom transport — pass a wrapper that injects auth headers |
| `onUnauthorized` | — | Called on `401`/`403` responses, before the generic error is set |

`fetcher`/`onUnauthorized` should be stable references (e.g. wrap in `useCallback`) — they are intentionally excluded from the hook's internal effect dependencies to avoid refetch loops on every render.

The hook returns:

| Field | Description |
|---|---|
| `data` / `totalCount` | Current page rows and the server's total (`@odata.count`) |
| `loading` | A request is in flight |
| `error` | Message of the last failed request, or `null`. **Render this** — a failed request otherwise leaves the grid silently empty |
| `page` / `setPage` | Zero-based page index |
| `sortCriteria` / `onSortChange` | Bind `onSortChange` to the table's `sort-change` event |
| `search` / `setSearch` | Current search term and its setter (resets to page 0) |
| `refresh` | Re-run the current request |

#### Search semantics

`setSearch` takes **literal text, not an OData search expression**. Each whitespace-separated token is sent as a quoted `$search` phrase joined with `AND` — `red shirt` becomes `$search="red" AND "shirt"`, matching rows that contain both terms.

Terms are always quoted because OData 4.0 only allows letters in an unquoted `searchWord`, so `2026` or `ZT-E2E-A` would be rejected by servers that follow it (4.01 relaxed this, but [Microsoft.OData still lexes as 4.0](https://github.com/OData/odata.net/issues/2445)). Quoting keeps any term valid regardless of server version. Since a `$search` phrase cannot contain `"` and OData defines no escape for it, double quotes are stripped from the term.

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
