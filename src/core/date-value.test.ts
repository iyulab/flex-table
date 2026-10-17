import { describe, it, expect, afterEach } from 'vitest';
import '../flex-table.js';
import { readCellDate } from './date-value.js';
import { filterModelPredicate } from './filter-model.js';
import { computeSortedIndices } from './sorting.js';
import { formatDateValue } from '../renderers/format.js';

/**
 * 날짜 셀은 표시 경로(`@iyulab/components` `formatDate` · `readDateValue`)와 같은 읽기로 정렬 · 거르기 · 서식된다.
 * `new Date('2026-10-02')` 는 UTC 자정이라, 같은 날의 오프셋 없는 시각과 섞이면 순서가 오프셋만큼 틀리고(양의 오프셋에서
 * 날짜만 값이 그 날 아침 뒤로 간다), 날짜 필터의 하한이 그 날 로컬 새벽 값을 버리고, `HH` 서식이 자정 대신 오프셋 시각을 낸다.
 * ⚠원 결함의 크기는 실행 머신의 시간대에 달렸다 — 아래 «옛 읽기에서 실패» 는 양의 오프셋(이 리포 개발 머신 +09)에서 판별한다.
 */
afterEach(() => document.body.replaceChildren());

describe('readCellDate', () => {
  it('a plain date is local midnight', () => {
    expect(readCellDate('2026-10-02')!.getTime()).toBe(new Date(2026, 9, 2).getTime());
  });

  it('a plain date-time is its wall clock · an instant is that moment · a Date is itself · a number is epoch time', () => {
    expect(readCellDate('2026-10-02T14:05')!.getTime()).toBe(new Date(2026, 9, 2, 14, 5).getTime());
    expect(readCellDate('2026-10-02T00:00:00Z')!.getTime()).toBe(Date.UTC(2026, 9, 2));
    const d = new Date(2026, 0, 1);
    expect(readCellDate(d)).toBe(d);
    expect(readCellDate(Date.UTC(2026, 0, 1))!.getTime()).toBe(Date.UTC(2026, 0, 1));
  });

  it('⚪NEGATIVE — ISO-shaped text that names no real day is null, not a rolled-over date', () => {
    expect(readCellDate('2026-02-30')).toBeNull();
    expect(readCellDate('2026-10-02T24:30')).toBeNull();
  });

  it('⚪NEGATIVE — other text still goes to the platform parser; nonsense is null', () => {
    expect(readCellDate('Oct 2, 2026')!.getDate()).toBe(2);
    expect(readCellDate('soon')).toBeNull();
    expect(readCellDate(null)).toBeNull();
  });
});

describe('the paths that read a date cell', () => {
  it('sorting — a plain date sorts before a time later that day', () => {
    const data = [{ at: '2026-10-02T03:00' }, { at: '2026-10-02' }];
    const order = computeSortedIndices(data, [{ key: 'at', direction: 'asc' }], [{ key: 'at', label: 'At', type: 'datetime' }]);
    expect(order).toEqual([1, 0]);
  });

  it('format pattern — a plain date is shown at midnight, on its own day', () => {
    expect(formatDateValue('2026-10-02', 'yyyy-MM-dd HH:mm')).toBe('2026-10-02 00:00');
  });

  it('⚪NEGATIVE — format pattern keeps a day that does not exist as its text', () => {
    expect(formatDateValue('2026-02-30', 'yyyy-MM-dd')).toBe('2026-02-30');
  });

  it('date filter — the lower bound is the local start of the day, so an early-morning value on it passes', () => {
    const onTheDay = filterModelPredicate({ type: 'date', from: '2026-10-02', to: '2026-10-02' });
    const row = {};
    expect(onTheDay('2026-10-02T05:00', row)).toBe(true);
    expect(onTheDay('2026-10-02T23:59', row)).toBe(true);
    expect(onTheDay('2026-10-01T23:59', row)).toBe(false);
    expect(onTheDay('2026-10-03T00:00', row)).toBe(false);
  });
});
