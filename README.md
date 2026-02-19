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

- **Virtual Scroll** — Smooth scrolling through 10,000+ rows
- **Keyboard Navigation** — Arrow, Tab, Home, End, Ctrl+Home/End
- **Inline Editing** — Enter/F2 to edit, Escape to cancel, type-aware editors
- **Custom Editor** — `editor` callback for fully custom cell editing UI
- **Range Selection** — Shift+Arrow, Shift+Click for multi-cell selection
- **Clipboard** — Ctrl+C/X/V with TSV format (Excel/Google Sheets compatible, RFC 4180)
- **Sorting** — Click header to sort (asc/desc/none), Shift+click for multi-sort
- **Column Resize** — Drag header border; double-click to auto-fit
- **Column Operations** — `addColumn()`, `deleteColumn()`, `moveColumn()` with undo
- **Pinned Columns** — Freeze columns during horizontal scroll (`pinned: 'left'`)
- **Filtering** — Programmatic API + built-in header filter UI (`show-filters`)
- **Row Operations** — `addRow()`, `deleteRows()`, `updateRows()` with undo
- **Undo/Redo** — Ctrl+Z / Ctrl+Y for all operations; configurable stack size
- **Export** — CSV, TSV, JSON; full data or selection-only
- **Dark Theme** — Auto via `prefers-color-scheme`, or manual `theme="dark"`
- **Row Numbers** — Optional `show-row-numbers` attribute with sticky positioning
- **ARIA** — `role="grid"`, `aria-sort`, `aria-selected`, `aria-readonly`, `aria-rowcount`, `aria-colcount`

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
  minWidth?: number;       // Minimum width (default: 40)
  hidden?: boolean;        // Hide column from view
  sortable?: boolean;      // Enable sorting (default: true)
  editable?: boolean;      // Per-column edit control (follows global editable)
  pinned?: 'left';         // Freeze column during horizontal scroll
  renderer?: CellRenderer; // Custom cell render: (value, row, col) => TemplateResult | string
  editor?: CellEditor;     // Custom cell editor: (value, row, col) => TemplateResult
}
```

The `editor` callback must return a Lit `TemplateResult` containing an input element with class `"ft-editor"`. The component reads `.value` from that element on commit. See [Custom Editor](#custom-editor) for details.

## Methods

### Row Operations

| Method | Returns | Description |
|--------|---------|-------------|
| `addRow(row?, index?)` | `DataRow \| null` | Add a row. Returns `null` if `maxRows` reached |
| `deleteRows(indices?)` | `void` | Delete rows by data index (default: selected rows) |
| `updateRows(changes)` | `void` | Batch update cells as single undo action. `changes: Array<{ row, key, value }>` |

### Column Operations

| Method | Returns | Description |
|--------|---------|-------------|
| `addColumn(def, index?)` | `ColumnDefinition` | Add column at position (default: end) |
| `deleteColumn(key)` | `void` | Remove column + cleanup filters/sort/widths |
| `moveColumn(key, newIndex)` | `void` | Reorder column to target index (clamped) |
| `getColumnWidth(key)` | `number \| undefined` | Get internal resize width for column |

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
| `column-resize` | `{ key, width, colIndex }` | Column resized (drag or auto-fit) |

### Sort & Filter Events

| Event | Detail | Description |
|-------|--------|-------------|
| `sort-change` | `{ criteria: [{ key, direction }] }` | Sort criteria changed |
| `filter-change` | `{ keys, filteredCount }` | Filter added/removed |

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

## Usage Guide

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

### Data Mutation

The `data` property uses in-place mutation for performance. Direct changes to data objects are **not** automatically detected:

```typescript
// Will NOT trigger re-render:
table.data[0].name = 'Alice';

// Options to trigger re-render:
table.requestUpdate();           // Manual re-render
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

Filters set via the UI and the programmatic API (`setFilter()`) share the same filter state.

## Development

```bash
npm install
npm run dev      # Dev server with demo
npm test         # Run tests
npm run build    # Build library
```

## License

MIT
