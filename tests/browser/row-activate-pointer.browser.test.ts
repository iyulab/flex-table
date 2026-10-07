import { describe, it, expect, afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import { html } from 'lit';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * «Open this row» from a read-only list — the pointer half of `row-activate`.
 *
 * The grid gave Enter a row-activation contract and the pointer none: a click only moved the active
 * cell (`cell-select`), and a double click asked for an edit a read-only table never starts. A list
 * page that opens a row's detail on click therefore listened to `cell-select` — which is focus, and
 * also fires when the keyboard arrives on the grid, so a single Tab into the table opened the first
 * row's detail (WCAG 3.2.1 On Focus). The keyboard user could open nothing else and could not Tab
 * past the table.
 *
 * Real input throughout: `userEvent` clicks and Tab, the button before the grid focused first.
 */

let table: FlexTable;
let before: HTMLButtonElement;
afterEach(() => { table?.remove(); before?.remove(); });

async function mount() {
  before = document.createElement('button');
  before.textContent = 'Before';
  document.body.appendChild(before);
  table = document.createElement('flex-table') as FlexTable;
  table.style.display = 'block';
  table.style.width = '600px';
  table.style.height = '300px';
  document.body.appendChild(table);
  table.editable = false;
  table.columns = [
    { key: 'name', label: 'Name', width: 200 },
    { key: 'act', label: 'Action', width: 200, render: () => html`<button class="del">Delete</button>` },
  ];
  table.data = [{ _id: 'c', name: 'Carol' }, { _id: 'a', name: 'Alice' }, { _id: 'b', name: 'Bob' }];
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
}

const cell = (row: number, col: number) =>
  table.shadowRoot!.querySelector<HTMLElement>(
    `.ft-row[aria-rowindex="${row + 2}"] .ft-cell[aria-colindex="${col + 1}"]`,
  )!;

function record() {
  const activated: Array<{ id: string; via: string }> = [];
  const selected: Array<{ id: string } | null> = [];
  table.addEventListener('row-activate', (e) => activated.push({ id: e.detail.id, via: e.detail.via }));
  table.addEventListener('cell-select', (e) => selected.push(e.detail));
  return { activated, selected };
}

describe('row-activate by pointer — a read-only list opens rows on click', () => {
  it('a click on a row opens that row', async () => {
    await mount();
    const { activated } = record();
    await userEvent.click(cell(1, 0));
    expect(activated).toEqual([{ id: 'a', via: 'click' }]);
  });

  it('Tab into the grid moves focus only — no row opens; Enter then opens the focused row', async () => {
    await mount();
    const { activated, selected } = record();
    before.focus();
    await userEvent.tab();
    await table.updateComplete;
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.at(-1)?.id).toBe('c');
    expect(activated).toEqual([]);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(activated).toEqual([{ id: 'a', via: 'keyboard' }]);
  });

  it('NEGATIVE: the Delete button a cell renders is that button’s click', async () => {
    await mount();
    const { activated } = record();
    let deleted = 0;
    table.shadowRoot!.querySelectorAll<HTMLElement>('.del')[2].addEventListener('click', () => deleted++);
    await userEvent.click(table.shadowRoot!.querySelectorAll<HTMLElement>('.del')[2]);
    expect(deleted).toBe(1);
    expect(activated).toEqual([]);
  });

  it('NEGATIVE: Shift-click extends the selection and opens nothing', async () => {
    await mount();
    await userEvent.click(cell(0, 0));
    const { activated } = record();
    await userEvent.keyboard('{Shift>}');
    await userEvent.click(cell(2, 0));
    await userEvent.keyboard('{/Shift}');
    expect(activated).toEqual([]);
  });
});
