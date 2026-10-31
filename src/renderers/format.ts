/**
 * Cell value formatting: number and date patterns.
 * Patterns follow Excel-like conventions.
 */

import { readCellDate } from '../core/date-value.js';
// 숫자 서식 코드는 components 의 정본 하나가 읽는다 — 표 · 시트 · 위젯이 같은 어휘를 쓴다.
import { applyNumberFormat, type FormattedNumber } from '@iyulab/components/dist/utilities/numberFormat.js';

export type { FormattedNumber, FormatTone } from '@iyulab/components/dist/utilities/numberFormat.js';

/** Whether `code` is a date/time pattern: date letters outside quotes and brackets, no digit placeholders. */
export function isDateFormat(code: string): boolean {
  const bare = code
    .replace(/"[^"]*"/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\\./g, '');
  return /[yMdHhs]/.test(bare) && !/[0#?]/.test(bare);
}

/**
 * Apply a format string or function to a cell value.
 * Returns empty string for null/undefined.
 */
export function applyFormat(
  value: unknown,
  format: string | ((value: unknown) => string)
): string {
  if (value == null) return '';
  if (typeof format === 'function') {
    return format(value);
  }
  return formatPattern(value, format).text;
}

/**
 * Apply a string pattern, keeping the section color as a tone the cell paints with theme colors.
 * A date pattern has no tone.
 */
export function formatPattern(value: unknown, format: string): FormattedNumber {
  if (value == null) return { text: '' };
  if (isDateFormat(format)) return { text: formatDateValue(value, format) };
  return formatNumberPattern(value, format);
}

// ---------------------------------------------------------------------------
// Number format
// ---------------------------------------------------------------------------

const warned = new Set<string>();

function formatNumberPattern(value: unknown, fmt: string): FormattedNumber {
  const result = applyNumberFormat(value, fmt);
  if (result) return result;
  if (!warned.has(fmt)) {
    warned.add(fmt);
    // eslint-disable-next-line no-console -- the column's format is wrong; say which one, once
    console.warn(`[@iyulab/flex-table] number format "${fmt}" uses syntax the table does not support (conditions, [Color N], scientific, fractions, or more than 21 integer / 100 fraction digits) — showing values unformatted.`);
  }
  return { text: String(value) };
}

/**
 * Apply a spreadsheet number format code (syntax: `applyNumberFormat` in `@iyulab/components`).
 * Non-numeric values use the fourth (text) section when there is one, otherwise show as is.
 */
export function formatNumberValue(value: unknown, fmt: string): string {
  return formatNumberPattern(value, fmt).text;
}

// ---------------------------------------------------------------------------
// Date format
// ---------------------------------------------------------------------------

/**
 * Format a Date or ISO string value using a pattern.
 * Tokens: yyyy, yy, MM, dd, HH, hh, mm, ss
 */
export function formatDateValue(value: unknown, fmt: string): string {
  let d: Date;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    // 표시 경로와 같은 읽기 — `YYYY-MM-DD` 는 그 날 로컬 자정, 없는 날은 글자 그대로.
    const read = readCellDate(value);
    if (!read) return String(value);
    d = read;
  } else {
    return String(value);
  }
  if (isNaN(d.getTime())) return String(value);

  const yyyy = String(d.getFullYear());
  const yy = yyyy.slice(-2);
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const hh = String(d.getHours() % 12 || 12).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  // Replace longest tokens first to avoid partial replacement
  return fmt
    .replace('yyyy', yyyy)
    .replace('yy', yy)
    .replace('MM', MM)
    .replace('dd', dd)
    .replace('HH', HH)
    .replace('hh', hh)
    .replace('mm', mm)
    .replace('ss', ss);
}
