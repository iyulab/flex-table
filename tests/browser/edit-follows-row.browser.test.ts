import { describe, it, expect, afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * An open editor belongs to the row it was started on. The edit used to remember a screen position and
 * write whatever row stood there when it was committed — a refresh that put a row above the one being
 * edited sent the typed value into the new row. Now the editor follows its row (drawn again in the
 * row's new place, keeping what was typed and the focus) and the commit writes that row.
 */
let table: FlexTable;
afterEach(() => table?.remove());

async function mount(data: Record<string, unknown>[]) {
  table = document.createElement('flex-table') as FlexTable;
  table.style.display = 'block';
  table.style.width = '400px';
  table.style.height = '300px';
  document.body.appendChild(table);
  table.columns = [{ key: 'name', label: 'Name', width: 200 }];
  table.data = data;
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
}

describe('flex-table — the editor follows its row', () => {
  it('🔴a refresh that puts a row above keeps the editor on its row, with the typed text, and Enter writes that row', async () => {
    const a = { name: 'a' };
    const b = { name: 'b' };
    await mount([a, b]);
    await userEvent.click(table.shadowRoot!.querySelector<HTMLElement>('.ft-cell')!);
    await userEvent.keyboard('{Enter}');
    await table.updateComplete;
    await userEvent.keyboard('A!');
    expect(table.shadowRoot!.querySelector<HTMLInputElement>('.ft-editor')!.value).toBe('A!');

    table.data = [{ name: 'new' }, a, b];
    await table.updateComplete;
    await new Promise((r) => setTimeout(r, 50));

    const editor = table.shadowRoot!.querySelector<HTMLInputElement>('.ft-editor');
    expect(editor, 'the edit is still open').toBeTruthy();
    expect(editor!.value).toBe('A!');
    expect(table.shadowRoot!.activeElement).toBe(editor);
    expect(editor!.closest('[aria-rowindex]')?.getAttribute('aria-rowindex'), 'drawn in «a»’s row').toBe('3');

    await userEvent.keyboard('?{Enter}');
    await table.updateComplete;
    expect(table.data.map((r) => r.name)).toEqual(['new', 'A!?', 'b']);
  });
});
