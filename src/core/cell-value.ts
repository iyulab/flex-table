import type { DataRow } from '../models/types.js';

/**
 * A column's value in a row. `key` is a property name, or a dot path into nested objects — `'Customer.Name'` reads
 * `row.Customer.Name` (an OData `$expand`, a joined record). A row that has a property by the whole name (`'a.b'`,
 * `'@odata.etag'`) gives that property: the path is only read when the name is not there. Every place the table reads
 * a cell — display, format, sort, filter, copy, export — goes through this, so they agree.
 */
export function getCellValue(row: DataRow | null | undefined, key: string): unknown {
  if (row == null) return undefined;
  if (key in row || !key.includes('.')) return row[key];
  let cur: unknown = row;
  for (const part of key.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/**
 * Writes a column's value — the inverse of {@link getCellValue}: the property by the whole name when the row has it
 * (or the key has no dot), otherwise the path, creating the objects along it that are missing.
 */
export function setCellValue(row: DataRow, key: string, value: unknown): void {
  if (key in row || !key.includes('.')) {
    row[key] = value;
    return;
  }
  const parts = key.split('.');
  let cur = row as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) {
    const next = cur[part];
    if (next == null || typeof next !== 'object') cur[part] = {};
    cur = cur[part] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}
