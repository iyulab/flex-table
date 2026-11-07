import { describe, it, expect } from 'vitest';
import { createODataSource } from './source.js';

/**
 * 기본 정렬이 내림차순인 소스에서 헤더의 첫 클릭이 아무 변화도 만들지 않던 것.
 *
 * 헤더는 오름 → 내림 → 없음으로 돈다. 기본 정렬(`defaultOrderBy`)이 `X desc` 인 소스는 처음부터 `X desc` 를 보이고, 그 헤더를
 * 처음 누르면 표가 «없음»(`[]`)을 보낸다 — 소스는 정렬이 없으면 기본 정렬로 묻는데 그것이 방금 보이던 `X desc` 라서 화면의 순서는
 * 그대로이고 화살표만 사라진다. 한 번 더 눌러야 오름차순이 된다. 소스가 «아무것도 바꾸지 않을 없음» 을 다음 단계로 넘긴다.
 */
const flush = () => new Promise((r) => setTimeout(r, 0));

function makeFetcher() {
  const calls: string[] = [];
  const fetcher = (input: string) => {
    calls.push(input);
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ value: [], '@odata.count': 0 }),
      text: () => Promise.resolve(''),
    } as unknown as Response);
  };
  return { calls, fetcher };
}

const orderByOf = (url: string) => new URL(url, 'http://x').searchParams.get('$orderby');

async function start(defaultOrderBy?: string, extra: object = {}) {
  const { calls, fetcher } = makeFetcher();
  const source = createODataSource('/api/orders', { fetcher, pageSize: 10, defaultOrderBy, ...extra });
  source.subscribe(() => {});
  await flush();
  return { source, calls };
}

describe('createODataSource — a header click that would change nothing moves on', () => {
  it('🔴default `OrderDate desc`: leaving it (the table sends none) goes to ascending', async () => {
    const { source, calls } = await start('OrderDate desc');
    expect(source.getState().sortCriteria).toEqual([{ key: 'OrderDate', direction: 'desc' }]);
    source.setSort([]); // the table's step after descending
    await flush();
    expect(source.getState().sortCriteria, '순서가 그대로일 «없음» 은 건너뛴다').toEqual([{ key: 'OrderDate', direction: 'asc' }]);
    expect(orderByOf(calls[calls.length - 1])).toBe('OrderDate asc');
  });

  it('it keeps toggling on that column (ascending → descending → ascending)', async () => {
    const { source } = await start('OrderDate desc');
    source.setSort([]);
    source.setSort([{ key: 'OrderDate', direction: 'desc' }]); // the table: ascending → descending
    await flush();
    expect(source.getState().sortCriteria).toEqual([{ key: 'OrderDate', direction: 'desc' }]);
    source.setSort([]);
    await flush();
    expect(source.getState().sortCriteria).toEqual([{ key: 'OrderDate', direction: 'asc' }]);
  });

  it('NEGATIVE — default ascending: descending → none is a real change (back to ascending), unchanged', async () => {
    const { source, calls } = await start('OrderDate asc');
    source.setSort([{ key: 'OrderDate', direction: 'desc' }]);
    await flush();
    source.setSort([]);
    await flush();
    expect(source.getState().sortCriteria).toEqual([]);
    expect(orderByOf(calls[calls.length - 1])).toBe('OrderDate asc');
  });

  it('NEGATIVE — another column sorted: none returns to the default order, unchanged', async () => {
    const { source, calls } = await start('OrderDate desc');
    source.setSort([{ key: 'Name', direction: 'desc' }]);
    await flush();
    source.setSort([]);
    await flush();
    expect(source.getState().sortCriteria).toEqual([]);
    expect(orderByOf(calls[calls.length - 1])).toBe('OrderDate desc');
  });

  it('NEGATIVE — no default order: none stays none', async () => {
    const { source } = await start(undefined);
    source.setSort([{ key: 'Name', direction: 'desc' }]);
    await flush();
    source.setSort([]);
    await flush();
    expect(source.getState().sortCriteria).toEqual([]);
  });

  it('NEGATIVE — an empty sort asked for while none is chosen stays empty', async () => {
    const { source } = await start('OrderDate desc', { initialSort: [] });
    source.setSort([]);
    await flush();
    expect(source.getState().sortCriteria).toEqual([]);
  });
});
