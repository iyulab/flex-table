import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';
import type { ColumnDefinition } from '../../src/models/types.js';

/**
 * Column widths that the table works out itself: a column without `width` sizes to its content, and `grow` columns
 * share the width the others leave empty. Measured from the drawn cells — jsdom lays nothing out.
 */

let table: FlexTable;
afterEach(() => table?.remove());

const settle = async () => {
  for (let i = 0; i < 3; i++) {
    await table.updateComplete;
    await new Promise((r) => setTimeout(r, 40));
  }
};

async function mount(columns: ColumnDefinition[], data: Record<string, unknown>[], width = 900) {
  table = document.createElement('flex-table') as FlexTable;
  table.style.display = 'block';
  table.style.width = `${width}px`;
  table.style.height = '300px';
  document.body.appendChild(table);
  table.columns = columns;
  table.data = data;
  await settle();
}

const header = (key: string) => {
  const i = table.columns.findIndex((c) => c.key === key);
  return table.shadowRoot!.querySelector<HTMLElement>(`.ft-header-cell[data-col-index="${i}"]`)!;
};
const width = (key: string) => header(key).getBoundingClientRect().width;
const bodyCells = (key: string) => {
  const i = table.columns.findIndex((c) => c.key === key);
  return [...table.shadowRoot!.querySelectorAll<HTMLElement>(`.ft-cell[data-col-index="${i}"]`)];
};

const rows = [
  { id: 1, account: '068801-04-386512 국민(일반)', bank: 'KB' },
  { id: 2, account: '068801-04-386599 국민(교회)', bank: 'KB' },
];

describe('flex-table — column widths it works out', () => {
  it('a column without `width` shows its widest value unclipped, and a short one is narrower than the old 120px', async () => {
    await mount([{ key: 'id', label: '#' }, { key: 'account', label: 'Account' }, { key: 'bank', label: 'Bank' }], rows);
    for (const cell of bodyCells('account')) expect(cell.scrollWidth).toBeLessThanOrEqual(cell.clientWidth);
    expect(width('account')).toBeGreaterThan(120);
    expect(width('id')).toBeLessThan(120);
  });

  it('a declared `width` is kept, and a measured width does not move when the data changes', async () => {
    await mount([{ key: 'id', label: '#', width: 200 }, { key: 'account', label: 'Account' }], rows);
    expect(width('id')).toBe(200);
    const before = width('account');
    table.data = [{ id: 3, account: 'x' }];
    await settle();
    expect(width('account')).toBe(before);
  });

  it('a long value is capped at 320px and cut, not the table', async () => {
    await mount([{ key: 'note', label: 'Note' }], [{ note: 'word '.repeat(200) }]);
    expect(width('note')).toBe(320);
  });

  it('`grow` columns fill the spare width in proportion; the others keep theirs', async () => {
    await mount(
      [{ key: 'a', label: 'A', width: 100 }, { key: 'b', label: 'B', width: 100, grow: 1 }, { key: 'c', label: 'C', width: 100, grow: 3 }],
      [{ a: 1, b: 2, c: 3 }],
      700,
    );
    const total = table.clientWidth;
    expect(width('a')).toBe(100);
    expect(width('b') + width('c')).toBe(total - 100);
    expect(Math.abs((width('c') - 100) - 3 * (width('b') - 100))).toBeLessThanOrEqual(3);
    const base = table.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    expect(base.scrollWidth).toBeLessThanOrEqual(base.clientWidth);
  });

  it('a `grow` column the user resizes keeps that width and stops growing', async () => {
    await mount([{ key: 'a', label: 'A', width: 100, grow: 1 }, { key: 'b', label: 'B', width: 100, grow: 1 }], [{ a: 1, b: 2 }], 700);
    const grownA = width('a');
    expect(grownA).toBeGreaterThan(100);
    table.applyViewState({ columns: [{ key: 'a', width: 150, hidden: false, pinned: null }] });
    await settle();
    expect(width('a')).toBe(150);
    expect(width('b')).toBe(table.clientWidth - 150);
  });

  it('auto-fit narrows a column that is wider than its content', async () => {
    await mount([{ key: 'id', label: '#', width: 300 }], rows);
    header('id').querySelector<HTMLElement>('.ft-resize-handle')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await settle();
    expect(width('id')).toBeLessThan(120);
  });
});
