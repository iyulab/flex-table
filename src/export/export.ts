import type { ColumnDefinition, DataRow } from '../models/types.js';

export type ExportFormat = 'csv' | 'tsv' | 'json';

/**
 * Export data to the specified format.
 */
export function exportData(
  data: DataRow[],
  columns: ColumnDefinition[],
  format: ExportFormat
): string {
  switch (format) {
    case 'csv':
      return exportDelimited(data, columns, ',');
    case 'tsv':
      return exportDelimited(data, columns, '\t');
    case 'json':
      return exportJson(data, columns);
  }
}

function exportDelimited(
  data: DataRow[],
  columns: ColumnDefinition[],
  delimiter: string
): string {
  const header = columns.map(col => escapeDelimited(col.header, delimiter)).join(delimiter);
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      if (value == null) return '';
      return escapeDelimited(String(value), delimiter);
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
  const keys = columns.map(col => col.key);
  const filtered = data.map(row => {
    const obj: DataRow = {};
    for (const key of keys) {
      obj[key] = row[key] ?? null;
    }
    return obj;
  });
  return JSON.stringify(filtered, null, 2);
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
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
};

const EXTENSIONS: Record<ExportFormat, string> = {
  csv: '.csv',
  tsv: '.tsv',
  json: '.json',
};

export function getExportMimeType(format: ExportFormat): string {
  return MIME_TYPES[format];
}

export function getExportExtension(format: ExportFormat): string {
  return EXTENSIONS[format];
}
