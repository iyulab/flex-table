// 🔴**배럴이 아니라 서브패스다.** `@iyulab/components` 의 배럴을 import 하면 그 패키지의
// 커스텀 엘리먼트 등록이 **전부 부수효과로 딸려 온다**(46개) — 소비자 번들이 그만큼 커지고,
// 이 패키지의 타깃 크기 게이트가 «등록된 태그» 를 도출하는 축에서도 남의 태그 45개를 본다
// (실측: 그 게이트가 이 변경의 첫 판을 정확히 그 이유로 빨갛게 만들었다).
import { Locale } from '@iyulab/components/dist/utilities/Locale.js';

/**
 * `@iyulab/flex-table` 가 스스로 그리는 chrome 문자열의 로케일 묶음.
 *
 * ★**왜 자체 레지스트리를 만들지 않는가**: `@iyulab/components` 가 정확히 이 용도의 primitive 를
 *   갖고 있다(`Locale.namespace<K>()` — 키 유니온을 소비자가 정하므로 그 라이브러리의 키셋은
 *   커지지 않는다). 이 패키지는 그것을 **이미 필수 peer 로 선언**하고 있고(스타일시트가 `--u-*`
 *   토큰을 56곳에서 쓴다), 그러므로 이 패키지를 쓰는 소비자는 그 패키지를 이미 설치한다.
 *   여기서 두 번째 레지스트리를 만드는 것은 새 능력이 아니라 **사본**이다.
 *
 * ⚠**종전 판단이 뒤집힌 자리다.** `odata/use-odata-source.ts` 에 *"한 문자열을 위해
 *   `@iyulab/components` 런타임 의존을 들이는 것은 비용이 이득을 넘는다"* 라고 적혀 있었고,
 *   그 전제는 **「한 문자열」** 이었다. 실측하니 이 패키지의 하드코딩 chrome 문자열은 **31건**
 *   이고 필터·찾기/바꾸기 UI 전체가 거기 있다 — 전제가 참이 아니게 되면 결론도 따라가야 한다.
 *
 * ⚠**기본은 영어이고 내장은 en·ko 둘뿐이다.** 다른 언어는 소비자가 더한다:
 *   ```ts
 *   import { flexTableLocale } from '@iyulab/flex-table';
 *   flexTableLocale.register('ja', { contains: '含む', … });
 *   ```
 *   14개 언어를 여기서 미리 채우지 않는 이유는 `@iyulab/components` 와 이 패키지의 위치가
 *   다르기 때문이다 — 그쪽은 어떤 앱에든 들어가는 기반이고, 이쪽은 아직 실측된 소비 범위가
 *   좁다. 필요해지는 언어는 요청과 함께 온다.
 *
 * ⚠**기호와 연산자는 이 표에 없다** — `AND`/`OR`(필터 결합 연산자), `◀`·`▶`·`✕`·`Aa`·`[ ]`
 *   (아이콘 자리의 글리프)는 어느 로케일에서도 같은 것을 뜻하며, 번역하면 오히려 읽히지 않는다.
 *   그 판단은 «번역하지 않기로 한 것»이지 «빠뜨린 것»이 아니다.
 */
export type FlexTableMessageKey =
  // 열 머리글·메뉴
  | 'showHiddenColumns'
  | 'columnMenu'
  | 'cellActions'
  | 'noColumnsDefined'
  // 셀 메모
  | 'addCommentPlaceholder'
  | 'cancel'
  | 'save'
  // 필터
  | 'clear'
  | 'blankCells'
  | 'emptyOnly'
  | 'nonEmptyOnly'
  | 'blankAll'
  | 'all'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'wildcard'
  | 'searchPlaceholder'
  | 'valuePlaceholder'
  | 'fromPlaceholder'
  | 'toPlaceholder'
  // 찾기·바꾸기
  | 'findPlaceholder'
  | 'findPrevious'
  | 'findNext'
  | 'matchCase'
  | 'wholeCell'
  | 'closeFind'
  | 'replaceWithPlaceholder'
  | 'replace'
  | 'replaceAll'
  // 열 메뉴 항목 — 0.35.0 이 넣고 0.36.0 이관이 빠뜨린 묶음
  | 'sortAscending'
  | 'sortDescending'
  | 'filter'
  | 'clearFilter'
  | 'hideColumn'
  | 'showColumn'
  | 'autoFitWidth'
  | 'wider'
  | 'narrower'
  | 'columnMenuFor'
  | 'columnMenuRegion'
  // 셀 컨텍스트 메뉴
  | 'copy'
  | 'insertRowAbove'
  | 'insertRowBelow'
  | 'deleteRow'
  | 'filterByThisValue'
  | 'addComment'
  | 'editComment'
  | 'deleteComment'
  // 가져오기 오버레이
  | 'dropFileToImport';

/** 이 패키지의 chrome 문자열 묶음. 소비자가 `register()` 로 언어를 더하거나 문구를 덮을 수 있다. */
export const flexTableLocale = Locale.namespace<FlexTableMessageKey>('flex-table');

flexTableLocale.register('en', {
  showHiddenColumns: 'Show hidden column(s)',
  columnMenu: 'Column menu',
  cellActions: 'Cell actions',
  noColumnsDefined: 'No columns defined',

  addCommentPlaceholder: 'Add a comment… (Ctrl+Enter to save)',
  cancel: 'Cancel',
  save: 'Save',

  clear: 'Clear',
  blankCells: 'Blank cells',
  emptyOnly: 'Empty only',
  nonEmptyOnly: 'Non-empty only',
  blankAll: '— All —',
  all: 'All',
  contains: 'Contains',
  startsWith: 'Starts with',
  endsWith: 'Ends with',
  wildcard: 'Wildcard',
  searchPlaceholder: 'Search...',
  valuePlaceholder: 'Value',
  fromPlaceholder: 'From',
  toPlaceholder: 'To',

  findPlaceholder: 'Find...',
  findPrevious: 'Previous (Shift+Enter)',
  findNext: 'Next (Enter)',
  matchCase: 'Match case',
  wholeCell: 'Whole cell',
  closeFind: 'Close (Escape)',
  replaceWithPlaceholder: 'Replace with...',
  replace: 'Replace',
  replaceAll: 'Replace all',

  sortAscending: 'Sort ascending',
  sortDescending: 'Sort descending',
  filter: 'Filter…',
  clearFilter: 'Clear filter',
  hideColumn: 'Hide column',
  showColumn: 'Show: {header}',
  autoFitWidth: 'Auto-fit width',
  wider: 'Wider',
  narrower: 'Narrower',
  columnMenuFor: 'Column menu: {header}',
  columnMenuRegion: '{header} column',

  copy: 'Copy',
  insertRowAbove: 'Insert row above',
  insertRowBelow: 'Insert row below',
  deleteRow: 'Delete row',
  filterByThisValue: 'Filter by this value',
  addComment: 'Add Comment',
  editComment: 'Edit Comment',
  deleteComment: 'Delete Comment',

  dropFileToImport: 'Drop file to import (.xlsx / .csv)',
});

flexTableLocale.register('ko', {
  showHiddenColumns: '숨긴 열 보기',
  columnMenu: '열 메뉴',
  cellActions: '셀 작업',
  noColumnsDefined: '정의된 열이 없습니다',

  addCommentPlaceholder: '메모 입력… (Ctrl+Enter 로 저장)',
  cancel: '취소',
  save: '저장',

  clear: '지우기',
  blankCells: '빈 셀',
  emptyOnly: '빈 값만',
  nonEmptyOnly: '빈 값 제외',
  blankAll: '— 전체 —',
  all: '전체',
  contains: '포함',
  startsWith: '시작 문자',
  endsWith: '끝 문자',
  wildcard: '와일드카드',
  searchPlaceholder: '검색...',
  valuePlaceholder: '값',
  fromPlaceholder: '시작',
  toPlaceholder: '끝',

  findPlaceholder: '찾기...',
  findPrevious: '이전 (Shift+Enter)',
  findNext: '다음 (Enter)',
  matchCase: '대/소문자 구분',
  wholeCell: '셀 전체 일치',
  closeFind: '닫기 (Escape)',
  replaceWithPlaceholder: '바꿀 내용...',
  replace: '바꾸기',
  replaceAll: '모두 바꾸기',

  sortAscending: '오름차순 정렬',
  sortDescending: '내림차순 정렬',
  filter: '필터…',
  clearFilter: '필터 지우기',
  hideColumn: '열 숨기기',
  showColumn: '{header} 보기',
  autoFitWidth: '너비 자동 맞춤',
  wider: '넓게',
  narrower: '좁게',
  columnMenuFor: '{header} 열 메뉴',
  columnMenuRegion: '{header} 열',

  copy: '복사',
  insertRowAbove: '위에 행 삽입',
  insertRowBelow: '아래에 행 삽입',
  deleteRow: '행 삭제',
  filterByThisValue: '이 값으로 필터',
  addComment: '메모 추가',
  editComment: '메모 편집',
  deleteComment: '메모 삭제',

  dropFileToImport: '가져올 파일을 놓으세요 (.xlsx / .csv)',
});

/** 짧은 조회 별칭 — 렌더 코드가 읽히게 유지한다. */
export const t = (
  key: FlexTableMessageKey,
  params?: Record<string, string | number>,
): string => flexTableLocale.text(key, params);
