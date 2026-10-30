import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Locale } from '@iyulab/components/dist/utilities/Locale.js';
import { applyFormat, formatPattern, isDateFormat } from './format.js';
import { renderCell } from './cell-renderer.js';

// 숫자 서식 코드의 문법은 components 의 `applyNumberFormat` 이 정본이고 그 회귀는 거기 있다.
// 여기는 표가 그것을 어떻게 쓰는가 — 날짜와의 갈림 · 미지원 코드 · 칸의 톤.
describe('cell number format codes (shared engine)', () => {
  let prev: string;
  beforeEach(() => {
    prev = Locale.get();
    Locale.set('en');
  });
  afterEach(() => {
    Locale.set(prev as Parameters<typeof Locale.set>[0]);
  });

  it('formats a cell with a format code, keeping units and section colors', () => {
    expect(formatPattern(1234, '#,##0원')).toEqual({ text: '1,234원' });
    expect(formatPattern(-1234, '#,##0;[Red](#,##0)')).toEqual({ text: '(1,234)', tone: 'danger' });
  });

  it('does not mistake a colored number format for a date', () => {
    expect(isDateFormat('#,##0;[Red](#,##0)')).toBe(false);
    expect(applyFormat(1234, '#,##0;[Red](#,##0)')).toBe('1,234');
  });

  it('shows an unsupported format unformatted and says so once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(applyFormat(5, '0.0E+00')).toBe('5');
    expect(applyFormat(6, '0.0E+00')).toBe('6');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/^\[@iyulab\/flex-table\]/);
    warn.mockRestore();
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
