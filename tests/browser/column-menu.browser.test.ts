import { describe, it, expect, afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * 머리의 열 메뉴 — 고정 위치 팝업이라 **화면 어디에 뜨는가**와 **실제 키 입력으로 닿는가**는
 * 계산된 배치와 트러스티드 입력으로만 잴 수 있다(jsdom 은 좌표가 전부 0 이고 합성 키는 포커스를 옮기지 않는다).
 */

let host: HTMLElement;

async function mount(style: string): Promise<FlexTable> {
  host = document.createElement('div');
  host.setAttribute('style', style);
  document.body.appendChild(host);
  const el = document.createElement('flex-table') as FlexTable;
  el.style.display = 'block';
  el.style.width = '100%';
  el.style.height = '200px';
  host.appendChild(el);
  el.showFilters = true;
  el.columns = [
    { key: 'a', header: 'A', width: 140 },
    { key: 'b', header: 'B', width: 140 },
  ];
  el.data = [{ a: 'a1', b: 'b1' }, { a: 'a2', b: 'b2' }];
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 80));
  return el;
}

afterEach(() => {
  host?.remove();
});

describe('flex-table 열 메뉴', () => {
  it('오른쪽 끝 열의 메뉴도 뷰포트 안에 뜬다', async () => {
    // 표를 창 오른쪽 끝에 붙인다 — 버튼 왼쪽에 메뉴를 그대로 펴면 창 밖으로 나간다.
    const el = await mount(`position:fixed;top:20px;right:0;width:290px`);
    const buttons = el.shadowRoot!.querySelectorAll<HTMLElement>('.ft-column-menu-btn');
    buttons[buttons.length - 1].click();
    await el.updateComplete;
    await el.updateComplete;

    const menu = el.shadowRoot!.querySelector<HTMLElement>('.ft-header-menu')!;
    const r = menu.getBoundingClientRect();
    expect(r.width, '메뉴가 렌더되지 않았다').toBeGreaterThan(100);
    // 보이는 폭(스크롤바 제외) 기준 — 창 폭에 맞추면 스크롤바 밑에 깔린다(게이트의 hit-test 가 잡았다).
    const viewWidth = document.documentElement.clientWidth;
    expect(Math.round(r.right), `메뉴 [${Math.round(r.left)}, ${Math.round(r.right)}] · 보이는 폭 ${viewWidth}`)
      .toBeLessThanOrEqual(viewWidth);
    expect(r.left).toBeGreaterThanOrEqual(0);
  });

  it('키보드만으로 필터를 연다 — 버튼에서 Enter 로 메뉴, ↓↓ 로 «Filter…», Enter 로 드롭다운 입력에 포커스', async () => {
    const el = await mount('padding:20px;width:400px');
    const button = el.shadowRoot!.querySelector<HTMLElement>('.ft-column-menu-btn')!;
    button.focus();
    await userEvent.keyboard('{Enter}');
    await el.updateComplete;
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('data-action')).toBe('sort-asc');

    // 정렬 둘 다음이 «Filter…» 다 — 구분선은 포커스 대상이 아니다.
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(el.shadowRoot!.activeElement?.getAttribute('data-action')).toBe('filter');

    await userEvent.keyboard('{Enter}');
    await el.updateComplete;
    await el.updateComplete;
    const active = el.shadowRoot!.activeElement as HTMLElement | null;
    expect(active?.closest('.ft-filter-dropdown'), `포커스: ${active?.outerHTML.slice(0, 80)}`).toBeTruthy();
  });

  it('메뉴의 «Wider» 는 실제 클릭으로도 열 폭을 한 단계 넓히고 메뉴를 닫지 않는다', async () => {
    const el = await mount('padding:20px;width:400px');
    const cell = () => el.shadowRoot!.querySelector<HTMLElement>('.ft-header-cell[data-col-index="0"]')!;
    const before = cell().getBoundingClientRect().width;

    el.shadowRoot!.querySelector<HTMLElement>('.ft-column-menu-btn')!.click();
    await el.updateComplete;
    await userEvent.click(el.shadowRoot!.querySelector<HTMLElement>('[data-action="wider"]')!);
    await el.updateComplete;

    expect(Math.round(cell().getBoundingClientRect().width - before)).toBe(20);
    expect(el.shadowRoot!.querySelector('.ft-header-menu')).toBeTruthy();
  });
});
