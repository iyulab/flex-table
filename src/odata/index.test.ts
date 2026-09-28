import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSearchExpression, parseOrderBy, buildODataQuery } from './index.js';
import { computeArrayView } from '../array/index.js';
import * as reactEntry from '../react.js';

describe('./odata public barrel', () => {
  it('re-exports buildSearchExpression', () => {
    expect(typeof buildSearchExpression).toBe('function');
    expect(buildSearchExpression('ZT-E2E-A')).toBe('"ZT-E2E-A"');
  });

  it('re-exports parseOrderBy (same class of gap as #129 — found while fixing it)', () => {
    expect(typeof parseOrderBy).toBe('function');
    expect(parseOrderBy('name desc')).toEqual([{ key: 'name', direction: 'desc' }]);
  });
});

describe('buildODataQuery', () => {
  const params = (q: string) => new URLSearchParams(q.replace(/^\?/, ''));

  it('builds what useODataSource sends: paging, count, sort, filter, search', () => {
    const p = params(buildODataQuery({
      page: 2,
      pageSize: 20,
      sortCriteria: [{ key: 'name', direction: 'desc' }],
      search: 'red shirt',
      fixedFilter: { IsActive: true },
    }));
    expect(p.get('$top')).toBe('20');
    expect(p.get('$skip')).toBe('40');
    expect(p.get('$count')).toBe('true');
    expect(p.get('$orderby')).toBe('name desc');
    expect(p.get('$filter')).toBe('IsActive eq true');
    expect(p.get('$search')).toBe('"red" AND "shirt"');
  });

  it('NEGATIVE — defaultOrderBy only when there is no sort, and no empty search or filter', () => {
    const p = params(buildODataQuery({ page: 0, pageSize: 10, defaultOrderBy: 'id asc', search: '  ' }));
    expect(p.get('$orderby')).toBe('id asc');
    expect(p.has('$search')).toBe(false);
    expect(p.has('$filter')).toBe(false);
  });
});

describe('React hooks live on ./react', () => {
  it('exports useODataSource and useArraySource next to FlexTableReact', () => {
    expect(typeof reactEntry.useODataSource).toBe('function');
    expect(typeof reactEntry.useArraySource).toBe('function');
    expect(reactEntry.FlexTableReact).toBeDefined();
  });
});

// `./odata` 와 `./array` 는 React 없는 앱(표가 아닌 typeahead, Lit 앱의 서버 페이징)이 순수 함수만
// 쓰는 자리다. 그 엔트리가 정적으로 도달하는 모듈 그래프에 React 가 들어오면 소비자는 쓰지 않는
// 프레임워크를 설치받는다 — 그래프를 따라가며 bare import 를 잰다.
// odata-query 는 프레임워크가 아니라 `buildODataQuery` 의 구현 의존이라 주 엔트리가 쓰는 것이 맞다.
describe('pure entries stay React-free', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const FORBIDDEN = /^(react|react-dom|@lit\/react)(\/|$)/;

  function bareImportsReachable(entry: string): string[] {
    const seen = new Set<string>();
    const bare = new Set<string>();
    const walk = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm)) {
        const spec = m[1];
        if (spec.startsWith('.')) walk(resolve(dirname(file), spec.replace(/\.js$/, '.ts')));
        else bare.add(spec);
      }
    };
    walk(entry);
    return [...bare];
  }

  it.each(['./index.ts', '../array/index.ts'])('%s reaches no React', (entry) => {
    const bare = bareImportsReachable(resolve(here, entry));
    expect(bare.filter((s) => FORBIDDEN.test(s))).toEqual([]);
  });

  it('the walker does see React through the hook module (negative control)', () => {
    expect(bareImportsReachable(resolve(here, './use-odata-source.ts'))).toContain('react');
  });

  it('computeArrayView is usable from the pure entry', () => {
    expect(typeof computeArrayView).toBe('function');
  });
});
