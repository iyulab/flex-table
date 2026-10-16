import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * A row taller than its content — a theme sets `--ft-row-height` (a house theme's 44px rows) and leaves the cell's block
 * padding alone. One-line cell text sits in the vertical middle of the cell, not under the top padding with the rest
 * left below. Measured on the text itself (a Range), not on the line box.
 */

let table: FlexTable;
afterEach(() => table?.remove());

async function mount(rowHeight: string): Promise<void> {
  table = document.createElement('flex-table') as FlexTable;
  table.style.cssText = `display:block;width:600px;height:320px;--ft-row-height:${rowHeight}`;
  table.setAttribute('aria-label', 'Orders');
  document.body.appendChild(table);
  table.columns = [{ key: 'a', label: 'Name', width: 200 }, { key: 'b', label: 'Qty', width: 120, type: 'number' }];
  table.data = [{ a: 'Blue Harbor Co.', b: 12 }, { a: 'Sunrise Ltd.', b: 7 }];
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
}

function gaps(el: HTMLElement): { top: number; bottom: number } {
  const text = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())
    ?? el.querySelector('*')?.firstChild;
  const range = document.createRange();
  range.selectNodeContents(text ?? el);
  const t = range.getBoundingClientRect();
  const c = el.getBoundingClientRect();
  return { top: t.top - c.top, bottom: c.bottom - t.bottom };
}

const bodyCell = () => table.shadowRoot!.querySelector<HTMLElement>('.ft-row .ft-cell')!;

describe('flex-table — cell text sits in the vertical middle of a tall row', () => {
  for (const h of ['44px', '56px']) {
    it(`a ${h} row: top and bottom gaps differ by at most 2px`, async () => {
      await mount(h);
      const cell = bodyCell();
      expect(cell.getBoundingClientRect().height).toBe(parseFloat(h));
      const g = gaps(cell);
      expect(Math.abs(g.top - g.bottom), `top ${g.top} · bottom ${g.bottom}`).toBeLessThanOrEqual(2);
    });
  }

  it('NEGATIVE a row that only fits padding and one line is unchanged — the padding is the floor', async () => {
    await mount('20px');
    const cell = bodyCell();
    expect(parseFloat(getComputedStyle(cell).paddingTop)).toBe(6);
    expect(gaps(cell).top).toBeGreaterThanOrEqual(0);
  });
});
