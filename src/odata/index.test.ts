import { describe, it, expect } from 'vitest';
import { buildSearchExpression, parseOrderBy, useODataSource } from './index.js';

describe('./odata public barrel', () => {
  it('re-exports buildSearchExpression (docket #129)', () => {
    expect(typeof buildSearchExpression).toBe('function');
    expect(buildSearchExpression('ZT-E2E-A')).toBe('"ZT-E2E-A"');
  });

  it('re-exports parseOrderBy (same class of gap as #129 — found while fixing it)', () => {
    expect(typeof parseOrderBy).toBe('function');
    expect(parseOrderBy('name desc')).toEqual([{ key: 'name', direction: 'desc' }]);
  });

  it('still re-exports useODataSource', () => {
    expect(typeof useODataSource).toBe('function');
  });
});
