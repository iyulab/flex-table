import { describe, it, expect, afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * 열 머리글 설명(`ColumnDefinition.description`) — 아이콘 + 툴팁은 «어디에 뜨는가»(고정 위치)와
 * «키보드로 닿는가» 가 계약이라 실제 배치와 실제 입력으로 잰다.
 */

let host: HTMLElement;

async function mount(style = 'position:fixed;top:60px;left:20px;width:480px'): Promise<FlexTable> {
  host = document.createElement('div');
  host.setAttribute('style', style);
  document.body.appendChild(host);
  const el = document.createElement('flex-table') as FlexTable;
  el.style.display = 'block';
  el.style.width = '100%';
  el.style.height = '200px';
  host.appendChild(el);
  el.columns = [
    { key: 'a', label: 'A', width: 160, description: 'Billed amount — by the billing party\'s unit price' },
    { key: 'b', label: 'B', width: 160 },
  ];
  el.data = [{ a: 'a1', b: 'b1' }, { a: 'a2', b: 'b2' }];
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 80));
  return el;
}

const cell = (el: FlexTable, i: number) => el.shadowRoot!.querySelector<HTMLElement>(`.ft-header-cell[data-col-index="${i}"]`)!;
const tooltip = (el: FlexTable) => el.shadowRoot!.querySelector<HTMLElement>('.ft-header-tooltip');
const settle = () => new Promise((r) => setTimeout(r, 80));

afterEach(() => {
  host?.remove();
});

describe('flex-table 열 머리글 설명', () => {
  it('설명이 있는 열만 아이콘을 갖고, 머리 칸이 aria-description 으로 전달한다', async () => {
    const el = await mount();
    expect(cell(el, 0).querySelector('.ft-header-hint')).toBeTruthy();
    expect(cell(el, 0).getAttribute('aria-description')).toContain('Billed amount');
    expect(cell(el, 1).querySelector('.ft-header-hint')).toBeNull();
    expect(cell(el, 1).hasAttribute('aria-description')).toBe(false);
  });

  it('아이콘에 마우스를 올리면 칸 위에 뜨고 벗어나면 닫힌다 — 정렬은 일어나지 않는다', async () => {
    const el = await mount();
    const icon = cell(el, 0).querySelector<HTMLElement>('.ft-header-hint')!;
    await userEvent.hover(icon);
    await settle();
    const tip = tooltip(el)!;
    expect(tip).toBeTruthy();
    expect(tip.textContent).toContain('Billed amount');
    const t = tip.getBoundingClientRect();
    const c = cell(el, 0).getBoundingClientRect();
    expect(t.bottom).toBeLessThanOrEqual(c.top);
    expect(t.left).toBeGreaterThanOrEqual(0);
    expect(t.right).toBeLessThanOrEqual(document.documentElement.clientWidth);
    await userEvent.unhover(icon);
    await settle();
    expect(tooltip(el)).toBeNull();
    expect(el.sortCriteria).toEqual([]);
  });

  it('아이콘 클릭은 정렬을 일으키지 않고 툴팁을 닫지 않는다 — 바깥 클릭이 닫는다', async () => {
    const el = await mount();
    const icon = cell(el, 0).querySelector<HTMLElement>('.ft-header-hint')!;
    await userEvent.click(icon);
    await settle();
    expect(tooltip(el)).toBeTruthy();
    expect(el.sortCriteria).toEqual([]);
    await userEvent.click(document.body);
    await settle();
    expect(tooltip(el)).toBeNull();
  });

  it('키보드가 머리 칸에 있으면 열리고, 다른 열로 옮기거나 Escape 면 닫힌다', async () => {
    const el = await mount();
    await userEvent.click(el.shadowRoot!.querySelector<HTMLElement>('.ft-cell')!);
    await userEvent.keyboard('{ArrowUp}');
    await settle();
    expect(tooltip(el)).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    await settle();
    expect(tooltip(el)).toBeNull();
    // Escape 로 닫은 열에서는 다시 열리지 않는다 — 다른 열을 다녀오면 열린다.
    await userEvent.keyboard('{ArrowRight}');
    await settle();
    expect(tooltip(el)).toBeNull();
    await userEvent.keyboard('{ArrowLeft}');
    await settle();
    expect(tooltip(el)).toBeTruthy();
    await userEvent.keyboard('{ArrowRight}');
    await settle();
    expect(tooltip(el)).toBeNull();
  });

  it('머리 칸을 마우스로 눌러서는 키보드 툴팁이 뜨지 않는다', async () => {
    const el = await mount();
    await userEvent.click(cell(el, 1));
    await settle();
    expect(tooltip(el)).toBeNull();
  });
});
