import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';
import { clickableNoise } from './clickable.js';

/**
 * A click-type listener on an element outside a handful of roles has NVDA announce «clickable» — on every cell and
 * header of a grid in browse mode (measured). Handlers are heard on the shadow root (`delegate` from
 * `@iyulab/components`); the oracle reads the listeners the browser holds (`clickable.ts`).
 */
let tables: FlexTable[] = [];
afterEach(() => { for (const t of tables) t.remove(); tables = []; });

async function mount(setup: (t: FlexTable) => void): Promise<FlexTable> {
  const table = document.createElement('flex-table') as FlexTable;
  table.style.display = 'block';
  table.style.width = '700px';
  table.style.height = '320px';
  table.setAttribute('aria-label', 'Orders');
  document.body.appendChild(table);
  setup(table);
  tables.push(table);
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 150));
  return table;
}

const noiseOf = async (el: Element) =>
  [...new Set((await clickableNoise(el)).map((n) => `${n.element} (${n.role}) ${n.types.join('+')}`))];

const columns = [
  { key: 'a', label: 'A', width: 120, sortable: true, description: 'First' },
  { key: 'b', label: 'B', width: 120 },
];
const data = Array.from({ length: 4 }, (_, r) => ({ a: `a${r}`, b: `b${r}` }));

describe('click-type listeners screen readers would announce as «clickable»', () => {
  it('none on the grid — cells, headers, row numbers, fill handle', async () => {
    const table = await mount((t) => {
      t.columns = columns;
      t.data = data;
      t.showRowNumbers = true;
      t.selectable = true;
    });
    expect(await noiseOf(table)).toEqual([]);
  }, 60_000);

  it('none on the cards', async () => {
    const table = await mount((t) => {
      t.columns = columns;
      t.data = data;
      (t as unknown as { layout: string }).layout = 'cards';
    });
    expect(await noiseOf(table)).toEqual([]);
  }, 60_000);
});
