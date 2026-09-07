import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useODataSource } from './use-odata-source.js';

/**
 * `useODataSource` 의 **훅 동작**을 실제 React 렌더로 고정한다.
 *
 * ⚠**이 파일 이전까지 이 패키지의 테스트는 전부 순수 함수였다** — 훅이 이 패키지의 주요
 * 공개 표면인데도 그것을 «실행해» 보는 자리가 하나도 없었다. 그래서 페이지 리셋처럼
 * *"언제 발화하고 언제 발화하지 않는가"* 가 핵심인 규칙은 타입체크로도 순수 함수 테스트로도
 * 증명되지 않았다. `react-dom` 을 devDependency 로 들인 이유가 그것이다.
 *
 * 요청은 `fetcher` 옵션으로 가로챈다 — 훅이 이미 노출하는 이음매라 전역 `fetch` 를
 * 흉내 낼 필요가 없다.
 */
describe('useODataSource — 페이지 리셋', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  /**
   * 훅이 실제로 만든 요청 URL 을 순서대로 모은다.
   *
   * ⚠**개수를 «충분히 크게» 돌려준다.** `@odata.count: 0` 을 돌려주면 결과 집합이 비어
   * 있다는 뜻이고, 그러면 페이지 클램프가 정당하게 발화해 `setPage(5)` 가 즉시 0으로
   * 되돌아온다 — 페이지 이동을 재려는 테스트에서는 그 조합 자체가 비현실적이다.
   */
  function makeFetcher(urls: string[], count = 1000) {
    return (input: string) => {
      urls.push(input);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ value: [{ id: 1 }], '@odata.count': count }),
        text: () => Promise.resolve(''),
      } as unknown as Response);
    };
  }

  type Options = Parameters<typeof useODataSource>[1];

  /** 옵션을 바꿔 가며 다시 렌더할 수 있는 최소 하네스. */
  async function mount(options: Options) {
    let latest: ReturnType<typeof useODataSource> | undefined;
    const Probe = (props: { options: Options }) => {
      latest = useODataSource('/api/orders', props.options);
      return null;
    };
    await act(async () => {
      root.render(createElement(Probe, { options }));
    });
    return {
      get current() {
        return latest!;
      },
      async rerender(next: Options) {
        await act(async () => {
          root.render(createElement(Probe, { options: next }));
        });
      },
    };
  }

  const skipOf = (url: string) => {
    const m = /\$skip=(\d+)/.exec(url);
    return m ? Number(m[1]) : 0;
  };

  it('fixedFilter 가 바뀌면 페이지가 첫 장으로 돌아간다', async () => {
    const urls: string[] = [];
    const view = await mount({ pageSize: 20, fetcher: makeFetcher(urls), fixedFilter: { IsActive: true } });

    await act(async () => view.current.setPage(5));
    expect(view.current.page).toBe(5);
    expect(skipOf(urls[urls.length - 1])).toBe(100);

    await view.rerender({ pageSize: 20, fetcher: makeFetcher(urls), fixedFilter: { IsActive: false } });

    // 회귀의 본체 — 종전에는 page 가 5 로 남아 $skip=100 이 유지됐고, 좁아진 결과
    // 집합에서는 그것이 빈 목록으로 나타났다.
    expect(view.current.page).toBe(0);
    expect(skipOf(urls[urls.length - 1])).toBe(0);
  });

  it('낡은 page 로는 «한 번도» 요청하지 않는다 (렌더 중 조정이라 effect 보다 앞선다)', async () => {
    const urls: string[] = [];
    const view = await mount({ pageSize: 20, fetcher: makeFetcher(urls), fixedFilter: { IsActive: true } });
    await act(async () => view.current.setPage(5));

    const before = urls.length;
    await view.rerender({ pageSize: 20, fetcher: makeFetcher(urls), fixedFilter: { IsActive: false } });

    // 필터 변경 이후에 나간 요청 중 $skip 이 0 이 아닌 것이 있으면, 그것이 바로
    // effect 로 리셋했을 때 생기는 «버려지는 요청» 이다.
    const after = urls.slice(before);
    expect(after.every((u) => skipOf(u) === 0)).toBe(true);
  });

  it('응답 개수가 지금 페이지를 담지 못하면 마지막 유효 페이지로 내려온다', async () => {
    // 결과 집합은 우리 요청 없이도 줄 수 있다(다른 사용자의 삭제 등). 그때 종전에는
    // 행 0 + totalCount 0이 아님 + 페이저가 없는 페이지를 강조하는 상태가 남았다.
    let count = 200;
    const fetcher = (input: string) => {
      const skip = Number(/\$skip=(\d+)/.exec(input)?.[1] ?? 0);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ value: skip >= count ? [] : [{ id: skip }], '@odata.count': count }),
        text: () => Promise.resolve(''),
      } as unknown as Response);
    };
    const view = await mount({ pageSize: 20, fetcher });
    await act(async () => view.current.setPage(5));
    expect(view.current.page).toBe(5);

    count = 10; // 10행 / 20행씩 = 마지막 페이지는 0
    await act(async () => view.current.refresh());

    expect(view.current.totalCount).toBe(10);
    expect(view.current.page).toBe(0);
    expect(view.current.data).toHaveLength(1);
  });

  it('첫 응답 전에 initialPage 를 지우지 않는다 (totalCount 초기값 0에 걸리지 않는다)', async () => {
    // 클램프를 «렌더 중»에 두면 totalCount 초기값 0 때문에 첫 fetch 전에 발화해
    // initialPage 가 조용히 무의미해진다. 응답 핸들러에 둔 이유가 이것이다.
    const urls: string[] = [];
    const view = await mount({ pageSize: 20, fetcher: makeFetcher(urls), initialPage: 4 });
    expect(view.current.page).toBe(4);
    expect(skipOf(urls[0])).toBe(80);
  });

  it('참조만 다르고 값이 같은 fixedFilter 객체는 페이지를 건드리지 않는다', async () => {
    const urls: string[] = [];
    const view = await mount({ pageSize: 20, fetcher: makeFetcher(urls), fixedFilter: { IsActive: true } });
    await act(async () => view.current.setPage(3));

    // 호출자가 매 render 마다 새 객체 리터럴을 넘기는 흔한 형태 — 값이 같으므로
    // 직렬화 키가 같고, 페이지는 유지돼야 한다.
    await view.rerender({ pageSize: 20, fetcher: makeFetcher(urls), fixedFilter: { IsActive: true } });
    expect(view.current.page).toBe(3);
  });

  it('마운트 시에는 리셋이 발화하지 않아 initialPage 가 살아남는다', async () => {
    const urls: string[] = [];
    const view = await mount({
      pageSize: 20,
      fetcher: makeFetcher(urls),
      fixedFilter: { IsActive: true },
      initialPage: 4,
    });

    // cycle-447 이 더한 initialPage 와의 상호작용 — 리셋이 마운트에서도 돌면
    // 이 옵션이 조용히 무의미해진다.
    expect(view.current.page).toBe(4);
    expect(skipOf(urls[0])).toBe(80);
  });

  it('fixedFilter 가 없다가 생겨도 페이지가 돌아간다', async () => {
    const urls: string[] = [];
    const view = await mount({ pageSize: 20, fetcher: makeFetcher(urls) });
    await act(async () => view.current.setPage(2));

    await view.rerender({ pageSize: 20, fetcher: makeFetcher(urls), fixedFilter: { IsActive: true } });
    expect(view.current.page).toBe(0);
  });
});


/**
 * README 가 **계약으로 선언한** 나머지 동작들. 넷 다 문서에는 있는데 실행 증거가 0이었다
 * (cycle-454 가 하네스를 만들기 전까지는 만들 방법도 없었다).
 */
describe('useODataSource — 선언된 계약', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  type Options = Parameters<typeof useODataSource>[1];

  async function mount(options: Options) {
    let latest: ReturnType<typeof useODataSource> | undefined;
    const Probe = (props: { options: Options }) => {
      latest = useODataSource('/api/orders', props.options);
      return null;
    };
    await act(async () => {
      root.render(createElement(Probe, { options }));
    });
    return {
      get current() {
        return latest!;
      },
    };
  }

  const okResponse = (count = 1000) =>
    ({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ value: [{ id: 1 }], '@odata.count': count }),
      text: () => Promise.resolve(''),
    }) as unknown as Response;

  it('401 응답에서 onUnauthorized 가 «에러가 설정되기 전에» 불린다', async () => {
    const calls: number[] = [];
    const view = await mount({
      onUnauthorized: (res) => calls.push(res.status),
      fetcher: () =>
        Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(''),
        } as unknown as Response),
    });
    expect(calls).toEqual([401]);
    // README: "Called on 401/403 responses, before the generic error is set"
    expect(view.current.error).not.toBeNull();
  });

  it('403 에서도 불린다', async () => {
    const calls: number[] = [];
    await mount({
      onUnauthorized: (res) => calls.push(res.status),
      fetcher: () =>
        Promise.resolve({
          ok: false,
          status: 403,
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(''),
        } as unknown as Response),
    });
    expect(calls).toEqual([403]);
  });

  it('500 에서는 불리지 않는다 (인증 실패만 이 훅의 대상이다)', async () => {
    const calls: number[] = [];
    const view = await mount({
      onUnauthorized: (res) => calls.push(res.status),
      fetcher: () =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
          text: () => Promise.resolve('{"error":{"message":"boom"}}'),
        } as unknown as Response),
    });
    expect(calls).toEqual([]);
    // 서버가 준 메시지가 일반 메시지를 이긴다.
    expect(view.current.error).toBe('boom');
  });

  it('요청이 갈아탈 때 이전 요청을 abort 한다', async () => {
    const signals: AbortSignal[] = [];
    const view = await mount({
      pageSize: 20,
      fetcher: (_input, init) => {
        signals.push(init.signal!);
        return Promise.resolve(okResponse());
      },
    });
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);

    await act(async () => view.current.setPage(2));

    // 첫 요청의 signal 이 끊겼어야 한다 — 안 그러면 늦게 도착한 응답이 새 것을 덮는다.
    expect(signals.length).toBeGreaterThan(1);
    expect(signals[0].aborted).toBe(true);
  });

  it('언마운트하면 진행 중인 요청을 abort 한다', async () => {
    const signals: AbortSignal[] = [];
    await mount({
      fetcher: (_input, init) => {
        signals.push(init.signal!);
        return Promise.resolve(okResponse());
      },
    });
    expect(signals[0].aborted).toBe(false);
    await act(async () => root.unmount());
    expect(signals[0].aborted).toBe(true);
    // afterEach 의 두 번째 unmount 가 터지지 않도록 새 root 를 만들어 둔다.
    root = createRoot(container);
  });

  it('setSearch 는 페이지를 0으로 되돌린다 (README 가 선언한 부수효과)', async () => {
    const view = await mount({ pageSize: 20, fetcher: () => Promise.resolve(okResponse()) });
    await act(async () => view.current.setPage(3));
    expect(view.current.page).toBe(3);
    await act(async () => view.current.setSearch('widget'));
    expect(view.current.page).toBe(0);
    expect(view.current.search).toBe('widget');
  });

  it('initial* 은 첫 렌더에서만 읽힌다 — 이후 옵션 변경은 무시된다', async () => {
    let latest: ReturnType<typeof useODataSource> | undefined;
    const fetcher = () => Promise.resolve(okResponse());
    const Probe = (props: { initialPage: number }) => {
      latest = useODataSource('/api/orders', { pageSize: 20, fetcher, initialPage: props.initialPage });
      return null;
    };
    await act(async () => {
      root.render(createElement(Probe, { initialPage: 2 }));
    });
    expect(latest!.page).toBe(2);

    // 옵션을 바꿔 다시 렌더해도 «첫 렌더에서만» 계약이 유지돼야 한다.
    await act(async () => {
      root.render(createElement(Probe, { initialPage: 7 }));
    });
    expect(latest!.page).toBe(2);
  });
});
