// src/array/source.ts
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { SortCriteria } from '../core/sorting.js';
import type { DataRow } from '../models/types.js';
import type { ODataSourceState } from '../odata/source.js';
import { resolveInitialState } from '../odata/query.js';
import type { UseArraySourceOptions } from './types.js';
import { computeArrayView, readAllArrayRows } from './view.js';
import type { FetchAllOptions } from '../core/fetch-all.js';

/** 메모리 소스의 설정 — `useArraySource` 의 옵션과 같다(`initial*` 은 만들 때만 읽는다). */
export type ArraySourceOptions<T> = UseArraySourceOptions<T>;

/** 메모리 소스 — `createODataSource` 와 같은 상태·조작 모양이라 같은 표 배선이 두 소스에서 돈다. */
export interface ArraySource<T> {
  /** 현재 상태(`loading` 은 늘 `false`, `error` 는 늘 `null`). 바뀌지 않았으면 같은 객체다. */
  getState(): ODataSourceState<T>;
  /** 상태가 바뀔 때마다 부른다. 해지 함수를 돌려준다. */
  subscribe(listener: () => void): () => void;
  /** 0-based 페이지로 옮긴다(범위를 넘으면 마지막 페이지). */
  setPage(page: number): void;
  /** 페이지 크기를 바꾸고 첫 장으로 간다. */
  setPageSize(size: number): void;
  /** 정렬을 바꾸고 첫 장으로 간다. */
  setSort(criteria: SortCriteria[]): void;
  /** 검색어를 바꾸고 첫 장으로 간다. */
  setSearch(term: string): void;
  /** 아무 일도 하지 않는다 — 다시 불러올 원격 상태가 없다(OData 소스와 같은 자리에 이어도 안전하다). */
  refresh(): void;
  /** 행이나 설정이 바뀌었다 — 다시 계산한다. 결과가 줄어 지금 페이지가 없어지면 마지막 페이지로 내려온다. */
  update(data: T[], options?: ArraySourceOptions<T>): void;
  /** 지금 검색·정렬의 결과 전체(페이지 없이) — `createODataSource` 의 `fetchAll` 과 같은 계약(상한 · 취소 · 진행). */
  fetchAll(options?: FetchAllOptions): Promise<T[]>;
}

/**
 * 이미 메모리에 있는 행의 데이터 소스 — 검색·정렬·페이지 나누기를 로컬에서 한다(`computeArrayView`). React 없이 쓴다;
 * React 는 `useArraySource`, Lit 은 `ArraySourceController`.
 */
export function createArraySource<T extends DataRow = DataRow>(data: T[], options: ArraySourceOptions<T> = {}): ArraySource<T> {
  let rows = data;
  let opts = options;
  const initial = resolveInitialState({
    defaultOrderBy: options.defaultOrderBy,
    initialPage: options.initialPage ?? 0,
    initialSearch: options.initialSearch ?? '',
    initialSort: options.initialSort,
  });
  let page = initial.page;
  let sortCriteria = initial.sortCriteria;
  let search = initial.search;
  let pageSize = options.pageSize ?? 20;
  let state = derive();
  const listeners = new Set<() => void>();

  function derive(): ODataSourceState<T> {
    const view = computeArrayView(rows, { search, sortCriteria, page, pageSize, columns: opts.columns, searchFields: opts.searchFields });
    // 표시와 상태가 같은 페이지를 말하게 — 결과가 줄면 페이지 상태도 마지막 유효 페이지로 내려온다(낮추기만 한다).
    const lastPage = view.totalCount === 0 ? 0 : Math.ceil(view.totalCount / pageSize) - 1;
    if (page > lastPage) page = lastPage;
    return { data: view.data as T[], totalCount: view.totalCount, loading: false, error: null, page, pageSize, sortCriteria, search };
  }

  function recompute() {
    state = derive();
    for (const l of [...listeners]) l();
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setPage(next) { page = next; recompute(); },
    setPageSize(size) { if (size === pageSize) return; pageSize = size; page = 0; recompute(); },
    setSort(criteria) { sortCriteria = criteria; page = 0; recompute(); },
    setSearch(term) { search = term; page = 0; recompute(); },
    refresh() {},
    fetchAll(options) {
      return readAllArrayRows(rows, { search, sortCriteria, columns: opts.columns, searchFields: opts.searchFields }, options);
    },
    update(nextData, nextOptions = {}) {
      // `pageSize` 옵션 «값이 바뀐» update 만 크기를 바꾼다(첫 장으로) — `createODataSource` 와 같은 규칙.
      if (nextOptions.pageSize !== undefined && nextOptions.pageSize !== opts.pageSize && nextOptions.pageSize !== pageSize) {
        pageSize = nextOptions.pageSize;
        page = 0;
      }
      rows = nextData;
      opts = nextOptions;
      recompute();
    },
  };
}

/**
 * Lit 어댑터 — 메모리 소스를 호스트에 묶는다. 상태가 바뀌면 호스트를 다시 그린다. 행이 바뀌면 `source.update(rows)`.
 */
export class ArraySourceController<T extends DataRow = DataRow> implements ReactiveController {
  /** 소스 — 조작(`setPage`·`setSort`·`setSearch`·`update`)은 이것으로 한다. */
  readonly source: ArraySource<T>;
  private unsubscribe?: () => void;

  /**
   * 행으로 소스를 만들거나, **이미 있는 소스**를 받는다 — 같은 소스를 여러 요소(표 · 페이저 · 목록 골격)가 함께 쓴다.
   */
  constructor(host: ReactiveControllerHost, source: ArraySource<T>);
  constructor(host: ReactiveControllerHost, data: T[], options?: ArraySourceOptions<T>);
  constructor(private readonly host: ReactiveControllerHost, dataOrSource: T[] | ArraySource<T>, options: ArraySourceOptions<T> = {}) {
    this.source = Array.isArray(dataOrSource) ? createArraySource<T>(dataOrSource, options) : dataOrSource;
    host.addController(this);
  }

  /** 현재 상태. */
  get state(): ODataSourceState<T> {
    return this.source.getState();
  }

  hostConnected(): void {
    this.unsubscribe ??= this.source.subscribe(() => this.host.requestUpdate());
  }

  hostDisconnected(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
}
