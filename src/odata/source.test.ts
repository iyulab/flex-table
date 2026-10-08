import { describe, it, expect } from 'vitest';
import { createODataSource } from './source.js';
import { ODataSourceController } from './controller.js';

/**
 * 프레임워크 중립 소스 — React 없이 쓴다. 훅의 행동은 `use-odata-source.hooks.test.ts` 가 고정하고, 여기서는 소스 자신의
 * 계약(구독이 시작 · 같은 틱의 조작은 한 요청 · 값 비교 · 해지가 거둠)과 Lit 어댑터를 잰다.
 */
const flush = () => new Promise((r) => setTimeout(r, 0));

function makeFetcher(count = 1000) {
  const calls: { url: string; signal: AbortSignal }[] = [];
  const fetcher = (input: string, init: RequestInit) => {
    calls.push({ url: input, signal: init.signal! });
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ value: [{ id: calls.length }], '@odata.count': count }),
      text: () => Promise.resolve(''),
    } as unknown as Response);
  };
  return { calls, fetcher };
}

const skipOf = (url: string) => new URL(url).searchParams.get('$skip');

describe('createODataSource', () => {
  it('구독자가 생길 때 처음 읽고, 상태를 알린다', async () => {
    const { calls, fetcher } = makeFetcher(42);
    const source = createODataSource('/api/orders', { fetcher });
    await flush();
    expect(calls).toHaveLength(0);
    expect(source.getState().loading).toBe(true);

    let notified = 0;
    source.subscribe(() => notified++);
    await flush();
    expect(calls).toHaveLength(1);
    expect(source.getState()).toMatchObject({ loading: false, totalCount: 42, data: [{ id: 1 }], error: null });
    expect(notified).toBeGreaterThan(0);
  });

  it('같은 틱의 조작은 마지막 조건으로 한 요청이다', async () => {
    const { calls, fetcher } = makeFetcher();
    const source = createODataSource('/api/orders', { fetcher, pageSize: 10 });
    source.subscribe(() => {});
    await flush();
    source.setSearch('kim');
    source.setPage(3);
    await flush();
    expect(calls).toHaveLength(2);
    expect(skipOf(calls[1].url)).toBe('30');
    expect(source.getState()).toMatchObject({ page: 3, search: 'kim' });
  });

  it('🔴fixedFilter 값이 바뀌면 첫 장으로 — 낡은 페이지로는 요청하지 않는다', async () => {
    const { calls, fetcher } = makeFetcher();
    const source = createODataSource('/api/orders', { fetcher, pageSize: 10, initialPage: 4, fixedFilter: { a: 1 } });
    source.subscribe(() => {});
    await flush();
    expect(skipOf(calls[0].url)).toBe('40');
    source.update('/api/orders', { fetcher, pageSize: 10, fixedFilter: { a: 2 } });
    await flush();
    expect(calls).toHaveLength(2);
    expect(skipOf(calls[1].url)).toBe('0');
  });

  it('expand · select 를 페이지 읽기와 fetchAll 이 같이 낸다 · expand 가 바뀌면 다시 읽는다', async () => {
    const { calls, fetcher } = makeFetcher(1);
    const options = { fetcher, expand: 'Customer($select=Name)', select: ['id'] };
    const source = createODataSource('/api/orders', options);
    const off = source.subscribe(() => {});
    await flush();
    await source.fetchAll();
    for (const call of calls) {
      const q = new URL(call.url).searchParams;
      expect(q.get('$expand')).toBe('Customer($select=Name)');
      expect(q.get('$select')).toBe('id');
    }
    expect(calls.length).toBe(2);
    source.update('/api/orders', { ...options, expand: ['Customer', 'Owner'] });
    await flush();
    expect(new URL(calls[calls.length - 1].url).searchParams.get('$expand')).toBe('Customer,Owner');
    off();
  });

  it('NEGATIVE 참조만 다른 같은 필터는 다시 읽지 않는다', async () => {
    const { calls, fetcher } = makeFetcher();
    const source = createODataSource('/api/orders', { fetcher, fixedFilter: { a: 1 } });
    source.subscribe(() => {});
    await flush();
    const before = source.getState();
    source.update('/api/orders', { fetcher, fixedFilter: { a: 1 } });
    await flush();
    expect(calls).toHaveLength(1);
    expect(source.getState()).toBe(before);
  });

  it('마지막 구독자가 떠나면 진행 중 요청을 거둔다', async () => {
    const signals: AbortSignal[] = [];
    const source = createODataSource('/api/orders', {
      fetcher: (_input, init) => {
        signals.push(init.signal!);
        return new Promise(() => {});
      },
    });
    const off = source.subscribe(() => {});
    await flush();
    expect(signals[0].aborted).toBe(false);
    off();
    expect(signals[0].aborted).toBe(true);
  });
});

describe('ODataSourceController', () => {
  function host() {
    const controllers: { hostConnected?(): void; hostDisconnected?(): void }[] = [];
    let updates = 0;
    return {
      addController: (c: (typeof controllers)[number]) => controllers.push(c),
      removeController: () => {},
      requestUpdate: () => { updates++; },
      updateComplete: Promise.resolve(true),
      connect: () => controllers.forEach((c) => c.hostConnected?.()),
      disconnect: () => controllers.forEach((c) => c.hostDisconnected?.()),
      get updates() { return updates; },
    };
  }

  it('연결되면 읽고 호스트를 다시 그린다 · 끊기면 거둔다', async () => {
    const signals: AbortSignal[] = [];
    let resolve!: (r: Response) => void;
    const h = host();
    const ctl = new ODataSourceController(h, '/api/orders', {
      fetcher: (_input, init) => {
        signals.push(init.signal!);
        return new Promise<Response>((r) => { resolve = r; });
      },
    });
    await flush();
    expect(signals).toHaveLength(0);

    h.connect();
    await flush();
    expect(signals).toHaveLength(1);
    resolve({ ok: true, status: 200, json: () => Promise.resolve({ value: [{ id: 7 }], '@odata.count': 1 }), text: () => Promise.resolve('') } as unknown as Response);
    await flush();
    expect(ctl.state).toMatchObject({ loading: false, data: [{ id: 7 }], totalCount: 1 });
    expect(h.updates).toBeGreaterThan(0);

    ctl.source.refresh();
    await flush();
    expect(signals).toHaveLength(2);
    h.disconnect();
    expect(signals[1].aborted).toBe(true);
  });
});

describe('createODataSource — 페이지 크기', () => {
  const topOf = (url: string) => new URL(url).searchParams.get('$top');

  it('🔴setPageSize 는 상태에 실리고, 첫 장으로 그 크기를 요청한다', async () => {
    const { calls, fetcher } = makeFetcher();
    const source = createODataSource('/api/orders', { fetcher, pageSize: 10, initialPage: 3 });
    source.subscribe(() => {});
    await flush();
    expect(source.getState().pageSize).toBe(10);
    source.setPageSize(50);
    await flush();
    expect(source.getState()).toMatchObject({ pageSize: 50, page: 0 });
    expect(topOf(calls.at(-1)!.url)).toBe('50');
    expect(skipOf(calls.at(-1)!.url)).toBe('0');
  });

  it('🔴같은 pageSize 옵션을 다시 넘기는 update(렌더마다 부르는 훅)는 setPageSize 로 바꾼 크기를 되돌리지 않는다', async () => {
    const { fetcher } = makeFetcher();
    const source = createODataSource('/api/orders', { fetcher, pageSize: 10 });
    source.subscribe(() => {});
    source.setPageSize(50);
    source.update('/api/orders', { fetcher, pageSize: 10 });
    await flush();
    expect(source.getState().pageSize).toBe(50);
  });

  it('pageSize 옵션 값이 바뀐 update 는 그 크기로 첫 장으로 간다', async () => {
    const { fetcher } = makeFetcher();
    const source = createODataSource('/api/orders', { fetcher, pageSize: 10, initialPage: 2 });
    source.subscribe(() => {});
    source.update('/api/orders', { fetcher, pageSize: 25 });
    await flush();
    expect(source.getState()).toMatchObject({ pageSize: 25, page: 0 });
  });

  it('NEGATIVE 같은 크기의 setPageSize 는 아무것도 바꾸지 않는다(페이지도)', async () => {
    const { fetcher } = makeFetcher();
    const source = createODataSource('/api/orders', { fetcher, pageSize: 10, initialPage: 2 });
    source.setPageSize(10);
    expect(source.getState().page).toBe(2);
  });
});

describe('ODataSourceController — 기존 소스', () => {
  it('🔴이미 있는 소스를 받는다 — 두 호스트가 같은 소스를 공유한다', async () => {
    const { fetcher } = makeFetcher();
    const source = createODataSource('/api/orders', { fetcher });
    const host = () => { const h = { updates: 0, addController() {}, removeController() {}, requestUpdate() { h.updates++; }, updateComplete: Promise.resolve(true) }; return h; };
    const a = host();
    const b = host();
    const ca = new ODataSourceController(a, source);
    const cb = new ODataSourceController(b, source);
    expect(ca.source).toBe(source);
    expect(cb.source).toBe(source);
    ca.hostConnected();
    cb.hostConnected();
    source.setPage(2);
    await flush();
    expect(a.updates).toBeGreaterThan(0);
    expect(b.updates).toBeGreaterThan(0);
  });
});
