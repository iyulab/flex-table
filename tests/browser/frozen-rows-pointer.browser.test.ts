import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * 고정 행 띠는 `position: sticky` 라 **스크롤해도 제자리**에 있다. 포인터 y 를 행으로 바꿀 때
 * 그 띠 위에서는 스크롤 양을 더하면 안 된다 — 더하면 띠 «뒤에 가려진» 본문 행을 가리킨다.
 * 행 끌기와 채우기 핸들 둘 다 그 식을 썼다(기술부채 표 «frozen row fill handle» · «row drag +
 * frozen row» 의 실체). ⚠좌표는 계산된 배치라 jsdom 에서는 잴 수 없다 — 이 파일이 여기 사는 이유.
 */

let table: FlexTable;

function mount(): FlexTable {
  const el = document.createElement('flex-table') as FlexTable;
  el.style.display = 'block';
  el.style.width = '500px';
  el.style.height = '300px';
  document.body.appendChild(el);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = el as any;
  any.columns = [
    { key: 'id', header: 'ID', type: 'number', width: 80 },
    { key: 'a', header: 'A', type: 'text', width: 160 },
  ];
  any.data = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, a: `a${i + 1}` }));
  any.frozenRows = 2;
  any.showRowNumbers = true;
  return el;
}

async function settle(el: FlexTable): Promise<void> {
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
  await el.updateComplete;
}

const fire = (target: EventTarget, type: string, x: number, y: number) =>
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true, cancelable: true, button: 0, clientX: x, clientY: y }));

/** 고정 행 `row`(0 기준) 안, 위에서 40% 지점의 뷰포트 y. */
function yInFrozenRow(el: FlexTable, row: number): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rowH = (el as any).rowHeight as number;
  const band = el.shadowRoot!.querySelector('.ft-frozen-rows')!.getBoundingClientRect();
  return band.top + row * rowH + rowH * 0.4;
}

afterEach(() => {
  table?.remove();
});

describe('frozen rows — pointer y maps to the row under the pointer while scrolled', () => {
  it('🔴row drag released over a frozen row lands there, not on the body row hidden behind it', async () => {
    table = mount();
    await settle(table);
    table.scrollTop = 180;
    await settle(table);

    const handle = [...table.shadowRoot!.querySelectorAll<HTMLElement>('.ft-row-num')].find((n) => n.textContent === '12')!;
    const r = handle.getBoundingClientRect();
    const x = r.left + r.width / 2;
    fire(handle, 'mousedown', x, r.top + r.height / 2);
    const y = yInFrozenRow(table, 1);
    fire(document, 'mousemove', x, y);
    fire(document, 'mousemove', x, y + 1);
    fire(document, 'mouseup', x, y + 1);
    await settle(table);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = ((table as any).data as { id: number }[]).map((d) => d.id);
    expect(ids.slice(0, 3)).toEqual([1, 12, 2]);
  });

  it('🔴fill handle dragged up into the frozen band fills up to the frozen row', async () => {
    table = mount();
    await settle(table);
    table.scrollTop = 180;
    await settle(table);

    const cell = [...table.shadowRoot!.querySelectorAll<HTMLElement>('.ft-cell')].find((c) => c.textContent?.trim() === 'a12')!;
    const c = cell.getBoundingClientRect();
    fire(cell, 'mousedown', c.left + 5, c.top + 5);
    fire(document, 'mouseup', c.left + 5, c.top + 5);
    fire(cell, 'click', c.left + 5, c.top + 5);
    await settle(table);

    const fill = table.shadowRoot!.querySelector<HTMLElement>('.ft-fill-handle')!;
    expect(fill, 'fill handle is rendered for the selected cell').toBeTruthy();
    const f = fill.getBoundingClientRect();
    fire(fill, 'mousedown', f.left + 2, f.top + 2);
    const y = yInFrozenRow(table, 0);
    fire(document, 'mousemove', c.left + 5, y);
    fire(document, 'mouseup', c.left + 5, y);
    await settle(table);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = ((table as any).data as { a: string }[]).map((d) => d.a);
    expect(a[0], 'the frozen row under the pointer is filled').toBe('a12');
    expect(a[1]).toBe('a12');
  });
});
