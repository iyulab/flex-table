import { describe, it, expect, beforeEach, vi } from 'vitest';
import './flex-table.js';
import type { FlexTable } from './flex-table.js';
import type { ColumnDefinition, DataRow } from './models/types.js';

const columns: ColumnDefinition[] = [
  { key: 'name', label: 'Name' },
  { key: 'qty', label: 'Qty', type: 'number' },
  { key: 'due', label: 'Due', type: 'date' },
  { key: 'ok', label: 'OK', type: 'boolean' },
];
const rows: DataRow[] = [
  { name: 'Alice', qty: 5, due: '2026-03-01', ok: true },
  { name: 'Bob', qty: 12, due: '2026-04-10', ok: false },
  { name: 'alina', qty: 20, due: '2026-03-20', ok: true },
  { name: '', qty: 1, due: null, ok: false },
];

async function make(): Promise<FlexTable> {
  const el = document.createElement('flex-table') as FlexTable;
  el.columns = columns;
  el.data = rows;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('filter models on the table', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('setFilter(model) filters like the popover and shows up in `filters`', async () => {
    const el = await make();
    el.setFilter('name', { type: 'text', mode: 'contains', value: 'ali' });
    expect(el.filteredRowCount).toBe(2);
    expect(el.filters).toEqual({ name: { type: 'text', mode: 'contains', value: 'ali' } });
  });

  it('★filter-change carries the models and names the keys that have none', async () => {
    const el = await make();
    const seen: Array<{ filters: unknown; unmodeled: string[]; keys: string[] }> = [];
    el.addEventListener('filter-change', (e) => seen.push((e as CustomEvent).detail));
    el.setFilter('qty', { type: 'number', conditions: [{ op: 'gt', value: 4 }] });
    el.setFilter('ok', (v) => v === true);
    const last = seen[seen.length - 1];
    expect(last.keys.sort()).toEqual(['ok', 'qty']);
    expect(last.filters).toEqual({ qty: { type: 'number', conditions: [{ op: 'gt', value: 4 }] } });
    expect(last.unmodeled).toEqual(['ok']);
  });

  it('a bare predicate still filters but has no model', async () => {
    const el = await make();
    el.setFilter('name', (v) => v === 'Bob');
    expect(el.filteredRowCount).toBe(1);
    expect(el.filters).toEqual({});
    expect(el.filterKeys).toEqual(['name']);
  });

  it('★`filters = …` replaces the model filters quietly, keeps the predicate-only ones, and round-trips', async () => {
    const el = await make();
    el.setFilter('qty', { type: 'number', conditions: [{ op: 'gte', value: 12 }] });
    el.setFilter('ok', (v) => v === true);
    const saved = el.filters;
    const listener = vi.fn();
    el.addEventListener('filter-change', listener);

    el.filters = { name: { type: 'text', mode: 'starts', value: 'a' } };
    expect(listener).not.toHaveBeenCalled(); // quiet, like `data`
    expect(el.filters).toEqual({ name: { type: 'text', mode: 'starts', value: 'a' } });
    expect(el.filterKeys.sort()).toEqual(['name', 'ok']); // the predicate stayed
    expect(el.filteredRowCount).toBe(2); // Alice and alina: start with «a» and pass the kept predicate (ok === true)

    el.filters = saved; // what was saved comes back as it was
    expect(el.filters).toEqual(saved);
    expect(el.filteredRowCount).toBe(1); // only alina: qty ≥ 12 and ok
  });

  it('a model set programmatically is what the popover shows, and clearing it from the popover clears the model', async () => {
    const el = await make();
    el.filters = { qty: { type: 'number', conditions: [{ op: 'gt', value: 1 }, { op: 'lt', value: 15 }], join: 'and' } };
    expect(el.filteredRowCount).toBe(2); // 5 and 12
    const priv = el as unknown as { _filterPopover: { numberState: Map<string, { cond1: { op: string; value: number | null }; join: string; cond2: { op: string; value: number | null } }> } };
    const state = priv._filterPopover.numberState.get('qty')!;
    expect(state.cond1).toMatchObject({ op: 'gt', value: 1 });
    expect(state.cond2).toMatchObject({ op: 'lt', value: 15 });
    expect(state.join).toBe('and');
    el.removeFilter('qty');
    expect(el.filters).toEqual({});
    expect(el.filteredRowCount).toBe(4);
  });

  it('NEGATIVE — a model that filters nothing removes the filter instead of installing one', async () => {
    const el = await make();
    el.setFilter('name', { type: 'text', mode: 'contains', value: 'ali' });
    el.setFilter('name', { type: 'text', mode: 'contains', value: '' });
    expect(el.filterKeys).toEqual([]);
    expect(el.filteredRowCount).toBe(4);
  });

  it('NEGATIVE — a stale stored model is skipped with a warning, the valid ones still apply', async () => {
    const el = await make();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    el.filters = {
      name: { type: 'regex', value: 'a' } as never,
      qty: { type: 'number', conditions: [{ op: 'gt', value: 4 }] },
    };
    expect(Object.keys(el.filters)).toEqual(['qty']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('[@iyulab/flex-table]');
    warn.mockRestore();
  });

  it('boolean and equals models filter the table', async () => {
    const el = await make();
    el.setFilter('ok', { type: 'boolean', value: false });
    expect(el.filteredRowCount).toBe(2);
    el.setFilter('name', { type: 'equals', value: 'Bob' });
    expect(el.filteredRowCount).toBe(1);
  });
});
