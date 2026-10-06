import React from 'react';
import { createComponent, type EventName } from '@lit/react';
import { FlexTable } from './flex-table.js';
import type { ColumnDefinition, DataRow } from './models/types.js';
import type { FlexTableEventMap } from './events.js';

const FlexTableReactBase = createComponent({
  tagName: 'flex-table',
  elementClass: FlexTable,
  react: React,
  events: {
    onCellSelect: 'cell-select' as EventName<FlexTableEventMap['cell-select']>,
    onCellEditCommit: 'cell-edit-commit' as EventName<FlexTableEventMap['cell-edit-commit']>,
    onCellEditCancel: 'cell-edit-cancel' as EventName<FlexTableEventMap['cell-edit-cancel']>,
    onCellEditStart: 'cell-edit-start' as EventName<FlexTableEventMap['cell-edit-start']>,
    onSortChange: 'sort-change' as EventName<FlexTableEventMap['sort-change']>,
    onFilterChange: 'filter-change' as EventName<FlexTableEventMap['filter-change']>,
    onRowAdd: 'row-add' as EventName<FlexTableEventMap['row-add']>,
    onRowDelete: 'row-delete' as EventName<FlexTableEventMap['row-delete']>,
    onRowActivate: 'row-activate' as EventName<FlexTableEventMap['row-activate']>,
    onColumnResize: 'column-resize' as EventName<FlexTableEventMap['column-resize']>,
    onColumnSelect: 'column-select' as EventName<FlexTableEventMap['column-select']>,
    onColumnAdd: 'column-add' as EventName<FlexTableEventMap['column-add']>,
    onColumnDelete: 'column-delete' as EventName<FlexTableEventMap['column-delete']>,
    onColumnReorder: 'column-reorder' as EventName<FlexTableEventMap['column-reorder']>,
    onSelectionChange: 'selection-change' as EventName<FlexTableEventMap['selection-change']>,
    onClipboardCopy: 'clipboard-copy' as EventName<FlexTableEventMap['clipboard-copy']>,
    onClipboardCut: 'clipboard-cut' as EventName<FlexTableEventMap['clipboard-cut']>,
    onClipboardPaste: 'clipboard-paste' as EventName<FlexTableEventMap['clipboard-paste']>,
    onClipboardError: 'clipboard-error' as EventName<FlexTableEventMap['clipboard-error']>,
    onUndoStateChange: 'undo-state-change' as EventName<FlexTableEventMap['undo-state-change']>,
    onValidationError: 'validation-error' as EventName<FlexTableEventMap['validation-error']>,
    onBatchUpdate: 'batch-update' as EventName<FlexTableEventMap['batch-update']>,
    onContextMenu: 'context-menu' as EventName<FlexTableEventMap['context-menu']>,
    onFilterError: 'filter-error' as EventName<FlexTableEventMap['filter-error']>,
    onRowReorder: 'row-reorder' as EventName<FlexTableEventMap['row-reorder']>,
    onColumnVisibilityChange: 'column-visibility-change' as EventName<FlexTableEventMap['column-visibility-change']>,
    onCommentChange: 'comment-change' as EventName<FlexTableEventMap['comment-change']>,
    onDataImport: 'data-import' as EventName<FlexTableEventMap['data-import']>,
    onFillHandleApply: 'fill-handle-apply' as EventName<FlexTableEventMap['fill-handle-apply']>,
    onFindReplace: 'find-replace' as EventName<FlexTableEventMap['find-replace']>,
    onHeaderContextMenu: 'header-context-menu' as EventName<FlexTableEventMap['header-context-menu']>,
  },
});

type BaseProps = React.ComponentProps<typeof FlexTableReactBase>;

/**
 * Props for {@link FlexTableReact}, parameterized on the consumer's row type `T`
 * (defaults to `DataRow` — identical to the previous non-generic behavior).
 */
export type FlexTableReactProps<T = DataRow> = Omit<BaseProps, 'data' | 'columns'> & {
  data?: T[];
  columns?: ColumnDefinition<T>[];
};

/**
 * React wrapper for the `<flex-table>` custom element, generic over the row type `T`.
 *
 * The underlying custom element (`FlexTable`) is a single registered class and cannot
 * itself be generic across instances — the DOM has no notion of `FlexTable<Order>` vs
 * `FlexTable<Consumer>`. `FlexTableReact<T>` performs one internal cast at this boundary
 * so consumers get end-to-end type safety (`data`, `columns`, `render`/`editor`/`validator`
 * callbacks) without casting at every call site.
 *
 * @example
 * ```tsx
 * const columns: ColumnDefinition<Order>[] = [
 *   { key: 'id', label: 'ID' },
 *   { key: 'total', label: 'Total', render: (v, row) => `${row.total} ${row.currency}` },
 * ];
 * <FlexTableReact<Order> data={orders} columns={columns} />
 * ```
 */
export const FlexTableReact = FlexTableReactBase as unknown as <T = DataRow>(
  props: FlexTableReactProps<T> & React.RefAttributes<FlexTable>
) => React.ReactElement | null;

export type { FlexTable };
export type { ColumnDefinition, DataRow, ColumnType, ColumnAlign, CellRenderer, CellEditor, CellValidator, ConditionalRule, SelectionMode, DataMode } from './models/types.js';

// React 훅 — 순수 함수(`buildSearchExpression`·`parseOrderBy`·`computeArrayView`)는
// React 없이 쓰도록 `./odata`·`./array` 에 남는다.
export { useODataSource } from './odata/use-odata-source.js';
export type { UseODataSourceOptions, UseODataSourceResult } from './odata/types.js';
export { useArraySource } from './array/use-array-source.js';
export type { UseArraySourceOptions, UseArraySourceResult } from './array/types.js';
export type { SourceError, SourceErrorDetail } from './core/source-error.js';
