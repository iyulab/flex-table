import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * 고정 열은 **계산된 배치**로만 판정할 수 있다.
 *
 * 유닛 스위트는 emit 되는 인라인 스타일 문자열을 단언한다 — 그것으로 «식이 맞는가»는
 * 재지만 «화면 어디에 오는가»는 재지 못한다. docket #233 은 정확히 그 틈에서 나왔고,
 * 그때 유닛 테스트 둘은 초록이었다.
 *
 * ⚠**여기서 재는 것은 전부 `getBoundingClientRect()` 와 `scrollWidth` 다** — jsdom 에서
 * 0 을 돌려주는 값들이고, 그것이 이 파일이 브라우저 프로젝트에 사는 이유 전부다.
 */

const HOST_WIDTH = 600;
const PIN_WIDTH = 88;

let table: FlexTable;

function mount(columns: unknown[], rowCount = 30): FlexTable {
  const host = document.createElement('div');
  host.style.padding = '20px';
  document.body.appendChild(host);

  const el = document.createElement('flex-table') as FlexTable;
  el.style.display = 'block';
  el.style.width = `${HOST_WIDTH}px`;
  el.style.height = '300px';
  host.appendChild(el);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (el as any).columns = columns;
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i <= rowCount; i++) {
    rows.push({ id: i, a: `a${i}`, b: `b${i}`, c: `c${i}`, d: `d${i}`, act: 'edit' });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (el as any).data = rows;
  return el;
}

const WIDE = [
  { key: 'id', header: 'ID', type: 'number', width: 80, pinned: 'left' },
  { key: 'a', header: 'A', type: 'text', width: 200 },
  { key: 'b', header: 'B', type: 'text', width: 200 },
  { key: 'c', header: 'C', type: 'text', width: 200 },
  { key: 'd', header: 'D', type: 'text', width: 200 },
  { key: 'act', header: 'Act', type: 'text', width: PIN_WIDTH, pinned: 'right' },
];

async function settle(el: FlexTable): Promise<void> {
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
  await el.updateComplete;
}

async function scrollTo(el: FlexTable, left: number): Promise<void> {
  el.scrollLeft = left;
  await new Promise((r) => setTimeout(r, 120));
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 40));
}

/** 머리행의 고정 셀들을 텍스트로 찾는다 — 인덱스는 가상 스크롤로 움직인다. */
function pinnedHeader(el: FlexTable, text: string): HTMLElement {
  const cells = Array.from(
    el.shadowRoot!.querySelectorAll('.ft-header-cell.ft-pinned'),
  ) as HTMLElement[];
  const hit = cells.find((c) => c.textContent?.trim().startsWith(text));
  if (!hit) throw new Error(`고정 머리행 셀 "${text}" 을 찾지 못했다 (${cells.length}개 중)`);
  return hit;
}

/**
 * 스크롤 영역의 좌우 경계 — **테두리 안쪽, 세로 스크롤바 제외**.
 *
 * ⚠`getBoundingClientRect()` 는 테두리를 «포함»하고 `clientWidth` 는 «제외»한다. 둘을 그대로
 * 섞으면 호스트의 1px 테두리만큼 어긋나고, 그 1px 이 고정 열 판정에서는 «붙었는가»의 전부다.
 */
function viewport(el: FlexTable): { left: number; right: number } {
  const r = el.getBoundingClientRect();
  const borderLeft = parseFloat(getComputedStyle(el).borderLeftWidth) || 0;
  const left = r.left + borderLeft;
  return { left, right: left + el.clientWidth };
}

/**
 * 브라우저 레이아웃은 소수 픽셀을 낸다(실측: 605.667). 정확 비교는 그 소수에 걸려
 * **결함이 아닌 것에 발화**하므로 1px 허용 오차로 판정한다 — 이 테스트가 잡으려는 오차는
 * 88px(고정 열 하나) 규모이지 1px 규모가 아니다.
 */
function expectClose(actual: number, expected: number, message: string): void {
  expect(Math.abs(actual - expected), `${message} — 실측 ${actual}, 기대 ${expected}`)
    .toBeLessThanOrEqual(1);
}

describe('고정 열 — 실제 레이아웃', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('오른쪽 고정 열이 모든 스크롤 위치에서 스크롤 영역 안에 있다', async () => {
    table = mount(WIDE);
    await settle(table);

    const max = table.scrollWidth - table.clientWidth;
    expect(max, '이 픽스처는 가로로 넘쳐야 의미가 있다').toBeGreaterThan(0);

    const seen: string[] = [];
    for (const left of [0, Math.round(max / 2), max]) {
      await scrollTo(table, left);
      const v = viewport(table);
      const rect = pinnedHeader(table, 'Act').getBoundingClientRect();
      seen.push(
        `scrollLeft=${Math.round(table.scrollLeft)} rect=[${Math.round(rect.left)}..${Math.round(rect.right)}] viewport=[${Math.round(v.left)}..${Math.round(v.right)}]`,
      );
      // 오른쪽 가장자리에 «붙어» 있어야 한다 — 안에 있기만 한 것으로는 부족하다.
      expectClose(rect.right, v.right, `오른쪽 가장자리에 붙지 않았다 · ${seen.join(' | ')}`);
      expect(rect.left, seen.join(' | ')).toBeGreaterThanOrEqual(v.left - 1);
    }
  });

  it('왼쪽 고정 열이 모든 스크롤 위치에서 왼쪽 가장자리에 붙는다', async () => {
    table = mount(WIDE);
    await settle(table);

    const max = table.scrollWidth - table.clientWidth;
    const positions: number[] = [];
    for (const left of [0, Math.round(max / 2), max]) {
      await scrollTo(table, left);
      positions.push(Math.round(pinnedHeader(table, 'ID').getBoundingClientRect().left));
    }
    // 화면 좌표가 움직이지 않는다 = 내용이 아니라 뷰포트를 따른다.
    expect(new Set(positions).size, `실측 ${positions.join(', ')}`).toBe(1);
  });

  it('스크롤해도 스크롤 가능 폭이 늘어나지 않는다', async () => {
    // 회귀: 음수 `right` 가 셀을 컨테이닝 블록 밖으로 밀어 스크롤 영역을 넓혔다.
    // 실측된 증상은 scrollWidth 968 → 1160 → 1543 이었고, 스크롤바가 끝에 닿지 못했다.
    table = mount(WIDE);
    await settle(table);

    const widths: number[] = [table.scrollWidth];
    const max = table.scrollWidth - table.clientWidth;
    for (const left of [Math.round(max / 2), max, max]) {
      await scrollTo(table, left);
      widths.push(table.scrollWidth);
    }
    expect(new Set(widths).size, `실측 ${widths.join(' → ')}`).toBe(1);
  });

  it('넘치지 않는 표에서는 고정 열이 자연 위치에 머문다', async () => {
    // 고정이 «없던 스크롤»을 만들어내면 안 된다.
    table = mount([
      { key: 'id', header: 'ID', type: 'number', width: 80, pinned: 'left' },
      { key: 'a', header: 'A', type: 'text', width: 120 },
      { key: 'act', header: 'Act', type: 'text', width: PIN_WIDTH, pinned: 'right' },
    ]);
    await settle(table);

    expect(table.scrollWidth - table.clientWidth, '가로 스크롤이 생기면 안 된다').toBe(0);

    const v = viewport(table);
    const rect = pinnedHeader(table, 'Act').getBoundingClientRect();
    // 자연 위치(80 + 120)에 있어야 한다 — 오른쪽 가장자리로 끌려가면 사이가 빈다.
    expectClose(rect.left - v.left, 200, '자연 위치가 아니다');
  });

  it('오른쪽 고정이 둘이면 열 순서대로 쌓인다', async () => {
    table = mount([
      { key: 'a', header: 'A', type: 'text', width: 300 },
      { key: 'b', header: 'B', type: 'text', width: 300 },
      { key: 'c', header: 'C', type: 'text', width: 300 },
      { key: 'd', header: 'Edit', type: 'text', width: 60, pinned: 'right' },
      { key: 'act', header: 'Del', type: 'text', width: 80, pinned: 'right' },
    ]);
    await settle(table);
    await scrollTo(table, 0);

    const v = viewport(table);
    const edit = pinnedHeader(table, 'Edit').getBoundingClientRect();
    const del = pinnedHeader(table, 'Del').getBoundingClientRect();

    expectClose(del.right, v.right, 'Del 이 오른쪽 가장자리에 붙지 않았다');
    // 서로 붙어 있고 순서가 유지된다 — 겹치면 하나가 다른 하나를 가린다.
    expectClose(edit.right, del.left, 'Edit 과 Del 이 맞닿지 않았다');
  });

  it('본문 셀이 머리행 고정 열과 같은 x 에 온다', async () => {
    table = mount(WIDE);
    await settle(table);
    await scrollTo(table, Math.round((table.scrollWidth - table.clientWidth) / 2));

    const header = pinnedHeader(table, 'Act').getBoundingClientRect();
    const bodyCell = Array.from(
      table.shadowRoot!.querySelectorAll('.ft-cell.ft-pinned'),
    ) as HTMLElement[];
    const hit = bodyCell.find((c) => c.textContent?.trim() === 'edit');
    expect(hit, '고정된 본문 셀을 찾지 못했다').toBeTruthy();

    const cell = hit!.getBoundingClientRect();
    expectClose(cell.left, header.left, '본문 셀과 머리행 셀의 x 가 다르다');
  });
});
