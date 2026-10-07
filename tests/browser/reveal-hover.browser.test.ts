import { describe, it, expect, afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import { html } from 'lit';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * `reveal: 'hover'` — a row-actions column shows while its row is hovered, focused or selected.
 * Measured with computed opacity (jsdom does not compute the cascade). The content stays in the
 * DOM and focusable, so keyboard users reach it.
 */
let table: FlexTable;

function mount(): FlexTable {
  const el = document.createElement('flex-table') as FlexTable;
  el.style.display = 'block';
  el.style.width = '400px';
  el.style.height = '200px';
  document.body.appendChild(el);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (el as any).columns = [
    { key: 'name', label: 'Name', width: 160 },
    { key: 'actions', label: '', width: 80, reveal: 'hover', editable: false,
      render: () => html`<button class="act">Edit</button>` },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (el as any).data = [{ name: 'a' }, { name: 'b' }];
  return el;
}

async function settle(el: FlexTable): Promise<void> {
  await el.updateComplete;
  // «At rest» means no pointer over a row — a file run before this one may have left the mouse where a row now is.
  await userEvent.unhover(el);
  await new Promise((r) => setTimeout(r, 150));
  await el.updateComplete;
}

const row = (el: FlexTable, i: number) => el.shadowRoot!.querySelector<HTMLElement>(`.ft-row[aria-rowindex="${i + 2}"]`)!;
const action = (el: FlexTable, i: number) => row(el, i).querySelector<HTMLElement>('.ft-reveal-hover > *')!;
const opacity = (n: HTMLElement) => getComputedStyle(n).opacity;

afterEach(() => table?.remove());

describe("flex-table column reveal: 'hover'", () => {
  it('hides the content at rest but keeps it in the DOM', async () => {
    table = mount();
    await settle(table);
    const btn = action(table, 0);
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('Edit');
    // Allow the transition to settle at 0.
    await new Promise((r) => setTimeout(r, 200));
    expect(opacity(btn)).toBe('0');
  });

  it('shows it when the row holds focus (keyboard reaches the control)', async () => {
    table = mount();
    await settle(table);
    const btn = row(table, 1).querySelector<HTMLButtonElement>('button.act')!;
    btn.focus();
    // 고정 대기(200ms)는 전체 스위트 부하에서 140ms 전환의 끝을 놓쳤다(0.9554) — 그 요소의 전환이 끝나기를 기다린다.
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    await Promise.all(btn.getAnimations().map((a) => a.finished));
    expect(opacity(btn)).toBe('1');
    expect(opacity(action(table, 0))).toBe('0');
  });

  it('a column without reveal is unaffected', async () => {
    table = mount();
    await settle(table);
    const nameCell = row(table, 0).querySelector<HTMLElement>('.ft-cell[data-col-index="0"]')!;
    expect(nameCell.classList.contains('ft-reveal-hover')).toBe(false);
  });
});
