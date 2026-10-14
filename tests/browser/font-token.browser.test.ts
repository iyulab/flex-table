import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * The table's font follows the type token `--u-font-base` the way its colours follow `--u-*` — measured on the
 * computed font, not on the custom property. `--ft-font-family` used to default to a literal stack, so a theme that
 * set the type tokens reached the table only through a per-table override.
 */
let table: FlexTable;
let theme: HTMLStyleElement | null = null;
afterEach(() => {
  table?.remove();
  theme?.remove();
  theme = null;
});

async function mount(style = '') {
  table = document.createElement('flex-table') as FlexTable;
  table.style.cssText = `display:block;width:400px;height:200px;${style}`;
  document.body.appendChild(table);
  table.columns = [{ key: 'a', label: 'A', width: 120 }];
  table.data = [{ a: 'x' }];
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 100));
  const cell = table.shadowRoot!.querySelector('.ft-cell, [role="gridcell"]');
  if (!cell) throw new Error('no cell rendered');
  return cell;
}

describe('flex-table font', () => {
  it('follows --u-font-base', async () => {
    theme = document.createElement('style');
    theme.textContent = ':root { --u-font-base: Georgia, serif; }';
    document.head.append(theme);
    const cell = await mount();
    expect(getComputedStyle(cell).fontFamily).toMatch(/^Georgia/);
  });

  it('an explicit --ft-font-family still wins', async () => {
    theme = document.createElement('style');
    theme.textContent = ':root { --u-font-base: Georgia, serif; }';
    document.head.append(theme);
    const cell = await mount('--ft-font-family: "Courier New", monospace');
    expect(getComputedStyle(cell).fontFamily).toMatch(/^"Courier New"/);
  });

  it('NEGATIVE — without the token the previous stack stays', async () => {
    const cell = await mount();
    expect(getComputedStyle(cell).fontFamily).toMatch(/^-apple-system/);
  });
});
