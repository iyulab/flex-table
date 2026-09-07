import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useArraySource } from './use-array-source.js';

/**
 * `useArraySource` 의 **훅 동작**을 실제 React 렌더로 고정한다
 * (하네스 근거는 `use-odata-source.hooks.test.ts` 머리말 참조).
 *
 * 여기서 재는 것은 «데이터가 줄었을 때 페이저와 행이 서로 맞는가» 다 — 행만 클램프하고
 * 상태를 두면 페이저가 **존재하지 않는 페이지를 강조**한다.
 */
describe('useArraySource — 페이지 범위 초과', () => {
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

  type Row = { id: number; name: string };
  const rows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: i, name: `row ${i}` }));

  async function mount(data: Row[], pageSize = 10) {
    let latest: ReturnType<typeof useArraySource<Row>> | undefined;
    const Probe = (props: { data: Row[] }) => {
      latest = useArraySource<Row>(props.data, { pageSize });
      return null;
    };
    await act(async () => {
      root.render(createElement(Probe, { data }));
    });
    return {
      get current() {
        return latest!;
      },
      async rerender(next: Row[]) {
        await act(async () => {
          root.render(createElement(Probe, { data: next }));
        });
      },
    };
  }

  it('데이터가 줄면 페이지와 행이 «함께» 마지막 유효 페이지로 내려온다', async () => {
    const view = await mount(rows(45));
    await act(async () => view.current.setPage(4));
    expect(view.current.page).toBe(4);
    expect(view.current.data).toHaveLength(5); // 45행 / 10 → 마지막 페이지 4 에 5행

    await view.rerender(rows(12));

    // 회귀의 본체 — 종전에는 page 가 4 로 남고 data 가 빈 배열이었다.
    expect(view.current.totalCount).toBe(12);
    expect(view.current.page).toBe(1);
    expect(view.current.data).toHaveLength(2);
  });

  it('데이터가 0건이 되면 0페이지로 내려온다', async () => {
    const view = await mount(rows(30));
    await act(async () => view.current.setPage(2));
    await view.rerender([]);
    expect(view.current.page).toBe(0);
    expect(view.current.data).toEqual([]);
  });

  it('범위 안이면 페이지를 건드리지 않는다 (routine refresh 에서 튀지 않는다)', async () => {
    const view = await mount(rows(45));
    await act(async () => view.current.setPage(2));
    // 길이가 같은 «새 배열» — polling 이 매번 새 참조를 주는 흔한 형태다.
    await view.rerender(rows(45));
    expect(view.current.page).toBe(2);
    expect(view.current.data[0]).toEqual({ id: 20, name: 'row 20' });
  });

  it('데이터가 다시 늘어도 페이지를 임의로 되돌리지 않는다', async () => {
    const view = await mount(rows(45));
    await act(async () => view.current.setPage(3));
    await view.rerender(rows(60));
    expect(view.current.page).toBe(3);
  });
});


/**
 * README 가 «same shape» 계약으로 선언한 나머지 동작들. cycle-456 이 `useODataSource`
 * 쪽에서 한 것의 형제 축이다 — 이 훅은 `resolveInitialState` 를 공유하지만 **훅을 지나는
 * 경로**는 별도라, 순수 함수 테스트가 이쪽을 증명하지 않는다.
 */
describe('useArraySource — 선언된 계약', () => {
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

  type Row = { id: number; name: string };
  const ROWS: Row[] = [
    { id: 1, name: 'widget alpha' },
    { id: 2, name: 'widget beta' },
    { id: 3, name: 'gadget gamma' },
  ];

  type Options = Parameters<typeof useArraySource<Row>>[1];

  async function mount(options: Options, data: Row[] = ROWS) {
    let latest: ReturnType<typeof useArraySource<Row>> | undefined;
    const Probe = (props: { options: Options }) => {
      latest = useArraySource<Row>(data, props.options);
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

  const many = Array.from({ length: 45 }, (_, i) => ({ id: i, name: `row ${i}` }));

  it('setSearch 는 페이지를 0으로 되돌린다 (useODataSource 와 같은 부수효과)', async () => {
    const view = await mount({ pageSize: 10 }, many);
    await act(async () => view.current.setPage(3));
    expect(view.current.page).toBe(3);

    // ⚠검색어는 «좁히지 않는» 것을 고른다. 'row 4' 로 하면 결과가 6행이 되어 마지막
    // 페이지가 0이고, **클램프가 리셋을 가려** 이 테스트가 아무것도 재지 않게 된다
    // (네거티브 컨트롤에서 `setPage(0)` 을 제거해도 초록이었다 — 그래서 바꿨다).
    // 'row' 는 45행 전부를 남기므로 3페이지가 유효하고, 0으로 가는 유일한 이유가 리셋이다.
    await act(async () => view.current.setSearch('row'));
    expect(view.current.page).toBe(0);
    expect(view.current.search).toBe('row');
  });

  it('onSortChange 도 페이지를 0으로 되돌린다', async () => {
    const view = await mount({ pageSize: 10 }, many);
    await act(async () => view.current.setPage(2));

    await act(async () => {
      view.current.onSortChange(
        new CustomEvent('sort-change', { detail: { criteria: [{ key: 'id', direction: 'desc' }] } })
      );
    });
    expect(view.current.page).toBe(0);
    expect(view.current.sortCriteria).toEqual([{ key: 'id', direction: 'desc' }]);
  });

  it('criteria 가 없는 이벤트는 아무것도 바꾸지 않는다', async () => {
    const view = await mount({ pageSize: 10 }, many);
    await act(async () => view.current.setPage(2));
    await act(async () => {
      view.current.onSortChange(new CustomEvent('sort-change', { detail: {} }));
    });
    expect(view.current.page).toBe(2);
    expect(view.current.sortCriteria).toEqual([]);
  });

  it('initial* 은 첫 렌더에서만 읽힌다', async () => {
    // ⚠검색어는 «좁히지 않는» 것을 고른다 — 'row 1' 로 하면 결과가 11행이 되어
    // 마지막 페이지가 1이고, 클램프가 «정당하게» 발화해 initialPage 2 가 1로 내려온다
    // (첫 판이 그 조합으로 실패했다 — 제품이 아니라 픽스처의 전제가 틀렸다).
    const view = await mount({ pageSize: 10, initialPage: 2, initialSearch: 'row' }, many);
    expect(view.current.page).toBe(2);
    expect(view.current.search).toBe('row');

    // 옵션을 바꿔 재렌더해도 움직이지 않는다 — `defaultOrderBy` 가 이미 갖던 계약이다.
    await view.rerender({ pageSize: 10, initialPage: 0, initialSearch: '' });
    expect(view.current.page).toBe(2);
    expect(view.current.search).toBe('row');
  });

  it('initialSort 가 defaultOrderBy 를 이기고, 빈 배열은 «정렬 없음» 이다', async () => {
    const won = await mount({ defaultOrderBy: 'id desc', initialSort: [{ key: 'name', direction: 'asc' }] });
    expect(won.current.sortCriteria).toEqual([{ key: 'name', direction: 'asc' }]);

    // 빈 배열은 폴백하지 않는다(`??` 이지 `||` 가 아니다).
    await act(async () => root.unmount());
    root = createRoot(container);
    const empty = await mount({ defaultOrderBy: 'id desc', initialSort: [] });
    expect(empty.current.sortCriteria).toEqual([]);
  });

  it('initialPage 도 클램프의 대상이다 (initialSearch 가 결과를 좁히면 함께 내려온다)', async () => {
    // 위 테스트가 처음 실패한 조합을 «의도된 계약»으로 고정한다: 'row 1' 은 11행만
    // 남기므로 마지막 페이지는 1이고, initialPage 2 는 그리로 내려온다.
    const view = await mount({ pageSize: 10, initialPage: 2, initialSearch: 'row 1' }, many);
    expect(view.current.totalCount).toBe(11);
    expect(view.current.page).toBe(1);
  });

  it('refresh 는 no-op 이고 상태를 흔들지 않는다 (다시 불러올 원격 상태가 없다)', async () => {
    const view = await mount({ pageSize: 10 }, many);
    await act(async () => view.current.setPage(2));
    await act(async () => view.current.refresh());
    expect(view.current.page).toBe(2);
    expect(view.current.loading).toBe(false);
    expect(view.current.error).toBeNull();
  });

  it('검색은 totalCount 를 좁힌 결과 기준으로 돌려준다', async () => {
    const view = await mount({ pageSize: 10 });
    expect(view.current.totalCount).toBe(3);
    await act(async () => view.current.setSearch('widget'));
    expect(view.current.totalCount).toBe(2);
    expect(view.current.data.map((r) => r.id)).toEqual([1, 2]);
  });
});
