// src/odata/use-odata-source.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import type { SortCriteria } from '../core/sorting.js';
import type { UseODataSourceOptions, UseODataSourceResult } from './types.js';
import { buildODataQuery, resolveInitialState } from './query.js';
import { networkFailure, readFailedResponse, SourceRequestError, toSourceError, type SourceError } from '../core/source-error.js';

/**
 * OData v4 서버 사이드 데이터소스 React 훅.
 * flex-table의 dataMode="server"와 함께 사용한다.
 */
export function useODataSource<T = Record<string, unknown>>(
  url: string,
  options: UseODataSourceOptions = {}
): UseODataSourceResult<T> {
  const {
    pageSize = 20,
    defaultOrderBy,
    initialPage = 0,
    initialSearch = '',
    initialSort,
    fixedFilter,
    baseUrl,
    fetcher = fetch,
    onUnauthorized,
    enabled = true,
  } = options;

  /*
   * fixedFilter는 호출자가 매 render마다 새 객체 리터럴로 넘기는 경우가 흔하다
   * (e.g. `fixedFilter={ IsActive: true }`). 참조 비교만 하면 useEffect가 매 render마다
   * 재실행되어 무한 fetch loop가 발생. 직렬화 키로 변환해 값 비교를 수행한다.
   */
  const fixedFilterKey = fixedFilter ? JSON.stringify(fixedFilter) : '';

  const [data, setData] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  // 아직 한 번도 답을 받지 않았으면 «불러오는 중» 이다 — 첫 렌더(effect 가 조회를 내기 전)가 «로딩 아님 + 0건» 을
  // 내면 빈 상태 문구가 한 프레임 번쩍인다. 꺼진 채 마운트해도 같은 값이라 `enabled` 와 한 규칙이다.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SourceError | null>(null);
  /*
   * 초기 상태를 «옵션으로» 받는 이유: 이것들이 없으면 「목록 → 상세 → 뒤로가기」에서
   * 위치를 되살리려는 소비자가 마운트 effect + setPage 로 우회할 수밖에 없고, 그 우회는
   * ⑴버려지는 첫 요청과 ⑵`setSearch` 의 `setPage(0)` 부수효과와의 순서 경합을 낳는다.
   * useState 초기값으로 흘리면 그 두 문제가 «표현 불가능» 해진다 — defaultOrderBy 가
   * 이미 정렬 축에서 하고 있던 것과 같은 방식이다.
   */
  const initial = resolveInitialState({ defaultOrderBy, initialPage, initialSearch, initialSort });
  const [page, setPage] = useState(initial.page);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria[]>(initial.sortCriteria);
  const [search, setSearch] = useState(initial.search);
  const [refreshToken, setRefreshToken] = useState(0);

  /**
   * `fixedFilter`가 바뀌면 페이지를 **첫 장으로 되돌린다.**
   *
   * 🔴**없으면 빈 목록이 나온다**: 5페이지를 보던 중 필터를 좁히면 `$skip`(= `page *
   * pageSize`)이 그대로 유지돼, 새 결과 집합의 범위를 넘어선 구간을 요청하게 된다.
   * `setSearch`(`handleSetSearch` → `setPage(0)`)와 `onSortChange`가 이미 같은 이유로
   * 페이지를 되돌리고 있었는데, **결과 집합의 크기를 바꾸는 세 번째 축인 `fixedFilter`만**
   * **빠져 있었다.**
   *
   * ⚠**effect 가 아니라 «렌더 중 조정»이다** — React 공식 권장 패턴이고
   * (`you-might-not-need-an-effect` → *"Adjusting some state when a prop changes"*),
   * 여기서는 그 차이가 성능이 아니라 **정확성**이다: effect 로 `setPage(0)`을 하면
   * React 가 DOM 을 커밋하고 effect 를 돌린 «뒤에» 페이지가 바뀌므로, 그 사이에 아래
   * fetch effect 가 **낡은 page + 새 filter** 조합으로 요청을 한 번 내보낸다. 렌더 중
   * 조정하면 React 는 `return` 직후 **즉시 다시 렌더**하고 자식 렌더·DOM 커밋·effect 를
   * 아직 하지 않았으므로 그 요청 자체가 없다. (버려지는 첫 요청은 `initial*` 옵션이
   * 막으려던 것과 같은 종류의 낭비다 — 그것을 여기서 새로 만들지 않는다.)
   *
   * ⚠**마운트 시에는 발화하지 않는다** — 이전 키의 초기값이 «현재 키»라서다. 그래서
   * `initialPage`가 이 조정에 지워지지 않는다.
   */
  const [prevFixedFilterKey, setPrevFixedFilterKey] = useState(fixedFilterKey);
  if (fixedFilterKey !== prevFixedFilterKey) {
    setPrevFixedFilterKey(fixedFilterKey);
    setPage(0);
  }

  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    setRefreshToken(t => t + 1);
  }, []);

  const handleSetSearch = useCallback((term: string) => {
    setSearch(term);
    setPage(0);
  }, []);

  const onSortChange = useCallback((e: CustomEvent) => {
    const criteria = e.detail?.criteria as SortCriteria[] | undefined;
    if (criteria) {
      setSortCriteria(criteria);
      setPage(0);
    }
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    // 꺼져 있으면 요청하지 않는다 — 위 abort 가 켜져 있던 동안의 진행 중 요청도 거둔다.
    if (!enabled) return;
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const queryString = buildODataQuery({ page, pageSize, sortCriteria, defaultOrderBy, search, fixedFilter });
    const fullUrl = `${baseUrl ?? window.location.origin}${url}${queryString}`;

    /*
     * 한 요청 = 한 응답이 아니다 — 서버 주도 페이징(`@odata.nextLink`)이면 서버가 우리가 요청한
     * `$top` 보다 적게 주고 이어 읽을 URL 을 붙인다. 그 링크를 버리면 `pageSize` 가 서버 페이지
     * 크기보다 큰 표가 **조용히 모자란 행**을 보인다(`totalCount` 는 맞아서 페이저도 멀쩡해 보인다).
     * 그래서 한 표 페이지를 채울 때까지 링크를 따라간다 — 링크는 `$top`·`$skip` 의 남은 범위를
     * 이미 담고 있으므로 우리가 자를 필요가 없다.
     *
     * 🔴오리진 밖 링크·이미 읽은 링크는 따라가지 않고 **오류로** 드러낸다 — 요청에는 세션이 실리고,
     * 조용히 멈추면 잘린 페이지가 온전한 페이지처럼 보인다.
     */
    const fetchPage = async (pageUrl: string) => {
      let res: Response;
      try {
        res = await fetcher(pageUrl, { signal: controller.signal });
      } catch (err) {
        // 거둔 요청은 실패가 아니다 — 아래 catch 가 조용히 넘긴다.
        if ((err as Error)?.name === 'AbortError') throw err;
        throw networkFailure(err);
      }
      if (!res.ok) {
        // 401 만 — 403 은 세션이 살아 있는 거절이라 «재인증» 훅의 사건이 아니다. 이어지는 에러 상태가 알린다.
        if (res.status === 401 && onUnauthorized) {
          onUnauthorized(res);
        }
        // 상태·거절 코드·상세를 문자열로 납작하게 만들지 않는다 — 소비자가 «어떤 실패인가» 로 가른다.
        throw new SourceRequestError(await readFailedResponse(res));
      }
      return res.json();
    };

    const load = async () => {
      const first = await fetchPage(fullUrl);
      const rows: T[] = [...(first.value ?? first)];
      const origin = new URL(fullUrl).origin;
      const seen = new Set([fullUrl]);
      let current = fullUrl;
      let next: unknown = first['@odata.nextLink'];
      while (typeof next === 'string' && next && rows.length < pageSize) {
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

    load()
      .then(({ count: rawCount, rows }) => {
        if (controller.signal.aborted) return;
        const count = rawCount ?? 0;
        setData(rows);
        setTotalCount(count);
        setError(null);

        /*
         * 🔴**응답이 돌려준 개수가 지금 페이지를 담지 못하면 마지막 유효 페이지로 되돌린다.**
         * 결과 집합은 우리 요청 없이도 줄 수 있다(다른 사용자가 지웠거나, `refresh` 사이에
         * 서버 상태가 바뀌었거나). 그때 `$skip` 이 그대로면 **행은 0인데 `totalCount` 는
         * 0이 아닌** 화면이 나오고, 페이저는 **존재하지 않는 페이지를 강조**한다.
         *
         * ⚠**렌더 중 조정이 아니라 여기서 한다** — 렌더 중에 하면 `totalCount` 초기값이
         * 0이라 **첫 응답이 오기 전에** `initialPage` 를 0으로 지워 버린다. 응답 핸들러는
         * 실제 개수를 아는 유일한 자리다.
         *
         * ⚠**루프하지 않는다** — 조정은 페이지를 항상 낮추기만 하고(`page > lastPage` 일
         * 때만), 다음 응답의 개수가 같으면 조건이 거짓이 되어 멈춘다. 대가는 이 드문
         * 경우에 **요청 한 번**이 더 나가는 것뿐이다.
         */
        const lastPage = count === 0 ? 0 : Math.ceil(count / pageSize) - 1;
        if (page > lastPage) setPage(lastPage);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err.name === 'AbortError') return;
        setError(toSourceError(err));
        setData([]);
        setTotalCount(0);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  // deps는 의도적으로 부분집합이다: fixedFilter 객체 대신 직렬화 키(fixedFilterKey)로 값을 비교하고,
  // fetcher/onUnauthorized는 매 render 재생성될 수 있는 함수라 제외한다 —
  // 호출자가 useCallback 등으로 안정된 참조를 넘길 것을 전제로 한다(url과 동일한 계약).
  }, [enabled, url, page, pageSize, sortCriteria, search, fixedFilterKey, defaultOrderBy, refreshToken, baseUrl]);

  return {
    data, totalCount,
    // 꺼져 있는 동안은 «아직 불러오지 않음» 이다 — 빈 목록을 «결과 없음» 으로 보이지 않게 한다.
    loading: loading || !enabled,
    error,
    page, setPage,
    sortCriteria, onSortChange,
    search, setSearch: handleSetSearch,
    refresh,
  };
}
