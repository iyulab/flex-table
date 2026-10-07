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
