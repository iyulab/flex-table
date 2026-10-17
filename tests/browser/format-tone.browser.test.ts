import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * A spreadsheet format's section color (`[Red]`) paints with the theme's status color, and the cell shows the
 * formatted text — before, `'#,##0;[Red](#,##0)'` drew the format code itself (the `d` of `[Red]` was read as a day).
 */
let table: FlexTable;
afterEach(() => { table?.remove(); });

describe('number format section color', () => {
  it('🔴a negative in a [Red] section shows (1,234) in --u-danger-color; a positive keeps the text color', async () => {
    table = document.createElement('flex-table') as FlexTable;
    table.style.cssText = 'display:block;width:400px;height:200px;--u-danger-color: rgb(200, 10, 20); color: rgb(30, 30, 30)';
    document.body.appendChild(table);
    table.columns = [{ key: 'amt', label: 'Amt', type: 'number', width: 160, format: '#,##0;[Red](#,##0)' }];
    table.data = [{ amt: -1234 }, { amt: 1234 }];
    await table.updateComplete;
    await new Promise((r) => setTimeout(r, 100));
    const cells = [...table.shadowRoot!.querySelectorAll<HTMLElement>('[role=gridcell]')].filter((c) => /1,234/.test(c.textContent ?? ''));
    expect(cells.map((c) => c.textContent!.trim())).toEqual(['(1,234)', '1,234']);
    const tone = cells[0].querySelector<HTMLElement>('.ft-format-tone');
    expect(tone && getComputedStyle(tone).color).toBe('rgb(200, 10, 20)');
    expect(cells[1].querySelector('.ft-format-tone')).toBeNull();
  });
});
