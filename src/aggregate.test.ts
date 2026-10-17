import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Locale } from '@iyulab/components/dist/utilities/Locale.js';
import './flex-table.js';
import type { FlexTable } from './flex-table.js';
import type { ColumnDefinition, DataRow } from './models/types.js';
import { computeAggregate } from './core/aggregate.js';

describe('computeAggregate', () => {
  it('sum · avg · min · max read numbers and numeric strings, skip empty cells', () => {
    const v = [100, '-40', null, '', 7, 'x'];
    expect(computeAggregate('sum', v, [])).toBe(67);
    expect(computeAggregate('avg', v, [])).toBeCloseTo(67 / 3);
    expect(computeAggregate('min', v, [])).toBe(-40);
    expect(computeAggregate('max', v, [])).toBe(100);
  });

  it('count counts non-empty cells; nothing to average is undefined; sum of nothing is 0', () => {
    expect(computeAggregate('count', ['a', '', null, 0, undefined], [])).toBe(2);
    expect(computeAggregate('avg', [], [])).toBeUndefined();
    expect(computeAggregate('max', ['', null], [])).toBeUndefined();
    expect(computeAggregate('sum', [], [])).toBe(0);
  });

  it('a function gets the values and the rows', () => {
    const rows = [{ a: 1 }, { a: 2 }];
    expect(computeAggregate((values, r) => `${values.length}/${r.length}`, [1, 2], rows)).toBe('2/2');
  });
});

describe('footer aggregates on the table', () => {
  const columns: ColumnDefinition[] = [
    { key: 'acct', label: 'Acct' },
    { key: 'amt', label: 'Amt', type: 'number', format: '#,##0;(#,##0)', aggregate: 'sum' },
    { key: 'n', label: 'N', type: 'date', aggregate: 'count' },
  ];
  let rows: DataRow[];

  beforeEach(() => {
    document.body.innerHTML = '';
    Locale.set('en');
    rows = [
      { acct: 'A', amt: 100, n: '2026-01-01' },
      { acct: 'B', amt: -40, n: '2026-01-02' },
      { acct: 'A', amt: 7, n: null },
    ];
  });

  async function make(extra: Partial<FlexTable> = {}): Promise<FlexTable> {
    const el = document.createElement('flex-table') as FlexTable;
    el.columns = columns;
    el.data = rows;
    Object.assign(el, extra);
    document.body.appendChild(el);
    await el.updateComplete;
    return el;
  }

  const footer = (el: FlexTable) =>
    [...el.shadowRoot!.querySelectorAll('.ft-footer .ft-footer-cell[role=gridcell]')].map((c) => c.textContent!.trim());

  it('🔴sums the shown rows in the column format and follows the filter', async () => {
    const el = await make();
    expect(footer(el)).toEqual(['', '67', '2']);
    el.setFilter('acct', { type: 'equals', value: 'A' });
    await el.updateComplete;
    expect(footer(el)).toEqual(['', '107', '1']);
    el.setFilter('acct', { type: 'equals', value: 'B' });
    await el.updateComplete;
    expect(footer(el)).toEqual(['', '(40)', '1']);
  });

  it('🔴follows an edit', async () => {
    const el = await make();
    el.updateRows([{ row: 0, key: 'amt', value: 1000 }]);
    await el.updateComplete;
    expect(footer(el)[1]).toBe('967');
  });

  it('a footerData entry wins over the aggregate; other columns keep theirs', async () => {
    const el = await make({ footerData: { acct: 'Total', amt: 'n/a' } });
    expect(footer(el)).toEqual(['Total', 'n/a', '2']);
  });

  it('🔴a number in footerData is written with the column format — a server total reads like the cells', async () => {
    const el = await make({ dataMode: 'server', footerData: { acct: 'Total', amt: -123456 } });
    expect(footer(el)).toEqual(['Total', '(123,456)', '']);
  });

  it('⚪NEGATIVE — server mode computes nothing (the table holds one page)', async () => {
    const el = await make({ dataMode: 'server' });
    expect(el.shadowRoot!.querySelector('.ft-footer')).toBeNull();
    expect(el.getAttribute('aria-rowcount')).toBe('4');
  });

  it('the footer counts as a grid row', async () => {
    const el = await make();
    expect(el.getAttribute('aria-rowcount')).toBe('5');
  });

  it('a throwing aggregate function leaves its cell empty and warns; the table still renders', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = document.createElement('flex-table') as FlexTable;
    el.columns = [
      { key: 'acct', label: 'Acct', aggregate: () => { throw new Error('boom'); } },
      { key: 'amt', label: 'Amt', type: 'number', aggregate: 'sum' },
    ];
    el.data = rows;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(footer(el)).toEqual(['', '67']);
    expect(String(warn.mock.calls[0]?.[0])).toContain('[@iyulab/flex-table]');
    warn.mockRestore();
  });

  it('getFilteredRows returns the shown rows in view order', async () => {
    const el = await make();
    el.setFilter('acct', { type: 'equals', value: 'A' });
    el.sortCriteria = [{ key: 'amt', direction: 'asc' }];
    await el.updateComplete;
    expect(el.getFilteredRows()).toEqual([rows[2], rows[0]]);
  });
});
