import { describe, it, expect, beforeEach, vi } from 'vitest';
import './flex-table.js';
import type { FlexTable } from './flex-table.js';
import type { ColumnDefinition, DataRow } from './models/types.js';
import { mergeColumnViewState, snapshotViewState } from './core/view-state.js';

const columns: ColumnDefinition[] = [
  { key: 'name', label: 'Name', width: 180 },
  { key: 'qty', label: 'Qty', type: 'number' },
  { key: 'due', label: 'Due', type: 'date', pinned: 'right' },
  { key: 'ok', label: 'OK', type: 'boolean' },
];
const rows: DataRow[] = [
  { name: 'Alice', qty: 5, due: '2026-03-01', ok: true },
  { name: 'Bob', qty: 12, due: '2026-04-10', ok: false },
  { name: 'alina', qty: 20, due: '2026-03-20', ok: true },
];

async function make(): Promise<FlexTable> {
  const el = document.createElement('flex-table') as FlexTable;
  el.columns = columns;
  el.data = rows;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('view state (pure)', () => {
  it('snapshot reads a declared width, a resize over it, and leaves auto columns without a width', () => {
    const widths = new Map([['name', 240]]);
    const state = snapshotViewState(columns, widths, [{ key: 'qty', direction: 'desc' }], {});
    expect(state.columns.map(c => c.key)).toEqual(['name', 'qty', 'due', 'ok']);
    expect(state.columns[0]).toEqual({ key: 'name', width: 240, hidden: false, pinned: null });
    expect('width' in state.columns[1]).toBe(false);
    expect(state.columns[2].pinned).toBe('right');
  });

  it('merge puts named columns first in the state order, and unnamed ones follow in their own order', () => {
    const { columns: out } = mergeColumnViewState(columns, [
      { key: 'ok', hidden: false, pinned: null },
      { key: 'name', hidden: false, pinned: null },
    ]);
    expect(out.map(c => c.key)).toEqual(['ok', 'name', 'qty', 'due']);
  });

  it('★merge skips a key the table no longer has and a repeated one, and says so', () => {
    const { columns: out, skipped } = mergeColumnViewState(columns, [
      { key: 'gone', hidden: true, pinned: null },
      { key: 'qty', hidden: true, pinned: null },
      { key: 'qty', hidden: false, pinned: null },
      'junk',
    ]);
    expect(out.map(c => c.key)).toEqual(['qty', 'name', 'due', 'ok']);
    expect(out[0].hidden).toBe(true);
    expect(skipped).toHaveLength(3);
  });

  it('merge unpins on null, ignores an invalid width, and does not touch the input columns', () => {
    const { columns: out, widths } = mergeColumnViewState(columns, [
      { key: 'due', hidden: false, pinned: null, width: -5 },
      { key: 'name', hidden: false, pinned: 'left', width: 99 },
    ]);
    expect(out.find(c => c.key === 'due')!.pinned).toBeUndefined();
    expect(widths.has('due')).toBe(false);
    expect(widths.get('name')).toBe(99);
    expect(columns[2].pinned).toBe('right');
  });
});

describe('view state on the table', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('★getViewState → applyViewState round-trips through JSON onto a fresh table', async () => {
    const a = await make();
    a.moveColumn('ok', 0);
    a.hideColumn('qty');
    a.sortCriteria = [{ key: 'name', direction: 'desc' }];
    a.setFilter('name', { type: 'text', mode: 'contains', value: 'ali' });
    const saved = JSON.parse(JSON.stringify(a.getViewState()));

    document.body.innerHTML = '';
    const b = await make();
    b.applyViewState(saved);
    await b.updateComplete;
    expect(b.getViewState()).toEqual(saved);
    expect(b.columns.map(c => c.key)).toEqual(['ok', 'name', 'qty', 'due']);
    expect(b.getHiddenColumns().map(c => c.key)).toEqual(['qty']);
    expect(b.filteredRowCount).toBe(2);
    expect(b.sortCriteria).toEqual([{ key: 'name', direction: 'desc' }]);
  });

  it('applyViewState changes only the parts it is given', async () => {
    const el = await make();
    el.setFilter('name', { type: 'text', mode: 'contains', value: 'ali' });
    el.applyViewState({ sort: [{ key: 'qty', direction: 'asc' }] });
    expect(el.filteredRowCount).toBe(2);
    expect(el.sortCriteria).toEqual([{ key: 'qty', direction: 'asc' }]);
    expect(el.columns.map(c => c.key)).toEqual(['name', 'qty', 'due', 'ok']);
  });

  it('applyViewState drops a sort on an unknown column and an invalid direction, and re-sorts the rows', async () => {
    const el = await make();
    el.applyViewState({ sort: [
      { key: 'nope', direction: 'asc' },
      { key: 'qty', direction: 'sideways' as never },
      { key: 'qty', direction: 'desc' },
    ] });
    expect(el.sortCriteria).toEqual([{ key: 'qty', direction: 'desc' }]);
  });

  it('applyViewState is quiet: no view-state-change, no filter-change, no sort-change', async () => {
    const el = await make();
    const seen: string[] = [];
    for (const n of ['view-state-change', 'filter-change', 'sort-change', 'column-reorder'])
      el.addEventListener(n, () => seen.push(n));
    el.applyViewState({
      columns: [{ key: 'ok', hidden: false, pinned: null }],
      sort: [{ key: 'qty', direction: 'asc' }],
      filters: { name: { type: 'text', mode: 'contains', value: 'a' } },
    });
    expect(seen).toEqual([]);
  });

  it('a stored width wins over a declared one, and the state reports it back', async () => {
    const el = await make();
    el.applyViewState({ columns: [{ key: 'name', width: 300, hidden: false, pinned: null }] });
    expect(el.getColumnWidth('name')).toBe(300);
    expect(el.getViewState().columns.find(c => c.key === 'name')!.width).toBe(300);
  });

  it('warns once per column it cannot place', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = await make();
    el.applyViewState({ columns: [{ key: 'gone', hidden: false, pinned: null }] });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('★view-state-change fires for each act with the reason and the whole state', async () => {
    const el = await make();
    const seen: Array<{ reason: string; state: ReturnType<FlexTable['getViewState']> }> = [];
    el.addEventListener('view-state-change', (e) => seen.push((e as CustomEvent).detail));
    el.moveColumn('ok', 0);
    el.hideColumn('qty');
    el.showColumn('qty');
    el.setFilter('name', { type: 'text', mode: 'contains', value: 'a' });
    expect(seen.map(s => s.reason)).toEqual(['column-order', 'column-visibility', 'column-visibility', 'filter']);
    expect(seen[0].state.columns[0].key).toBe('ok');
    expect(seen[1].state.columns.find(c => c.key === 'qty')!.hidden).toBe(true);
    expect(seen[3].state.filters).toEqual({ name: { type: 'text', mode: 'contains', value: 'a' } });
  });

  it('undoing a reorder also reports the view, so a saved view does not go stale', async () => {
    const el = await make();
    el.moveColumn('ok', 0);
    const seen: string[][] = [];
    el.addEventListener('view-state-change', (e) => seen.push((e as CustomEvent).detail.state.columns.map((c: { key: string }) => c.key)));
    el.undo();
    expect(seen).toEqual([['name', 'qty', 'due', 'ok']]);
  });
});
