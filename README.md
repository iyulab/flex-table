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
- **Range Selection** — Shift+Arrow, Shift+Click for multi-cell selection
- **Clipboard** — Ctrl+C/X/V with TSV format (Excel/Google Sheets compatible)
- **Sorting** — Click header to sort (asc/desc/none), Shift+click for multi-sort
- **Column Resize** — Drag header border to resize columns
- **Filtering** — Programmatic column filters via `setFilter()` / `clearFilters()`
- **Row Operations** — `addRow()`, `deleteRows()` with undo support
- **Undo/Redo** — Ctrl+Z / Ctrl+Shift+Z for all edit operations
- **Export** — CSV, TSV, JSON export via `exportToString()` / `exportToFile()`
- **Dark Theme** — Auto via `prefers-color-scheme`, or manual `theme="dark"`
- **Row Numbers** — Optional `show-row-numbers` attribute
- **ARIA** — `role="grid"`, `aria-sort`, `aria-rowcount`, `aria-colcount`

## Properties

| Property | Attribute | Type | Default | Description |
|----------|-----------|------|---------|-------------|
| `columns` | — | `ColumnDefinition[]` | `[]` | Column definitions |
| `data` | — | `DataRow[]` | `[]` | Data rows |
| `rowHeight` | `row-height` | `number` | `32` | Row height in pixels |
| `showRowNumbers` | `show-row-numbers` | `boolean` | `false` | Show row number column |
| `filteredRowCount` | — | `number` | — | Number of rows after filtering (read-only) |
| — | `theme` | `string` | — | Force `"dark"` or `"light"` theme |

## Column Definition

```typescript
interface ColumnDefinition {
  key: string;        // Data property key
  header: string;     // Display header text
  type?: ColumnType;  // 'text' | 'number' | 'boolean' | 'date' | 'datetime'
  width?: number;     // Column width in pixels (default: 120)
  minWidth?: number;  // Minimum width (default: 40)
  hidden?: boolean;   // Hide column
  sortable?: boolean; // Enable sorting (default: true)
  renderer?: CellRenderer; // Custom cell render function
}
```

## Methods

| Method | Description |
|--------|-------------|
| `addRow(row?, index?)` | Add a row (default: empty row at end) |
| `deleteRows(indices?)` | Delete rows (default: selected rows) |
| `setFilter(key, predicate)` | Set a filter for a column |
| `removeFilter(key)` | Remove filter for a column |
| `clearFilters()` | Remove all filters |
| `exportToString(format)` | Export to `'csv'` / `'tsv'` / `'json'` string |
| `exportToFile(format, filename?)` | Export and trigger file download |

## Events

| Event | Detail | Description |
|-------|--------|-------------|
| `cell-select` | `{ row, col }` | Cell selection changed |
| `cell-edit-commit` | `{ row, col, key, oldValue, newValue }` | Cell value committed |
| `cell-edit-cancel` | `{ row, col }` | Cell edit cancelled |
| `clipboard-copy` | `{ range, text }` | Range copied |
| `clipboard-cut` | `{ range, text }` | Range cut |
| `clipboard-paste` | `{ changes }` | Data pasted |
| `sort-change` | `{ criteria }` | Sort criteria changed |
| `filter-change` | `{ keys, filteredCount }` | Filter changed |
| `column-resize` | `{ key, width, colIndex }` | Column resized |
| `row-add` | `{ row, index }` | Row added |
| `row-delete` | `{ indices, rows }` | Rows deleted |

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

## Development

```bash
npm install
npm run dev      # Dev server with demo
npm test         # Run tests
npm run build    # Build library
```

## License

MIT
