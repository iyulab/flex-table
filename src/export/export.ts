import type { ColumnDefinition, DataRow } from '../models/types.js';
import { buildXlsx, buildXlsxDeflated } from './xlsx-writer.js';
import { exportCellValue, exportDate } from './values.js';

export type ExportFormat = 'csv' | 'tsv' | 'json' | 'xlsx';

/** Options for `exportData` / `exportDataBlob`. */
export interface ExportOptions {
  /**
   * CSV/TSV only — start the text with a UTF-8 byte order mark. Spreadsheet apps (Excel on a non-UTF-8 system
   * code page, e.g. Korean Windows) read a CSV without one in the system code page and garble non-ASCII text.
   * Leave it off for files another program loads. Default: `false`.
   */
  bom?: boolean;
}

const BOM = '\uFEFF';

/**
 * Export data to the specified format.
 * Returns string for text formats (csv/tsv/json) or Uint8Array for xlsx.
 */
export function exportData(
  data: DataRow[],
  columns: ColumnDefinition[],
  format: ExportFormat,
  options: ExportOptions = {}
): string | Uint8Array<ArrayBuffer> {
  const bom = options.bom ? BOM : '';
  switch (format) {
    case 'csv':
      return bom + exportDelimited(data, columns, ',');
    case 'tsv':
      return bom + exportDelimited(data, columns, '\t');
    case 'json':
      return exportJson(data, columns);
    case 'xlsx':
      return buildXlsx(data, columns);
  }
}

/**
 * Export data as a `Blob` of the format's MIME type. XLSX is DEFLATE-compressed (unlike `exportData`,
 * which stays synchronous and therefore stores the workbook uncompressed).
 */
export async function exportDataBlob(
  data: DataRow[],
  columns: ColumnDefinition[],
  format: ExportFormat,
  options: ExportOptions = {}
): Promise<Blob> {
  const content = format === 'xlsx' ? await buildXlsxDeflated(data, columns) : exportData(data, columns, format, options);
  return new Blob([content], { type: getExportMimeType(format) });
}

function formatValueForExport(value: unknown): string {
  if (value == null) return '';
  // 글자 형식은 `Date` 를 ISO 로 쓴다 — 날짜 열의 문자열은 이미 글자라 그대로 둔다.
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function exportDelimited(
  data: DataRow[],
  columns: ColumnDefinition[],
  delimiter: string
): string {
  const header = columns.map(col => escapeDelimited(col.label, delimiter)).join(delimiter);
  const rows = data.map(row =>
    columns.map(col => {
      const formatted = formatValueForExport(exportCellValue(row, col));
      return escapeDelimited(formatted, delimiter);
    }).join(delimiter)
  );
  return [header, ...rows].join('\n');
}

function escapeDelimited(value: string, delimiter: string): string {
  // Quote if value contains delimiter, quotes, or newlines
  if (value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function exportJson(data: DataRow[], columns: ColumnDefinition[]): string {
  const filtered = data.map(row => {
    const obj: DataRow = {};
    for (const col of columns) {
      const value = exportCellValue(row, col);
      obj[col.key] = value instanceof Date ? (exportDate(value, col)?.toISOString() ?? null) : (value ?? null);
    }
    return obj;
  });
  return JSON.stringify(filtered, null, 2);
}

/**
 * Trigger a file download in the browser.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

const MIME_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv;charset=utf-8',
  tsv: 'text/tab-separated-values;charset=utf-8',
  json: 'application/json;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const EXTENSIONS: Record<ExportFormat, string> = {
  csv: '.csv',
  tsv: '.tsv',
  json: '.json',
  xlsx: '.xlsx',
};

export function getExportMimeType(format: ExportFormat): string {
  return MIME_TYPES[format];
}

export function getExportExtension(format: ExportFormat): string {
  return EXTENSIONS[format];
}
