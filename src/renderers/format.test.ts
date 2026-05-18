import { describe, it, expect } from 'vitest';
import { applyFormat, formatNumberValue, formatDateValue } from './format.js';

describe('applyFormat', () => {
  it('returns empty string for null', () => {
    expect(applyFormat(null, '#,##0')).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(applyFormat(undefined, '#,##0')).toBe('');
  });

  it('delegates to function formatter', () => {
    expect(applyFormat(42, (v) => `val:${v}`)).toBe('val:42');
  });

  it('routes date patterns to date formatter', () => {
    const d = new Date(2026, 4, 18); // 2026-05-18
    expect(applyFormat(d, 'yyyy-MM-dd')).toBe('2026-05-18');
  });

  it('routes number patterns to number formatter', () => {
    expect(applyFormat(1234.5, '#,##0.00')).toContain('1');
  });
});

describe('formatNumberValue', () => {
  it('#,##0 formats integer with grouping', () => {
    const result = formatNumberValue(1234567, '#,##0');
    expect(result).toMatch(/1[,.]234[,.]567/);
  });

  it('#,##0.00 formats with 2 decimal places', () => {
    const result = formatNumberValue(1234.5, '#,##0.00');
    expect(result).toContain('1');
    // Should have 2 decimal places
    const numericPart = result.replace(/[^0-9.]/g, '');
    expect(numericPart).toMatch(/\.\d{2}$/);
  });

  it('0.00% formats as percentage', () => {
    const result = formatNumberValue(0.1235, '0.00%');
    expect(result).toContain('%');
    expect(result).toContain('12');
  });

  it('$#,##0.00 prepends currency symbol', () => {
    const result = formatNumberValue(1234.56, '$#,##0.00');
    expect(result.startsWith('$')).toBe(true);
  });

  it('returns string representation for non-numeric input', () => {
    expect(formatNumberValue('abc', '#,##0')).toBe('abc');
  });
});

describe('formatDateValue', () => {
  const d = new Date(2026, 4, 8, 14, 30, 5); // 2026-05-08 14:30:05

  it('yyyy-MM-dd formats date', () => {
    expect(formatDateValue(d, 'yyyy-MM-dd')).toBe('2026-05-08');
  });

  it('yyyy-MM-dd HH:mm formats date+time', () => {
    expect(formatDateValue(d, 'yyyy-MM-dd HH:mm')).toBe('2026-05-08 14:30');
  });

  it('accepts ISO string', () => {
    expect(formatDateValue('2026-05-08', 'yyyy/MM/dd')).toBe('2026/05/08');
  });

  it('returns original string for invalid date', () => {
    expect(formatDateValue('not-a-date', 'yyyy-MM-dd')).toBe('not-a-date');
  });
});
