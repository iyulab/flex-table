import { describe, it, expect, afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * 표 격자의 끌기 제스처는 `dir="rtl"` 에서 화면을 따른다 — 열 너비 손잡이는 열의 끝 가장자리에 있고 끝 쪽(RTL 은 왼쪽)으로 끌면
 * 넓어지며, 머리 칸을 끝 쪽으로 끌면 다음 열 자리에 놓이고(드롭 표지는 그 자리의 시작 가장자리), 채움 손잡이는 선택 셀의 끝
 * 가장자리 모서리에 서서 끝 쪽으로 끌면 다음 열을 채운다. 끌기는 문서의 `mousemove`/`mouseup` 을 듣는 코드라 시험은 합성 마우스
 * 이벤트로 좌표를 준다(키보드와 달리 «닿는가» 가 아니라 «좌표가 어디로 풀리는가» 가 계약이다). 오라클은 «시작 가장자리» 기준이라
 * 방향 없이 같은 단언을 한다.
 */

const COLUMNS = [
  { key: 'id', label: 'ID', type: 'number', width: 80, pinned: 'left' },
  { key: 'a', label: 'A', type: 'text', width: 200, editable: true },
  { key: 'b', label: 'B', type: 'text', width: 200, editable: true },
  { key: 'c', label: 'C', type: 'text', width: 200, editable: true },
  { key: 'd', label: 'D', type: 'text', width: 200, editable: true },
];

let table: FlexTable;
afterEach(() => { table?.remove(); document.documentElement.dir = 'ltr'; });

async function mount(dir: 'ltr' | 'rtl'): Promise<FlexTable> {
  document.documentElement.dir = dir;
  table = document.createElement('flex-table') as FlexTable;
  table.setAttribute('layout', 'table');
  table.style.display = 'block';
  table.style.width = '760px';
  table.style.height = '300px';
  document.body.appendChild(table);
  table.editable = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (table as any).columns = COLUMNS;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (table as any).data = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, a: `a${i}`, b: `b${i}`, c: `c${i}`, d: `d${i}` }));
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 150));
  return table;
}

const settle = async () => {
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
  await table.updateComplete;
};
const fire = (target: EventTarget, type: string, x: number, y: number) =>
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
const mid = (r: DOMRect) => ({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 });
const header = (text: string) =>
  [...table.shadowRoot!.querySelectorAll<HTMLElement>('.ft-header-cell')].find((c) => c.textContent?.trim().startsWith(text))!;
const headerOrder = () =>
  [...table.shadowRoot!.querySelectorAll<HTMLElement>('.ft-header-cell')]
    .sort((p, q) => p.getBoundingClientRect().left - q.getBoundingClientRect().left)
    .map((c) => c.textContent?.trim().charAt(0));
const cell = (row: number, col: number) =>
  table.shadowRoot!.querySelector<HTMLElement>(`.ft-row[aria-rowindex="${row + 2}"] .ft-cell[aria-colindex="${col + 1}"]`)!;
const startOf = (r: DOMRect, dir: 'ltr' | 'rtl') => (dir === 'ltr' ? r.left : r.right);
const endOf = (r: DOMRect, dir: 'ltr' | 'rtl') => (dir === 'ltr' ? r.right : r.left);
const step = (dir: 'ltr' | 'rtl') => (dir === 'ltr' ? 1 : -1); // 끝 쪽 방향의 화면 부호

describe.each(['ltr', 'rtl'] as const)('RTL — flex-table 끌기 제스처 (%s)', (dir) => {
  it('열 너비 손잡이를 끝 쪽으로 끌면 열이 넓어진다', async () => {
    await mount(dir);
    const before = header('A').getBoundingClientRect().width;
    const handle = header('A').querySelector<HTMLElement>('.ft-resize-handle')!;
    expect(handle, 'A 머리에 너비 손잡이가 있다').toBeTruthy();
    const H = handle.getBoundingClientRect();
    expect(Math.abs((dir === 'ltr' ? H.right : H.left) - endOf(header('A').getBoundingClientRect(), dir)), `${dir}: 손잡이는 칸의 끝 가장자리`).toBeLessThan(3);
    const { x, y } = mid(H);
    fire(handle, 'mousedown', x, y);
    fire(document, 'mousemove', x + 40 * step(dir), y);
    fire(document, 'mouseup', x + 40 * step(dir), y);
    await settle();
    const after = header('A').getBoundingClientRect().width;
    expect(after - before, `${dir}: 너비 ${before} → ${after}`).toBeGreaterThan(30);
  });

  it('머리 칸을 끝 쪽으로 한 열 끌면 다음 열 뒤에 놓이고 드롭 표지는 그 자리의 시작 가장자리에 선다', async () => {
    await mount(dir);
    const a = header('A').getBoundingClientRect();
    const { x, y } = mid(a);
    expect(headerOrder(), '끌기 전 순서(화면 시작부터)').toEqual(dir === 'ltr' ? ['I', 'A', 'B', 'C', 'D'] : ['D', 'C', 'B', 'A', 'I']);
    fire(header('A'), 'mousedown', x, y);
    // B 의 가운데를 지나 C 의 시작 가장자리 근처로 — 목표 위치는 «B 뒤(C 앞)».
    const c = header('C').getBoundingClientRect();
    const toX = startOf(c, dir) + 20 * step(dir);
    fire(document, 'mousemove', x + 12 * step(dir), y);
    fire(document, 'mousemove', toX, y);
    await settle();
    const indicator = table.shadowRoot!.querySelector<HTMLElement>('.ft-drop-indicator');
    expect(indicator, '드롭 표지가 그려진다').toBeTruthy();
    const I = indicator!.getBoundingClientRect();
    expect(Math.abs(startOf(I, dir) - startOf(c, dir)), `${dir}: 표지 ${startOf(I, dir)} · C 의 시작 가장자리 ${startOf(c, dir)}`).toBeLessThan(4);
    fire(document, 'mouseup', toX, y);
    await settle();
    // 순서(읽는 방향) — A 가 B 뒤로.
    const reading = dir === 'ltr' ? headerOrder() : headerOrder().reverse();
    expect(reading, `${dir}: 읽는 방향 순서`).toEqual(['I', 'B', 'A', 'C', 'D']);
  });

  it('채움 손잡이는 선택 셀의 끝 가장자리 모서리에 서고, 아래로 끌면 같은 열의 아래 셀을 채운다(열 판정이 화면 좌표를 바로 푼다)', async () => {
    await mount(dir);
    await userEvent.click(cell(0, 2));
    await settle();
    const handle = table.shadowRoot!.querySelector<HTMLElement>('.ft-fill-handle');
    expect(handle, '채움 손잡이가 그려진다').toBeTruthy();
    const B = cell(0, 2).getBoundingClientRect();
    const H = handle!.getBoundingClientRect();
    const hCenter = (H.left + H.right) / 2;
    expect(Math.abs(hCenter - endOf(B, dir)), `${dir}: 손잡이 중심 ${hCenter} · 셀의 끝 가장자리 ${endOf(B, dir)}`).toBeLessThan(6);
    const { x, y } = mid(H);
    // 끌기의 열 판정은 포인터의 가로 좌표를 열 오프셋과 같은 좌표계로 풀어야 한다 — 같은 열 가운데에서 아래로 끌면 «행 채움» 이다.
    const down = mid(cell(3, 2).getBoundingClientRect());
    fire(handle!, 'mousedown', x, y);
    fire(document, 'mousemove', down.x, down.y);
    fire(document, 'mouseup', down.x, down.y);
    await settle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (table as any).data as { b: string }[];
    expect([rows[1].b, rows[2].b, rows[3].b], `${dir}: 채움이 아래 셋으로 번졌다`).toEqual(['b0', 'b0', 'b0']);
  });
});
