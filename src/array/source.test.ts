import { describe, it, expect } from 'vitest';
import { createArraySource, ArraySourceController } from './source.js';

/**
 * 메모리 소스 — React 없이. `useArraySource` 와 같은 계약(검색·정렬은 첫 장으로 · 결과가 줄면 페이지도 내려옴 ·
 * `refresh` 무동작)을 소스 자신에서 잰다.
 */
const rows = Array.from({ length: 45 }, (_, i) => ({ id: i + 1, name: i % 2 ? `kim ${i}` : `lee ${i}` }));

describe('createArraySource', () => {
  it('페이지를 나누고 상태를 알린다', () => {
    const source = createArraySource(rows, { pageSize: 10 });
    let notified = 0;
    source.subscribe(() => notified++);
    expect(source.getState()).toMatchObject({ totalCount: 45, page: 0, loading: false, error: null });
    source.setPage(4);
    expect(source.getState().data.map((r) => r.id)).toEqual([41, 42, 43, 44, 45]);
    expect(notified).toBe(1);
  });

  it('검색·정렬은 첫 장으로 간다', () => {
    const source = createArraySource(rows, { pageSize: 10, initialPage: 3 });
    source.setSearch('kim');
    expect(source.getState()).toMatchObject({ page: 0, totalCount: 22, search: 'kim' });
    source.setPage(2);
    source.setSort([{ key: 'id', direction: 'desc' }]);
    expect(source.getState().page).toBe(0);
  });

  it('🔴행이 줄어 지금 페이지가 없어지면 페이지 상태도 마지막 페이지로 내려온다', () => {
    const source = createArraySource(rows, { pageSize: 10 });
    source.setPage(4);
    source.update(rows.slice(0, 12), { pageSize: 10 });
    expect(source.getState()).toMatchObject({ page: 1, totalCount: 12 });
    expect(source.getState().data.map((r) => r.id)).toEqual([11, 12]);
  });

  it('NEGATIVE refresh 는 아무 일도 하지 않는다', () => {
    const source = createArraySource(rows);
    const before = source.getState();
    source.refresh();
    expect(source.getState()).toBe(before);
  });
});

describe('ArraySourceController', () => {
  it('연결된 동안 상태 변경이 호스트를 다시 그린다', () => {
    const controllers: { hostConnected?(): void; hostDisconnected?(): void }[] = [];
    let updates = 0;
    const host = {
      addController: (c: (typeof controllers)[number]) => controllers.push(c),
      removeController: () => {},
      requestUpdate: () => { updates++; },
      updateComplete: Promise.resolve(true),
    };
    const ctl = new ArraySourceController(host, rows, { pageSize: 10 });
    controllers.forEach((c) => c.hostConnected?.());
    ctl.source.setPage(1);
    expect(updates).toBe(1);
    expect(ctl.state.data[0].id).toBe(11);
    controllers.forEach((c) => c.hostDisconnected?.());
    ctl.source.setPage(2);
    expect(updates).toBe(1);
  });
});

describe('createArraySource — 페이지 크기 · 기존 소스', () => {
  it('🔴setPageSize 는 상태에 실리고 첫 장으로 간다', () => {
    const source = createArraySource(rows, { pageSize: 10, initialPage: 3 });
    source.setPageSize(20);
    expect(source.getState()).toMatchObject({ pageSize: 20, page: 0 });
    expect(source.getState().data).toHaveLength(20);
  });

  it('🔴같은 pageSize 옵션의 update 는 바꾼 크기를 지킨다 · 값이 바뀐 update 는 그 크기로', () => {
    const source = createArraySource(rows, { pageSize: 10 });
    source.setPageSize(20);
    source.update(rows, { pageSize: 10 });
    expect(source.getState().pageSize).toBe(20);
    source.update(rows, { pageSize: 5 });
    expect(source.getState()).toMatchObject({ pageSize: 5, page: 0 });
  });

  it('ArraySourceController 는 이미 있는 소스를 받는다', () => {
    const source = createArraySource(rows);
    const host = { addController() {}, removeController() {}, requestUpdate() {}, updateComplete: Promise.resolve(true) };
    expect(new ArraySourceController(host, source).source).toBe(source);
    expect(new ArraySourceController(host, rows).source).not.toBe(source);
  });
});
