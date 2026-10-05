import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import { Locale } from '@iyulab/components/dist/utilities/Locale.js';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * The date and datetime cell editor is `u-date-picker` — a text box that reads what the text editor
 * read, plus a calendar. What this measures needs a real browser: focus moving inside the picker's
 * shadow tree and its calendar must not end the edit, and keys pressed in the calendar belong to it.
 * The stored value keeps the editor's old contract: `YYYY-MM-DD`, and a local `YYYY-MM-DDTHH:mm`.
 */
let table: FlexTable;
const errors: string[] = [];

beforeEach(() => {
  Locale.set('en');
  errors.length = 0;
});
afterEach(() => table?.remove());

async function editing(type: 'date' | 'datetime', value: string) {
  table = document.createElement('flex-table') as FlexTable;
  table.style.display = 'block';
  table.style.width = '500px';
  table.style.height = '300px';
  document.body.appendChild(table);
  table.editable = true;
  table.columns = [{ key: 'd', label: 'D', type, editable: true, width: 220 }];
  table.data = [{ d: value }, { d: null }];
  table.addEventListener('validation-error', (e) => errors.push((e as CustomEvent).detail.error));
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = table as any;
  any._selection.setActive(0, 0);
  any._syncActiveCell();
  any._startEdit();
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 50));
  const picker = () => table.shadowRoot!.querySelector('u-date-picker.ft-editor') as (HTMLElement & { value?: string; updateComplete: Promise<unknown> }) | null;
  expect(picker(), 'precondition: editing').not.toBeNull();
  const text = () => picker()!.shadowRoot!.querySelector<HTMLInputElement>('[part~="input"]')!;
  return { picker, text };
}

/** The calendar grid is `u-calendar`'s own shadow tree, inside the picker's. */
const calendar = (p: HTMLElement) => p.shadowRoot!.querySelector('u-calendar')!.shadowRoot!;

const settle = async () => {
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 80));
};

describe('flex-table — date editor is u-date-picker', () => {
  it('shows the cell value in the text box, focused and selected', async () => {
    const { text } = await editing('date', '2026-10-02');
    expect(text().value).toBe('2026-10-02');
    expect(table.shadowRoot!.activeElement?.localName).toBe('u-date-picker');
    expect(text().selectionEnd! - text().selectionStart!).toBe(10);
  });

  it('reads a typed short form on Enter, stores YYYY-MM-DD and moves down', async () => {
    const { picker, text } = await editing('date', '2026-10-02');
    await userEvent.fill(text(), '20261231');
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(picker()).toBeNull();
    expect(table.data[0].d).toBe('2026-12-31');
    expect(table.activeCell).toEqual({ row: 1, col: 0 });
  });

  it('rejects text that is not a date, keeps the value and says why', async () => {
    const { text } = await editing('date', '2026-10-02');
    await userEvent.fill(text(), '2026-02-30');
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(table.data[0].d).toBe('2026-10-02');
    expect(errors).toEqual(['Enter a date as YYYY-MM-DD']);
  });

  it('a day picked in the calendar is the value — and clicking the calendar does not end the edit first', async () => {
    const { picker, text } = await editing('date', '2026-10-02');
    await userEvent.click(text());
    await settle();
    const p = picker()!;
    // A non-focusable spot in the calendar: focus must stay with the editor.
    await userEvent.click(calendar(p).querySelector<HTMLElement>('[part~="calendar-title"]')!);
    await settle();
    expect(picker(), 'still editing after a click on the calendar title').not.toBeNull();
    const day15 = calendar(p).querySelector<HTMLElement>('[data-iso="2026-10-15"]')!;
    await userEvent.click(day15);
    await settle();
    expect(picker()).toBeNull();
    expect(table.data[0].d).toBe('2026-10-15');
  });

  it('Escape closes an open calendar first; the next Escape cancels the edit', async () => {
    const { picker, text } = await editing('date', '2026-10-02');
    await userEvent.click(text());
    await settle();
    expect(picker()!.matches(':state(open)'), 'precondition: calendar open').toBe(true);
    await userEvent.keyboard('{Escape}');
    await settle();
    expect(picker(), 'the first Escape closed only the calendar').not.toBeNull();
    expect(picker()!.matches(':state(open)')).toBe(false);
    await userEvent.keyboard('{Escape}');
    await settle();
    expect(picker()).toBeNull();
    expect(table.data[0].d).toBe('2026-10-02');
  });
});

describe('flex-table — datetime editor', () => {
  it('shows YYYY-MM-DD HH:mm and stores a typed date and time as local YYYY-MM-DDTHH:mm', async () => {
    const { text } = await editing('datetime', '2026-10-02T14:05');
    expect(text().value).toBe('2026-10-02 14:05');
    await userEvent.fill(text(), '2026-12-31 9:30');
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(table.data[0].d).toBe('2026-12-31T09:30');
    expect(errors).toEqual([]);
  });

  it('rejects an impossible time and keeps the value', async () => {
    const { text } = await editing('datetime', '2026-10-02T14:05');
    await userEvent.fill(text(), '2026-12-31 25:00');
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(table.data[0].d).toBe('2026-10-02T14:05');
    expect(errors).toEqual(['Enter a date and time as YYYY-MM-DD HH:mm']);
  });

  it('a day picked in the calendar waits for Apply, then keeps the time', async () => {
    const { picker, text } = await editing('datetime', '2026-10-02T14:05');
    await userEvent.click(text());
    await settle();
    const p = picker()!;
    const day15 = calendar(p).querySelector<HTMLElement>('[data-iso="2026-10-15"]')!;
    await userEvent.click(day15);
    await settle();
    expect(picker(), 'picking the day alone does not end the edit').not.toBeNull();
    const apply = [...p.shadowRoot!.querySelectorAll<HTMLElement>('[part~="calendar-footer"] u-button, [part~="calendar-footer"] button')].find((b) => /apply/i.test(b.textContent ?? ''))!;
    expect(apply, 'precondition: Apply button').toBeTruthy();
    await userEvent.click(apply);
    await settle();
    expect(picker()).toBeNull();
    expect(table.data[0].d).toBe('2026-10-15T14:05');
  });
});
