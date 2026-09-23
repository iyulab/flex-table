import { describe, it, expect, afterEach } from 'vitest';
import { Locale } from '@iyulab/components/dist/utilities/Locale.js';
import { renderCell } from '../../src/renderers/cell-renderer.js';
import { applyFormat } from '../../src/renderers/format.js';
import type { ColumnDefinition } from '../../src/models/types.js';

/**
 * 셀 **값** 의 기본 포맷이 앱이 정한 로캘(`Locale`)을 따르는가 — 런타임 기본 로캘이 아니라.
 *
 * 결함(docket `#414`): 표의 chrome 문구는 `Locale` 을 탔지만 값 포매터는 `toLocaleString()` 을
 * 로캘 없이 불렀다. `Locale.set('ko')` 한 앱을 영어 브라우저로 열면 같은 표의 메뉴는 한국어,
 * 날짜는 `9/9/2026, 8:16:01 AM` 이었다.
 *
 * ⚠**앱 로캘과 브라우저 로캘을 «다르게» 둬야 이 결함이 보인다** — 둘이 같으면 종전 코드도
 * 초록이다. 그래서 대상 로캘을 브라우저 언어와 다른 쪽으로 고른다.
 */
const browserLang = navigator.language.toLowerCase();
const TARGET = browserLang.startsWith('de') ? 'ko' : 'de';
const col = (type: string): ColumnDefinition => ({ key: 'v', type } as ColumnDefinition);
const FIELDS: Intl.DateTimeFormatOptions = {
  year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
};

describe('flex-table 셀 값 — 앱 로캘을 따른다', () => {
  afterEach(() => { Locale.set('en'); });

  it('전제: 대상 로캘이 브라우저 로캘과 다르다(같으면 이 파일은 아무것도 재지 않는다)', () => {
    expect(browserLang.startsWith(TARGET)).toBe(false);
  });

  it('🔴datetime', () => {
    Locale.set(TARGET);
    const d = new Date(2026, 8, 9, 8, 16, 1);
    expect(renderCell(d, {}, col('datetime'))).toBe(new Intl.DateTimeFormat(TARGET, FIELDS).format(d));
  });

  it('🔴date — "YYYY-MM-DD" 는 로컬 날짜로 읽는다', () => {
    Locale.set(TARGET);
    expect(renderCell('2026-09-09', {}, col('date'))).toBe(new Intl.DateTimeFormat(TARGET).format(new Date(2026, 8, 9)));
  });

  it('🔴number — 정수와 소수', () => {
    Locale.set(TARGET);
    expect(renderCell(1234567, {}, col('number'))).toBe(new Intl.NumberFormat(TARGET).format(1234567));
    expect(renderCell(1234.5, {}, col('number'))).toBe(new Intl.NumberFormat(TARGET, { minimumFractionDigits: 1 }).format(1234.5));
  });

  it('🔴숫자 패턴(format="#,##0.00")도 같은 로캘', () => {
    Locale.set(TARGET);
    expect(applyFormat(1234.5, '#,##0.00')).toBe(
      new Intl.NumberFormat(TARGET, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }).format(1234.5),
    );
  });

  it('NEGATIVE: 날짜가 아닌 문자열은 그대로 나온다', () => {
    Locale.set(TARGET);
    expect(renderCell('not a date', {}, col('date'))).toBe('not a date');
    expect(renderCell('not a date', {}, col('datetime'))).toBe('not a date');
  });
});
