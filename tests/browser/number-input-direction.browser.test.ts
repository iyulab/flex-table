import { describe, it, expect, afterEach } from 'vitest';
import { page } from 'vitest/browser';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * A number is text whose direction is fixed: the sign stands left of the digits («-1234.5»). The cell editor of a number column
 * and the number condition of the filter are text inputs (the browser's own number handling does not apply), and in a
 * right-to-left page they took the page as their paragraph direction — the weak «-» went to the line end and read «1234.5-».
 * The inputs are left-to-right; where the text sits (the end edge for the editor, the start edge for the filter) does not move.
 *
 * The text lives in a native input, so no Range can measure it — the oracle is pixels: the first run of ink at the left of the
 * text is the sign (a thin bar a few pixels tall) when the sign stands first, and a digit (tall) when it jumped to the end.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let wrap: HTMLElement;
afterEach(() => wrap?.remove());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

async function shot() {
  const raw = (await page.screenshot({ save: false, base64: true } as never)) as unknown as { base64: string } | string;
  const base64 = typeof raw === 'string' ? raw : raw.base64;
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('screenshot did not decode'));
    img.src = `data:image/png;base64,${base64}`;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return { data: ctx.getImageData(0, 0, img.width, img.height).data, width: img.width, scale: img.width / window.innerWidth };
}

async function mount(dir: 'ltr' | 'rtl'): Promise<{ table: Any }> {
  wrap = document.createElement('div');
  wrap.setAttribute('dir', dir);
  document.body.appendChild(wrap);
  const table = document.createElement('flex-table') as FlexTable;
  table.style.display = 'block';
  table.style.width = '400px';
  table.style.height = '260px';
  wrap.appendChild(table);
  const any = table as Any;
  any.editable = true;
  any.columns = [{ key: 'n', label: 'Amount', type: 'number', editable: true, width: 300 }];
  any.data = [{ n: -1234.5 }, { n: 7 }];
  await table.updateComplete;
  await sleep(150);
  return { table: any };
}

/** Where the ink of the input's text begins and ends, and how tall the first run (up to the first blank column) is. */
async function ink(input: HTMLInputElement) {
  input.style.caretColor = 'transparent';
  input.setSelectionRange(input.value.length, input.value.length);
  await sleep(60);
  const box = input.getBoundingClientRect();
  const a = await shot();
  const s = a.scale;
  const x0 = Math.ceil(box.left * s) + 3;
  const x1 = Math.floor(box.right * s) - 3;
  const y0 = Math.ceil(box.top * s) + 3;
  const y1 = Math.floor(box.bottom * s) - 3;
  const dark = (x: number, y: number) => {
    const i = (y * a.width + x) * 4;
    return a.data[i] + a.data[i + 1] + a.data[i + 2] < 3 * 140;
  };
  const colHeight = (x: number) => {
    let n = 0;
    for (let y = y0; y < y1; y++) if (dark(x, y)) n++;
    return n;
  };
  let left = -1;
  let right = -1;
  let runEnd = -1;
  for (let x = x0; x < x1; x++) {
    if (colHeight(x) > 0) {
      if (left < 0) left = x;
      right = x;
    } else if (left >= 0 && runEnd < 0) {
      runEnd = x;
    }
  }
  if (runEnd < 0) runEnd = right + 1;
  let top = y1;
  let bottom = y0;
  if (left >= 0) {
    for (let x = left; x < runEnd; x++) for (let y = y0; y < y1; y++) if (dark(x, y)) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
  }
  return { left, right, firstRunHeight: left < 0 ? 0 : bottom - top + 1, boxLeft: x0, boxRight: x1, scale: s };
}

async function editor(table: Any): Promise<HTMLInputElement> {
  table._selection.setActive(0, 0);
  table._syncActiveCell();
  table._startEdit();
  await table.updateComplete;
  await sleep(150);
  return table.shadowRoot!.querySelector('.ft-editor-number') as HTMLInputElement;
}

async function filterInput(table: Any): Promise<HTMLInputElement> {
  table._openFilterFromMenu('n');
  await table.updateComplete;
  await sleep(150);
  const input = table.shadowRoot!.querySelector('.ft-num-cond-input') as HTMLInputElement;
  input.value = '-1234.5';
  return input;
}

describe('flex-table — number inputs keep the sign in front', () => {
  it('cell editor, right-to-left page: sign first, and the text stays at the left (the number end edge)', async () => {
    const { table } = await mount('rtl');
    const m = await ink(await editor(table));
    expect(m.firstRunHeight, `the first ink run is ${m.firstRunHeight}px tall (a digit, so the sign moved to the end)`).toBeLessThanOrEqual(3 * m.scale);
    expect(m.right, 'the text stays left of the middle').toBeLessThan((m.boxLeft + m.boxRight) / 2);
  });

  it('cell editor, left-to-right page: unchanged — sign first, text at the right (end edge)', async () => {
    const { table } = await mount('ltr');
    const m = await ink(await editor(table));
    expect(m.firstRunHeight).toBeLessThanOrEqual(3 * m.scale);
    expect(m.left, 'the text sits at the right of the middle').toBeGreaterThan((m.boxLeft + m.boxRight) / 2);
  });

  it('filter condition, right-to-left page: sign first, and the text stays at the start edge (right)', async () => {
    const { table } = await mount('rtl');
    const m = await ink(await filterInput(table));
    expect(m.firstRunHeight, `the first ink run is ${m.firstRunHeight}px tall (a digit, so the sign moved to the end)`).toBeLessThanOrEqual(3 * m.scale);
    expect(m.left, 'the text sits at the right of the middle').toBeGreaterThan((m.boxLeft + m.boxRight) / 2);
  });

  it('filter condition, left-to-right page: unchanged — sign first, text at the left (start edge)', async () => {
    const { table } = await mount('ltr');
    const m = await ink(await filterInput(table));
    expect(m.firstRunHeight).toBeLessThanOrEqual(3 * m.scale);
    expect(m.right, 'the text stays left of the middle').toBeLessThan((m.boxLeft + m.boxRight) / 2);
  });
});
