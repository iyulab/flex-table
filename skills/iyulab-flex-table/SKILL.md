---
name: iyulab-flex-table
description: Spreadsheet-grade data grid web component (`<flex-table>`, built with Lit) with virtual scrolling, inline cell editing, validation, range selection, clipboard, undo/redo, sorting, filtering, pinned columns, and CSV/TSV/JSON/XLSX export, plus a React wrapper and OData / in-memory data-source hooks. Use when working with @iyulab/flex-table — defining columns, editing cells, handling grid events, wiring server-side paging with useODataSource or useArraySource, or styling the grid.
license: MIT
metadata:
  author: iyulab
---

# @iyulab/flex-table

A schema-agnostic data grid custom element (`<flex-table>`) for large datasets and cell-level editing.
Rows are plain objects (`DataRow = Record<string, unknown>`); columns describe how to show and edit them.

## Install

```bash
npm install @iyulab/flex-table @iyulab/components
# React wrapper and hooks (optional peers)
npm install @lit/react react
```

`@iyulab/components` is a peer dependency (locale, formatting, design tokens).

## Entry points

| Import | Contents |
|---|---|
| `@iyulab/flex-table` | Registers `<flex-table>`; exports `FlexTable`, types, `exportData`, `renderCell`, `flexTableLocale`, `RowSelectionState`, `UndoStack`, `effectiveAlign` |
| `@iyulab/flex-table/react` | `FlexTableReact`, `useODataSource`, `useArraySource` |
| `@iyulab/flex-table/odata` | No React: `createODataSource` (the source `useODataSource` adapts), `ODataSourceController` (Lit), `buildODataQuery`, `buildSearchExpression`, `parseOrderBy` |
| `@iyulab/flex-table/array` | Pure helper, no React: `computeArrayView` |

## Quick start

```html
<flex-table id="table" style="height: 400px" show-row-numbers></flex-table>

<script type="module">
  import '@iyulab/flex-table';

  const table = document.getElementById('table');
  table.columns = [
    { key: 'name', label: 'Name', type: 'text', width: 200 },
    { key: 'age', label: 'Age', type: 'number', width: 100 },
    { key: 'active', label: 'Active', type: 'boolean', width: 80 },
  ];
  table.data = [
    { name: 'Alice', age: 30, active: true },
    { name: 'Bob', age: 25, active: false },
  ];
  table.addEventListener('cell-edit-commit', (e) => console.log(e.detail));
</script>
```

## Key concepts

**Give it a height.** The host is its own scroll container and virtualizes against its own height.
Without a height (or a constrained flex parent with `min-height: 0`), every row is rendered.

**Columns.** Each `ColumnDefinition` needs `key` and `label`. `type` picks the built-in
renderer/editor (`text`, `number`, `boolean`, `date`, `datetime`, `select`; unknown strings behave
as `text`). See `references/api.md` for every field.

- `format` changes only the displayed text (`'#,##0.00'`, `'0.00%'`, `'yyyy-MM-dd'`, or a function); sorting, filtering, editing and export keep the raw value.
- `render` replaces the cell content (`(value, row, col) => TemplateResult | string`) and wins over `format`.
- `editor` returns a Lit template containing an element with class `ft-editor`; its `.value` is committed.
- `validator` returns `null` when valid, or an error message (the edit is rejected and `validation-error` fires).
- `number` cells, the number filter and paste read numbers in the active `Locale` (`1,5` is 1.5 on a comma-decimal page); an edit that is not a number is rejected with `validation-error`.
- `date` cells edit with `u-date-picker` (a `YYYY-MM-DD` text box in every browser language plus a calendar) (also `20261002`, `2026/10/2`, `10-02`); pasted dates are normalized to ISO. `datetime` cells edit as `YYYY-MM-DD HH:mm` (local) and store `YYYY-MM-DDTHH:mm`.
- `conditionalRules` applies `{ when, style }` rules in order; later matches override earlier ones.
- `pinned: 'left' | 'right'` freezes a column during horizontal scroll.

**Data is mutated in place.** Assigning a new array re-renders; changing a row object does not.
Use `updateRows([{ row, key, value }])` for programmatic edits (undoable, fires `batch-update`) or
`refreshData()` after an external in-place mutation.

**Editing and read-only.** `editable` defaults to `true`. For a read-only grid set
`table.editable = false` (a property, since a boolean attribute cannot express `false`) — Enter on a non-editable cell then fires
`row-activate`, the grid's "open this row" contract.

**Row selection is index-based.** Enable with `selectable` (`selection-mode="single|multi"`).
There is no row key, so set `clear-selection-on-data-change` when selection drives bulk actions and
`data` can be replaced. `selectWhere(predicate)` selects rows by content.

**Client vs server mode.** `data-mode="client"` (default) sorts and filters locally.
`data-mode="server"` only emits `sort-change` / `filter-change`; you supply already-processed rows.

**Filtering.** Programmatic `setFilter(key, (value, row) => boolean)`; `show-filters` adds a
**Filter…** entry to each column's header menu (text, number range, boolean, date/datetime range).
Both share one filter state.

**Undo/redo** covers edits, row and column operations, paste and comments (`max-undo-size`, default 100).

## React

```tsx
import { useRef } from 'react';
import { FlexTableReact, type FlexTable, type ColumnDefinition } from '@iyulab/flex-table/react';

interface Order { id: string; total: number; currency: string }

const columns: ColumnDefinition<Order>[] = [
  { key: 'id', label: 'ID' },
  { key: 'total', label: 'Total', render: (_v, row) => `${row.total} ${row.currency}` },
];

function Orders({ orders }: { orders: Order[] }) {
  const ref = useRef<FlexTable>(null);
  return (
    <FlexTableReact<Order>
      ref={ref}
      data={orders}
      columns={columns}
      selectable
      onCellEditCommit={(e) => console.log(e.detail)}
    />
  );
}
```

Server paging from OData or an in-memory array uses the same binding — see `references/react.md`.

## Common pitfalls

- No height → no virtualization.
- `--ft-row-height` is read once at first render; change row height later via `rowHeight` / `row-height`.
- Styles for elements returned by `render` must be passed through the `stylesheets` property
  (constructable `CSSStyleSheet[]`); document CSS does not cross the shadow boundary.
- Always show `error` from `useODataSource` — pass it to the table (`error={source.error}`); a failed request otherwise leaves the grid empty. Branch on `error.status` / `error.code` rather than parsing the message.

## References

- [references/api.md](references/api.md) — properties, column definition, methods, events
- [references/react.md](references/react.md) — `FlexTableReact`, `useODataSource`, `useArraySource`, pure OData/array helpers
- [references/styling.md](references/styling.md) — CSS custom properties, density, keyboard shortcuts, localization
