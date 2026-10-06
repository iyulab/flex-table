import { describe, it, expect, afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * flex-table keyboard contract — the README's «Keyboard Shortcuts» table, key by key.
 *
 * Most rows of that table had no test that pressed the key: cell navigation, extending the
 * range, F2 and typing to edit, Escape clearing the selection, Delete, Ctrl+Shift+Z and
 * Alt+ArrowLeft were all unmeasured. A sibling grid documented an Enter behaviour its code never
 * had, so a documented key is only a promise once something presses it.
 *
 * Keys go through `userEvent.keyboard` (trusted input) after a real click on a cell; results are
 * read from the public surface — `activeCell`, `data`, the rendered selection, `column-resize`.
 */

let table: FlexTable;
afterEach(() => table?.remove());

async function mount(editable = true) {
  table = document.createElement('flex-table') as FlexTable;
  table.style.display = 'block';
  table.style.width = '700px';
  table.style.height = '360px';
  document.body.appendChild(table);
  table.editable = editable;
  table.columns = ['a', 'b', 'c', 'd'].map((key) => ({ key, label: key.toUpperCase(), width: 120, editable }));
  table.data = Array.from({ length: 8 }, (_, r) => ({ a: `a${r}`, b: `b${r}`, c: `c${r}`, d: `d${r}` }));
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
  return table;
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

const active = () => [table.activeCell?.row, table.activeCell?.col];
const selectedCount = () => table.shadowRoot!.querySelectorAll('.ft-cell.ft-selected').length;
const editor = () => table.shadowRoot!.querySelector<HTMLInputElement>('input.ft-editor');

describe('flex-table keyboard — navigation', () => {
  it('arrow keys move the active cell', async () => {
    await mount();
    await at(3, 1);
    await press('{ArrowUp}{ArrowLeft}');
    expect(active()).toEqual([2, 0]);
    await press('{ArrowDown}{ArrowRight}{ArrowRight}');
    expect(active()).toEqual([3, 2]);
  });

  it('Tab / Shift+Tab move to the next / previous cell', async () => {
    await mount();
    await at(1, 1);
    await press('{Tab}');
    expect(active()).toEqual([1, 2]);
    await press('{Shift>}{Tab}{/Shift}{Shift>}{Tab}{/Shift}');
    expect(active()).toEqual([1, 0]);
  });

  it('Home / End jump to the row ends, Ctrl+Home / Ctrl+End to the table ends', async () => {
    await mount();
    await at(4, 1);
    await press('{End}');
    expect(active()).toEqual([4, 3]);
    await press('{Home}');
    expect(active()).toEqual([4, 0]);
    await press('{Control>}{End}{/Control}');
    expect(active()).toEqual([7, 3]);
    await press('{Control>}{Home}{/Control}');
    expect(active()).toEqual([0, 0]);
  });

  it('Shift+Arrow extends the selection range; Escape clears it', async () => {
    await mount();
    await at(2, 1);
    await press('{Shift>}{ArrowRight}{ArrowDown}{/Shift}');
    expect(selectedCount(), 'a 2×2 range').toBe(4);
    await press('{Escape}');
    expect(selectedCount()).toBe(0);
    expect(table.activeCell).toBeNull();
  });
});

describe('flex-table keyboard — editing', () => {
  it('F2 starts editing; Escape cancels without changing the value', async () => {
    await mount();
    await at(1, 1);
    await press('{F2}');
    expect(editor()).not.toBeNull();
    await userEvent.keyboard('zzz');
    await press('{Escape}');
    expect(editor()).toBeNull();
    expect(table.data[1].b).toBe('b1');
  });

  it('typing a character starts editing with that character; Enter commits', async () => {
    await mount();
    await at(1, 1);
    await userEvent.keyboard('Q');
    await settle();
    expect(editor()?.value).toBe('Q');
    await press('{Enter}');
    expect(table.data[1].b).toBe('Q');
  });

  it('Delete clears the selected cells; Ctrl+Z undoes; Ctrl+Shift+Z redoes', async () => {
    await mount();
    await at(2, 1);
    await press('{Shift>}{ArrowRight}{/Shift}{Delete}');
    expect([table.data[2].b, table.data[2].c]).toEqual(['', '']);
    await press('{Control>}z{/Control}');
    expect([table.data[2].b, table.data[2].c]).toEqual(['b2', 'c2']);
    await press('{Control>}{Shift>}z{/Shift}{/Control}');
    expect([table.data[2].b, table.data[2].c]).toEqual(['', '']);
  });

  it('a read-only table ignores Delete', async () => {
    await mount(false);
    await at(2, 1);
    await press('{Delete}');
    expect(table.data[2].b).toBe('b2');
  });
});

describe('flex-table keyboard — row selection', () => {
  const selectable = async () => {
    await mount();
    table.selectable = true;
    await settle();
  };

  it('Shift+Space selects the active cell’s row and toggles it back; Space alone still types', async () => {
    await selectable();
    await at(2, 1);
    await press('{Shift>} {/Shift}');
    expect(table.getSelectedRows().selectedIndices).toEqual([2]);
    expect(editor()).toBeNull();
    await press('{Shift>} {/Shift}');
    expect(table.getSelectedRows().selectedIndices).toEqual([]);
    await press(' ');
    expect(editor(), 'Space starts editing an editable cell, as before').not.toBeNull();
  });

  it('the row checkboxes are named and are not Tab stops — Shift+Tab into the grid lands on the grid', async () => {
    await selectable();
    const boxes = [...table.shadowRoot!.querySelectorAll<HTMLInputElement>('.ft-checkbox-cell input, .ft-checkbox-header input')];
    expect(boxes.length).toBeGreaterThan(2);
    expect(boxes.every((b) => b.tabIndex === -1)).toBe(true);
    expect(boxes.every((b) => (b.getAttribute('aria-label') ?? '') !== '')).toBe(true);

    // Forward Tab is the grid's own key (next cell), so the exposed path is Shift+Tab from what follows the
    // table: sequential focus walks back into the shadow tree and lands on the last tabbable control in it.
    const after = document.createElement('button');
    table.after(after);
    after.focus();
    await press('{Shift>}{Tab}{/Shift}');
    const inner = table.shadowRoot!.activeElement as HTMLElement | null;
    after.remove();
    expect(document.activeElement).toBe(table);
    expect(inner?.localName ?? 'host', 'Shift+Tab lands on the grid, not on a row checkbox').not.toBe('input');
  });
});

describe('flex-table keyboard — column width', () => {
  it('Alt+ArrowRight widens and Alt+ArrowLeft narrows the current column by 20px', async () => {
    await mount();
    const widths: number[] = [];
    table.addEventListener('column-resize', (e) => widths.push((e as CustomEvent).detail.width));
    await at(0, 1);
    await press('{Alt>}{ArrowRight}{/Alt}');
    await press('{Alt>}{ArrowLeft}{/Alt}{Alt>}{ArrowLeft}{/Alt}');
    expect(widths).toEqual([140, 120, 100]);
  });
});

describe('flex-table keyboard — header and column menu', () => {
  const header = (col: number) =>
    table.shadowRoot!.querySelector<HTMLElement>(`.ft-header-cell[data-col-index="${col}"]`)!;
  const menuButton = (col: number) => header(col).querySelector<HTMLElement>('.ft-column-menu-btn')!;
  const focusedAction = () => table.shadowRoot!.activeElement?.getAttribute('data-action');
  const menuOpen = () => !!table.shadowRoot!.querySelector('.ft-header-menu');

  it('Ctrl+Click on a header selects the whole column', async () => {
    await mount();
    await userEvent.click(header(2), { modifiers: ['Control'] });
    await settle();
    expect(selectedCount(), 'every row of column C').toBe(8);
    const cells = Array.from(table.shadowRoot!.querySelectorAll('.ft-cell.ft-selected'));
    expect(cells.every((c) => c.getAttribute('aria-colindex') === '3')).toBe(true);
  });

  it('Space on a column menu button opens the menu; Home / End move to the first / last item; Escape returns to the button', async () => {
    await mount();
    table.showFilters = true;
    await settle();
    menuButton(1).focus();
    await press(' ');
    expect(menuOpen()).toBe(true);
    const items = Array.from(table.shadowRoot!.querySelectorAll<HTMLElement>('.ft-header-menu [data-action]'));
    await press('{End}');
    expect(focusedAction()).toBe(items[items.length - 1].getAttribute('data-action'));
    await press('{Home}');
    expect(focusedAction()).toBe(items[0].getAttribute('data-action'));
    await press('{Escape}');
    expect(menuOpen()).toBe(false);
    expect(table.shadowRoot!.activeElement).toBe(menuButton(1));
  });
});

describe('flex-table keyboard — keys on header controls are theirs', () => {
  const menuButton = (col: number) =>
    table.shadowRoot!.querySelector<HTMLElement>(`.ft-header-cell[data-col-index="${col}"] .ft-column-menu-btn`)!;
  const menuOpen = () => !!table.shadowRoot!.querySelector('.ft-header-menu');
  const editorOpen = () => !!table.shadowRoot!.querySelector('input.ft-editor');

  for (const key of ['{Enter}', ' ']) {
    it(`${key === ' ' ? 'Space' : 'Enter'} on a column menu button opens the menu even with an active cell — it does not edit the cell`, async () => {
      await mount();
      table.showFilters = true;
      await settle();
      await at(1, 1);
      menuButton(2).focus();
      await press(key);
      expect(editorOpen()).toBe(false);
      expect(menuOpen()).toBe(true);
    });
  }
});
