import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * The text of a cell is data the app put there, whatever the page's direction. A line of Latin letters in a right-to-left page
 * (a company name, a part number) has the page as its paragraph direction, so its trailing punctuation and a leading sign jump
 * to the wrong end — «Blue Harbor Co.» reads «.Blue Harbor Co». Each value is isolated (`<bdi>`: the value decides its own
 * direction, the cell keeps its alignment), so the value reads in its own order and stands where the cell puts it.
 */
let table: FlexTable;
afterEach(() => table?.remove());

async function mount(dir: 'ltr' | 'rtl', values: string[]) {
  table = document.createElement('flex-table') as FlexTable;
  table.setAttribute('dir', dir);
  table.style.display = 'block';
  table.style.width = '400px';
  table.style.height = '240px';
  document.body.appendChild(table);
  table.columns = [{ key: 'name', label: 'Name', width: 300 }];
  table.data = values.map((name) => ({ name }));
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
}

/** Where the first and the last character of the cell's text stand on screen, and the cell's own box. */
function edges(text: string) {
  const cell = [...table.shadowRoot!.querySelectorAll<HTMLElement>('.ft-cell')].find((c) => c.textContent?.trim() === text)!;
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node && node.data.trim() !== text) node = walker.nextNode() as Text | null;
  const range = document.createRange();
  range.setStart(node!, 0);
  range.setEnd(node!, 1);
  const first = range.getBoundingClientRect();
  range.setStart(node!, node!.data.length - 1);
  range.setEnd(node!, node!.data.length);
  const last = range.getBoundingClientRect();
  return { first: first.left, last: last.left, lastRight: last.right, firstRight: first.right, cell: cell.getBoundingClientRect() };
}

describe('flex-table — a value keeps its own direction in a cell', () => {
  it('in a right-to-left page a Latin value reads left to right — the full stop stands after the last word', async () => {
    await mount('rtl', ['Blue Harbor Co.']);
    const e = edges('Blue Harbor Co.');
    expect(e.last).toBeGreaterThan(e.first); // «.Blue Harbor Co» put the dot left of the B
  });

  it('…and the value stays where the cell puts it: at the start edge, the right in a right-to-left page', async () => {
    await mount('rtl', ['Blue Harbor Co.']);
    const e = edges('Blue Harbor Co.');
    expect(e.cell.right - e.lastRight).toBeLessThan(e.firstRight - e.cell.left); // nearer the right edge than the left
  });

  it('a leading sign stays before the number it belongs to', async () => {
    await mount('rtl', ['+12% vs yesterday']);
    const e = edges('+12% vs yesterday');
    expect(e.first).toBeLessThan(e.last); // the «+» is the first thing read, at the left of the Latin run
  });

  it('NEGATIVE: in a left-to-right page the value stands as before — first character at the start edge', async () => {
    await mount('ltr', ['Blue Harbor Co.']);
    const e = edges('Blue Harbor Co.');
    expect(e.last).toBeGreaterThan(e.first);
    expect(e.first - e.cell.left).toBeLessThan(20); // padding only
  });
});
