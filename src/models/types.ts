import type { TemplateResult } from 'lit';

/**
 * Supported column data types for built-in rendering and editing.
 */
export type ColumnType = 'text' | 'number' | 'boolean' | 'date' | 'datetime';

/**
 * Custom cell renderer function.
 * Receives the cell value, the full row data, and the column definition.
 * Returns either a Lit TemplateResult or a plain string.
 */
export type CellRenderer = (
  value: unknown,
  row: DataRow,
  col: ColumnDefinition
) => TemplateResult | string;

/**
 * Custom cell editor function.
 * Receives the cell value, the full row data, and the column definition.
 * Should return a Lit TemplateResult containing an input element with class "ft-editor".
 */
export type CellEditor = (
  value: unknown,
  row: DataRow,
  col: ColumnDefinition
) => TemplateResult;

/**
 * Definition of a single column in the table.
 */
export interface ColumnDefinition {
  /** Unique key matching data property names */
  key: string;
  /** Display header text */
  header: string;
  /** Data type for rendering/editing (default: 'text') */
  type?: ColumnType;
  /** Column width in pixels (default: auto) */
  width?: number;
  /** Minimum column width in pixels (default: 40) */
  minWidth?: number;
  /** Whether the column is hidden */
  hidden?: boolean;
  /** Whether the column is sortable (default: true) */
  sortable?: boolean;
  /** Custom cell renderer — overrides built-in type rendering */
  renderer?: CellRenderer;
  /** Whether the column is editable (default: true — follows global editable setting) */
  editable?: boolean;
  /** Custom cell editor — overrides built-in type editing */
  editor?: CellEditor;
  /** Pin the column to one side during horizontal scroll */
  pinned?: 'left';
}

/**
 * A single data row — schema-agnostic key-value map.
 */
export type DataRow = Record<string, unknown>;
