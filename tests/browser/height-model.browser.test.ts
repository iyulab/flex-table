import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * **호스트 높이 계약 — 가상 스크롤은 «제약된 호스트» 를 전제한다**(cycle-563).
 *
 * ## 왜 이 파일이 생겼는가
 *
 * 이 표는 호스트 자신이 스크롤 컨테이너이고(`:host { overflow: auto }`), 뷰포트를 **호스트의
 * `clientHeight` 로 측정**한다. 본문 스페이서는 전체 가상 높이를 이고 정상 흐름에 있다.
 * ⇒ 호스트에 높이 제약이 없으면 **뷰포트가 곧 전체 내용 높이**가 되어 보이는 행 수 계산이
 * 전 행을 가리킨다 — 즉 **가상화가 사실상 꺼진다.**
 *
 * 실측(cycle-563 탐침): 1000행 · 높이 없음 → 호스트 **32,040px** · 셀 **2000개**(전 행).
 * 같은 데이터에 높이 300px → 셀 30개. README 가 내세우는 «100,000+ rows» 는 **제약이 있을 때만**
 * 참이고, 그 전제가 문서에 없었다(Quick Start 예제조차 높이를 주지 않았다).
 *
 * ⇒ 재는 것은 치수가 아니라 **렌더된 셀 수**다 — 그것이 소비자가 실제로 겪는 축(탭이 멈춘다)이다.
 *
 * ## 왜 브라우저인가
 *
 * `clientHeight`·`scrollHeight` 가 전부다. jsdom 은 0 을 돌려주므로 이 파일은 원리적으로
 * 브라우저 프로젝트에만 살 수 있다(형제 `pinned-columns` 와 같은 이유).
 *
 * ## ⚠왜 «실제로 스크롤되었는가» 를 따로 단언하는가 (cycle-563 네거티브 컨트롤이 침묵했다)
 *
 * 첫 판은 `scrollHeight - clientHeight > 0` 과 «머리행이 움직이지 않는다» 로만 판정했다.
 * 그 상태에서 `:host` 의 `overflow: auto` 를 걷는 네거티브 컨트롤이 **4건 전부 통과**했다 —
 * ⑴넘치기만 해도 `scrollHeight` 는 커지므로 첫 단언은 `overflow: visible` 에서도 참이고
 * ⑵스크롤이 **불가능해지면** 머리행도 움직이지 않아 sticky 단언이 **공허하게** 통과한다.
 * ⇒ 그 판의 테스트는 «호스트가 스크롤 컨테이너이기를 그만둔 것» 을 원리적으로 볼 수 없었다.
 * 그래서 `scrollTop` 을 준 뒤 **그 값이 실제로 남는지**를 함께 잰다 — 그것이 스크롤 컨테이너의
 * 유일한 직접 증거다.
 */

const COLUMNS = [
  { key: 'id', header: 'ID', type: 'number', width: 80 },
  { key: 'a', header: 'A', type: 'text', width: 200 },
];
const COLS = COLUMNS.length;
const ROWS = 500;

let wrap: HTMLDivElement;

beforeEach(() => {
  document.body.innerHTML = '';
  wrap = document.createElement('div');
  wrap.style.width = '600px';
  document.body.appendChild(wrap);
});
afterEach(() => { document.body.innerHTML = ''; });

function make(): FlexTable {
  const el = document.createElement('flex-table') as FlexTable;
  el.style.width = '600px';
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i <= ROWS; i++) rows.push({ id: i, a: `a${i}` });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (el as any).columns = COLUMNS;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (el as any).data = rows;
  return el;
}

async function settle(el: FlexTable): Promise<void> {
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 150));
  await el.updateComplete;
}

/** 지금 DOM 에 실제로 존재하는 본문 행 수 — 가상화가 작동하는지의 유일한 직접 증거. */
const renderedRows = (el: FlexTable): number =>
  Math.round(el.shadowRoot!.querySelectorAll('.ft-cell').length / COLS);

describe('flex-table — 호스트 높이 계약(가상 스크롤의 전제)', () => {
  it('🔴호스트에 높이를 주면 «보이는 창» 만 렌더한다 — 가상화가 실제로 작동한다', async () => {
    const el = make();
    el.style.height = '300px';
    wrap.appendChild(el);
    await settle(el);

    expect(el.scrollHeight - el.clientHeight, '이 픽스처는 세로로 넘쳐야 의미가 있다').toBeGreaterThan(0);
    expect(Math.round(el.clientHeight)).toBeLessThan(400);
    // 🔴호스트가 «실제로» 스크롤 컨테이너인가 — 넘침만으로는 증명되지 않는다(위 docstring).
    el.scrollTop = 200;
    await new Promise((r) => setTimeout(r, 120));
    expect(el.scrollTop, '호스트가 스크롤되지 않았다 — 스크롤 컨테이너가 아니다').toBeGreaterThan(0);
    const n = renderedRows(el);
    expect(n, `창만 렌더해야 한다 — 실측 ${n}행 / 전체 ${ROWS}행`).toBeLessThan(ROWS / 5);
  });

  it('🔴높이 제약이 없으면 전 행을 렌더한다 — 계약이라 고정한다(문서가 경고하는 상태)', async () => {
    const el = make();
    wrap.appendChild(el);
    await settle(el);

    // 호스트가 스페이서의 전체 높이를 그대로 갖는다 ⇒ 뷰포트 == 내용 ⇒ 스크롤할 것이 없다.
    expect(el.scrollHeight - el.clientHeight, '제약이 없으면 호스트 자신이 스크롤하지 않는다').toBe(0);
    expect(el.getBoundingClientRect().height, '호스트가 전체 가상 높이만큼 커진다').toBeGreaterThan(ROWS * 20);
    const n = renderedRows(el);
    expect(n, `제약이 없으면 전 행이 렌더된다 — 실측 ${n}행 / 전체 ${ROWS}행`).toBeGreaterThanOrEqual(ROWS);
  });

  it('고정 높이에서 스크롤해도 머리행이 남는다 — 호스트가 스크롤 컨테이너이고 머리행은 sticky 다', async () => {
    const el = make();
    el.style.height = '300px';
    wrap.appendChild(el);
    await settle(el);

    const header = el.shadowRoot!.querySelector('.ft-header') as HTMLElement;
    const before = header.getBoundingClientRect().top - el.getBoundingClientRect().top;
    el.scrollTop = 400;
    await new Promise((r) => setTimeout(r, 120));
    await el.updateComplete;
    // 🔴먼저 «스크롤이 일어났다» 를 증명한다 — 스크롤이 불가능하면 머리행도 안 움직여
    //   아래 단언이 공허하게 통과한다(cycle-563 NC 침묵의 원인).
    expect(el.scrollTop, '스크롤이 적용되지 않아 이 사례는 아무것도 재지 못한다').toBeGreaterThan(0);
    const after = header.getBoundingClientRect().top - el.getBoundingClientRect().top;
    expect(Math.abs(after - before), `머리행이 밀려 올라갔다 — ${before} → ${after}`).toBeLessThan(4);
  });

  it('부모를 제약하는 레시피도 성립한다 — flex 부모 + min-height:0', async () => {
    wrap.style.height = '300px';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    const el = make();
    el.style.flex = '1 1 auto';
    el.style.minHeight = '0';
    wrap.appendChild(el);
    await settle(el);

    expect(Math.round(el.getBoundingClientRect().height), '부모 높이 안에 들어와야 한다').toBeLessThanOrEqual(300);
    expect(el.scrollHeight - el.clientHeight, '제약이 걸리면 호스트가 넘친다').toBeGreaterThan(0);
    el.scrollTop = 200;
    await new Promise((r) => setTimeout(r, 120));
    expect(el.scrollTop, '제약이 걸린 호스트가 실제로 스크롤되어야 한다').toBeGreaterThan(0);
    const n = renderedRows(el);
    expect(n, `창만 렌더해야 한다 — 실측 ${n}행 / 전체 ${ROWS}행`).toBeLessThan(ROWS / 5);
  });
});
