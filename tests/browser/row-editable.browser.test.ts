import { describe, it, expect, afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';
import type { DataRow } from '../../src/models/types.js';

/**
 * Whether a cell may change, decided per row — `editable: (row, col) => boolean`.
 *
 * A column whose cells lock with the row's state (a shipped order's quantity) had only the
 * column-wide `editable` flag, so a consumer left it editable and rejected the value in `validator`:
 * the editor opened on a locked cell and the edit was refused only on commit. A cell that may not
 * change now opens no editor and takes no write from any editing path — and the column-wide
 * `editable: false` gets the same guarantee, which paste, Delete, cut, fill and replace did not give.
 */

let table: FlexTable;
afterEach(() => table?.remove());

const LOCKED = new Set([1, 3]);
const unlocked = (row: DataRow) => !row.locked;

async function mount(bEditable: boolean | ((row: DataRow) => boolean) = unlocked) {
  table = document.createElement('flex-table') as FlexTable;
  table.style.display = 'block';
  table.style.width = '600px';
  table.style.height = '320px';
  document.body.appendChild(table);
  table.editable = true;
  table.columns = [
    { key: 'a', label: 'A', width: 120 },
    { key: 'b', label: 'B', width: 120, editable: bEditable },
    { key: 'c', label: 'C', width: 120 },
  ];
  table.data = Array.from({ length: 6 }, (_, r) => ({ a: `a${r}`, b: `b${r}`, c: `c${r}`, locked: LOCKED.has(r) }));
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
}

const cell = (row: number, col: number) =>
  table.shadowRoot!.querySelector<HTMLElement>(
    `.ft-row[aria-rowindex="${row + 2}"] .ft-cell[aria-colindex="${col + 1}"]`,
  )!;

const settle = async () => {
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 30));
};

const press = async (keys: string) => {
  await userEvent.keyboard(keys);
  await settle();
};

const at = async (row: number, col: number) => {
  await userEvent.click(cell(row, col));
  await settle();
};

const editor = () => table.shadowRoot!.querySelector('.ft-editor');
const columnB = () => table.data.slice(0, 4).map((r) => r.b);

/** Selects rows 0–3 of column b. */
async function selectB() {
  await at(0, 1);
  await press('{Shift>}{ArrowDown}{ArrowDown}{ArrowDown}{/Shift}');
}

describe('flex-table — a locked row opens no editor', () => {
  it('double-click, F2, typing and Space leave a locked cell closed; an open row still edits', async () => {
    await mount();
    await userEvent.dblClick(cell(1, 1));
    await settle();
    expect(editor(), 'double-click on a locked cell').toBeNull();
    await press('{F2}');
    expect(editor(), 'F2 on a locked cell').toBeNull();
    await press('x');
    expect(editor(), 'typing on a locked cell').toBeNull();
    await press(' ');
    expect(editor(), 'Space on a locked cell').toBeNull();
    expect(table.data[1].b).toBe('b1');

    await at(2, 1);
    await press('{F2}');
    expect(editor(), 'F2 on an open row').not.toBeNull();
  });

  it('Enter on a locked cell activates the row, as on any read-only cell', async () => {
    await mount();
    const seen: string[] = [];
    table.addEventListener('row-activate', (e) => seen.push((e as CustomEvent).detail.via));
    await at(1, 1);
    seen.length = 0; // the click that made the cell active is a pointer activation of its own
    await press('{Enter}');
    expect(editor()).toBeNull();
    expect(seen).toEqual(['keyboard']);
  });

  it('a locked cell is aria-readonly; the same column in an open row is not', async () => {
    await mount();
    expect(cell(1, 1).getAttribute('aria-readonly')).toBe('true');
    expect(cell(0, 1).hasAttribute('aria-readonly')).toBe(false);
  });

  it('the decision follows the row — unlocking it opens the cell', async () => {
    await mount();
    table.data[1].locked = false;
    table.data = [...table.data];
    await settle();
    expect(cell(1, 1).hasAttribute('aria-readonly')).toBe(false);
    await at(1, 1);
    await press('{F2}');
    expect(editor()).not.toBeNull();
  });
});

describe('flex-table — a locked cell takes no write from a block edit', () => {
  it('Delete clears the open rows of the block and leaves the locked ones', async () => {
    await mount();
    await selectB();
    await press('{Delete}');
    expect(columnB()).toEqual(['', 'b1', '', 'b3']);
  });

  it('paste writes the open cells and skips the locked ones', async () => {
    await mount();
    await at(0, 0);
    await press('{Shift>}{ArrowDown}{ArrowDown}{ArrowDown}{/Shift}');
    await press('{Control>}c{/Control}');
    await at(0, 1);
    await press('{Control>}v{/Control}');
    expect(columnB()).toEqual(['a0', 'b1', 'a2', 'b3']);
  });

  it('Ctrl+D fills the open rows only', async () => {
    await mount();
    await selectB();
    await press('{Control>}d{/Control}');
    expect(columnB()).toEqual(['b0', 'b1', 'b0', 'b3']);
  });

  it('cut copies the whole block and clears only the open cells', async () => {
    await mount();
    await selectB();
    await press('{Control>}x{/Control}');
    await new Promise((r) => setTimeout(r, 60));
    expect(columnB()).toEqual(['', 'b1', '', 'b3']);
  });

  it('replace all replaces the matching open cells and leaves the locked ones', async () => {
    await mount();
    await at(0, 0);
    await press('{Control>}h{/Control}');
    const find = table.shadowRoot!.querySelector<HTMLInputElement>('.ft-find-input')!;
    const replace = table.shadowRoot!.querySelector<HTMLInputElement>('.ft-find-replace-input')!;
    await userEvent.fill(find, 'b');
    await userEvent.fill(replace, 'Z');
    await settle();
    // The replace row's last button is «replace all» (its label follows the locale).
    const all = replace.parentElement!.querySelector<HTMLButtonElement>('button:last-of-type')!;
    await userEvent.click(all);
    await settle();
    expect(columnB()).toEqual(['Z', 'b1', 'Z', 'b3']); // replace writes the whole cell
  });
});

describe('flex-table — a column-wide editable: false holds against every editing path', () => {
  it('Delete and paste leave a read-only column alone', async () => {
    await mount(false);
    await selectB();
    await press('{Delete}');
    expect(columnB()).toEqual(['b0', 'b1', 'b2', 'b3']);
    await at(0, 0);
    await press('{Control>}c{/Control}');
    await at(0, 1);
    await press('{Control>}v{/Control}');
    expect(table.data[0].b).toBe('b0');
  });
});
