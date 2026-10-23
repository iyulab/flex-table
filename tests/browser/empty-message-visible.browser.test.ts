import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * 빈 상태 · 오류 문구는 표의 보이는 폭 가운데에 머문다 — 머리글이 표보다 넓어 가로로 굴린 채 결과가 비면 문구가 화면 밖이었다
 * (`u-rich-table` 과 같은 계약).
 */

let table: FlexTable;
afterEach(() => table?.remove());

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

function offCentre(el: FlexTable): number {
  const msg = el.shadowRoot!.querySelector('.ft-empty') as HTMLElement;
  const range = document.createRange();
  range.selectNodeContents(msg);
  const text = range.getBoundingClientRect();
  const host = el.getBoundingClientRect();
  return Math.abs(text.left + text.width / 2 - (host.left + el.clientLeft + el.clientWidth / 2));
}

describe('flex-table — state message in the visible area', () => {
  it('🔴scrolled sideways, then emptied: the message is centred in view', async () => {
    table = document.createElement('flex-table') as FlexTable;
    table.style.cssText = 'width: 600px; height: 300px';
    document.body.appendChild(table);
    table.columns = Array.from({ length: 15 }, (_, i) => ({ key: `c${i}`, label: `Column ${i}`, width: 150 }));
    table.data = [{ c0: 1 }];
    await table.updateComplete;
    await frame();
    table.scrollLeft = 1000;
    await frame();
    expect(table.scrollLeft).toBeGreaterThan(0);
    table.data = [];
    await table.updateComplete;
    await frame();
    expect(offCentre(table)).toBeLessThan(2);
  });
});
