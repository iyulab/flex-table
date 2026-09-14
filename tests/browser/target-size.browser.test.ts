import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

/**
 * **WCAG 2.2 SC 2.5.8 Target Size (Minimum) — 24×24 CSS px** 게이트.
 *
 * `@iyulab/components` 게이트에서 형제 넷을 거쳐 이식했다. 판정 규칙·간격 예외·hit-test 축은 **같은 형태**이고, 근거는
 * `components` 쪽 파일 머리말이 정본이다 — 여기에는 이 패키지에서만 참인 것만 적는다.
 *
 * ## ⚠ 태그는 하나, 표면은 여럿이다
 *
 * 이 패키지가 등록하는 태그는 `flex-table` 하나뿐이다. 그래서 «태그마다 픽스처 하나» 로는 아무것도 가르지 못한다 —
 * 격자 머리의 정렬 헤더 · 필터 버튼 · 열 리사이즈 핸들 · 행 선택 체크박스는 **서로 다른 치수 결정**이다. ⇒ 표면마다
 * **상태**(픽스처)를 따로 둔다. 붙어 있는 작은 타깃끼리(필터 버튼 ↔ 리사이즈 핸들, 위아래 행의 체크박스)는 한 픽스처에
 * 넣고 간격을 이 컴포넌트가 소유한다고 본다 — 간격 예외가 실제로 일하는 자리다.
 *
 * ## ⚠ 형제 걸러내기가 필요 없다
 *
 * `@iyulab/components` 는 **peer** 이고 런타임 import 가 0 이다(토큰 시트 계약만) — 배럴이 형제 태그를 등록하지 않는다.
 */

const MIN = 24;

interface Measured {
  w: number;
  h: number;
  cx: number;
  cy: number;
}

function measure(el: Element): Measured {
  const r = el.getBoundingClientRect();
  return { w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
}

/** SC 2.5.8 «간격 예외» — 중심 간 거리가 24px 이상이면 24px 원이 겹치지 않는다. */
function spacingSatisfied(target: Measured, others: Measured[]): boolean {
  return others.every((o) => Math.hypot(target.cx - o.cx, target.cy - o.cy) >= MIN);
}

type Verdict = 'meets-size' | 'exempt-by-spacing' | 'undersized';

function judge(target: Measured, others: Measured[]): Verdict {
  if (target.w >= MIN && target.h >= MIN) return 'meets-size';
  return spacingSatisfied(target, others) ? 'exempt-by-spacing' : 'undersized';
}

/** 섀도 DOM 안쪽에서 셀렉터로 고른다. */
function inShadow(host: Element, sel: string): Element[] {
  const root = (host as HTMLElement & { shadowRoot?: ShadowRoot }).shadowRoot;
  return root ? Array.from(root.querySelectorAll(sel)) : [];
}

/**
 * 🔴**hit-test 축**(cycle-553 · 세 게이트 공통) — 타깃의 중심과 1px 안쪽 네 가장자리를 실제로 누르면 그 타깃이 받는가.
 *
 * `getBoundingClientRect` 는 조상의 `overflow` 가 자른 부분도, 닫혀서 보이지 않는 요소의 박스도 그대로 보고한다 — 크기만
 * 재면 ***보이지도 눌리지도 않는 타깃이 통과한다.*** 실제로 그랬다: components 게이트의 `u-input` 접미 아이콘(좁은 필드에서
 * 밖으로 밀려나 잘렸다)과, 닫힌 채 띄운 대화상자 픽스처(닫기 버튼 중심을 누르면 `body` 가 받았다).
 *
 * - **사용자가 스크롤로 닿을 수 있으면 닿는 것이다** — 점마다, 그 점이 보이도록 `overflow: auto|scroll` 조상과 창만 스크롤한
 *   뒤 잰다(cycle-554: 표·시트·블록이 러너의 좁은 뷰포트를 넘어 `elementFromPoint` 가 `null` 을 돌려줬고, 뷰포트보다 넓은
 *   타깃은 양 끝을 한 화면에 담을 수 없다). `overflow: hidden|clip` 조상은 사용자가 움직일 수 없으므로 **건드리지 않는다** —
 *   `scrollIntoView` 는 그것까지 스크롤해 잘린 타깃을 통과시킨다. 움직인 스크롤은 점마다 돌려놓는다.
 * - 판정은 타깃이 속한 트리(`getRootNode()`)에서 한다. 그 트리로 retarget 되어 **호스트**가 돌아오면, 그 점이 타깃 안
 *   `<slot>` 에 꽂힌 라이트 DOM 내용 위일 때 타깃이 받은 것으로 센다(링크 안에 꽂힌 글자 등).
 * - ⚠**이웃 타깃이 받은 것은 봐주지 않는다.** 붙어 있는 격자 셀의 경계선 때문에 가장자리를 이웃에 양보하는 면제를
 *   시험해 봤지만(cycle-554), 네거티브 컨트롤로 끄자 **어떤 픽스처도 빨개지지 않았다** — 셀 가장자리의 불일치는 경계선이
 *   아니라 뷰포트 밖이었다. 쓰이지 않는 면제는 조용한 미탐이라 걷어냈다. 필요해지면 그 픽스처가 빨강으로 알린다.
 *
 * ⚠이 헬퍼는 세 게이트(components · chat-components · data-components)에 **같은 코드로** 한 벌씩 있다 — 고치면 셋 다.
 */
type HitPoint = readonly [name: string, fx: number, fy: number, ox: number, oy: number];

const HIT_POINTS: HitPoint[] = [
  ['중심', 0.5, 0.5, 0, 0],
  ['왼', 0, 0.5, 1, 0],
  ['오른', 1, 0.5, -1, 0],
  ['위', 0.5, 0, 0, 1],
  ['아래', 0.5, 1, 0, -1],
];

function describeEl(el: Element | null): string {
  if (!el) return 'null';
  const cls = el.getAttribute('class');
  return `${el.localName}${cls ? `.${cls.split(' ')[0]}` : ''}`;
}

function unreachablePoints(el: Element): Array<{ point: string; hit: string }> {
  const root = el.getRootNode() as Document | ShadowRoot;
  const host = root instanceof ShadowRoot ? root.host : null;
  const at = (p: HitPoint): [number, number] => {
    const r = el.getBoundingClientRect();
    return [r.left + r.width * p[1] + p[3], r.top + r.height * p[2] + p[4]];
  };
  const misses: Array<{ point: string; hit: string }> = [];
  for (const p of HIT_POINTS) {
    const restore = revealPoint(el, () => at(p));
    try {
      const [x, y] = at(p);
      const hit = root.elementFromPoint(x, y);
      const ok = !!hit && (hit === el || el.contains(hit) || (hit === host && slottedContentAt(el, x, y)));
      if (!ok) misses.push({ point: p[0], hit: describeEl(hit) });
    } finally {
      restore();
    }
  }
  return misses;
}

/** 평탄 트리의 부모 — 슬롯에 꽂혔으면 그 슬롯, 섀도 루트면 그 호스트. */
function flatParent(node: Node): Element | null {
  const slot = (node as Element).assignedSlot;
  if (slot) return slot;
  const parent = node.parentNode;
  if (parent instanceof ShadowRoot) return parent.host;
  return parent instanceof Element ? parent : null;
}

/** 그 점이 보이도록 사용자가 스크롤할 수 있는 조상과 창을 움직인다. 돌려놓는 함수를 돌려준다. */
function revealPoint(el: Element, point: () => [number, number]): () => void {
  const moved: Array<[Element, number, number]> = [];
  for (let a = flatParent(el); a && a !== document.documentElement && a !== document.body; a = flatParent(a)) {
    const cs = getComputedStyle(a);
    const canX = /auto|scroll/.test(cs.overflowX) && a.scrollWidth > a.clientWidth;
    const canY = /auto|scroll/.test(cs.overflowY) && a.scrollHeight > a.clientHeight;
    if (!canX && !canY) continue;
    const [x, y] = point();
    const box = a.getBoundingClientRect();
    const left = box.left + a.clientLeft;
    const top = box.top + a.clientTop;
    const before: [Element, number, number] = [a, a.scrollLeft, a.scrollTop];
    if (canX && (x < left || x >= left + a.clientWidth)) a.scrollLeft += x - (left + a.clientWidth / 2);
    if (canY && (y < top || y >= top + a.clientHeight)) a.scrollTop += y - (top + a.clientHeight / 2);
    if (a.scrollLeft !== before[1] || a.scrollTop !== before[2]) moved.push(before);
  }
  const wx = window.scrollX;
  const wy = window.scrollY;
  const [x, y] = point();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const dx = x < 0 || x >= vw ? x - vw / 2 : 0;
  const dy = y < 0 || y >= vh ? y - vh / 2 : 0;
  if (dx || dy) window.scrollBy(dx, dy);
  return () => {
    window.scrollTo(wx, wy);
    for (const [a, l, t] of moved.reverse()) {
      a.scrollLeft = l;
      a.scrollTop = t;
    }
  };
}

/** 타깃 안 `<slot>` 에 꽂힌 라이트 DOM 내용 중 그 점을 덮는 것이 있는가. */
function slottedContentAt(el: Element, x: number, y: number): boolean {
  for (const slot of Array.from(el.querySelectorAll('slot'))) {
    for (const n of slot.assignedNodes({ flatten: true })) {
      let rects: DOMRect[];
      if (n instanceof Element) {
        rects = [n.getBoundingClientRect()];
      } else {
        const range = document.createRange();
        range.selectNodeContents(n);
        rects = Array.from(range.getClientRects());
      }
      if (rects.some((q) => x >= q.left && x <= q.right && y >= q.top && y <= q.bottom)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 규칙 — 손으로 쓴다 (도출할 수 없는 우리 지식)
// ---------------------------------------------------------------------------

/** 포인터 타깃이 아닌 것. 이 패키지에는 없다(유일한 태그가 격자다). */
const NOT_A_TARGET = new Set<string>([]);

/**
 * 타깃을 «갖고 있지만» 아직 대표 픽스처를 쓰지 않은 것.
 * ⚠**이 목록은 「통과」가 아니라 「미판정」이다.**
 */
const NEEDS_FIXTURE = new Set<string>([]);

/**
 * 🔴**측정 결과 미달인데 «치수를 올리는 것이 시각적 공개 계약 변경»이라 사람 판단이 필요한 것.**
 * 여기 있는 동안 이 파일은 그것을 **미달로 단언**하므로 스위트는 초록이고, 치수를 올리면
 * 빨개진다 — 그때 이 집합에서 빼는 것이 완료 신호다. 태그 전체(`u-x`) 또는 한 상태(`u-x [상태]`)에 건다.
 */
const UNDERSIZED_PINS = new Set<string>([
  // 게이트 첫 실행 실측: 필터 버튼 **14×14** · 열 리사이즈 핸들 **6×38**(셋 다 hit-test 는 통과 — 보이고 눌린다).
  // 🔴배치를 움직이지 않는 «패딩 + 음수 여백» 기법(components 접미 아이콘과 같은 것)으로는 해소되지 않는다 — 넓힌 누를 면이
  //   필터 버튼 쪽은 **머리 셀의 정렬 클릭 영역**을, 리사이즈 핸들 쪽은 **이웃 열 머리**를 덮는다. 즉 치수가 아니라
  //   «머리 안에서 어느 동작이 어느 면을 갖는가» 가 바뀌는 결정이라 사람 판단이다.
  'flex-table [필터 버튼 · 리사이즈 핸들]',
]);

/**
 * 🔴**SC 2.5.8 「인라인」 예외** — 이 패키지에는 없다.
 * ⚠**면제는 이름으로 좁게 준다** — 넓은 면제는 조용한 미탐이 된다.
 */
const INLINE_PROSE = new Set<string>([]);

interface Fixture {
  html: string;
  /** 🔴**상태 이름** — 한 태그의 서로 다른 표면을 상태로 가른다(`FIXTURES` 값이 배열). */
  state?: string;
  /** 재기 전에 상태를 연다. 여는 데 실패하면 **던진다** — 없는 타깃을 통과로 세면 미탐이다. */
  prepare?: (host: Element) => Promise<void>;
  /** 이 픽스처 안의 «타깃»들. 생략하면 태그 자신. */
  targets?: (tag: string) => Element[];
  /** 🔴**이 컴포넌트가 «타깃들 사이의 간격»을 스스로 소유하는가.** 기본값은 크기로만 판정. */
  spacingIsOurs?: true;
  /** 렌더가 비동기인 것을 위한 추가 대기(ms). */
  settle?: number;
}

type Table = HTMLElement & {
  columns: unknown;
  data: unknown;
  showFilters: boolean;
  selectable: boolean;
  updateComplete: Promise<unknown>;
};

/** 공통 격자 — 정렬 가능한 열 셋 · 필터 · 다중 선택. `columns`·`data` 는 **프로퍼티**다. */
const prepareGrid = async (host: Element): Promise<void> => {
  const t = host as Table;
  t.showFilters = true;
  t.selectable = true;
  t.columns = [
    { key: 'name', header: 'Name', type: 'text', width: 160 },
    { key: 'qty', header: 'Qty', type: 'number', width: 120 },
    { key: 'city', header: 'City', type: 'text', width: 160 },
  ];
  t.data = [1, 2, 3, 4].map((i) => ({ id: i, name: `Item ${i}`, qty: i * 10, city: `City ${i}` }));
  await t.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
  await t.updateComplete;
  if (inShadow(t, '.ft-filter-btn').length !== 3) throw new Error('필터 버튼 셋이 렌더되지 않았다 — showFilters 가 걸리지 않았다');
  if (inShadow(t, '.ft-checkbox-cell input[type=checkbox]').length === 0) throw new Error('행 선택 체크박스가 렌더되지 않았다');
};

const grid = '<flex-table style="display:block;width:560px;height:260px"></flex-table>';
const table = () => document.querySelector('flex-table')!;

/** 실제로 재는 것 — 대표 픽스처와 그 안의 타깃. 상태가 여럿이면 배열. */
const FIXTURES: Record<string, Fixture | Fixture[]> = {
  'flex-table': [
    {
      state: '정렬 헤더',
      html: grid,
      prepare: prepareGrid,
      targets: () => inShadow(table(), '.ft-header-cell[role="columnheader"]'),
      spacingIsOurs: true,
    },
    {
      state: '필터 버튼 · 리사이즈 핸들',
      // 머리 셀 안에서 서로 붙어 있는 작은 타깃 둘 — 같은 픽스처에 넣어 간격을 함께 잰다.
      html: grid,
      prepare: prepareGrid,
      targets: () => inShadow(table(), '.ft-filter-btn, .ft-resize-handle'),
      spacingIsOurs: true,
    },
    {
      state: '행 선택',
      // 머리의 «전체 선택» 과 행 체크박스 — 위아래로 쌓인다.
      html: grid,
      prepare: prepareGrid,
      targets: () => inShadow(table(), '.ft-checkbox-header input[type=checkbox], .ft-checkbox-cell input[type=checkbox]'),
      spacingIsOurs: true,
    },
  ],
};

async function mount(html: string, settle = 0): Promise<void> {
  document.body.innerHTML = `<div style="padding:40px;width:600px">${html}</div>`;
  await new Promise((r) => setTimeout(r, 80 + settle));
}

/** 등록된 태그 — 손으로 열거하지 않는다. */
const registered: string[] = [];

beforeAll(async () => {
  const original = customElements.define.bind(customElements);
  customElements.define = ((name: string, ctor: CustomElementConstructor, opts?: ElementDefinitionOptions) => {
    registered.push(name);
    return original(name, ctor, opts);
  }) as typeof customElements.define;
  await import('../../src/index.js');
  customElements.define = original;
});

describe('WCAG 2.2 SC 2.5.8 — 타깃 크기(최소) 게이트', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('규칙 자체 — 간격 예외 모델링', () => {
    it('24×24 이상이면 간격과 무관하게 통과한다', () => {
      expect(judge({ w: 24, h: 24, cx: 0, cy: 0 }, [{ w: 24, h: 24, cx: 1, cy: 0 }])).toBe('meets-size');
    });

    it('🔴미달이어도 중심 간 24px 이상이면 «간격 예외»로 통과한다', () => {
      expect(judge({ w: 16, h: 16, cx: 0, cy: 0 }, [{ w: 16, h: 16, cx: 24, cy: 0 }]))
        .toBe('exempt-by-spacing');
    });

    it('🔴미달이고 중심 간 24px 미만이면 위반이다', () => {
      expect(judge({ w: 16, h: 16, cx: 0, cy: 0 }, [{ w: 16, h: 16, cx: 23.9, cy: 0 }]))
        .toBe('undersized');
    });

    it('⚪NEGATIVE — 이웃이 없으면 미달이어도 «간격 예외»다 (혼자 있는 타깃)', () => {
      expect(judge({ w: 10, h: 10, cx: 0, cy: 0 }, [])).toBe('exempt-by-spacing');
    });

    it('⚪NEGATIVE — 대각선 거리도 유클리드로 잰다 (축별로 재면 틀린다)', () => {
      expect(judge({ w: 16, h: 16, cx: 0, cy: 0 }, [{ w: 16, h: 16, cx: 17, cy: 17 }]))
        .toBe('exempt-by-spacing');
    });
  });

  describe('규칙 자체 — hit-test 축', () => {
    const pointsOf = (el: Element) => unreachablePoints(el).map((m) => m.point);
    const ALL = ['중심', '왼', '오른', '위', '아래'];

    it('보이는 버튼은 다섯 점 모두 닿는다 — 자손(글자·아이콘)이 받아도 그 버튼이 받은 것이다', async () => {
      await mount('<button style="width:60px;height:30px"><span style="display:block">OK</span></button>');
      expect(pointsOf(document.querySelector('button')!)).toEqual([]);
    });

    it('🔴조상 overflow 에 통째로 잘린 버튼은 다섯 점 모두 닿지 않는다 — 박스는 그대로 보고되는데도', async () => {
      await mount('<div style="width:40px;height:30px;overflow:hidden;position:relative">' +
        '<button style="position:absolute;left:50px;width:30px;height:30px">x</button></div>');
      const button = document.querySelector('button')!;
      expect(Math.round(button.getBoundingClientRect().width), '크기만 보면 통과처럼 보인다').toBe(30);
      expect(pointsOf(button)).toEqual(ALL);
    });

    it('🔴반쯤 잘린 버튼은 잘린 쪽 가장자리만 닿지 않는다 (중심만 재면 놓친다)', async () => {
      await mount('<div style="width:40px;height:30px;overflow:hidden;position:relative">' +
        '<button style="position:absolute;left:20px;width:30px;height:30px">x</button></div>');
      expect(pointsOf(document.querySelector('button')!)).toEqual(['오른']);
    });

    it('🔴다른 요소에 덮인 버튼은 닿지 않는다', async () => {
      await mount('<div style="position:relative"><button style="width:30px;height:30px">x</button>' +
        '<div style="position:absolute;inset:0;width:30px;height:30px"></div></div>');
      expect(pointsOf(document.querySelector('button')!)).toEqual(ALL);
    });

    it('뷰포트 밖이어도 창을 스크롤해 닿으면 닿는다 — 그리고 스크롤은 돌려놓는다', async () => {
      await mount('<div style="width:3000px"><button style="margin-left:2600px;width:30px;height:30px">x</button></div>');
      expect(pointsOf(document.querySelector('button')!)).toEqual([]);
      expect(window.scrollX).toBe(0);
    });

    it('🔴뷰포트보다 넓은 타깃도 양 끝이 닿는다 — 점마다 드러낸다', async () => {
      await mount('<button style="width:2500px;height:30px">wide</button>');
      expect(pointsOf(document.querySelector('button')!)).toEqual([]);
    });

    it('사용자 스크롤 컨테이너(overflow:auto) 밖에 있는 타깃은 그 컨테이너를 스크롤해 닿는다', async () => {
      // ⚠높이는 가로 스크롤바가 생겨도 버튼(30)이 들어갈 만큼 — 40 이면 스크롤바가 위아래 끝을 가려 픽스처가 틀린다.
      await mount('<div id="sc" style="width:100px;height:60px;overflow:auto"><div style="width:600px">' +
        '<button style="margin-left:500px;width:30px;height:30px">x</button></div></div>');
      expect(pointsOf(document.querySelector('button')!)).toEqual([]);
      expect(document.getElementById('sc')!.scrollLeft).toBe(0);
    });

    it('🔴overflow:hidden 컨테이너는 스크롤하지 않는다 — 잘린 타깃은 잘린 채로 남는다(scrollIntoView 는 이것을 드러낸다)', async () => {
      await mount('<div style="width:100px;height:40px;overflow:hidden"><div style="width:600px">' +
        '<button style="margin-left:500px;width:30px;height:30px">x</button></div></div>');
      expect(pointsOf(document.querySelector('button')!)).toEqual(ALL);
    });

    it('섀도 안 링크에 슬롯으로 꽂힌 글자 위의 점도 그 링크가 받은 것으로 센다(retarget 보정)', async () => {
      const name = 'zz-hit-slot-link';
      if (!customElements.get(name)) {
        customElements.define(name, class extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' }).innerHTML =
              '<a href="#x" style="display:inline-block;padding:4px"><slot></slot></a>';
          }
        });
      }
      await mount(`<${name}>Linked text</${name}>`);
      expect(pointsOf(document.querySelector(name)!.shadowRoot!.querySelector('a')!)).toEqual([]);
    });

    it('⚪NEGATIVE — 이웃 타깃이 가장자리를 덮어도 봐주지 않는다 (이웃에 양보하는 면제는 없다)', async () => {
      await mount('<div style="display:flex"><button id="a" style="width:40px;height:30px;margin-right:-3px">a</button>' +
        '<button id="b" style="width:40px;height:30px;position:relative">b</button></div>');
      expect(pointsOf(document.getElementById('a')!)).toEqual(['오른']);
    });
  });

  describe('🔴 대상 도출 — 등록된 태그가 규칙 표를 벗어나지 않는다', () => {
    it('배럴이 태그를 실제로 등록한다 (도출이 0건이면 아래 단언이 전부 공허해진다)', () => {
      expect(registered.length).toBeGreaterThan(0);
    });

    it('등록된 모든 태그가 세 집합 중 정확히 하나에 분류돼 있다', () => {
      const unclassified = registered.filter(
        (t) => !NOT_A_TARGET.has(t) && !NEEDS_FIXTURE.has(t) && !(t in FIXTURES),
      );
      expect(unclassified,
        `분류되지 않은 태그가 있다 — 새 컴포넌트라면 규칙 표에 넣을 것: ${unclassified.join(' ')}`,
      ).toEqual([]);
    });

    it('📌커버리지를 보고한다 — 「미판정」은 통과가 아니다', () => {
      const unjudged = [...NEEDS_FIXTURE].sort();
      // ⚠이 단언은 «미판정이 늘지 않았는가»를 지킨다. 픽스처를 쓰면 이 수가 줄고 그때 이
      //   줄을 함께 고치는 것이 그 작업의 완료 신호다.
      // 🔴«판정» 은 태그 수와 **상태 수**를 함께 말한다 — 태그만 세면 열린 상태를 빠뜨려도 이 줄이 변하지 않는다.
      const states = Object.values(FIXTURES).flat().length;
      expect(
        `판정 ${Object.keys(FIXTURES).length}(${states}상태) · 미판정 ${unjudged.length}(${unjudged.join(' ')})` +
        ` · 대상아님 ${NOT_A_TARGET.size} · 인라인예외 ${INLINE_PROSE.size}`,
      ).toBe('판정 1(3상태) · 미판정 0() · 대상아님 0 · 인라인예외 0');
    });

    it('규칙 표에 «등록되지 않은» 이름이 남아 있지 않다 (표가 낡지 않게)', () => {
      const known = new Set(registered);
      const stale = [...NOT_A_TARGET, ...NEEDS_FIXTURE, ...Object.keys(FIXTURES)]
        .filter((t) => !known.has(t));
      expect(stale, `등록되지 않은 이름: ${stale.join(' ')}`).toEqual([]);
    });
  });

  describe('실측 — 픽스처를 가진 모든 타깃', () => {
    const CASES = Object.entries(FIXTURES).flatMap(([tag, entry]) =>
      (Array.isArray(entry) ? entry : [entry]).map((fixture) => ({ tag, fixture })));
    for (const { tag, fixture } of CASES) {
      const name = `${tag}${fixture.state ? ` [${fixture.state}]` : ''}`;
      const pinned = UNDERSIZED_PINS.has(tag) || UNDERSIZED_PINS.has(name);
      const inline = INLINE_PROSE.has(tag);
      const label = pinned
        ? '📌미달로 «핀»돼 있다 (사람 판단 대기)'
        : inline
          ? '「인라인」 예외 — 크기 하한을 적용하지 않되 실측은 보고한다'
          : 'SC 2.5.8 을 만족한다';
      it(`${name}: ${label}`, async () => {
        await mount(fixture.html, fixture.settle);
        if (fixture.prepare) await fixture.prepare(document.querySelector(tag)!);
        const els = (fixture.targets ? fixture.targets(tag) : [document.querySelector(tag)!]);
        const targets = els.map(measure);
        expect(targets.length, '타깃을 하나도 못 찾으면 이 판정은 무의미하다').toBeGreaterThan(0);

        // 🔴크기보다 먼저 — 그 타깃이 실제로 눌리는가. 잘렸거나 가려졌거나 닫혀 있으면 크기 판정은 의미가 없다.
        //   (세 게이트 공통 · 인라인 예외도 «눌린다» 는 전제는 면제하지 않는다.)
        const unreachable = els
          .map((el) => ({ el, misses: unreachablePoints(el) }))
          .filter(({ misses }) => misses.length > 0)
          .map(({ el, misses }) => `${describeEl(el)} — ${misses.map((m) => `${m.point}→${m.hit}`).join(' · ')}`);
        expect(unreachable, '누르면 다른 요소가 받는 타깃 — 잘렸거나 가려졌거나 닫혀 있다').toEqual([]);
        const verdicts = targets.map((t, i) =>
          fixture.spacingIsOurs ? judge(t, targets.filter((_, j) => j !== i)) : judge(t, [t]),
        );
        const detail = `실측 ${targets.map((t) => `${Math.round(t.w)}x${Math.round(t.h)}`).join(' ')} · 판정 ${verdicts.join(' ')}`;

        if (pinned) {
          expect(verdicts.some((v) => v === 'undersized'), detail).toBe(true);
        } else if (inline) {
          const host = document.querySelector(tag)!;
          expect(getComputedStyle(host).display, `${detail} · 인라인이 아니면 면제 근거가 없다`)
            .toMatch(/^inline/);
        } else {
          expect(verdicts.every((v) => v !== 'undersized'), detail).toBe(true);
        }
      });
    }
  });
});
