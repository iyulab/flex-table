import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * While `loading`, an empty table does not say «no data» — before the first response an empty `data` is not a result,
 * and a reader takes the message for the answer. It says it is loading; once loading ends the empty message returns.
 * An error still wins, and rows already shown stay under the overlay on a reload.
 */

let table: FlexTable;
afterEach(() => table?.remove());

const message = (el: FlexTable) => el.shadowRoot!.querySelector('.ft-empty')?.textContent?.trim() ?? null;

async function mount(): Promise<FlexTable> {
  table = document.createElement('flex-table') as FlexTable;
  table.style.cssText = 'width: 600px; height: 300px';
  table.emptyMessage = '데이터가 없습니다';
  table.columns = [{ key: 'name', label: 'Name' }];
  document.body.appendChild(table);
  await table.updateComplete;
  return table;
}

describe('flex-table — empty while loading', () => {
  it('🔴loading with no rows yet: the loading text, not the empty message', async () => {
    const el = await mount();
    el.loading = true;
    await el.updateComplete;
    expect(message(el)).toBe('Loading…');
    expect(el.getAttribute('aria-busy')).toBe('true');
  });

  it('loadingMessage replaces the locale text', async () => {
    const el = await mount();
    el.loadingMessage = '목록을 불러오는 중';
    el.loading = true;
    await el.updateComplete;
    expect(message(el)).toBe('목록을 불러오는 중');
  });

  it('loading ends with no rows: the empty message', async () => {
    const el = await mount();
    el.loading = true;
    await el.updateComplete;
    el.loading = false;
    await el.updateComplete;
    expect(message(el)).toBe('데이터가 없습니다');
  });

  it('an error while loading is shown, not the loading text', async () => {
    const el = await mount();
    el.loading = true;
    el.error = { message: 'Request failed' };
    await el.updateComplete;
    expect(message(el)).toBe('Request failed');
  });

  it('reloading with rows on screen keeps the rows (no state message)', async () => {
    const el = await mount();
    el.data = [{ name: 'a' }];
    await el.updateComplete;
    el.loading = true;
    await el.updateComplete;
    expect(message(el)).toBeNull();
  });
});
