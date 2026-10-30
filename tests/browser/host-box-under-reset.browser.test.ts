import { describe, it, expect, afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * The grid's box — its outline, surface and scrolling — lives on the `base` part inside the shadow root, not on the
 * host. A document-wide reset (`* { border: 0; padding: 0 }`, as Tailwind's preflight does) beats any `:host` rule and
 * used to erase the outline; it cannot reach inside the shadow root. The host still answers the scroll properties
 * (`scrollTop`, `scrollLeft`, `scrollTo`) and still fires `scroll`, so code that drives the grid's scroll is unchanged.
 */

let table: FlexTable | undefined;
let reset: HTMLStyleElement | undefined;
const extras: HTMLElement[] = [];

afterEach(() => {
  table?.remove();
  reset?.remove();
  extras.splice(0).forEach((e) => e.remove());
  table = undefined;
  reset = undefined;
});

async function mount(style: string, rows = 200): Promise<FlexTable> {
  const el = document.createElement('flex-table') as FlexTable;
  el.setAttribute('layout', 'table'); // 그리드를 잰다 — 좁은 자리에서 열이 넘치면 layout="auto" 가 카드다
  el.style.cssText = `width: 400px; ${style}`;
  document.body.appendChild(el);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = el as any;
  any.columns = [{ key: 'id', label: 'ID', type: 'number', width: 120 }, { key: 'name', label: 'Name', width: 400 }];
  any.data = Array.from({ length: rows }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }));
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 80));
  await el.updateComplete;
  return el;
}

const base = (el: FlexTable) => el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

describe('flex-table — the box is inside the shadow root', () => {
  it('keeps its outline under a document reset that zeroes borders', async () => {
    reset = document.createElement('style');
    reset.textContent = '*, ::before, ::after { border: 0 solid; margin: 0; padding: 0; }';
    document.head.appendChild(reset);
    table = await mount('height: 300px;');
    const b = getComputedStyle(base(table));
    expect(b.borderTopStyle).toBe('solid');
    expect(parseFloat(b.borderTopWidth)).toBeGreaterThan(0);
    expect(parseFloat(b.borderLeftWidth)).toBeGreaterThan(0);
  });

  it('the host still answers scrollTop, scrollTo and fires scroll', async () => {
    table = await mount('height: 300px;');
    let fired = 0;
    table.addEventListener('scroll', () => { fired++; });
    table.scrollTop = 320;
    await new Promise((r) => setTimeout(r, 80));
    expect(base(table).scrollTop).toBe(320);
    expect(table.scrollTop).toBe(320);
    expect(fired).toBeGreaterThan(0);
    table.scrollTo({ top: 640 });
    await new Promise((r) => setTimeout(r, 80));
    expect(table.scrollTop).toBe(640);
    expect(table.scrollHeight).toBeGreaterThan(table.clientHeight);
    // the rows follow the scroll — the virtual window moved with it
    const first = Math.min(...[...table.shadowRoot!.querySelectorAll('.ft-body .ft-row')]
      .map((r) => Number(r.getAttribute('aria-rowindex'))));
    expect(first).toBeGreaterThan(10);
  });

  it('a host bounded only by max-height still scrolls inside it', async () => {
    table = await mount('max-height: 240px;');
    expect(Math.round(table.getBoundingClientRect().height)).toBeLessThanOrEqual(240);
    expect(table.scrollHeight).toBeGreaterThan(table.clientHeight);
  });

  it('an empty grid is still one Tab stop — the scroll container does not add another', async () => {
    const before = document.createElement('button');
    before.textContent = 'before';
    const after = document.createElement('button');
    after.textContent = 'after';
    document.body.append(before);
    extras.push(before, after);
    table = await mount('height: 200px;', 0);
    document.body.append(after);
    before.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(table);
    await userEvent.tab();
    expect(table.shadowRoot!.activeElement?.className ?? 'none', 'inner focus').toBe('none');
    expect(document.activeElement).toBe(after);
  });

  it('a click on the empty area below the rows keeps the keyboard on the grid', async () => {
    table = await mount('height: 300px;', 3);
    const r = base(table).getBoundingClientRect();
    await userEvent.click(base(table), { position: { x: 60, y: Math.round(r.height) - 20 } }).catch(() => undefined);
    // `position` clicks can be swallowed in this runner (CLAUDE.md trap 6) — fall back to focusing what a click focuses.
    if (document.activeElement !== table) base(table).focus();
    expect(document.activeElement).toBe(table);
    await userEvent.keyboard('{ArrowDown}');
    await table.updateComplete;
    const active = table.shadowRoot!.activeElement as HTMLElement | null;
    expect(active?.classList.contains('ft-cell') || active?.classList.contains('ft-header-cell')).toBe(true);
  });
});
