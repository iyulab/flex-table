// src/odata/source.ts
import type { SortCriteria } from '../core/sorting.js';
import { buildODataQuery, resolveInitialState } from './query.js';
import { networkFailure, readFailedResponse, SourceRequestError, toSourceError, type SourceError } from '../core/source-error.js';

/** OData 소스의 설정 — `useODataSource` 의 옵션과 같다(`initial*` 은 만들 때만 읽는다). */
export interface ODataSourceOptions {
  pageSize?: number;
  defaultOrderBy?: string;
  /**
   * 초기 페이지. **0-based** — `page`/`setPage` 와 같은 축이고, 요청의 `$skip` 은 `page * pageSize` 다. 기본값 `0`.
   * 만들 때만 읽는다 — 이후에 옮기려면 `setPage`.
   */
  initialPage?: number;
  /** 초기 검색어. 기본값 `''`. 만들 때만 읽는다. */
  initialSearch?: string;
  /**
   * 초기 정렬. 주면 `defaultOrderBy` 파싱보다 **우선**한다 — 이쪽은 `sortCriteria`/`setSort` 가 주고받는 모양 그대로라
   * 저장해 둔 정렬 상태를 파싱 없이 되돌릴 수 있다. 만들 때만 읽는다.
   */
  initialSort?: SortCriteria[];
  /** 고정 필터. 값(직렬화)이 바뀌면 페이지가 첫 장으로 돌아간다 — 참조만 다른 같은 값은 아무 일도 없다. */
  fixedFilter?: Record<string, unknown>;
  /** 기본값: `window.location.origin`. 프록시/BFF 등 다른 origin 으로 요청해야 할 때 지정. */
  baseUrl?: string;
  /** 커스텀 fetch transport(예: 인증 헤더를 주입하는 `HttpClient` 래퍼). 기본값: 전역 `fetch`. */
  fetcher?: (input: string, init: RequestInit) => Promise<Response>;
  /**
   * 응답이 401 일 때 호출(세션 만료 리다이렉트 등). 호출 후에도 기존 에러 처리는 계속 진행된다.
   * 403(인증됐지만 권한 없음)에는 부르지 않는다 — 그 실패는 `error` 로 드러난다.
   */
  onUnauthorized?: (response: Response) => void;
  /**
   * `false` 인 동안 요청하지 않는다. 기본값 `true`. `false → true` 가 되는 순간 그때의 조건으로 첫 조회가 나가고,
   * 그 사이 `loading` 은 `true` 다. 조회 중에 `false` 가 되면 진행 중 요청을 취소한다. `false` 인 동안의 `refresh()` 는
   * 아무 일도 하지 않는다 — 켜지는 순간의 조회가 이미 최신 조건이다.
   */
  enabled?: boolean;
}

/** 소스의 현재 상태 — 바뀔 때마다 새 객체다(같은 객체면 바뀌지 않았다). */
export interface ODataSourceState<T> {
  data: T[];
  totalCount: number;
  /**
   * 조회 중이거나 아직 한 번도 답을 받지 않았으면 `true` — 첫 응답(성공·실패)이 정착할 때까지, 그리고 `enabled: false`
   * 인 동안. 그래서 `!loading && totalCount === 0` 이 곧 «결과 없음» 이다.
   */
  loading: boolean;
  /**
   * 마지막 요청의 실패, 없으면 `null`. 화면에는 `error.message` 를 그린다. «어떤 실패인가» 는 `status`(HTTP) ·
   * `code`(서버의 거절 코드) · `details` 로 가른다 — 401 은 `onUnauthorized` 도 부른다.
   */
  error: SourceError | null;
  /** 0-based. */
  page: number;
  /** 한 페이지의 행 수 — `pageSize` 옵션으로 시작하고(기본 20) `setPageSize` 로 바뀐다. */
  pageSize: number;
  sortCriteria: SortCriteria[];
  search: string;
}

/**
 * 프레임워크 중립 OData 소스 — 상태 · 구독 · 조작. React 는 `useODataSource`, Lit 은 `ODataSourceController` 가 이것을 감싼다.
 *
 * 요청은 **구독자가 있을 때만** 나간다(첫 `subscribe` 가 시작, 마지막 해지가 진행 중 요청을 거둔다). 같은 틱의 조작은
 * 한 요청으로 모인다 — `setSearch` 의 «페이지를 첫 장으로» 나 `update` 의 필터 변경이 낡은 페이지로 요청을 내지 않는다.
 */
export interface ODataSource<T> {
  /** 현재 상태. 바뀌지 않았으면 같은 객체를 돌려준다(`useSyncExternalStore` 의 스냅숏 계약). */
  getState(): ODataSourceState<T>;
  /** 상태가 바뀔 때마다 부른다. 해지 함수를 돌려준다. */
  subscribe(listener: () => void): () => void;
  /** 0-based 페이지로 옮긴다. */
  setPage(page: number): void;
  /** 페이지 크기를 바꾸고 첫 장으로 간다(페이저의 «페이지당 행 수»). */
  setPageSize(size: number): void;
  /** 정렬을 바꾸고 첫 장으로 간다. */
  setSort(criteria: SortCriteria[]): void;
  /** 검색어를 바꾸고 첫 장으로 간다. */
  setSearch(term: string): void;
  /** 같은 조건으로 다시 읽는다. */
  refresh(): void;
  /** 설정을 바꾼다 — 요청 조건이 바뀌면 다시 읽고(`fixedFilter` 값이 바뀌면 첫 장으로), `fetcher`·`onUnauthorized` 는 다음 요청부터. */
  update(url: string, options?: ODataSourceOptions): void;
}

/** OData v4 서버 사이드 데이터 소스를 만든다. flex-table 의 `dataMode="server"` 와 함께 쓴다. */
export function createODataSource<T = Record<string, unknown>>(url: string, options: ODataSourceOptions = {}): ODataSource<T> {
  let currentUrl = url;
  let opts = options;
  let filterKey = keyOf(options.fixedFilter);
  const initial = resolveInitialState({
    defaultOrderBy: options.defaultOrderBy,
    initialPage: options.initialPage ?? 0,
    initialSearch: options.initialSearch ?? '',
    initialSort: options.initialSort,
  });
  // 아직 한 번도 답을 받지 않았으면 «불러오는 중» 이다 — 첫 그림이 «로딩 아님 + 0건» 을 내면 빈 상태 문구가 번쩍인다.
  let inner: Omit<ODataSourceState<T>, 'loading'> & { loading: boolean } = {
    data: [], totalCount: 0, loading: true, error: null,
    page: initial.page, pageSize: options.pageSize ?? 20, sortCriteria: initial.sortCriteria, search: initial.search,
  };
  let snapshot = view();
  const listeners = new Set<() => void>();
  let controller: AbortController | null = null;
  let scheduled = false;
  /** 마지막으로 요청을 낸 조건 — 같으면 다시 내지 않는다(`refresh` 는 이것을 지운다). */
  let lastRequest: string | null = null;

  function enabled() { return opts.enabled ?? true; }
  function pageSize() { return inner.pageSize; }

  /** 꺼져 있는 동안은 «아직 불러오지 않음» 이다 — 빈 목록을 «결과 없음» 으로 보이지 않게 한다. */
  function view(): ODataSourceState<T> {
    return { ...inner, loading: inner.loading || !enabled() };
  }

  function set(patch: Partial<ODataSourceState<T>>) {
    inner = { ...inner, ...patch };
    publish();
  }

  function publish() {
    const next = view();
    const keys = Object.keys(next) as (keyof ODataSourceState<T>)[];
    if (keys.every((k) => next[k] === snapshot[k])) return;
    snapshot = next;
    for (const l of [...listeners]) l();
  }

  function requestKey() {
    return JSON.stringify([currentUrl, opts.baseUrl, pageSize(), opts.defaultOrderBy, filterKey, inner.page, inner.sortCriteria, inner.search]);
  }

  /** 같은 틱의 조작을 한 요청으로 모은다. */
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      run();
    });
  }

  function run() {
    if (listeners.size === 0) return;
    if (!enabled()) {
      controller?.abort();
      controller = null;
      lastRequest = null;
      publish();
      return;
    }
    const key = requestKey();
    if (key === lastRequest) return;
    lastRequest = key;
    load();
  }

  function load() {
    controller?.abort();
    const ctrl = new AbortController();
    controller = ctrl;
    const { page, sortCriteria, search } = inner;
    const size = pageSize();
    const fetcher = opts.fetcher ?? fetch;
    const onUnauthorized = opts.onUnauthorized;
    set({ loading: true, error: null });

    const queryString = buildODataQuery({ page, pageSize: size, sortCriteria, defaultOrderBy: opts.defaultOrderBy, search, fixedFilter: opts.fixedFilter });
    const fullUrl = `${opts.baseUrl ?? window.location.origin}${currentUrl}${queryString}`;

    /*
     * 한 요청 = 한 응답이 아니다 — 서버 주도 페이징(`@odata.nextLink`)이면 서버가 우리가 요청한 `$top` 보다 적게 주고
     * 이어 읽을 URL 을 붙인다. 그 링크를 버리면 `pageSize` 가 서버 페이지 크기보다 큰 표가 **조용히 모자란 행**을
     * 보인다(`totalCount` 는 맞아서 페이저도 멀쩡해 보인다). 그래서 한 표 페이지를 채울 때까지 링크를 따라간다.
     *
     * 🔴오리진 밖 링크·이미 읽은 링크는 따라가지 않고 **오류로** 드러낸다 — 요청에는 세션이 실리고, 조용히 멈추면 잘린
     * 페이지가 온전한 페이지처럼 보인다.
     */
    const fetchPage = async (pageUrl: string) => {
      let res: Response;
      try {
        res = await fetcher(pageUrl, { signal: ctrl.signal });
      } catch (err) {
        // 거둔 요청은 실패가 아니다 — 아래 catch 가 조용히 넘긴다.
        if ((err as Error)?.name === 'AbortError') throw err;
        throw networkFailure(err);
      }
      if (!res.ok) {
        // 401 만 — 403 은 세션이 살아 있는 거절이라 «재인증» 훅의 사건이 아니다. 이어지는 에러 상태가 알린다.
        if (res.status === 401 && onUnauthorized) onUnauthorized(res);
        // 상태·거절 코드·상세를 문자열로 납작하게 만들지 않는다 — 소비자가 «어떤 실패인가» 로 가른다.
        throw new SourceRequestError(await readFailedResponse(res));
      }
      return res.json();
    };

    const read = async () => {
      const first = await fetchPage(fullUrl);
      const rows: T[] = [...(first.value ?? first)];
      const origin = new URL(fullUrl).origin;
      const seen = new Set([fullUrl]);
      let current = fullUrl;
      let next: unknown = first['@odata.nextLink'];
      while (typeof next === 'string' && next && rows.length < size) {
        const resolved = new URL(next, current);
        if (resolved.origin !== origin) {
          throw new Error(`OData nextLink points outside the source origin (${resolved.origin})`);
        }
        current = resolved.toString();
        if (seen.has(current)) throw new Error(`OData nextLink repeats an already-read page (${current})`);
        seen.add(current);
        const more = await fetchPage(current);
        rows.push(...(more.value ?? []));
        next = more['@odata.nextLink'];
      }
      return { count: first['@odata.count'], rows };
    };

    read()
      .then(({ count: rawCount, rows }) => {
        if (ctrl.signal.aborted) return;
        const count = rawCount ?? 0;
        /*
         * 🔴응답이 돌려준 개수가 지금 페이지를 담지 못하면 마지막 유효 페이지로 되돌린다 — 결과 집합은 우리 요청 없이도
         * 준다(다른 사용자가 지웠거나 `refresh` 사이에 서버가 바뀌었거나). 그대로면 «행은 0인데 `totalCount` 는 0이 아닌»
         * 화면에 페이저가 존재하지 않는 페이지를 강조한다. 응답만이 실제 개수를 알므로 여기서 한다(첫 응답 전에
         * `initialPage` 를 지우지 않는다). 페이지를 낮추기만 하므로 루프하지 않는다.
         */
        const lastPage = count === 0 ? 0 : Math.ceil(count / size) - 1;
        if (page > lastPage) {
          set({ data: rows, totalCount: count, error: null, page: lastPage });
          schedule();
        } else {
          set({ data: rows, totalCount: count, error: null });
        }
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        if (err?.name === 'AbortError') return;
        set({ error: toSourceError(err), data: [], totalCount: 0 });
      })
      .finally(() => {
        if (ctrl.signal.aborted) return;
        // 끝난 요청의 컨트롤러도 들고 있는다 — 다음 요청·해지가 그 신호를 끊는다(fetcher 가 신호를 붙잡아 둔 경우 그것을 놓게 한다).
        set({ loading: false });
      });
  }

  return {
    getState: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) schedule();
      return () => {
        if (!listeners.delete(listener) || listeners.size > 0) return;
        // 마지막 구독자가 떠나면 진행 중 요청을 거둔다 — 다시 구독하면 같은 조건으로 다시 읽는다.
        controller?.abort();
        controller = null;
        lastRequest = null;
      };
    },
    setPage(page) {
      set({ page });
      schedule();
    },
    setPageSize(size) {
      if (size === inner.pageSize) return;
      set({ pageSize: size, page: 0 });
      schedule();
    },
    setSort(criteria) {
      set({ sortCriteria: criteria, page: 0 });
      schedule();
    },
    setSearch(term) {
      set({ search: term, page: 0 });
      schedule();
    },
    refresh() {
      if (!enabled()) return;
      lastRequest = null;
      schedule();
    },
    update(nextUrl, nextOptions = {}) {
      const nextKey = keyOf(nextOptions.fixedFilter);
      const filterChanged = nextKey !== filterKey;
      const sizeOptionChanged = nextOptions.pageSize !== undefined && nextOptions.pageSize !== opts.pageSize;
      currentUrl = nextUrl;
      opts = nextOptions;
      filterKey = nextKey;
      /*
       * 🔴필터 값이 바뀌면 첫 장으로 — 5페이지를 보던 중 필터를 좁히면 `$skip` 이 새 결과 집합의 범위를 넘는다.
       * 검색·정렬이 같은 이유로 이미 첫 장으로 돌아간다. 필터와 페이지가 한 번에 바뀌므로 낡은 페이지로 요청하지 않는다.
       */
      if (filterChanged) inner = { ...inner, page: 0 };
      // `pageSize` 옵션 «값이 바뀐» `update` 만 크기를 바꾼다(첫 장으로). 같은 값을 다시 넘기는 것(`useODataSource` 는 렌더마다
      // 넘긴다)이나 생략은 `setPageSize` 로 바꾼 크기를 되돌리지 않는다.
      if (sizeOptionChanged && nextOptions.pageSize !== inner.pageSize) {
        inner = { ...inner, pageSize: nextOptions.pageSize!, page: 0 };
      }
      publish();
      schedule();
    },
  };
}

/**
 * `fixedFilter` 는 호출자가 매번 새 객체 리터럴로 넘기는 경우가 흔하다 — 참조가 아니라 직렬화한 값으로 비교한다.
 */
function keyOf(filter: Record<string, unknown> | undefined): string {
  return filter ? JSON.stringify(filter) : '';
}
