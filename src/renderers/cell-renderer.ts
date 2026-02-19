import { html } from 'lit';
import type { ColumnDefinition, DataRow } from '../models/types.js';

/**
 * Render a cell value using the column's custom renderer or built-in type rendering.
 */
export function renderCell(value: unknown, row: DataRow, col: ColumnDefinition) {
  if (col.renderer) {
    return col.renderer(value, row, col);
  }
  return formatValue(value, col);
}

/**
 * Format a value based on column type.
 */
function formatValue(value: unknown, col: ColumnDefinition): unknown {
  if (value == null) return '';

  switch (col.type) {
    case 'number':
      return formatNumber(value);
    case 'boolean':
      return html`<span class="ft-bool">${value ? '\u2714' : ''}</span>`;
    case 'date':
      return formatDate(value);
    case 'datetime':
      return formatDateTime(value);
    default:
      return String(value);
  }
}

function formatNumber(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { minimumFractionDigits: 1 });
  }
  return String(value);
}

function formatDate(value: unknown): string {
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleDateString();
  }
  return String(value);
}

function formatDateTime(value: unknown): string {
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleString();
  }
  return String(value);
}
