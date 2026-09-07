import { describe, it, expect } from 'vitest';
import buildQuery from 'odata-query';
import { buildSearchExpression, parseOrderBy, resolveInitialState } from './use-odata-source.js';

describe('buildSearchExpression', () => {
  it('단일 단어를 phrase로 감싼다', () => {
    expect(buildSearchExpression('test')).toBe('"test"');
  });

  // OData 4.0 searchWord는 문자만 허용 — 인용 없이 보내면 서버가 400 (odata.net#2445)
  it('숫자·하이픈이 섞인 검색어를 phrase로 감싼다', () => {
    expect(buildSearchExpression('E2E')).toBe('"E2E"');
    expect(buildSearchExpression('2026')).toBe('"2026"');
    expect(buildSearchExpression('ZT-E2E-A')).toBe('"ZT-E2E-A"');
  });

  it('다중 단어의 암묵 AND 의미론을 보존한다', () => {
    expect(buildSearchExpression('red shirt')).toBe('"red" AND "shirt"');
    expect(buildSearchExpression('a b c')).toBe('"a" AND "b" AND "c"');
  });

  it('앞뒤·연속 공백을 무시한다', () => {
    expect(buildSearchExpression('  red   shirt  ')).toBe('"red" AND "shirt"');
  });

  // phrase는 `"`를 담을 수 없고 이스케이프 규칙도 없다 (qchar-no-AMP-DQUOTE)
  it('큰따옴표를 제거한다', () => {
    expect(buildSearchExpression('say "hi"')).toBe('"say" AND "hi"');
    expect(buildSearchExpression('26"')).toBe('"26"');
  });

  it('검색어 속 AND/OR를 연산자가 아닌 리터럴 토큰으로 다룬다', () => {
    expect(buildSearchExpression('red OR blue')).toBe('"red" AND "OR" AND "blue"');
  });

  it('유효 토큰이 없으면 undefined', () => {
    expect(buildSearchExpression('')).toBeUndefined();
    expect(buildSearchExpression('   ')).toBeUndefined();
    expect(buildSearchExpression('""')).toBeUndefined();
  });
});

describe('parseOrderBy', () => {
  it('키와 방향을 파싱한다', () => {
    expect(parseOrderBy('name asc')).toEqual([{ key: 'name', direction: 'asc' }]);
    expect(parseOrderBy('name desc')).toEqual([{ key: 'name', direction: 'desc' }]);
  });

  it('방향이 생략되면 asc (OData 기본값)', () => {
    expect(parseOrderBy('name')).toEqual([{ key: 'name', direction: 'asc' }]);
  });

  it('방향을 대소문자 무관하게 읽는다', () => {
    expect(parseOrderBy('name DESC')).toEqual([{ key: 'name', direction: 'desc' }]);
  });

  it('쉼표로 다중 기준을 파싱한다', () => {
    expect(parseOrderBy('createdAt desc, name asc')).toEqual([
      { key: 'createdAt', direction: 'desc' },
      { key: 'name', direction: 'asc' },
    ]);
  });

  it('불규칙한 공백을 흡수한다', () => {
    expect(parseOrderBy('  createdAt   desc ,  name  ')).toEqual([
      { key: 'createdAt', direction: 'desc' },
      { key: 'name', direction: 'asc' },
    ]);
  });
});

describe('$search 쿼리 문자열', () => {
  // %22(quotation-mark)와 %20(RWS)은 OData ABNF가 허용하는 형태라 그대로 적법하다.
  const searchQuery = (term: string) => buildQuery({ search: buildSearchExpression(term) });

  it('하이픈 포함 검색어를 인용된 phrase로 전송한다', () => {
    expect(searchQuery('ZT-E2E-A')).toBe('?$search=%22ZT-E2E-A%22');
  });

  it('다중 단어를 AND 결합 phrase로 전송한다', () => {
    expect(searchQuery('red shirt')).toBe('?$search=%22red%22%20AND%20%22shirt%22');
  });

  it('공백뿐인 검색어는 $search를 붙이지 않는다', () => {
    expect(searchQuery('   ')).toBe('');
  });

  it('페이징·정렬과 함께 조합된다', () => {
    const query = buildQuery({
      top: 20,
      skip: 0,
      count: true,
      search: buildSearchExpression('ZT-E2E-A'),
    });
    expect(query).toBe('?$count=true&$top=20&$skip=0&$search=%22ZT-E2E-A%22');
  });
});

/**
 * 초기 상태 옵션 (docket #198).
 *
 * ★**두 소스 훅이 이 함수 하나를 공유한다** — README가 *"same shape … so the same binding
 * code works with either source"*를 계약으로 선언하므로, 초기값 해석이 양쪽에 복제되면
 * 그 계약은 문장으로만 유지된다. 여기를 재는 것이 곧 양쪽을 재는 것이다.
 *
 * ★**NEGATIVE가 절반이다.** 이 변경의 진짜 위험은 «못 읽는 것»이 아니라 ***기본값이
 * 달라져 기존 소비자의 동작이 조용히 바뀌는 것***이다.
 */
describe('resolveInitialState (초기 상태 옵션)', () => {
  it('🔴NEGATIVE — 옵션이 없으면 종전 동작 그대로다 (page 0 · search 빈 문자열 · 정렬 없음)', () => {
    expect(resolveInitialState({})).toEqual({ page: 0, search: '', sortCriteria: [] });
  });

  it('🔴NEGATIVE — `defaultOrderBy`만 있던 종전 소비자의 해석이 바뀌지 않는다', () => {
    expect(resolveInitialState({ defaultOrderBy: 'CreatedAt desc' })).toEqual({
      page: 0,
      search: '',
      sortCriteria: [{ key: 'CreatedAt', direction: 'desc' }],
    });
  });

  it('초기 페이지를 그대로 흘린다 (0-based — `skip = page * pageSize`와 같은 축)', () => {
    expect(resolveInitialState({ initialPage: 1 }).page).toBe(1);
  });

  it('초기 검색어를 그대로 흘린다', () => {
    expect(resolveInitialState({ initialSearch: '주문번호' }).search).toBe('주문번호');
  });

  it('🔴`initialPage: 0`을 «주지 않은 것»으로 취급하지 않는다 (falsy 함정)', () => {
    // `initialPage || 0`으로 쓰면 이 테스트는 통과하지만 아래 `initialSort: []`가 죽는다 —
    // 두 케이스를 함께 두는 이유다.
    expect(resolveInitialState({ initialPage: 0 }).page).toBe(0);
  });

  it('🔴빈 `initialSort: []`는 «정렬 없음»이라는 «선언»이라 `defaultOrderBy`로 되돌아가지 않는다', () => {
    // `initialSort || parse(...)`로 쓰면 빈 배열이 falsy가 아님에도 의미가 흐려진다.
    // `??`여야 «주지 않음»과 «비어 있게 달라»가 갈린다.
    expect(
      resolveInitialState({ initialSort: [], defaultOrderBy: 'CreatedAt desc' }).sortCriteria,
    ).toEqual([]);
  });

  it('`initialSort`가 `defaultOrderBy`를 이긴다 — 저장해 둔 정렬을 파싱 없이 되돌린다', () => {
    const restored = [{ key: 'OrderDate', direction: 'desc' as const }];
    expect(
      resolveInitialState({ initialSort: restored, defaultOrderBy: 'CreatedAt asc' }).sortCriteria,
    ).toEqual(restored);
  });

  it('셋을 한 번에 받는다 — 「목록 → 상세 → 뒤로가기」 복원이 한 번의 렌더로 끝난다', () => {
    expect(
      resolveInitialState({
        initialPage: 1,
        initialSearch: 'ZT-E2E-A',
        initialSort: [{ key: 'OrderDate', direction: 'desc' }],
      }),
    ).toEqual({
      page: 1,
      search: 'ZT-E2E-A',
      sortCriteria: [{ key: 'OrderDate', direction: 'desc' }],
    });
  });
});
