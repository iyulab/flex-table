import { describe, it, expect, afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * The cell editor is focused and its text selected once, when editing starts — not on every update
 * of the table. The check compared `document.activeElement` (the table's host, for anything in its
 * shadow tree) with the editor, so it always differed: each update re-selected the text, and an
 * update while typing — the autocomplete list does one per key — made the next key replace it.
 */
let table: FlexTable;
afterEach(() => table?.remove());

describe('flex-table — the editor is focused once', () => {
  it('typing into an autocomplete editor keeps every key', async () => {
    table = document.createElement('flex-table') as FlexTable;
    table.style.display = 'block';
    table.style.width = '500px';
    table.style.height = '300px';
    document.body.appendChild(table);
    table.editable = true;
    table.columns = [{ key: 'a', label: 'A', autocomplete: true, editable: true, width: 200 }];
    table.data = [{ a: 'apple' }, { a: 'apricot' }, { a: '' }];
    await table.updateComplete;
    await new Promise((r) => setTimeout(r, 120));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const any = table as any;
    any._selection.setActive(2, 0);
    any._syncActiveCell();
    any._startEdit();
    await table.updateComplete;
    const editor = table.shadowRoot!.querySelector<HTMLInputElement>('.ft-editor')!;
    await userEvent.keyboard('apx');
    await table.updateComplete;
    expect(editor.value).toBe('apx');
  });
});
