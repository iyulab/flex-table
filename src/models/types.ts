import type { TemplateResult } from 'lit';
import type { ColumnAggregate } from '../core/aggregate.js';

/**
 * Built-in column data types for rendering and editing.
 * Any string is accepted as a type — unknown types fall back to 'text' behavior.
 */
export type ColumnType = 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'select' | (string & {});

/** Logical horizontal alignment — `start`/`end` follow the writing direction. */
export type ColumnAlign = 'start' | 'center' | 'end';

/** The alignment a column's cells render with: `align`, or the default derived from `type`. */
export function effectiveAlign(col: { align?: ColumnAlign; type?: ColumnType }): ColumnAlign {
  if (col.align) return col.align;
  if (col.type === 'number') return 'end';
  if (col.type === 'boolean') return 'center';
  return 'start';
}

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
  /** Column header text */
  label: string;
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
  /**
   * Horizontal alignment of cell content. Logical values, so right-to-left locales mirror.
   * Default: derived from `type` — 'end' for 'number', 'center' for 'boolean', 'start' otherwise.
   */
  align?: ColumnAlign;
  /**
   * Horizontal alignment of the header label.
   * Default: the column's effective cell alignment (`align`, or the `type` default above), so a
   * right-aligned number column gets a right-aligned header. Set it only when the header should
   * differ from its values.
   */
  headerAlign?: ColumnAlign;
  /**
   * What the column's values mean — the basis a header label cannot carry («billed amount — by the
   * billing party's unit price»). Shown as an info icon beside the label with a tooltip, and passed to
   * assistive technology as the header's `aria-description`. The tooltip opens on pointer hover, on a
   * tap of the icon, and whenever the keyboard is on the header cell; Escape or leaving closes it.
   * Plain text. Not part of any export.
   */
  description?: string;
  /** Custom cell renderer — overrides built-in type rendering */
  render?: CellRenderer<T>;
  /**
   * Whether the column's cells can be edited (default: true — the table's `editable` still applies).
   * - `false`: no cell of the column is edited.
   * - Function: `(row, col) => boolean` — decides per row, for a column whose cells lock with the row's
   *   state (a shipped order's quantity, a total row): `editable: (row) => row.status !== 'shipped'`.
   *
   * A cell that is not editable opens no editor (double-click, Enter, F2, typing, Space on a checkbox),
   * takes no paste, fill, Delete or cut, and is `aria-readonly`. This answers «may the cell change»;
   * `validator` answers «is this value acceptable». Programmatic writes (`updateRows`, `data`) are not gated.
   */
  editable?: boolean | ((row: T, col: ColumnDefinition<T>) => boolean);
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
   * - String: spreadsheet number format code (e.g. '#,##0.00', '0.00%', '#,##0;[Red](#,##0)', '#,##0원') or date
   *   pattern (e.g. 'yyyy-MM-dd'). XLSX export writes the same code as the cell's number format.
   * - Function: custom formatter receiving (value, row, col)
   */
  format?: string | ((value: unknown, row: T, col: ColumnDefinition<T>) => string);
  /**
   * The value export writes for this column — CSV/TSV/JSON/XLSX. Without it export writes the raw value (as
   * `format`/`render` do not apply to export). Give it where the file should say what the list shows, e.g. a status
   * code shown as a label: `exportValue: (v) => statusLabel(v)`. A returned `Date` becomes a date cell in XLSX.
   */
  exportValue?: (value: unknown, row: T) => string | number | boolean | Date | null | undefined;
  /**
   * Other headers an imported file may give this column (`importFromFile`) — a template a person made says
   * «관리 번호» where the label is «관리번호». Matched like the label: exactly, then ignoring case and surrounding spaces.
   */
  importAliases?: string[];
  /**
   * Summarizes the rows the table shows — after filtering — in the footer row, written with the column's `format`:
   * `'sum'` · `'avg'` · `'count'` · `'min'` · `'max'`, or `(values, rows) => value`. A `footerData` entry for
   * the column wins. In `data-mode="server"` the table holds one page, so it does not compute these — give the
   * totals the server computed as `footerData`.
   */
  aggregate?: ColumnAggregate<T>;
  /** Per-column conditional formatting rules applied during cell rendering */
  conditionalRules?: ConditionalRule<T>[];
  /**
   * Draws a run of repeated values in this column as one merged cell — the value shows once, in
   * the first row of the run, and the lines between the run's rows are dropped. Every row keeps its
   * own value: sorting, filtering, copying, export and screen readers see each row as before.
   * - `true`: a row continues the run when its value equals the previous row's (empty values never merge).
   * - Function: `(row, previousRow, col) => boolean` — e.g. merge customer cells only within one
   *   order: `(row, prev) => row.orderId === prev.orderId`.
   * Rows are compared in display order (after sorting and filtering). The value is drawn again at
   * the top of the scrolled view and below frozen rows, so it never scrolls out of sight.
   */
  mergeRepeated?: boolean | ((row: T, previousRow: T, col: ColumnDefinition<T>) => boolean);
  /**
   * When the column's content shows.
   * - `'always'` (default)
   * - `'hover'`: only while the row is hovered, holds focus, or is selected — for a row-actions
   *   column (edit, a "more" menu), so a list does not repeat the same buttons on every row. The
   *   content stays in the DOM and keyboard focus reveals it; on touch screens (no hover) it is
   *   always shown, and it is not printed.
   */
  reveal?: 'always' | 'hover';
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
