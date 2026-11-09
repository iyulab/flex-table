import { describe, it, expect, afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * 표 격자는 `dir="rtl"` 에서 **거울**이 된다(표 · 시트 격자는 방향을 따른다). 열은 읽는 방향의 시작부터 흐르고, 시작 쪽 고정
 * 열은 시작 가장자리에, 끝 쪽 고정 열은 끝 가장자리에 붙으며, 가상 가로 스크롤 · 방향키 · 열 너비 키는 화면을 따른다. 오라클은
 * «시작 가장자리» 기준이라 방향 없이 같은 단언을 한다(LTR 은 왼쪽 · RTL 은 오른쪽). 배치를 계산하는 JS 의 좌표가 물리면
 * CSS 만 거울인 반쪽이 된다 — 고정 열은 반대편에 붙고 가상 범위는 스크롤 부호에 속고 방향키는 화면과 어긋난다.
 *
 * 브라우저 스크롤 규약: RTL 에서 `scrollLeft` 는 시작(오른쪽)이 0 이고 끝으로 갈수록 음수다.
 */

const HOST_WIDTH = 600;
const PIN_WIDTH = 88;
const COLUMNS = [
  { key: 'id', label: 'ID', type: 'number', width: 80, pinned: 'left' },
  { key: 'a', label: 'A', type: 'text', width: 200, editable: true },
  { key: 'b', label: 'B', type: 'text', width: 200, editable: true },
  { key: 'c', label: 'C', type: 'text', width: 200, editable: true },
  { key: 'd', label: 'D', type: 'text', width: 200, editable: true },
  { key: 'act', label: 'Act', type: 'text', width: PIN_WIDTH, pinned: 'right' },
];

let table: FlexTable;
afterEach(() => { table?.remove(); document.documentElement.dir = 'ltr'; });

async function mount(dir: 'ltr' | 'rtl'): Promise<FlexTable> {
  document.documentElement.dir = dir;
  table = document.createElement('flex-table') as FlexTable;
  table.setAttribute('layout', 'table');
  table.style.display = 'block';
  table.style.width = `${HOST_WIDTH}px`;
  table.style.height = '300px';
  document.body.appendChild(table);
  table.editable = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (table as any).columns = COLUMNS;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (table as any).data = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, a: `a${i}`, b: `b${i}`, c: `c${i}`, d: `d${i}`, act: 'edit' }));
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 150));
  return table;
}

const settle = async () => {
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
  await table.updateComplete;
};

const base = () => table.shadowRoot!.querySelector<HTMLElement>('.ft-base')!;
const cell = (row: number, col: number) =>
  table.shadowRoot!.querySelector<HTMLElement>(`.ft-row[aria-rowindex="${row + 2}"] .ft-cell[aria-colindex="${col + 1}"]`);
const header = (text: string) =>
  [...table.shadowRoot!.querySelectorAll<HTMLElement>('.ft-header-cell')].find((c) => c.textContent?.trim().startsWith(text))!;

/** 스크롤 영역의 가장자리 — 세로 스크롤바(RTL 은 왼쪽에 선다)를 뺀 «내용 영역». */
function viewport() {
  const B = base().getBoundingClientRect();
  const bar = base().offsetWidth - base().clientWidth;
  const rtl = getComputedStyle(base()).direction === 'rtl';
  return rtl ? { left: B.left + bar, right: B.right } : { left: B.left, right: B.right - bar };
}
const startOf = (r: { left: number; right: number }, dir: 'ltr' | 'rtl') => (dir === 'ltr' ? r.left : r.right);

async function scrollToEnd(dir: 'ltr' | 'rtl') {
  table.scrollLeft = dir === 'ltr' ? 100000 : -100000;
  await settle();
  await new Promise((r) => setTimeout(r, 60));
  expect(Math.abs(table.scrollLeft), '이 픽스처는 가로로 넘쳐야 의미가 있다').toBeGreaterThan(50);
}

describe.each(['ltr', 'rtl'] as const)('RTL — flex-table (%s)', (dir) => {
  it('열은 시작부터 흐르고 본문 셀은 자기 머리 셀 아래에 선다', async () => {
    await mount(dir);
    const hA = header('A').getBoundingClientRect();
    const hB = header('B').getBoundingClientRect();
    const cA = cell(0, 1)!.getBoundingClientRect();
    expect(Math.abs(startOf(cA, dir) - startOf(hA, dir)), `${dir}: A 열의 머리와 셀 시작 가장자리`).toBeLessThan(2);
    if (dir === 'ltr') expect(hB.left).toBeGreaterThan(hA.left); else expect(hB.right).toBeLessThan(hA.right);
  });

  it('시작 쪽 고정 열은 시작 가장자리에, 끝 쪽 고정 열은 끝 가장자리에 — 끝까지 스크롤해도', async () => {
    await mount(dir);
    await scrollToEnd(dir);
    const V = viewport();
    const idStart = startOf(header('ID').getBoundingClientRect(), dir);
    expect(Math.abs(idStart - startOf(V, dir)), `${dir}: 시작 쪽 고정 열 ${idStart} · 시작 가장자리 ${startOf(V, dir)}`).toBeLessThan(2);
    const act = header('Act').getBoundingClientRect();
    const actEnd = dir === 'ltr' ? act.right : act.left;
    const vEnd = dir === 'ltr' ? V.right : V.left;
    expect(Math.abs(actEnd - vEnd), `${dir}: 끝 쪽 고정 열 ${actEnd} · 끝 가장자리 ${vEnd}`).toBeLessThan(2);
  });

  it('끝까지 스크롤하면 마지막 열이 그려져 있고 보이는 영역 안에 있다(가상 범위가 스크롤 부호에 속지 않는다)', async () => {
    await mount(dir);
    await scrollToEnd(dir);
    const d = cell(0, 4);
    expect(d, `${dir}: D 열 셀이 DOM 에 있다`).not.toBeNull();
    const D = d!.getBoundingClientRect();
    const V = viewport();
    expect(D.left, `${dir}: D 열 [${D.left}..${D.right}] · 보이는 영역 [${V.left}..${V.right}]`).toBeGreaterThanOrEqual(V.left - 2);
    expect(D.right).toBeLessThanOrEqual(V.right + 2);
  });

  it('화면의 «다음 열» 방향키가 다음 열로 간다(LTR 오른쪽 · RTL 왼쪽)', async () => {
    await mount(dir);
    await userEvent.click(cell(0, 1)!);
    await settle();
    await userEvent.keyboard(dir === 'ltr' ? '{ArrowRight}' : '{ArrowLeft}');
    await settle();
    expect([table.activeCell?.row, table.activeCell?.col]).toEqual([0, 2]);
    await userEvent.keyboard(dir === 'ltr' ? '{ArrowLeft}' : '{ArrowRight}');
    await settle();
    expect([table.activeCell?.row, table.activeCell?.col]).toEqual([0, 1]);
  });

  it('Alt+바깥쪽 화살표는 열을 넓힌다(LTR 오른쪽 · RTL 왼쪽)', async () => {
    await mount(dir);
    await userEvent.click(cell(0, 1)!);
    await settle();
    const before = header('A').getBoundingClientRect().width;
    await userEvent.keyboard(`{Alt>}{${dir === 'ltr' ? 'ArrowRight' : 'ArrowLeft'}}{/Alt}`);
    await settle();
    const after = header('A').getBoundingClientRect().width;
    expect(after, `${dir}: 너비 ${before} → ${after}`).toBeGreaterThan(before);
  });

  it('커서를 끝 열로 옮기면 그 열이 보이는 영역으로 스크롤된다', async () => {
    await mount(dir);
    await userEvent.click(cell(0, 1)!);
    await settle();
    await userEvent.keyboard('{End}');
    await settle();
    await new Promise((r) => setTimeout(r, 80));
    expect(table.activeCell?.col, 'End 는 행의 끝 열로 간다').toBe(5);
    await userEvent.keyboard(dir === 'ltr' ? '{ArrowLeft}' : '{ArrowRight}');
    await settle();
    await new Promise((r) => setTimeout(r, 80));
    const c = cell(0, table.activeCell!.col)!.getBoundingClientRect();
    const V = viewport();
    expect(c.left, `${dir}: 활성 셀 [${c.left}..${c.right}] · 보이는 영역 [${V.left}..${V.right}]`).toBeGreaterThanOrEqual(V.left - 2);
    expect(c.right).toBeLessThanOrEqual(V.right + 2);
  });
});
