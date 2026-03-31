import React from 'react';
import { createComponent, type EventName } from '@lit/react';
import { FlexTable } from './flex-table.js';

export const FlexTableReact = createComponent({
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

export type { FlexTable };
export type { ColumnDefinition, DataRow, ColumnType, CellRenderer, CellEditor, CellValidator, SelectionMode, DataMode } from './models/types.js';
