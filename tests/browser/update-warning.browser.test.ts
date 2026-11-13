import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * **`flex-table` 은 소비자의 개발 콘솔에 Lit «갱신 뒤 갱신» 경고를 남기지 않는다.**
 *
 * `updated()` · `firstUpdated()` 가 반응형 상태를 쓰면 갱신이 한 번 더 예약되고 Lit 개발 빌드는 경고를 낸다. 이 요소는 그린 뒤에
 * 뷰포트 크기 · 키보드 힌트를 잰다 — 그 쓰기가 어느 때 갱신을 예약하는지는 값이 실제로 바뀌는지에 달려 있어 소스만으로는 모른다.
 * 브라우저 시험의 `console.warn` 은 러너 출력에 오지 않는다 — 스파이로 직접 단언한다. Lit 은 같은 글을 페이지당 한 번만 내므로
 * 시험마다 `globalThis.litIssuedWarnings` 를 비운다.
 */
let table: FlexTable | undefined;
beforeEach(() => { (globalThis as unknown as { litIssuedWarnings?: Set<string> }).litIssuedWarnings?.clear(); });
afterEach(() => { table?.remove(); table = undefined; vi.restoreAllMocks(); });

const litWarnings = (warn: { mock: { calls: unknown[][] } }) =>
  warn.mock.calls.map(([m]) => String(m)).filter((m) => m.includes('scheduled an update')).map((m) => m.slice(0, 60));
const settle = () => new Promise((r) => setTimeout(r, 120));

async function mount(): Promise<FlexTable> {
  const el = document.createElement('flex-table') as FlexTable;
  el.style.display = 'block';
  el.style.width = '700px';
  el.style.height = '360px';
  el.setAttribute('aria-label', 'Orders');
  document.body.appendChild(el);
  el.columns = ['a', 'b', 'c'].map((key) => ({ key, label: key.toUpperCase(), width: 120 }));
  el.data = Array.from({ length: 5 }, (_, r) => ({ a: `a${r}`, b: `b${r}`, c: `c${r}` }));
  await el.updateComplete;
  await settle();
  return el;
}

describe('flex-table — Lit 개발 모드 경고', () => {
  it('🔴열 · 데이터가 있는 일반 마운트에 «갱신 뒤 갱신» 경고가 없다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    table = await mount();
    expect(litWarnings(warn)).toEqual([]);
  });

  it('🔴키보드로 칸을 옮기고(포커스 · 힌트) 크기를 바꿔도 경고가 없다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    table = await mount();
    table.shadowRoot!.querySelector<HTMLElement>('.ft-row[aria-rowindex="2"] .ft-cell[aria-colindex="1"]')!.focus();
    await userEvent.keyboard('{ArrowDown}{ArrowRight}');
    await table.updateComplete;
    table.style.width = '520px';
    await settle();
    expect(litWarnings(warn)).toEqual([]);
  });
});
