import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * `mergeRepeated` 는 «보이는 것» 의 계약이다 — 반복 값은 DOM 에 남고(복사·찾기·스크린리더)
 * 칠해지지만 않는다. 그래서 여기서는 계산된 색·선·배경을 잰다(jsdom 은 캐스케이드를 계산하지
 * 않는다). 스크롤로 묶음 한가운데에 들어왔을 때 첫 줄이 값을 다시 그리는지도 실제 스크롤로 잰다.
 */

const ROW_H = 32;
let table: FlexTable;

function mount(rows: Record<string, unknown>[], columns: unknown[]): FlexTable {
  const el = document.createElement('flex-table') as FlexTable;
  el.style.display = 'block';
  el.style.width = '500px';
  el.style.height = `${ROW_H * 6 + 40}px`;
  document.body.appendChild(el);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (el as any).columns = columns;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (el as any).data = rows;
  return el;
}

async function settle(el: FlexTable): Promise<void> {
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
  await el.updateComplete;
}

/** Visible body cell of column `col` on the row whose aria-rowindex is `rowIndex + 2`. */
function cell(el: FlexTable, rowIndex: number, col: number): HTMLElement {
  const row = el.shadowRoot!.querySelector<HTMLElement>(`.ft-row[aria-rowindex="${rowIndex + 2}"]`);
  expect(row, `row ${rowIndex} rendered`).toBeTruthy();
  return row!.querySelector<HTMLElement>(`.ft-cell[data-col-index="${col}"]`)!;
}

const painted = (c: HTMLElement) => getComputedStyle(c).color !== 'rgba(0, 0, 0, 0)';

// Order 1 has three lines, order 2 two, order 3 one — and orders 1 and 2 share a customer.
const LINES = [
  { order: 'A-1', customer: 'Kim', product: 'p1' },
  { order: 'A-1', customer: 'Kim', product: 'p2' },
  { order: 'A-1', customer: 'Kim', product: 'p3' },
  { order: 'A-2', customer: 'Kim', product: 'p4' },
  { order: 'A-2', customer: 'Kim', product: 'p5' },
  { order: 'A-3', customer: 'Lee', product: 'p6' },
];
const COLUMNS = [
  { key: 'order', label: 'Order', width: 100, mergeRepeated: true },
  {
    key: 'customer', label: 'Customer', width: 120,
    mergeRepeated: (row: Record<string, unknown>, prev: Record<string, unknown>) => row.order === prev.order,
  },
  { key: 'product', label: 'Product', width: 120 },
];

afterEach(() => table?.remove());

describe('mergeRepeated', () => {
  it('paints a run once, drops the lines inside it, and keeps one background', async () => {
    table = mount(LINES, COLUMNS);
    await settle(table);

    // Order column: rows 0-2 one run, 3-4 one run, 5 alone.
    expect(painted(cell(table, 0, 0))).toBe(true);
    expect(painted(cell(table, 1, 0))).toBe(false);
    expect(painted(cell(table, 2, 0))).toBe(false);
    expect(painted(cell(table, 3, 0))).toBe(true);
    expect(painted(cell(table, 5, 0))).toBe(true);

    // Every row keeps its value in the DOM.
    expect(cell(table, 1, 0).textContent).toContain('A-1');

    // The line between rows 0 and 1 of the run is gone; the line closing the run stays.
    const border = (c: HTMLElement) => getComputedStyle(c).borderBottomColor;
    expect(border(cell(table, 0, 0))).toBe('rgba(0, 0, 0, 0)');
    expect(border(cell(table, 2, 0))).not.toBe('rgba(0, 0, 0, 0)');

    // Rows 0 and 1 have different stripes, but the merged cell is one surface.
    const bg = (c: HTMLElement) => getComputedStyle(c).backgroundColor;
    expect(bg(cell(table, 1, 0))).toBe(bg(cell(table, 0, 0)));
    expect(bg(cell(table, 1, 2))).not.toBe(bg(cell(table, 0, 2)));
  });

  it('merges by the rule when given a function — the same customer across two orders stays two cells', async () => {
    table = mount(LINES, COLUMNS);
    await settle(table);
    expect(painted(cell(table, 2, 1))).toBe(false); // still order A-1
    expect(painted(cell(table, 3, 1))).toBe(true); // Kim again, but order A-2 starts a new run
  });

  it('draws the value again on the first row in view when a run is scrolled half out', async () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ order: `O-${Math.floor(i / 10)}`, product: `p${i}` }));
    table = mount(rows, [
      { key: 'order', label: 'Order', width: 100, mergeRepeated: true },
      { key: 'product', label: 'Product', width: 120 },
    ]);
    await settle(table);
    expect(painted(cell(table, 4, 0))).toBe(false);

    table.scrollTop = ROW_H * 4; // rows 4.. of run O-0 are now at the top
    await settle(table);
    const top = Math.floor(table.scrollTop / ROW_H);
    expect(painted(cell(table, top, 0))).toBe(true);
    expect(painted(cell(table, top + 1, 0))).toBe(false);
  });

  it('paints a continued cell again when it is the active cell', async () => {
    table = mount(LINES, COLUMNS);
    await settle(table);
    cell(table, 1, 0).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
    cell(table, 1, 0).click();
    await settle(table);
    expect(painted(cell(table, 1, 0))).toBe(true);
  });
});
