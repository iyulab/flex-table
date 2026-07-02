import type { TemplateResult } from 'lit';

/**
 * Built-in column data types for rendering and editing.
 * Any string is accepted as a type — unknown types fall back to 'text' behavior.
 */
export type ColumnType = 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'select' | (string & {});

/** Option item for select columns */
export interface SelectOption {
  label: string;
  value: unknown;
}

/**
 * Custom cell renderer function.
 * Receives the cell value, the full row data, and the column definition.
 * Returns either a Lit TemplateResult or a plain string.
 */
export type CellRenderer<T = DataRow> = (
  value: unknown,
  row: T,
  col: ColumnDefinition<T>
) => TemplateResult | string;

/**
 * Custom cell editor function.
 * Receives the cell value, the full row data, and the column definition.
 * Should return a Lit TemplateResult containing an input element with class "ft-editor".
 */
export type CellEditor<T = DataRow> = (
  value: unknown,
  row: T,
  col: ColumnDefinition<T>
) => TemplateResult;

/**
 * Cell validator function. Returns null/undefined if valid, or an error message string.
 */
export type CellValidator<T = DataRow> = (
  value: unknown,
  row: T,
  col: ColumnDefinition<T>
) => string | null | undefined;

/**
 * Row selection mode.
 */
export type SelectionMode = 'single' | 'multi';

/**
 * Data processing mode.
 * - 'client': flex-table performs sorting/filtering locally (default).
 * - 'server': flex-table only dispatches events; consumer provides pre-sorted/filtered data.
 */
export type DataMode = 'client' | 'server';

/**
 * Definition of a single column in the table.
 *
 * `T` is the consumer's row type (defaults to the schema-agnostic `DataRow`).
 * Internally, `FlexTable` (the registered custom element) always operates on
 * `ColumnDefinition<DataRow>` — a custom element cannot itself be generic across
 * instances, so `FlexTableReact<T>` performs a single internal cast at the
 * React boundary instead of requiring consumers to cast at every callback.
 */
export interface ColumnDefinition<T = DataRow> {
  /** Unique key matching data property names */
  key: string;
  /** Display header text */
  header: string;
  /** Data type for rendering/editing (default: 'text'). Unknown types fall back to 'text'. */
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
  renderer?: CellRenderer<T>;
  /** Whether the column is editable (default: true — follows global editable setting) */
  editable?: boolean;
  /** Custom cell editor — overrides built-in type editing */
  editor?: CellEditor<T>;
  /** Pin the column to one side during horizontal scroll */
  pinned?: 'left' | 'right';
  /** Cell validator — called before committing edits */
  validator?: CellValidator<T>;
  /** Allowed values for select columns (strings or label/value pairs) */
  options?: string[] | SelectOption[];
  /**
   * Autocomplete for text editing.
   * - true: show suggestions from existing column values
   * - 'strict': same as true, but rejects values not in the list
   */
  autocomplete?: boolean | 'strict';
  /**
   * Display format for cell values. Applied during rendering; raw value is preserved.
   * - String: number format pattern (e.g. '#,##0.00', '0.00%', '$#,##0') or date pattern (e.g. 'yyyy-MM-dd')
   * - Function: custom formatter receiving (value, row, col)
   */
  format?: string | ((value: unknown, row: T, col: ColumnDefinition<T>) => string);
  /** Per-column conditional formatting rules applied during cell rendering */
  conditionalRules?: ConditionalRule<T>[];
}

/** Style applied to a cell by a conditional formatting rule */
export interface CellStyle {
  background?: string;
  color?: string;
  fontWeight?: 'bold' | 'normal';
  fontStyle?: 'italic' | 'normal';
}

/** A single conditional formatting rule */
export interface ConditionalRule<T = DataRow> {
  /** Returns true when this rule's style should be applied */
  when: (value: unknown, row: T, col: ColumnDefinition<T>) => boolean;
  style: CellStyle;
}

/**
 * A single data row — schema-agnostic key-value map.
 */
export type DataRow = Record<string, unknown>;
