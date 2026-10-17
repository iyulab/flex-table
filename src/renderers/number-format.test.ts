import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Locale } from '@iyulab/components/dist/utilities/Locale.js';
import { formatWithCode, isDateFormat } from './number-format.js';
import { applyFormat, formatPattern } from './format.js';
import { renderCell } from './cell-renderer.js';

// 기대값은 같은 서식 코드를 Excel(en-US 로캘)이 보이는 글자다.
describe('spreadsheet number format codes', () => {
  let prev: string;
  beforeEach(() => {
    prev = Locale.get();
    Locale.set('en');
  });
  afterEach(() => {
    Locale.set(prev as Parameters<typeof Locale.set>[0]);
  });

  const text = (v: unknown, code: string) => formatWithCode(v, code)?.text;

  it('keeps a trailing unit literal', () => {
    expect(text(1234, '#,##0원')).toBe('1,234원');
    expect(text(1234, '#,##0" 원"')).toBe('1,234 원');
  });

  it('puts the minus sign before a currency prefix in a single section', () => {
    expect(text(-1234, '₩#,##0')).toBe('-₩1,234');
    expect(text(-1234, '#,##0')).toBe('-1,234');
  });

  it('uses the negative section with the absolute value', () => {
    expect(text(-1234, '#,##0;(#,##0)')).toBe('(1,234)');
    expect(text(1234, '#,##0;(#,##0)')).toBe('1,234');
    expect(text(-1234.5, '#,##0.00;-#,##0.00')).toBe('-1,234.50');
  });

  it('uses the zero section', () => {
    expect(text(0, '#,##0;(#,##0);"-"')).toBe('-');
    expect(text(0, '#,##0;(#,##0);\\-')).toBe('-');
  });

  it('reads a color as a tone and does not mistake [Red] for a date', () => {
    expect(isDateFormat('#,##0;[Red](#,##0)')).toBe(false);
    expect(formatWithCode(1234, '#,##0;[Red](#,##0)')).toEqual({ text: '1,234', tone: undefined });
    expect(formatWithCode(-1234, '#,##0;[Red](#,##0)')).toEqual({ text: '(1,234)', tone: 'danger' });
    expect(formatWithCode(-1234.5, '#,##0.00;[Red]-#,##0.00')).toEqual({ text: '-1,234.50', tone: 'danger' });
  });

  it('scales by trailing commas', () => {
    expect(text(123456789, '#,##0,,"백만"')).toBe('123백만');
    expect(text(1234567, '#,##0,')).toBe('1,235');
  });

  it('formats percent, padding zeros and optional digits', () => {
    expect(text(0.1235, '0.00%')).toBe('12.35%');
    expect(text(5, '000')).toBe('005');
    expect(text(0.5, '#.##')).toBe('.5');
    expect(text(0.5, '0.0#')).toBe('0.5');
    expect(text(1.234, '0.0#')).toBe('1.23');
  });

  it('reads [$sym-locale] as the symbol and _x as an alignment space', () => {
    expect(text(1234, '[$₩-412]#,##0')).toBe('₩1,234');
    expect(text(1234, '#,##0_);(#,##0)')).toBe('1,234 ');
  });

  it('uses the text section for non-numeric values', () => {
    expect(text('n/a', '#,##0;-#,##0;0;"["@"]"')).toBe('[n/a]');
    expect(text('n/a', '#,##0')).toBe('n/a');
  });

  it('does not write a minus for a negative that rounds to zero', () => {
    expect(text(-0.4, '#,##0')).toBe('0');
  });

  it('returns null for syntax it does not support', () => {
    expect(formatWithCode(5, '[>100]#,##0;0')).toBeNull();
    expect(formatWithCode(5, '0.00E+00')).toBeNull();
    expect(formatWithCode(5, '# ?/?')).toBeNull();
  });

  it('shows an unsupported format unformatted and says so once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(applyFormat(5, '0.0E+00')).toBe('5');
    expect(applyFormat(6, '0.0E+00')).toBe('6');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/^\[@iyulab\/flex-table\]/);
    warn.mockRestore();
  });

  it('applyFormat routes a colored number format to numbers, not dates', () => {
    expect(applyFormat(1234, '#,##0;[Red](#,##0)')).toBe('1,234');
    expect(applyFormat(1234, '#,##0원')).toBe('1,234원');
  });

  it('a cell paints a section color as a theme tone, and plain sections stay text', () => {
    const col = { key: 'amt', label: 'Amt', type: 'number' as const, format: '#,##0;[Red](#,##0)' };
    const neg = renderCell(-1234, {}, col) as { values?: unknown[] };
    expect(neg.values).toEqual(['danger', '(1,234)']);
    expect(renderCell(1234, {}, col)).toBe('1,234');
  });

  it('still routes date patterns to the date formatter', () => {
    expect(isDateFormat('yyyy-MM-dd')).toBe(true);
    expect(formatPattern(new Date(2026, 4, 18), 'yyyy-MM-dd')).toEqual({ text: '2026-05-18' });
  });
});
