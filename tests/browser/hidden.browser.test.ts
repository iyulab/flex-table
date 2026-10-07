import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * `hidden` hides the table. The host's own `display` outranks the user-agent `[hidden]` rule, so without a host rule
 * for it a hidden table kept drawing — a list skeleton that switches between a table and a card view puts `hidden` on
 * the view it is not showing, and both showed.
 */

let table: FlexTable;
afterEach(() => table?.remove());

describe('flex-table hidden', () => {
  it('a hidden table takes no box', async () => {
    table = document.createElement('flex-table') as FlexTable;
    document.body.appendChild(table);
    table.columns = [{ key: 'a', label: 'A', width: 120 }];
    table.data = [{ a: 1 }];
    await table.updateComplete;
    expect(table.getBoundingClientRect().height).toBeGreaterThan(0);

    table.hidden = true;
    expect(getComputedStyle(table).display).toBe('none');
    expect(table.getBoundingClientRect().height).toBe(0);
  });
});
