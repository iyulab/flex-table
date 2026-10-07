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
    expect(table.getSelectedRows().map((r) => table.data.indexOf(r))).toEqual([2]);
    expect(editor()).toBeNull();
    await press('{Shift>} {/Shift}');
    expect(table.getSelectedRows().map((r) => table.data.indexOf(r))).toEqual([]);
    await press(' ');
    expect(editor(), 'Space starts editing an editable cell, as before').not.toBeNull();
  });

  it('the row checkboxes are named and are not Tab stops — Shift+Tab into the grid lands on the grid', async () => {
    await selectable();
    const boxes = [...table.shadowRoot!.querySelectorAll<HTMLInputElement>('.ft-checkbox-cell input, .ft-checkbox-header input')];
    expect(boxes.length).toBeGreaterThan(2);
    expect(boxes.every((b) => b.tabIndex === -1)).toBe(true);
    expect(boxes.every((b) => (b.getAttribute('aria-label') ?? '') !== '')).toBe(true);

    // Shift+Tab from what follows the table walks back into it: sequential focus would land on the last
    // tabbable control in the shadow tree, and there is none — the grid is the one stop.
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

describe('flex-table keyboard — the grid is one Tab stop and never keeps the focus', () => {
  // Before 0.50 Tab past the last cell (Shift+Tab before the first) stayed on that cell: focus could never
  // leave the grid by keyboard (WCAG 2.1.2), and every column menu button was a Tab stop of its own.
  let before: HTMLButtonElement;
  let after: HTMLButtonElement;
  const small = async () => {
    table = document.createElement('flex-table') as FlexTable;
    table.style.display = 'block';
    table.style.width = '500px';
    table.style.height = '240px';
    before = document.createElement('button');
    after = document.createElement('button');
    document.body.append(before, table, after);
    table.columns = ['a', 'b'].map((key) => ({ key, label: key.toUpperCase(), width: 120 }));
    table.data = Array.from({ length: 2 }, (_, r) => ({ a: `a${r}`, b: `b${r}` }));
    await table.updateComplete;
    await new Promise((r) => setTimeout(r, 120));
  };
  afterEach(() => { before?.remove(); after?.remove(); });

  it('Tab into the grid lands on the first cell, walks the cells, and leaves after the last', async () => {
    await small();
    before.focus();
    await press('{Tab}');
    expect(document.activeElement).toBe(table);
    expect(active(), 'the first cell is active on arrival — Tab is not spent entering').toEqual([0, 0]);
    await press('{Tab}{Tab}{Tab}');
    expect(active()).toEqual([1, 1]);
    await press('{Tab}');
    expect(document.activeElement, 'past the last cell Tab leaves the grid').toBe(after);
  });

  it('Shift+Tab before the first cell leaves the grid backwards', async () => {
    await small();
    after.focus();
    await press('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(table);
    await at(0, 1);
    await press('{Shift>}{Tab}{/Shift}');
    expect(active()).toEqual([0, 0]);
    await press('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(before);
  });

  it('the column menu buttons are not Tab stops', async () => {
    await small();
    const buttons = [...table.shadowRoot!.querySelectorAll<HTMLElement>('.ft-column-menu-btn')];
    expect(buttons.length).toBe(2);
    expect(buttons.every((b) => b.tabIndex === -1)).toBe(true);
  });
});

describe('flex-table keyboard — the header row', () => {
  const header = (col: number) =>
    table.shadowRoot!.querySelector<HTMLElement>(`.ft-header-cell[data-col-index="${col}"]`)!;
  const activeHeader = () =>
    [...table.shadowRoot!.querySelectorAll<HTMLElement>('.ft-header-cell.ft-header-active')].map((h) => h.dataset.colIndex);
  const menuOpen = () => !!table.shadowRoot!.querySelector('.ft-header-menu');

  it('ArrowUp from the first row moves onto the header; arrows / Home / End move along it; ArrowDown returns', async () => {
    await mount();
    await at(0, 1);
    await press('{ArrowUp}');
    expect(activeHeader()).toEqual(['1']);
    expect(table.activeCell, 'no body cell is active while the header is').toBeNull();
    await press('{ArrowRight}');
    expect(activeHeader()).toEqual(['2']);
    await press('{End}');
    expect(activeHeader()).toEqual(['3']);
    await press('{Home}{ArrowRight}');
    expect(activeHeader()).toEqual(['1']);
    await press('{ArrowDown}');
    expect(activeHeader()).toEqual([]);
    expect(active()).toEqual([0, 1]);
  });

  it('Enter on a header cell sorts it (ascending, then descending); Shift+Enter adds a second column', async () => {
    await mount();
    const sorts: unknown[] = [];
    table.addEventListener('sort-change', (e) => sorts.push((e as CustomEvent).detail.criteria));
    await at(0, 0);
    await press('{ArrowUp}{Enter}');
    expect(header(0).getAttribute('aria-sort')).toBe('ascending');
    await press('{Enter}');
    expect(header(0).getAttribute('aria-sort')).toBe('descending');
    await press('{ArrowRight}{Shift>}{Enter}{/Shift}');
    expect(sorts.at(-1)).toEqual([{ key: 'a', direction: 'desc' }, { key: 'b', direction: 'asc' }]);
    expect(activeHeader(), 'sorting keeps the keyboard on the header').toEqual(['1']);
  });

  it('Alt+ArrowDown opens the column menu; Escape closes it and returns to the grid on the same header cell', async () => {
    await mount();
    await at(0, 2);
    await press('{ArrowUp}{Alt>}{ArrowDown}{/Alt}');
    expect(menuOpen()).toBe(true);
    expect(table.shadowRoot!.activeElement?.getAttribute('role')).toBe('menuitem');
    await press('{Escape}');
    expect(menuOpen()).toBe(false);
    expect(document.activeElement).toBe(table);
    expect(table.shadowRoot!.activeElement, 'focus is back on the header cell, not the menu button').toBe(header(2));
    expect(activeHeader()).toEqual(['2']);
  });

  it('an empty table keeps the header row reachable by keyboard', async () => {
    await mount();
    table.data = [];
    await settle();
    table.focus();
    await press('{ArrowDown}{ArrowRight}{Enter}');
    expect(activeHeader()).toEqual(['1']);
    expect(header(1).getAttribute('aria-sort')).toBe('ascending');
  });
});

describe('flex-table keyboard — the focus is on the cell the keyboard is on', () => {
  // Before 0.50 the host kept the focus and marked the active cell with a class only: assistive
  // technology heard «grid» and nothing as the arrows moved (the host cannot point
  // aria-activedescendant into its own shadow tree). Roving focus puts the focus on the cell.
  const focused = () => table.shadowRoot!.activeElement as HTMLElement | null;
  const header = (col: number) =>
    table.shadowRoot!.querySelector<HTMLElement>(`.ft-header-cell[data-col-index="${col}"]`)!;

  it('clicks and arrow keys move the focus onto the active cell; ArrowUp onto the header cell', async () => {
    await mount();
    await at(2, 1);
    expect(focused()).toBe(cell(2, 1));
    await press('{ArrowRight}{ArrowDown}');
    expect(focused()).toBe(cell(3, 2));
    expect(focused()?.getAttribute('role')).toBe('gridcell');
    await press('{Control>}{Home}{/Control}{ArrowUp}');
    expect(focused()).toBe(header(0));
    expect(focused()?.getAttribute('role')).toBe('columnheader');
    expect(document.activeElement, 'the page sees the grid as focused').toBe(table);
  });

  it('a cell scrolled out of the virtual window hands the focus to the grid; the next key brings it back', async () => {
    await mount();
    table.data = Array.from({ length: 300 }, (_, r) => ({ a: `a${r}`, b: `b${r}`, c: `c${r}`, d: `d${r}` }));
    await settle();
    await at(0, 0);
    table.scrollTop = 5000;
    await new Promise((r) => setTimeout(r, 250));
    expect(document.activeElement, 'the focus did not fall to the page').toBe(table);
    expect(focused(), 'not a recycled cell that now shows another row').toBeNull();
    await press('{ArrowDown}');
    await new Promise((r) => setTimeout(r, 250));
    expect(focused()).toBe(cell(1, 0));
  });

  it('Shift+F10 on the active cell opens the cell menu at that cell; Escape returns to the cell', async () => {
    await mount();
    table.showContextMenu = true;
    const opened: { row: number; col: number }[] = [];
    table.addEventListener('context-menu', (e) => opened.push({ row: e.detail.row, col: e.detail.col }));
    await settle();
    await at(2, 1);
    await press('{Shift>}{F10}{/Shift}');
    expect(opened, 'the keyboard path reports the active cell, like a right-click on it').toEqual([{ row: 2, col: 1 }]);
    const menu = table.shadowRoot!.querySelector<HTMLElement>('.ft-body-context-menu');
    expect(menu).not.toBeNull();
    const rect = cell(2, 1).getBoundingClientRect();
    const left = parseFloat(menu!.style.left);
    expect(left >= rect.left && left <= rect.right, 'the menu opens at the cell, not at the pointer').toBe(true);
    expect(focused()?.getAttribute('role')).toBe('menuitem');
    await press('{Escape}');
    expect(table.shadowRoot!.querySelector('.ft-body-context-menu')).toBeNull();
    expect(focused()).toBe(cell(2, 1));
  });

  it('after an edit the focus returns to the grid cell', async () => {
    await mount();
    await at(1, 0);
    await press('{F2}');
    expect(focused()?.localName).toBe('input');
    await press('X{Enter}');
    expect(focused()).toBe(cell(2, 0));
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
