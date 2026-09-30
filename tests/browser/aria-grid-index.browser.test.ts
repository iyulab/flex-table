import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * 가상화 그리드의 위치 정보(WAI-ARIA APG «Data Grid» · `aria-rowcount`/`aria-rowindex`/`aria-colindex`).
 *
 * 표는 보이는 행·열만 DOM 에 둔다. 인덱스가 없으면 스크린 리더는 «DOM 에 있는 것» 을 전체로 읽는다 —
 * 스크롤한 뒤 첫 행이 «1행» 이라고 말하고, 300행 표를 «20행» 이라고 말한다.
 * 규칙: 행 수는 머리글·푸터 행을 포함하고, 인덱스는 1부터이며 **화면 위치**(정렬 뒤의 순서)를 가리킨다.
 * 열 수·열 인덱스는 데이터 열만 센다(체크박스·행 번호 칸은 셀 역할이 없다).
 */
const ROWS = 300;
const COLS = 12;

let table: FlexTable | undefined;
afterEach(() => { table?.parentElement?.remove(); table = undefined; });

async function settle(el: FlexTable): Promise<void> {
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 150));
  await el.updateComplete;
}

async function mount(extra: Record<string, unknown> = {}): Promise<FlexTable> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const el = document.createElement('flex-table') as FlexTable;
  el.style.display = 'block';
  el.style.width = '600px';
  el.style.height = '300px';
  host.appendChild(el);
  const columns = [{ key: 'id', label: 'ID', type: 'number', width: 80, pinned: 'left' }];
  for (let c = 1; c < COLS; c++) columns.push({ key: `c${c}`, label: `C${c}`, type: 'text', width: 150 } as never);
  const data = Array.from({ length: ROWS }, (_, i) => {
    const row: Record<string, unknown> = { id: i + 1 };
    for (let c = 1; c < COLS; c++) row[`c${c}`] = `r${i + 1}c${c}`;
    return row;
  });
  Object.assign(el, { columns, data, ...extra });
  table = el;
  await settle(el);
  return el;
}

const rowsOf = (el: FlexTable) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('.ft-row[role="row"]')];
/** 행의 id 칸(고정 열 · 데이터 열 0) 값 */
const idOf = (row: HTMLElement) => Number(row.querySelector('[role="gridcell"][aria-colindex="1"]')?.textContent?.trim());

describe('flex-table — 가상화 그리드의 aria 인덱스', () => {
  it('행 수는 머리글·푸터를 포함하고 열 수는 데이터 열이다', async () => {
    const el = await mount({ footerData: { id: 'Σ' } });
    expect(el.getAttribute('aria-rowcount')).toBe(String(ROWS + 2));
    expect(el.getAttribute('aria-colcount')).toBe(String(COLS));

    const header = el.shadowRoot!.querySelector<HTMLElement>('.ft-header[role="row"]')!;
    expect(header.getAttribute('aria-rowindex')).toBe('1');
    const footer = el.shadowRoot!.querySelector<HTMLElement>('.ft-footer[role="row"]')!;
    expect(footer.getAttribute('aria-rowindex')).toBe(String(ROWS + 2));
    // 푸터 행에도 셀이 있다 — 셀 없는 행은 그리드에서 빈 행으로 읽힌다.
    expect(footer.querySelector('[role="gridcell"][aria-colindex="1"]')?.textContent?.trim()).toBe('Σ');
  });

  it('푸터가 없으면 행 수는 머리글 + 데이터다', async () => {
    const el = await mount();
    expect(el.getAttribute('aria-rowcount')).toBe(String(ROWS + 1));
  });

  it('렌더된 행의 aria-rowindex 는 데이터 위치다 — 아래로 스크롤한 뒤에도', async () => {
    const el = await mount();
    const first = rowsOf(el);
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThan(ROWS); // 가상화가 실제로 돌고 있다(전제)
    for (const r of first) expect(Number(r.getAttribute('aria-rowindex'))).toBe(idOf(r) + 1);

    el.scrollTop = 5000;
    await settle(el);
    const later = rowsOf(el);
    expect(later.some((r) => r.getAttribute('aria-rowindex') === '2')).toBe(false);
    for (const r of later) expect(Number(r.getAttribute('aria-rowindex'))).toBe(idOf(r) + 1);
  });

  it('머리글과 셀의 aria-colindex 는 열 위치다 — 오른쪽으로 스크롤한 뒤에도', async () => {
    const el = await mount();
    el.scrollLeft = 1200;
    await settle(el);
    const heads = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="columnheader"]')];
    expect(heads.length).toBeLessThan(COLS); // 열도 가상화된다(전제)
    for (const h of heads) {
      expect(Number(h.getAttribute('aria-colindex'))).toBe(Number(h.dataset.colIndex) + 1);
    }
    const row = rowsOf(el)[0];
    const cells = [...row.querySelectorAll<HTMLElement>('[role="gridcell"]')];
    for (const c of cells) {
      const ci = Number(c.getAttribute('aria-colindex'));
      if (ci === 1) continue; // id
      expect(c.textContent?.trim()).toBe(`r${idOf(row)}c${ci - 1}`);
    }
    expect(Math.max(...cells.map((c) => Number(c.getAttribute('aria-colindex'))))).toBeGreaterThan(heads.length);
  });

  it('고정 행도 같은 규칙이다', async () => {
    const el = await mount({ frozenRows: 2 });
    el.scrollTop = 3000;
    await settle(el);
    const indices = rowsOf(el).map((r) => r.getAttribute('aria-rowindex'));
    expect(indices).toContain('2');
    expect(indices).toContain('3');
    for (const r of rowsOf(el)) expect(Number(r.getAttribute('aria-rowindex'))).toBe(idOf(r) + 1);
  });
});
