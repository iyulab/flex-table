import { describe, it, afterEach, expect, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * **좁은 폭의 카드 목록 폴백** — `layout="auto"` 는 그리드가 맞지 않는 자리에서 행을 카드로 그린다:
 * ⑴휴대폰(창이 `card-breakpoint` 보다 좁다) ⑵넓은 창의 좁은 자리에서 열 합계가 들어가지 않을 때.
 * 들어가는 좁은 자리는 그리드로 남는다. 앱이 `layout` 을 정하지 않았으면 콘솔에 한 번. u-rich-table 과 같은 어휘.
 */

const COLUMNS = [
  { key: 'id', label: 'Order', width: 120 },
  { key: 'customer', label: 'Customer', width: 160 },
  { key: 'status', label: 'Status', width: 120 },
];
const ROWS = [
  { id: 'G-1', customer: 'Aster', status: 'pending' },
  { id: 'G-2', customer: 'Birch', status: 'shipped' },
];

afterEach(async () => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  await page.viewport(1280, 900);
});

const settle = async (el: FlexTable) => {
  for (let i = 0; i < 3; i++) {
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 30));
  }
  await el.updateComplete;
};

async function mount(width: string, props: Partial<FlexTable> = {}): Promise<FlexTable> {
  const el = document.createElement('flex-table') as FlexTable;
  el.columns = COLUMNS;
  el.data = ROWS.map((r) => ({ ...r }));
  el.rowKey = 'id';
  el.editable = false;
  Object.assign(el, props);
  el.style.display = 'block';
  // 왼쪽에 자리를 둔다 — 넓힌 시험 창에서 iframe 왼쪽 가장자리 띠의 작은 대상(카드 선택 상자 x≈19)은 Playwright 클릭이
  // 아무 이벤트도 일으키지 못했다(pointerdown 0건 · 같은 상자를 오른쪽으로 옮기면 닿는다). 시험 하네스의 일이다.
  el.style.marginInlineStart = '48px';
  el.style.width = width;
  el.style.height = '300px';
  document.body.appendChild(el);
  await settle(el);
  return el;
}

const cards = (el: FlexTable) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('li.ft-card')];
const isGrid = (el: FlexTable) => el.shadowRoot!.querySelector('.ft-header') !== null;
const notes = (warn: { mock: { calls: unknown[][] } }) => warn.mock.calls.filter(([m]) => String(m).includes('drew its rows as cards'));

describe('flex-table — 카드 폴백', () => {
  it('🔴휴대폰 폭이면(auto) 행이 카드다 — 제목 · 라벨:값 · 그리드 역할을 내려놓는다 · 콘솔에 한 번', async () => {
    await page.viewport(390, 844);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = await mount('100%');
    expect(isGrid(el)).toBe(false);
    expect(cards(el)).toHaveLength(2);
    expect(cards(el)[0].querySelector('.ft-card-title')!.textContent!.trim()).toBe('G-1');
    expect([...cards(el)[0].querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Customer', 'Status']);
    expect(el.getAttribute('role')).toBeNull();
    expect(notes(warn)).toHaveLength(1);
    expect(String(notes(warn)[0][0])).toMatch(/^\[@iyulab\/flex-table\] .*screen is 390px/);
  });

  it('🔴넓은 창의 좁은 자리에서 열이 들어가지 않으면 카드 — 넓히면 그리드로 돌아온다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = await mount('300px');
    expect(cards(el)).toHaveLength(2);
    expect(String(notes(warn)[0][0])).toMatch(/\d+px wide and its columns need 400px/);
    el.style.width = '900px';
    await settle(el);
    expect(isGrid(el)).toBe(true);
    expect(el.getAttribute('role')).toBe('grid');
  });

  it('⚪NEGATIVE — 넓은 창에서 좁아도 열이 들어가면 그리드 · 넓으면 그리드 · 알림 없음', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(isGrid(await mount('500px'))).toBe(true);
    expect(isGrid(await mount('900px'))).toBe(true);
    expect(notes(warn)).toHaveLength(0);
  });

  it('🔴앱이 정하면 그대로 — 휴대폰에서도 table 은 그리드, 넓어도 cards 는 카드 · 알림 없음', async () => {
    await page.viewport(390, 844);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(isGrid(await mount('100%', { layout: 'table' }))).toBe(true);
    await page.viewport(1280, 900);
    expect(cards(await mount('900px', { layout: 'cards' }))).toHaveLength(2);
    expect(notes(warn)).toHaveLength(0);
  });

  it('🔴편집 열이 있는 표는 auto 에서 휴대폰이어도 그리드', async () => {
    await page.viewport(390, 844);
    const el = await mount('100%', { editable: true, columns: [...COLUMNS.slice(0, 2), { key: 'status', label: 'Status', editable: true }] });
    expect(isGrid(el)).toBe(true);
  });

  it('🔴열의 card 역할 — title 이 제목, hidden 은 빠진다', async () => {
    const el = await mount('900px', {
      layout: 'cards',
      columns: [{ key: 'id', label: 'Order', card: 'hidden' }, { key: 'customer', label: 'Customer', card: 'title' }, { key: 'status', label: 'Status' }],
    });
    expect(cards(el)[0].querySelector('.ft-card-title')!.textContent!.trim()).toBe('Aster');
    expect([...cards(el)[0].querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Status']);
  });

  it('🔴카드를 누르면 row-activate(click) · Enter 는 (keyboard) · 체크박스는 선택만', async () => {
    const el = await mount('900px', { layout: 'cards', selectable: true });
    const events: string[] = [];
    el.addEventListener('row-activate', (e) => events.push(`${(e as CustomEvent).detail.id}:${(e as CustomEvent).detail.via}`));
    const selections: string[][] = [];
    el.addEventListener('selection-change', (e) => selections.push([...(e as CustomEvent).detail.selectedIds]));
    await userEvent.click(cards(el)[1].querySelector('.ft-card-title')!);
    expect(events).toEqual(['G-2:click']);
    cards(el)[0].focus();
    await userEvent.keyboard('{Enter}');
    expect(events).toEqual(['G-2:click', 'G-1:keyboard']);
    await userEvent.click(cards(el)[0].querySelector('input[type="checkbox"]')!);
    expect(selections.at(-1)).toEqual(['G-1']);
    expect(events).toHaveLength(2);
  });
});
