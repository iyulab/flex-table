import { describe, it, expect, afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * `enter-move` — where the selection goes after Enter commits a cell edit. The default stays the cell below (a spreadsheet's
 * habit); `next` moves the way Tab does (reading order, onto the next row at the end of a row); `none` stays on the cell.
 */
let table: FlexTable;
afterEach(() => table?.remove());

type Internals = { _selection: { setActive(r: number, c: number): void; activeCell: { row: number; col: number } | null }; _syncActiveCell(): void; _startEdit(): void };

async function mount(enterMove?: string, dir?: 'rtl') {
  table = document.createElement('flex-table') as FlexTable;
  table.style.display = 'block';
  table.style.width = '600px';
  table.style.height = '300px';
  if (dir) table.setAttribute('dir', dir);
  if (enterMove !== undefined) table.setAttribute('enter-move', enterMove);
  document.body.appendChild(table);
  table.editable = true;
  table.columns = ['a', 'b', 'c'].map((key) => ({ key, label: key.toUpperCase(), editable: true, width: 120 }));
  table.data = [
    { a: '1', b: '2', c: '3' },
    { a: '4', b: '5', c: '6' },
    { a: '7', b: '8', c: '9' },
  ];
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
}

/** Edit the cell at (row, col), type a value and press Enter — the position the selection ends on. */
async function enterFrom(row: number, col: number): Promise<{ row: number; col: number } | null> {
  const t = table as unknown as Internals;
  t._selection.setActive(row, col);
  t._syncActiveCell();
  t._startEdit();
  await table.updateComplete;
  await userEvent.keyboard('x{Enter}');
  await table.updateComplete;
  return t._selection.activeCell;
}

describe('flex-table — enter-move', () => {
  it('moves down by default, and an unknown value reads as down', async () => {
    await mount();
    expect(await enterFrom(0, 1)).toEqual({ row: 1, col: 1 });
    table.remove();
    await mount('sideways');
    expect(await enterFrom(0, 1)).toEqual({ row: 1, col: 1 });
  });

  it('`next` goes to the next cell in the row, and onto the start of the next row at the end of a row', async () => {
    await mount('next');
    expect(await enterFrom(0, 0)).toEqual({ row: 0, col: 1 });
    expect(await enterFrom(0, 2)).toEqual({ row: 1, col: 0 });
  });

  it('`next` stays on the last cell, and `down` stays on the last row', async () => {
    await mount('next');
    expect(await enterFrom(2, 2)).toEqual({ row: 2, col: 2 });
    table.remove();
    await mount('down');
    expect(await enterFrom(2, 1)).toEqual({ row: 2, col: 1 });
  });

  it('`none` keeps the selection on the edited cell — and the value is still committed', async () => {
    await mount('none');
    expect(await enterFrom(1, 1)).toEqual({ row: 1, col: 1 });
    expect(table.data[1].b).toContain('x');
  });

  it('`next` is the next cell in reading order — the next column index in a right-to-left page too', async () => {
    await mount('next', 'rtl');
    expect(await enterFrom(0, 0)).toEqual({ row: 0, col: 1 });
  });
});
