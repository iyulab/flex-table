import { describe, it, expect, vi } from 'vitest';
import { createODataSource } from './source.js';
import { buildODataQuery } from './query.js';
import { createArraySource } from '../array/source.js';
import { RowLimitError, SourceRequestError } from '../core/source-error.js';
import * as odataEntry from './index.js';
import * as arrayEntry from '../array/index.js';
import * as reactEntry from '../react.js';
import * as rootEntry from '../index.js';

/**
 * `fetchAll` — «지금 이 목록이 보여 주는 조회 결과 전체». 서버 페이지 목록의 내보내기가 받아 온 한 페이지만 보던 것이
 * 계기다(조용히 잘린 파일). 질의(정렬 · 검색 · 고정 필터)를 아는 것은 소스이고 파일 모양(열)은 표가 안다 — 그 사이를
 * 잇는 원시 연산이 소스의 이것이다.
 *
 * 계약: 지금 조건 그대로 · `$top`/`$skip` 없이 · `@odata.nextLink` 를 끝까지 · 상한을 넘으면 잘라서 주지 않고 거절 ·
 * 소스 상태(페이지 · 데이터)를 건드리지 않는다.
 */

type Page = { value: Array<Record<string, unknown>>; '@odata.count'?: number; '@odata.nextLink'?: string };

/** URL → 응답 표. 없는 URL 은 404. */
function serve(pages: Record<string, Page>, base = 'http://localhost') {
  const calls: string[] = [];
  const fetcher = vi.fn((input: string, init: RequestInit) => {
    calls.push(input);
    if (init.signal?.aborted) return Promise.reject(new DOMException('aborted', 'AbortError'));
    const key = input.startsWith(base) ? input.slice(base.length) : input;
    const pathOnly = key.split('?')[0];
    const body = pages[key] ?? pages[pathOnly];
    if (!body) {
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}), text: () => Promise.resolve('{"error":{"code":"NotFound","message":"gone"}}') } as unknown as Response);
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') } as unknown as Response);
  });
  return { calls, fetcher };
}

const rows = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ id: from + i }));
const params = (url: string) => new URL(url).searchParams;

describe('buildODataQuery — no pageSize asks for the whole result', () => {
  it('omits $top and $skip, keeps $count, sort, filter and search', () => {
    const p = new URLSearchParams(buildODataQuery({ sortCriteria: [{ key: 'name', direction: 'asc' }], search: 'kim', fixedFilter: { IsActive: true } }).slice(1));
    expect(p.has('$top')).toBe(false);
    expect(p.has('$skip')).toBe(false);
    expect(p.get('$count')).toBe('true');
    expect(p.get('$orderby')).toBe('name asc');
    expect(p.get('$filter')).toBe('IsActive eq true');
    expect(p.get('$search')).toBe('"kim"');
  });
});

describe('ODataSource.fetchAll', () => {
  it('🔴follows @odata.nextLink to the end — the whole result, not one page', async () => {
    const { calls, fetcher } = serve({
      '/api/assets': { value: rows(1, 3), '@odata.count': 7, '@odata.nextLink': 'http://localhost/api/assets?$skiptoken=3' },
      '/api/assets?$skiptoken=3': { value: rows(4, 3), '@odata.nextLink': '/api/assets?$skiptoken=6' },
      '/api/assets?$skiptoken=6': { value: rows(7, 1) },
    });
    const source = createODataSource('/api/assets', { fetcher, pageSize: 2, baseUrl: 'http://localhost' });
    const all = await source.fetchAll();
    expect(all.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(calls).toHaveLength(3);
  });

  it('asks with the current sort, search and fixed filter — and no paging', async () => {
    const { calls, fetcher } = serve({ '/api/assets': { value: rows(1, 2), '@odata.count': 2 } });
    const source = createODataSource('/api/assets', { fetcher, pageSize: 2, baseUrl: 'http://localhost', fixedFilter: { Site: 'A' } });
    source.setSort([{ key: 'name', direction: 'desc' }]);
    source.setSearch('pump');
    source.setPage(5);
    await source.fetchAll();
    const p = params(calls[0]);
    expect(p.get('$orderby')).toBe('name desc');
    expect(p.get('$search')).toBe('"pump"');
    expect(p.get('$filter')).toBe("Site eq 'A'");
    expect(p.has('$top')).toBe(false);
    expect(p.has('$skip')).toBe(false);
  });

  it('leaves the source state alone and needs no subscriber', async () => {
    const { fetcher } = serve({ '/api/assets': { value: rows(1, 4), '@odata.count': 4 } });
    const source = createODataSource('/api/assets', { fetcher, pageSize: 2, baseUrl: 'http://localhost', initialPage: 1 });
    const before = source.getState();
    await source.fetchAll();
    expect(source.getState()).toBe(before);
  });

  it('🔴rejects past maxRows instead of cutting — on the first response when the server counted', async () => {
    const { calls, fetcher } = serve({
      '/api/assets': { value: rows(1, 3), '@odata.count': 1240, '@odata.nextLink': '/api/assets?$skiptoken=3' },
    });
    const source = createODataSource('/api/assets', { fetcher, baseUrl: 'http://localhost' });
    const err = await source.fetchAll({ maxRows: 1000 }).catch((e) => e);
    expect(err).toBeInstanceOf(RowLimitError);
    expect(err).toBeInstanceOf(SourceRequestError);
    expect(err.total).toBe(1240);
    expect(err.maxRows).toBe(1000);
    expect(err.failure.message).toContain('1000');
    expect(calls).toHaveLength(1);
  });

  it('rejects past maxRows by what it read when the server did not count', async () => {
    const { fetcher } = serve({
      '/api/assets': { value: rows(1, 3), '@odata.nextLink': '/api/assets?$skiptoken=3' },
      '/api/assets?$skiptoken=3': { value: rows(4, 3) },
    });
    const source = createODataSource('/api/assets', { fetcher, baseUrl: 'http://localhost' });
    const err = await source.fetchAll({ maxRows: 5 }).catch((e) => e);
    expect(err).toBeInstanceOf(RowLimitError);
    expect(err.total).toBeUndefined();
  });

  it('NEGATIVE exactly maxRows is not over the limit', async () => {
    const { fetcher } = serve({ '/api/assets': { value: rows(1, 5), '@odata.count': 5 } });
    const source = createODataSource('/api/assets', { fetcher, baseUrl: 'http://localhost' });
    expect(await source.fetchAll({ maxRows: 5 })).toHaveLength(5);
  });

  it('reports progress per page, with the server total', async () => {
    const { fetcher } = serve({
      '/api/assets': { value: rows(1, 3), '@odata.count': 4, '@odata.nextLink': '/api/assets?$skiptoken=3' },
      '/api/assets?$skiptoken=3': { value: rows(4, 1) },
    });
    const source = createODataSource('/api/assets', { fetcher, baseUrl: 'http://localhost' });
    const progress: Array<[number, number | undefined]> = [];
    await source.fetchAll({ onProgress: (loaded, total) => progress.push([loaded, total]) });
    expect(progress).toEqual([[3, 4], [4, 4]]);
  });

  it('a failed page rejects with SourceRequestError carrying the structured failure', async () => {
    const { fetcher } = serve({
      '/api/assets': { value: rows(1, 3), '@odata.nextLink': '/api/missing' },
    });
    const onUnauthorized = vi.fn();
    const source = createODataSource('/api/assets', { fetcher, baseUrl: 'http://localhost', onUnauthorized });
    const err = await source.fetchAll().catch((e) => e);
    expect(err).toBeInstanceOf(SourceRequestError);
    expect(err.failure).toMatchObject({ status: 404, code: 'NotFound', message: 'gone' });
  });

  it('🔴a nextLink outside the source origin is refused, not followed', async () => {
    const { calls, fetcher } = serve({
      '/api/assets': { value: rows(1, 3), '@odata.nextLink': 'https://elsewhere.example/api/assets?$skiptoken=3' },
    });
    const source = createODataSource('/api/assets', { fetcher, baseUrl: 'http://localhost' });
    const err = await source.fetchAll().catch((e) => e);
    expect(err).toBeInstanceOf(SourceRequestError);
    expect(calls).toHaveLength(1);
  });

  it('an aborted signal rejects with AbortError', async () => {
    const { fetcher } = serve({ '/api/assets': { value: rows(1, 3) } });
    const source = createODataSource('/api/assets', { fetcher, baseUrl: 'http://localhost' });
    const ctrl = new AbortController();
    ctrl.abort();
    const err = await source.fetchAll({ signal: ctrl.signal }).catch((e) => e);
    expect(err.name).toBe('AbortError');
  });
});

describe('ArraySource.fetchAll — the same contract in memory', () => {
  const data = [{ name: 'pump b' }, { name: 'valve' }, { name: 'pump a' }, { name: 'pump c' }];

  it('the current search and sort, all rows, no page', async () => {
    const source = createArraySource(data, { pageSize: 1, initialPage: 0 });
    source.setSearch('pump');
    source.setSort([{ key: 'name', direction: 'asc' }]);
    expect((await source.fetchAll()).map((r) => r.name)).toEqual(['pump a', 'pump b', 'pump c']);
    expect(source.getState().data).toHaveLength(1);
  });

  it('rejects past maxRows with the count', async () => {
    const source = createArraySource(data);
    const err = await source.fetchAll({ maxRows: 3 }).catch((e) => e);
    expect(err).toBeInstanceOf(RowLimitError);
    expect(err.total).toBe(4);
  });

  it('NEGATIVE an empty result is an empty array, not an error', async () => {
    const source = createArraySource(data);
    source.setSearch('nothing matches');
    expect(await source.fetchAll()).toEqual([]);
  });
});

describe('entries carry what a fetchAll caller needs', () => {
  it('./odata, ./array, ./react export the rejection classes; the root exports the table-less export helpers', () => {
    expect(odataEntry.RowLimitError).toBe(RowLimitError);
    expect(odataEntry.SourceRequestError).toBe(SourceRequestError);
    expect(arrayEntry.RowLimitError).toBe(RowLimitError);
    expect(reactEntry.RowLimitError).toBe(RowLimitError);
    expect(odataEntry.DEFAULT_MAX_ROWS).toBe(100_000);
    expect(typeof rootEntry.exportDataBlob).toBe('function');
    expect(typeof rootEntry.downloadBlob).toBe('function');
  });
});
