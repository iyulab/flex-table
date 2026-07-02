import React from 'react';
import { createComponent, type EventName } from '@lit/react';
import { FlexTable } from './flex-table.js';
import type { ColumnDefinition, DataRow } from './models/types.js';

const FlexTableReactBase = createComponent({
  tagName: 'flex-table',
  elementClass: FlexTable,
  react: React,
  events: {
    onCellSelect: 'cell-select' as EventName<CustomEvent>,
    onCellEditCommit: 'cell-edit-commit' as EventName<CustomEvent>,
    onCellEditCancel: 'cell-edit-cancel' as EventName<CustomEvent>,
    onCellEditStart: 'cell-edit-start' as EventName<CustomEvent>,
    onSortChange: 'sort-change' as EventName<CustomEvent>,
    onFilterChange: 'filter-change' as EventName<CustomEvent>,
    onRowAdd: 'row-add' as EventName<CustomEvent>,
    onRowDelete: 'row-delete' as EventName<CustomEvent>,
    onColumnResize: 'column-resize' as EventName<CustomEvent>,
    onColumnSelect: 'column-select' as EventName<CustomEvent>,
    onColumnAdd: 'column-add' as EventName<CustomEvent>,
    onColumnDelete: 'column-delete' as EventName<CustomEvent>,
    onColumnReorder: 'column-reorder' as EventName<CustomEvent>,
    onSelectionChange: 'selection-change' as EventName<CustomEvent>,
    onClipboardCopy: 'clipboard-copy' as EventName<CustomEvent>,
    onClipboardCut: 'clipboard-cut' as EventName<CustomEvent>,
    onClipboardPaste: 'clipboard-paste' as EventName<CustomEvent>,
    onClipboardError: 'clipboard-error' as EventName<CustomEvent>,
    onUndoStateChange: 'undo-state-change' as EventName<CustomEvent>,
    onValidationError: 'validation-error' as EventName<CustomEvent>,
    onBatchUpdate: 'batch-update' as EventName<CustomEvent>,
    onContextMenu: 'context-menu' as EventName<CustomEvent>,
    onFilterError: 'filter-error' as EventName<CustomEvent>,
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
 * so consumers get end-to-end type safety (`data`, `columns`, `renderer`/`editor`/`validator`
 * callbacks) without casting at every call site.
 *
 * @example
 * ```tsx
 * const columns: ColumnDefinition<Order>[] = [
 *   { key: 'id', header: 'ID' },
 *   { key: 'total', header: 'Total', renderer: (v, row) => `${row.total} ${row.currency}` },
 * ];
 * <FlexTableReact<Order> data={orders} columns={columns} />
 * ```
 */
export const FlexTableReact = FlexTableReactBase as unknown as <T = DataRow>(
  props: FlexTableReactProps<T> & React.RefAttributes<FlexTable>
) => React.ReactElement | null;

export type { FlexTable };
export type { ColumnDefinition, DataRow, ColumnType, CellRenderer, CellEditor, CellValidator, ConditionalRule, SelectionMode, DataMode } from './models/types.js';
