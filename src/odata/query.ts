// src/odata/query.ts
// React·odata-query 없이 쓰는 순수 함수 — `./odata` 엔트리가 싣는 전부다(훅은 `./react`).
import buildQuery from 'odata-query';
import type { SortCriteria } from '../core/sorting.js';

/**
 * 검색어를 OData `$search` 표현식으로 인코딩한다 (`red shirt` → `"red" AND "shirt"`).
 *
 * 토큰을 인용하는 이유: OData 4.0의 `searchWord`는 문자(Unicode L/Nl)만 허용해
 * `2026`·`ZT-E2E-A` 같은 검색어가 거부된다. 4.01이 숫자·하이픈을 허용하도록 완화했으나
 * Microsoft.OData 렉서는 아직 4.0 규칙이다(odata.net#2445). `searchPhrase`는 두 버전
 * 모두에서 적법하므로 서버 버전과 무관하게 안전하다.
 *
 * 통째로가 아니라 토큰별로 감싸는 이유: 인용 없는 다중 단어는 암묵 AND로 파싱되므로
 * (`searchAndExpr = RWS [ 'AND' RWS ] searchExpr`), 전체를 한 phrase로 감싸면 연속
 * 문자열 매칭으로 의미가 바뀐다. 토큰별 인용은 기존 의미론을 그대로 보존한다.
 *
 * `"`는 phrase 안에 넣을 수 없고 이스케이프 규칙도 없어(`qchar-no-AMP-DQUOTE`) 제거한다.
 *
 * @returns `$search` 표현식, 또는 유효 토큰이 없으면 `undefined`
 */
export function buildSearchExpression(term: string): string | undefined {
  const tokens = term
    .split(/\s+/)
    .map(token => token.replace(/"/g, ''))
    .filter(token => token.length > 0);
  if (tokens.length === 0) return undefined;
  return tokens.map(token => `"${token}"`).join(' AND ');
}

/** `resolveInitialState`가 읽는 옵션 — 두 소스 훅의 옵션 타입이 공통으로 갖는 부분. */
export interface InitialSourceStateOptions {
  defaultOrderBy?: string;
  initialPage?: number;
  initialSearch?: string;
  initialSort?: SortCriteria[];
}

/**
 * 옵션에서 `page`/`search`/`sortCriteria`의 **초기값**을 뽑는다.
 *
 * ★**두 훅이 이 함수 하나를 공유하는 것이 요점이다.** README가 *"same shape … so the same
 * binding code works with either source"*를 계약으로 선언하는데, 초기값 해석을 양쪽에
 * 복제하면 그 계약이 **문장으로만** 유지된다 — 이 리포가 반복 기록한 실패 형태다.
 * 구현이 하나면 드리프트가 없다.
 *
 * ⚠**`initialSort`가 `defaultOrderBy`를 이긴다.** 둘은 같은 것을 서로 다른 표기로
 * 말하고(`SortCriteria[]` ↔ `$orderby` 문자열), 더 구체적인 쪽을 우선한다.
 * `initialSort`는 `onSortChange`가 주는 모양 그대로라 저장해 둔 정렬을 파싱 없이 되돌린다.
 *
 * ⚠**React가 useState 초기값을 첫 렌더에서만 읽는다는 사실이 계약의 일부다** — 이후의
 * 옵션 변경은 무시되고, 이동은 `setPage`/`setSearch`로 한다. `defaultOrderBy`가 이미
 * 그렇게 동작해 왔으므로 새 규칙이 아니다.
 */
export function resolveInitialState(options: InitialSourceStateOptions): {
  page: number;
  search: string;
  sortCriteria: SortCriteria[];
} {
  const { defaultOrderBy, initialPage = 0, initialSearch = '', initialSort } = options;
  return {
    page: initialPage,
    search: initialSearch,
    sortCriteria: initialSort ?? (defaultOrderBy ? parseOrderBy(defaultOrderBy) : []),
  };
}

/**
 * `$orderby` 문자열을 정렬 기준 배열로 파싱한다 (`'a asc, b desc'`).
 * 방향이 생략되거나 `desc`가 아니면 `asc`로 본다(OData 기본값).
 */
export function parseOrderBy(orderBy: string): SortCriteria[] {
  return orderBy.split(',').map(s => {
    const parts = s.trim().split(/\s+/);
    return {
      // `A/B` (a navigation path) is the column key `A.B` — the table's sort indicator matches the column.
      key: parts[0].replace(/\//g, '.'),
      direction: (parts[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc') as SortCriteria['direction'],
    };
  });
}

/** `buildODataQuery` 가 읽는 표 상태 — `useODataSource` 가 요청마다 넘기는 것과 같은 모양. */
export interface ODataQueryState {
  /** 0부터 세는 페이지 번호. `pageSize` 와 함께 `$skip` 이 된다. */
  page?: number;
  /**
   * 한 페이지의 행 수(`$top`). **생략하면 `$top`·`$skip` 없이** 조회 결과 전체를 묻는다 — 서버가 응답을 나누면
   * (`@odata.nextLink`) 끝까지 따라가는 것은 부르는 쪽 몫이다(`ODataSource.fetchAll`).
   */
  pageSize?: number;
  sortCriteria?: SortCriteria[];
  /** 정렬 기준이 비었을 때 쓰는 `$orderby` 문자열. */
  defaultOrderBy?: string;
  /** 사용자가 친 검색어(리터럴) — `buildSearchExpression` 으로 인코딩된다. */
  search?: string;
  /** odata-query 의 필터 객체(`{ IsActive: true }` 등). */
  fixedFilter?: Record<string, unknown>;
  /** `$expand` — 문자열(`'Customer($select=Name)'`) 또는 배열(쉼표로 잇는다). */
  expand?: string | string[];
  /** `$select` — 받을 속성 이름. */
  select?: string[];
}

/** 열 키(점 경로 `Customer.Name`)를 `$orderby` 의 속성 경로(`Customer/Name`)로. */
export function orderByPath(key: string): string {
  return key.replace(/\./g, '/');
}

/**
 * 표 상태를 OData 쿼리 문자열(`?$top=…&$skip=…&$count=true…`)로 만든다.
 *
 * `useODataSource` 가 요청마다 하는 일 그대로다 — 훅 밖으로 꺼낸 이유는 `buildSearchExpression` 과
 * 같다: React 없이 서버 페이징을 하는 소비자(Lit 앱의 표, 표가 아닌 목록)가 같은 쿼리를
 * 재구현하지 않게. 정렬 기준이 있으면 그것이, 없으면 `defaultOrderBy` 가 `$orderby` 가 된다.
 */
export function buildODataQuery(state: ODataQueryState): string {
  const { page = 0, pageSize, sortCriteria = [], defaultOrderBy, search, fixedFilter, expand, select } = state;
  const orderBy = sortCriteria.length > 0
    ? sortCriteria.map(s => `${orderByPath(s.key)} ${s.direction}`).join(', ')
    : defaultOrderBy;

  const queryParams: Record<string, unknown> = pageSize === undefined
    ? { count: true }
    : { top: pageSize, skip: page * pageSize, count: true };
  if (orderBy) queryParams.orderBy = orderBy;
  if (fixedFilter) queryParams.filter = fixedFilter;
  if (expand && expand.length > 0) queryParams.expand = expand;
  if (select && select.length > 0) queryParams.select = select;
  if (search) {
    const searchExpression = buildSearchExpression(search);
    if (searchExpression) queryParams.search = searchExpression;
  }
  return buildQuery(queryParams);
}
