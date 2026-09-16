import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Locale } from '@iyulab/components/dist/utilities/Locale.js';
import '../../src/flex-table.js';
import { flexTableLocale } from '../../src/locale.js';

/**
 * 이 패키지가 스스로 그리는 chrome 문자열이 **로케일을 타는가.**
 *
 * 종전에는 필터·찾기/바꾸기 UI 전체가 영문 하드코딩이었다(실측 31건). 이 패키지는 로케일 층이
 * 없었지만 `@iyulab/components` 를 **필수 peer 로 이미 선언**하고 있었고, 그 패키지가 정확히 이
 * 용도의 primitive(`Locale.namespace`)를 갖고 있었다 — 즉 없던 능력이 아니라 **쓰지 않던 능력**이다.
 *
 * ⚠**낱말을 고정하지 않는다** — 번역을 다듬을 때마다 깨지면 테스트가 번역을 막는다.
 */
describe('flex-table 로케일', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { Locale.set('en'); });

  it('en 과 ko 가 서로 다른 문자열을 준다 — 하드코딩이면 같다', () => {
    Locale.set('en');
    const en = flexTableLocale.text('contains');
    Locale.set('ko');
    const ko = flexTableLocale.text('contains');
    expect(en).toBe('Contains');
    expect(ko).not.toBe(en);
  });

  it('en 테이블과 ko 테이블의 키 집합이 같다 — 한쪽만 늘면 조용히 영어가 샌다', () => {
    const keys = [
      'showHiddenColumns', 'columnMenu', 'cellActions', 'noColumnsDefined',
      'addCommentPlaceholder', 'cancel', 'save',
      'clear', 'blankCells', 'emptyOnly', 'nonEmptyOnly', 'blankAll', 'all',
      'contains', 'startsWith', 'endsWith', 'wildcard',
      'searchPlaceholder', 'valuePlaceholder', 'fromPlaceholder', 'toPlaceholder',
      'findPlaceholder', 'findPrevious', 'findNext', 'matchCase', 'wholeCell', 'closeFind',
      'replaceWithPlaceholder', 'replace', 'replaceAll',
    ] as const;

    const missing: string[] = [];
    for (const k of keys) {
      Locale.set('en');
      const en = flexTableLocale.text(k);
      Locale.set('ko');
      const ko = flexTableLocale.text(k);
      // 키가 없으면 `text()` 는 **키 자체**를 돌려준다 — 그 상태를 잡는다.
      if (en === k || ko === k) missing.push(k);
    }
    expect(missing).toEqual([]);
  });

  it('소비자가 언어를 더할 수 있다 — 내장은 en·ko 둘뿐이다', () => {
    flexTableLocale.register('ja', { contains: '含む' });
    Locale.set('ja');
    expect(flexTableLocale.text('contains')).toBe('含む');
  });

  it('빈 표의 안내 문구가 렌더에서 로케일을 탄다', async () => {
    Locale.set('ko');
    const el = document.createElement('flex-table');
    document.body.appendChild(el);
    await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    const empty = el.shadowRoot!.querySelector('.ft-empty');
    expect(empty?.textContent?.trim()).toBe('정의된 열이 없습니다');
  });
});
