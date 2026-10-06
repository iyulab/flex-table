# React: `@iyulab/flex-table/react`

Requires the optional peers `react` and `@lit/react`.

## `FlexTableReact`

A `@lit/react` wrapper around `<flex-table>`, generic over the row type `T` (default `DataRow`).
Every element property is a prop; `ref` resolves to the `FlexTable` instance, so all methods
(`addRow`, `deleteRows`, `setFilter`, `selectWhere`, …) are reachable imperatively.

```tsx
import { useRef } from 'react';
import { FlexTableReact, type FlexTable, type ColumnDefinition } from '@iyulab/flex-table/react';

const columns: ColumnDefinition<Order>[] = [
  { key: 'id', label: 'ID' },
  { key: 'total', label: 'Total', type: 'number', format: '#,##0.00' },
];

function Orders({ orders }: { orders: Order[] }) {
  const ref = useRef<FlexTable>(null);
  return (
    <>
      <button onClick={() => ref.current?.addRow({ id: '', total: 0 })}>Add</button>
      <FlexTableReact<Order> ref={ref} data={orders} columns={columns} selectable
        onSelectionChange={(e) => console.log(e.detail.selectedRows)} />
    </>
  );
}
```

### Mapped event props

| Prop | Event | Prop | Event |
|---|---|---|---|
| `onCellSelect` | `cell-select` | `onColumnSelect` | `column-select` |
| `onCellEditStart` | `cell-edit-start` | `onColumnAdd` | `column-add` |
| `onCellEditCommit` | `cell-edit-commit` | `onColumnDelete` | `column-delete` |
| `onCellEditCancel` | `cell-edit-cancel` | `onColumnReorder` | `column-reorder` |
| `onValidationError` | `validation-error` | `onColumnResize` | `column-resize` |
| `onSortChange` | `sort-change` | `onSelectionChange` | `selection-change` |
| `onFilterChange` | `filter-change` | `onClipboardCopy` | `clipboard-copy` |
| `onFilterError` | `filter-error` | `onClipboardCut` | `clipboard-cut` |
| `onRowAdd` | `row-add` | `onClipboardPaste` | `clipboard-paste` |
| `onRowDelete` | `row-delete` | `onClipboardError` | `clipboard-error` |
| `onRowActivate` | `row-activate` | `onUndoStateChange` | `undo-state-change` |
| `onBatchUpdate` | `batch-update` | `onContextMenu` | `context-menu` |
| `onRowReorder` | `row-reorder` | `onHeaderContextMenu` | `header-context-menu` |
| `onColumnVisibilityChange` | `column-visibility-change` | `onCommentChange` | `comment-change` |
| `onDataImport` | `data-import` | `onFillHandleApply` | `fill-handle-apply` |
| `onFindReplace` | `find-replace` | | |

Every custom event of `<flex-table>` has a prop.

Type exports from this entry: `FlexTable`, `FlexTableReactProps`, `ColumnDefinition`, `DataRow`,
`ColumnType`, `ColumnAlign`, `CellRenderer`, `CellEditor`, `CellValidator`, `ConditionalRule`,
`SelectionMode`, `DataMode`, `UseODataSourceOptions`, `UseODataSourceResult`,
`UseArraySourceOptions`, `UseArraySourceResult`.

## `useODataSource(url, options)`

Fetches paged, sorted, searched rows from an OData v4 endpoint. Bind the result to a
server-mode table:

```tsx
import { useCallback } from 'react';
import { FlexTableReact, useODataSource } from '@iyulab/flex-table/react';

function Orders() {
  const fetcher = useCallback((input: string, init: RequestInit) => fetch(input, init), []);
  const source = useODataSource<Order>('/api/orders', { pageSize: 20, fetcher });

  return (
    <>
      <input value={source.search} onChange={(e) => source.setSearch(e.target.value)} />
      {source.error && <p role="alert">{source.error.message}</p>}
      <FlexTableReact<Order>
        dataMode="server"
        columns={columns}
        data={source.data}
        loading={source.loading}
        onSortChange={source.onSortChange}
        clearSelectionOnDataChange
      />
      <button disabled={source.page === 0} onClick={() => source.setPage(source.page - 1)}>Prev</button>
      <span>{source.page + 1} / {Math.max(1, Math.ceil(source.totalCount / 20))}</span>
      <button onClick={() => source.setPage(source.page + 1)}>Next</button>
    </>
  );
}
```

### Options

| Option | Default | Notes |
|---|---|---|
| `pageSize` | `20` | |
| `defaultOrderBy` | — | `$orderby` string, e.g. `'name asc'` |
| `initialPage` | `0` | Zero-based; first render only |
| `initialSearch` | `''` | First render only |
| `initialSort` | — | `SortCriteria[]`; overrides `defaultOrderBy`; `[]` means no sort |
| `fixedFilter` | — | odata-query filter object, always applied; value change resets to page 0 (compared by value) |
| `baseUrl` | `window.location.origin` | For proxy/BFF setups |
| `fetcher` | global `fetch` | `(input, init) => Promise<Response>`; keep stable |
| `onUnauthorized` | — | `(response) => void` on 401 only (403 surfaces as `error`); keep stable |
| `enabled` | `true` | While `false`: no request, `loading` stays `true`, `refresh()` is a no-op, in-flight request is cancelled |

### Result

| Field | Notes |
|---|---|
| `data`, `totalCount` | Current page and `@odata.count`; `@odata.nextLink` is followed to fill a page |
| `loading` | Request in flight, or no answer yet (true from the first render until the first response settles, and while `enabled: false`) — so `!loading && totalCount === 0` means "no results" |
| `error` | `SourceError \| null` — `{ message, status?, code?, details?, body?, cause? }`; render `error.message`, branch on `status` / `code` (OData `error.code`). `message` is the server's sentence when it sent one; otherwise this package's, in the `flexTableLocale` language — `requestFailed` (`Request failed ({status})`) when a response came back, `networkFailed` when none did (the transport's exception is in `cause`) |
| `page`, `setPage` | Zero-based |
| `sortCriteria`, `onSortChange` | Pass `onSortChange` to the table's `sort-change` (resets to page 0) |
| `search`, `setSearch` | Literal text (resets to page 0) |
| `refresh` | Re-run the current request |

Search is literal: each whitespace-separated token becomes a quoted phrase joined with `AND`
(`red shirt` → `"red" AND "shirt"`); double quotes are stripped. If the result set shrinks below
the current page, the page moves down to the last existing page.

Use `enabled` when the query depends on an async value:

```tsx
const source = useODataSource('/api/orders', {
  fixedFilter: season ? { Season: season } : undefined,
  enabled: season !== undefined,
});
```

## `useArraySource(data, options)`

Search, sort and paging over an in-memory array, returning **the same shape** as
`useODataSource` — the same `dataMode="server"` binding works with either.

```tsx
import { useMemo } from 'react';
import { useArraySource } from '@iyulab/flex-table/react';

const joined = useMemo(
  () => prices.map((p) => ({ ...p, productName: productsById[p.productId]?.name ?? '' })),
  [prices, productsById],
);
const source = useArraySource(joined, { pageSize: 20, columns });
```

| Option | Default | Notes |
|---|---|---|
| `pageSize` | `20` | |
| `defaultOrderBy` | — | Same syntax as `useODataSource` |
| `initialPage` / `initialSearch` / `initialSort` | `0` / `''` / — | Same first-render-only contract |
| `columns` | — | Enables value-aware sort (number/date/boolean); otherwise text sort |
| `searchFields` | all row values | `(row) => Array<string \| number \| boolean \| null \| undefined>` |

Differences: `totalCount` is the count after search, `loading` is always `false`, `error` always
`null`, and `refresh` is a no-op. The page is clamped down if the array shrinks.

## Without React

```ts
import { buildODataQuery, buildSearchExpression, parseOrderBy } from '@iyulab/flex-table/odata';
import { computeArrayView } from '@iyulab/flex-table/array';

buildSearchExpression('red shirt'); // '"red" AND "shirt"'  ('' → undefined)
parseOrderBy('name desc');          // [{ key: 'name', direction: 'desc' }]
buildODataQuery({ page: 2, pageSize: 20, search: 'red', fixedFilter: { IsActive: true } });
// '?$filter=...&$count=true&$top=20&$skip=40&$search=...'

const { data, totalCount } = computeArrayView(rows, {
  search: '', sortCriteria: [], page: 0, pageSize: 20, columns,
});
```

`buildODataQuery` state fields: `page`, `pageSize`, and optional `sortCriteria`, `defaultOrderBy`,
`search`, `fixedFilter` — exactly what the hook sends per request.
