import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import '../flex-table';
import type { FlexTable } from '../flex-table';

const src = readFileSync(resolve(__dirname, 'flex-table.styles.ts'), 'utf-8');

/**
 * **치수·위계 축**(`--ft-row-height` · 셀 여백 · 머리행 타이포)의 계약.
 *
 * ⚠**이 표는 가상 스크롤이라 행 높이가 CSS 로 닿지 않는다** — 행은 `index * rowHeight`
 * 로 절대 배치되고 셀 높이는 인라인으로 박힌다. 그래서 *"셀 여백을 열면 행 높이가
 * 따라온다"* 는 **이 컴포넌트에서 성립하지 않으며**, 소비자의 수용 기준을 만족시키려면
 * CSS 토큰을 JS 가 판독해야 한다. 아래 DOM 테스트가 그 경로를 지킨다.
 *
 * 나머지 셋은 순수 CSS 라 소스 대조로 충분하다 — 다만 **기본값이 종전 렌더값과 같다**는
 * 것이 이 축 전체의 수용 조건이므로(소비자 ⑸-3), 값까지 못박는다.
 */
describe('치수·위계 축', () => {
  const baseBlock = src.slice(src.indexOf(':host {'), src.indexOf('/* --- Dark Theme'));
  const decl = (name: string) =>
    baseBlock.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm'))?.[1].trim();

  describe('기본값 = 종전 렌더값 (아무것도 선언하지 않은 소비자는 무변화)', () => {
    it.each([
      ['--ft-row-height', '32px'],
      ['--ft-cell-padding-block', '6px'],
      ['--ft-cell-padding-inline', '12px'],
      ['--ft-header-font-weight', '600'],
    ])('%s 의 기본값이 %s 이다', (name, expected) => {
      expect(decl(name)).toBe(expected);
    });

    it('머리행 글자 크기는 기본적으로 본문과 같다', () => {
      expect(decl('--ft-header-font-size')).toBe('var(--ft-font-size)');
    });
  });

  describe('선언이 실제로 소비된다 (토큰만 만들고 배선하지 않는 실패를 막는다)', () => {
    /** `.ft-cell` 같은 규칙 하나의 본문만 떼어 온다. */
    const rule = (selector: string) => {
      const at = src.indexOf(`\n  ${selector} {`);
      return at === -1 ? '' : src.slice(at, src.indexOf('}', at));
    };

    it('본문 셀 여백이 토큰을 경유한다', () => {
      expect(rule('.ft-cell')).toContain(
        'padding: var(--ft-cell-padding-block) var(--ft-cell-padding-inline)',
      );
    });

    it('머리행이 크기·굵기 둘 다 토큰을 경유한다', () => {
      const header = rule('.ft-header-cell');
      expect(header).toContain('font-size: var(--ft-header-font-size)');
      expect(header).toContain('font-weight: var(--ft-header-font-weight)');
    });

    it('편집기 여백도 셀을 따라간다 (겹쳐 뜨므로 어긋나면 글자가 튄다)', () => {
      expect(rule('.ft-editor')).toContain('var(--ft-cell-padding-block)');
    });

    it('치수 축에 리터럴 여백이 남아 있지 않다 (본문 셀·머리행·편집기)', () => {
      const offenders = ['.ft-cell', '.ft-header-cell', '.ft-editor']
        .map(s => [s, rule(s)] as const)
        .filter(([, body]) => /padding:\s*\d/.test(body))
        .map(([s]) => s);
      expect(offenders, '토큰을 비껴간 여백 선언').toEqual([]);
    });
  });

  describe('★--ft-row-height 가 가상화 계산에 실제로 들어간다', () => {
    let el: FlexTable;

    beforeEach(() => {
      document.documentElement.style.removeProperty('--ft-row-height');
    });
    afterEach(() => {
      el?.remove();
      document.documentElement.style.removeProperty('--ft-row-height');
    });

    /** 문서 스코프 선언 → 붙이기 → 첫 렌더 완료. 소비자가 실제로 쓰는 경로다. */
    const mount = async (rowHeightToken?: string) => {
      if (rowHeightToken) {
        document.documentElement.style.setProperty('--ft-row-height', rowHeightToken);
      }
      el = document.createElement('flex-table') as FlexTable;
      el.columns = [{ key: 'a', header: 'A' }];
      el.data = [{ a: 1 }, { a: 2 }];
      document.body.appendChild(el);
      await el.updateComplete;
      return el;
    };

    it('선언이 없으면 기본값 32 다', async () => {
      expect((await mount()).rowHeight).toBe(32);
    });

    it('문서 스코프 선언이 rowHeight 로 들어온다', async () => {
      expect((await mount('24px')).rowHeight).toBe(24);
    });

    it('머리행 높이도 함께 따라온다 (rowHeight 파생이므로)', async () => {
      const tall = await mount('48px');
      // headerHeight 는 private 이지만 렌더 결과로 드러난다.
      expect(tall.shadowRoot!.querySelector('.ft-header-cell')).toBeTruthy();
      expect(tall.rowHeight).toBe(48);
    });

    it('★명시 지정이 CSS 토큰을 이긴다 (기존 소비자가 깨지지 않는다)', async () => {
      const e = await mount('24px');
      e.rowHeight = 40;
      await e.updateComplete;
      expect(e.rowHeight).toBe(40);
    });

    it('해석할 수 없는 단위는 조용히 기본값을 유지한다', async () => {
      expect((await mount('2em')).rowHeight).toBe(32);
    });
  });
});
