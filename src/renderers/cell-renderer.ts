import { html } from 'lit';
import type { ColumnDefinition, DataRow } from '../models/types.js';
import { applyFormat } from './format.js';
// 서브패스 — 배럴은 커스텀 엘리먼트 등록 46개를 부수효과로 끌어온다(locale.ts 참조).
import { formatDate as formatLocaleDate, formatNumber as formatLocaleNumber } from '@iyulab/components/dist/utilities/format.js';

/**
 * Render a cell value using the column's custom renderer or built-in type rendering.
 */
export function renderCell(value: unknown, row: DataRow, col: ColumnDefinition) {
  if (col.renderer) {
    return col.renderer(value, row, col);
  }
  if (col.format) {
    const formatted = typeof col.format === 'function'
      ? col.format(value, row, col)
      : applyFormat(value, col.format);
    return formatted;
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
    case 'select':
      return formatSelectLabel(value, col);
    default:
      return String(value);
  }
}

function formatSelectLabel(value: unknown, col: ColumnDefinition): string {
  if (!col.options || col.options.length === 0) return value == null ? '' : String(value);
  if (typeof col.options[0] === 'string') return value == null ? '' : String(value);
  const opts = col.options as { label: string; value: unknown }[];
  const match = opts.find(o => o.value === value);
  return match ? match.label : (value == null ? '' : String(value));
}

/*
 * 셀 값의 기본 포맷은 `@iyulab/components` 의 포매터를 쓴다 — 로캘은 `Locale.get()`.
 *
 * 종전에는 `toLocaleString()` 류를 로캘 없이 불러 **런타임 기본 로캘**을 따랐다. 그래서 앱이
 * `Locale.set('ko')` 로 언어를 정해도 영어 브라우저에서는 같은 표의 메뉴는 한국어, 값은 영어
 * 형식(`9/9/2026, 8:16:01 AM`)이었다. 메뉴 문구가 이미 `Locale` 을 타므로 값도 같은 출처를 탄다.
 * 덤으로 `"YYYY-MM-DD"` 는 **로컬 자정**으로 읽힌다 — `new Date(str)` 은 그것을 UTC 자정으로
 * 읽어, 음수 오프셋 시간대에서 하루 전 날짜를 보여 줬다.
 */
const DATE_TIME_FIELDS: Intl.DateTimeFormatOptions = {
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric',
};

function formatNumber(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? formatLocaleNumber(value) : formatLocaleNumber(value, { minimumFractionDigits: 1 });
  }
  return String(value);
}

function formatDate(value: unknown): string {
  if (value instanceof Date || typeof value === 'string') return formatLocaleDate(value);
  return String(value);
}

function formatDateTime(value: unknown): string {
  if (value instanceof Date || typeof value === 'string') return formatLocaleDate(value, DATE_TIME_FIELDS);
  return String(value);
}
