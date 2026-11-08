import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * 열린 메뉴는 한 번에 하나다 — 열 메뉴가 열려 있는 채 셀을 오른쪽 클릭하면(그 클릭은 문서 `click` 을
 * 만들지 않는다) 둘이 함께 뜨지 않아야 하고, 그 반대도 같다. 배치와 실제 이벤트 경로가 걸린 계약이라 브라우저에서 잰다.
 */

let host: HTMLElement;

async function mount(): Promise<FlexTable> {
  host = document.createElement('div');
  host.setAttribute('style', 'padding:20px;width:400px');
  document.body.appendChild(host);
  const el = document.createElement('flex-table') as FlexTable;
  el.style.display = 'block';
  el.style.width = '100%';
  el.style.height = '200px';
  el.setAttribute('show-context-menu', '');
  host.appendChild(el);
  el.showFilters = true;
  el.columns = [
    { key: 'a', label: 'A', width: 140 },
    { key: 'b', label: 'B', width: 140 },
  ];
  el.data = [{ a: 'a1', b: 'b1' }, { a: 'a2', b: 'b2' }];
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 80));
  return el;
}

afterEach(() => {
  host?.remove();
});

const openCount = (el: FlexTable) => ({
  header: el.shadowRoot!.querySelectorAll('.ft-header-menu').length,
  body: el.shadowRoot!.querySelectorAll('.ft-body-context-menu').length,
});

async function rightClickCell(el: FlexTable) {
  const cell = el.shadowRoot!.querySelector<HTMLElement>('.ft-cell')!;
  const r = cell.getBoundingClientRect();
  cell.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true, composed: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5,
  }));
  await el.updateComplete;
  await el.updateComplete;
}

describe('flex-table 열린 메뉴는 하나다', () => {
  it('열 메뉴가 열린 채 셀을 오른쪽 클릭하면 열 메뉴는 닫히고 셀 메뉴만 남는다', async () => {
    const el = await mount();
    el.shadowRoot!.querySelector<HTMLElement>('.ft-column-menu-btn')!.click();
    await el.updateComplete;
    await el.updateComplete;
    expect(openCount(el)).toEqual({ header: 1, body: 0 });

    await rightClickCell(el);
    expect(openCount(el)).toEqual({ header: 0, body: 1 });
  });

  it('셀 메뉴가 열린 채 열 메뉴 버튼을 누르면 셀 메뉴는 닫히고 열 메뉴만 남는다', async () => {
    const el = await mount();
    await rightClickCell(el);
    expect(openCount(el)).toEqual({ header: 0, body: 1 });

    el.shadowRoot!.querySelector<HTMLElement>('.ft-column-menu-btn')!.click();
    await el.updateComplete;
    await el.updateComplete;
    expect(openCount(el)).toEqual({ header: 1, body: 0 });
  });
});
