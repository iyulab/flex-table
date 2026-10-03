import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * 가상 스크롤이 그리는 행 범위는 «뷰포트에 실제로 보이는 본문 행» 을 덮어야 한다. 헤더와 고정 행
 * 띠는 스크롤 흐름 안의 sticky 라, 본문 행 k 는 띠 아래 가장자리에서 `k * rowHeight − scrollTop`
 * 에 온다. 여기서는 뷰포트 아래 가장자리까지의 본문 행이 전부 DOM 에 있는지를 계산된 배치로 잰다.
 */

let table: FlexTable;
const ROW_H = 32;

function mount(frozenRows: number, height: number): FlexTable {
  const el = document.createElement('flex-table') as FlexTable;
  el.style.display = 'block';
  el.style.width = '400px';
  el.style.height = `${height}px`;
  document.body.appendChild(el);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = el as any;
  any.columns = [{ key: 'id', label: 'ID', type: 'number', width: 120 }];
  any.data = Array.from({ length: 300 }, (_, i) => ({ id: i + 1 }));
  any.frozenRows = frozenRows;
  return el;
}

async function settle(el: FlexTable): Promise<void> {
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
  await el.updateComplete;
}

/** Body rows (not frozen) whose box reaches into the viewport, by aria-rowindex − 2. */
function renderedBodyRows(el: FlexTable): number[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('.ft-body .ft-row')]
    .map((r) => Number(r.getAttribute('aria-rowindex')) - 2)
    .sort((a, b) => a - b);
}

afterEach(() => table?.remove());

describe('visible range under a sticky header and frozen band', () => {
  for (const frozen of [0, 3, 8]) {
    it(`renders every body row down to the bottom edge of the view (frozenRows=${frozen})`, async () => {
      table = mount(frozen, 400);
      await settle(table);
      table.scrollTop = ROW_H * 40;
      await settle(table);

      const host = table.getBoundingClientRect();
      const band = table.shadowRoot!.querySelector('.ft-header')!.getBoundingClientRect().height
        + frozen * ROW_H;
      // Body rows that are at least partly visible between the band's lower edge and the view's bottom.
      const firstVisible = frozen + Math.floor(table.scrollTop / ROW_H);
      const lastVisible = frozen + Math.floor((table.scrollTop + table.clientHeight - band - 1) / ROW_H);
      const rows = renderedBodyRows(table);
      for (let i = firstVisible; i <= lastVisible; i++) {
        expect(rows, `row ${i} is in view (host ${Math.round(host.height)}px) but not rendered`).toContain(i);
      }
      // Overscan stays bounded — the range is not the whole data set.
      expect(rows.length).toBeLessThan(40);
    });
  }
});
