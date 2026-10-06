import { describe, it, expect, afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';
import { axActive, axFirst } from './ax.js';

/**
 * What a screen reader receives as the keyboard moves — read from Chromium's accessibility tree
 * (`./ax.ts`), not from the DOM. The keyboard suite asserts that the focus sits on the cell; this
 * asserts that the browser exposes that cell, by role and by its text, as the current node.
 * Before roving focus (0.50.1) the host held the focus and the current node was the grid itself —
 * arrows moved a class and nothing was announced.
 */

let table: FlexTable;
afterEach(() => table?.remove());

async function mount() {
  table = document.createElement('flex-table') as FlexTable;
  table.style.display = 'block';
  table.style.width = '700px';
  table.style.height = '360px';
  table.setAttribute('aria-label', 'Orders');
  document.body.appendChild(table);
  table.columns = ['a', 'b', 'c'].map((key) => ({ key, label: key.toUpperCase(), width: 120 }));
  table.data = Array.from({ length: 5 }, (_, r) => ({ a: `a${r}`, b: `b${r}`, c: `c${r}` }));
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
}

const cell = (row: number, col: number) =>
  table.shadowRoot!.querySelector<HTMLElement>(`.ft-row[aria-rowindex="${row + 2}"] .ft-cell[aria-colindex="${col + 1}"]`)!;

const press = async (keys: string) => {
  await userEvent.keyboard(keys);
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 40));
};

describe('flex-table — accessibility tree', () => {
  it('the grid is exposed with its name', async () => {
    await mount();
    expect(await axFirst('grid')).toMatchObject({ role: 'grid', name: 'Orders' });
  });

  it('the current node follows the arrows: body cell → body cell → column header', async () => {
    await mount();
    await userEvent.click(cell(1, 0));
    await press('{ArrowRight}');
    expect(await axActive()).toMatchObject({ role: 'gridcell', name: 'b1', props: { focused: true, selected: true } });
    await press('{ArrowDown}');
    expect(await axActive()).toMatchObject({ role: 'gridcell', name: 'b2' });
    await press('{Control>}{Home}{/Control}{ArrowUp}');
    expect(await axActive()).toMatchObject({ role: 'columnheader', name: expect.stringContaining('A') });
  });

  it('NEGATIVE with nothing focused there is no current node', async () => {
    await mount();
    (document.activeElement as HTMLElement | null)?.blur();
    expect(await axActive()).toBeNull();
  });
});
