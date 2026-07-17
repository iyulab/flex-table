import { describe, it, expect } from 'vitest';
import buildQuery from 'odata-query';
import { buildSearchExpression, parseOrderBy } from './use-odata-source.js';

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
