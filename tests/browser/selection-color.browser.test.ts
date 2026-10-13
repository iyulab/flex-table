import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';
import lightCss from '@iyulab/components/styles/light.css?raw';

/**
 * Row checkboxes draw in the selection colour — `--ft-selection-color`, from the shared `--u-selection-color`
 * (the primary colour unless the theme separates them). They read `--ft-active-color` before, which is the
 * primary colour, so a theme with an ink primary and a blue selection drew ink checks on a blue-tinted row.
 */
let table: FlexTable & { selectable: boolean };
afterEach(() => { table?.remove(); });

async function mount(style: string) {
  table = document.createElement('flex-table') as typeof table;
  table.style.cssText = `display:block;width:500px;height:240px;${style}`;
  document.body.appendChild(table);
  table.selectable = true;
  table.columns = [{ key: 'a', label: 'A', width: 120 }];
  table.data = [{ a: 'x' }, { a: 'y' }];
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 100));
  const boxes = [...table.shadowRoot!.querySelectorAll<HTMLInputElement>('.ft-checkbox-header input[type=checkbox], .ft-checkbox-cell input[type=checkbox]')];
  if (boxes.length === 0) throw new Error('row checkboxes did not render');
  return boxes;
}

describe('row checkbox colour', () => {
  it('🔴follows --u-selection-color when the theme separates it from the primary colour', async () => {
    const boxes = await mount('--u-primary-color: rgb(24, 25, 27); --u-selection-color: rgb(47, 111, 235)');
    for (const b of boxes) expect(getComputedStyle(b).accentColor).toBe('rgb(47, 111, 235)');
  });

  it('⚪NEGATIVE — a theme that does not separate them keeps the primary colour (the components sheet pairs them)', async () => {
    const sheet = document.createElement('style');
    sheet.textContent = lightCss;
    document.head.appendChild(sheet);
    document.documentElement.style.setProperty('--u-primary-color', 'rgb(24, 25, 27)');
    try {
      const boxes = await mount('');
      expect(getComputedStyle(boxes[0]).accentColor).toBe('rgb(24, 25, 27)');
    } finally {
      sheet.remove();
      document.documentElement.style.removeProperty('--u-primary-color');
    }
  });
});
