import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import { Locale } from '@iyulab/components/dist/utilities/Locale.js';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * The date column filter's from/to bounds are `u-date-picker`s — the cell editor's control. The native
 * date inputs they replace show the browser's UI language (`10/02/2026` in an English browser) while
 * the table shows ISO. Two pickers, not one range picker: either bound may stay open.
 */
type Picker = HTMLElement & { value: string; mode: string; label: string; min?: string; max?: string };

let table: FlexTable;

beforeEach(() => Locale.set('en'));
afterEach(() => table?.remove());

async function filtering(type: 'date' | 'datetime', rows: unknown[]) {
  table = document.createElement('flex-table') as FlexTable;
  table.style.display = 'block';
  table.style.width = '500px';
  table.style.height = '300px';
  document.body.appendChild(table);
  table.showFilters = true;
  table.columns = [{ key: 'd', label: 'D', type, width: 220 }];
  table.data = rows.map((d) => ({ d }));
  await table.updateComplete;
  table.shadowRoot!.querySelector<HTMLElement>('.ft-column-menu-btn')!.click();
  await table.updateComplete;
  table.shadowRoot!.querySelector<HTMLElement>('.ft-header-menu [data-action="filter"]')!.click();
  await settle();
}

const pickers = () => [...table.shadowRoot!.querySelectorAll<Picker>('.ft-filter-dropdown u-date-picker')];
const text = (p: Picker) => p.shadowRoot!.querySelector<HTMLInputElement>('[part~="input"]')!;
const dropdownOpen = () => table.shadowRoot!.querySelector('.ft-filter-dropdown') !== null;

const settle = async () => {
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 80));
};

describe('flex-table — date filter bounds are u-date-picker', () => {
  it('renders two labelled pickers (From, To) in the column mode, and focuses the first', async () => {
    await filtering('datetime', ['2026-10-02T09:00']);
    const [from, to] = pickers();
    expect([from.mode, to.mode]).toEqual(['datetime', 'datetime']);
    expect([from.label, to.label]).toEqual(['From', 'To']);
    expect(table.shadowRoot!.querySelector('.ft-filter-dropdown input[type="datetime-local"]')).toBeNull();
    expect(table.shadowRoot!.activeElement).toBe(from);
  });

  it('a typed bound filters on Enter — each bound alone, then both, the end day inclusive', async () => {
    await filtering('date', ['2026-01-10', '2026-01-20', '2026-01-31', '2026-02-05']);
    const [from, to] = pickers();

    await userEvent.fill(text(from), '2026-01-15');
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(table.filteredRowCount).toBe(3);

    await userEvent.fill(text(to), '20260131');
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(to.value).toBe('2026-01-31');
    expect(table.filteredRowCount).toBe(2);
    expect(dropdownOpen(), 'typing in a bound keeps the filter open').toBe(true);
  });

  it('shows ISO in the text box whatever the browser language', async () => {
    await filtering('date', ['2026-10-02']);
    const [from] = pickers();
    await userEvent.fill(text(from), '10-02');
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(text(from).value).toMatch(/^\d{4}-10-02$/);
  });

  it('bounds each calendar at the other bound', async () => {
    await filtering('datetime', ['2026-10-02T09:00']);
    const [from, to] = pickers();
    await userEvent.fill(text(from), '2026-10-01 08:00');
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(pickers()[1].min).toBe('2026-10-01');
    await userEvent.fill(text(to), '2026-10-20 18:00');
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(pickers()[0].max).toBe('2026-10-20');
    expect(table.filteredRowCount).toBe(1);
  });

  it('Escape with a calendar open closes the calendar, not the filter; the next Escape closes the filter', async () => {
    await filtering('date', ['2026-10-02']);
    const [from] = pickers();
    text(from).click();
    await settle();
    expect(from.matches(':state(open)'), 'precondition: calendar open').toBe(true);
    await userEvent.keyboard('{Escape}');
    await settle();
    expect(from.matches(':state(open)')).toBe(false);
    expect(dropdownOpen()).toBe(true);
    await userEvent.keyboard('{Escape}');
    await settle();
    expect(dropdownOpen()).toBe(false);
  });

  it('picking a day in the calendar applies the bound and keeps the filter open', async () => {
    await filtering('date', ['2026-10-02', '2026-10-20']);
    const [from] = pickers();
    from.value = '2026-10-01';
    await settle();
    text(from).click();
    await settle();
    const grid = from.shadowRoot!.querySelector('u-calendar')!.shadowRoot!;
    const day15 = [...grid.querySelectorAll<HTMLElement>('[data-iso]')].find((c) => c.dataset.iso === '2026-10-15');
    expect(day15, 'precondition: day cell').toBeTruthy();
    await userEvent.click(day15!);
    await settle();
    expect(from.value).toBe('2026-10-15');
    expect(table.filteredRowCount).toBe(1);
    expect(dropdownOpen()).toBe(true);
  });

  it('NEGATIVE an open bound sets no limit on the other calendar, and clearing a bound drops it', async () => {
    await filtering('date', ['2026-01-10', '2026-02-05']);
    const [from, to] = pickers();
    expect(from.max).toBeFalsy();
    expect(to.min).toBeFalsy();
    await userEvent.fill(text(from), '2026-02-01');
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(table.filteredRowCount).toBe(1);
    await userEvent.fill(text(from), '');
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(table.filteredRowCount).toBe(2);
  });
});
