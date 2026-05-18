# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.13.0] - 2026-05-19

### Added
- **셀 표시 형식 (`format`)**: `ColumnDefinition.format`에 형식 문자열(`'#,##0.00'`, `'0.00%'`, `'$#,##0'`, `'yyyy-MM-dd'` 등) 또는 커스텀 함수 지정. 편집/클립보드에는 raw value 유지
- **조건부 서식 (`conditionalRules`)**: `ColumnDefinition.conditionalRules`에 `{ when, style }` 규칙 배열 지정. 조건 true 시 background/color/fontWeight/fontStyle 인라인 스타일 적용. 다중 규칙 병합
- **자동완성 편집기 (`autocomplete`)**: `ColumnDefinition.autocomplete: true | 'strict'`. 텍스트 편집 시 기존 컬럼 값 기반 드롭다운 제안. Arrow Down/Up으로 탐색, Enter로 선택. `'strict'` 모드는 목록 외 값 거부
- **컬럼 숨기기/표시 UI**: 헤더 우클릭 → 내장 컨텍스트 메뉴 (Hide column / Show 숨긴 열). 숨겨진 열 인접 인디케이터 버튼. `hideColumn(key)` / `showColumn(key)` / `getHiddenColumns()` API

### Changed
- `ColumnDefinition`에 `format`, `conditionalRules`, `autocomplete` 필드 추가
- 새 공개 타입: `CellStyle`, `ConditionalRule`
- 새 이벤트: `header-context-menu`, `column-visibility-change`

---

## [0.12.0] - 2026-05-19

### Added
- **비연속 다중 선택 (Ctrl+Click)**: Ctrl+Click으로 떨어진 셀들 추가/제거 토글. 선택된 비연속 셀 Delete 시 일괄 클리어 (단일 undo)
- **컬럼 드래그 이동 UI**: 헤더 셀 드래그로 열 순서 변경. ghost + 드롭 인디케이터 표시. 리사이즈 핸들과 드래그 영역 분리
- **드롭다운 편집기 (`type: 'select'`)**: `options: string[] | { label, value }[]` 로 셀 편집 시 `<select>` 편집기 표시. 미편집 시 label 표시
- **찾기/바꾸기 (Ctrl+F / Ctrl+H)**: 찾기 패널 + 바꾸기 패널 오버레이. 다음/이전 이동, 단건/모두 바꾸기 (모두 바꾸기는 단일 undo). `find-replace` 이벤트
- **행 드래그 정렬**: 행 번호 셀 드래그로 행 순서 변경. ghost + 수평 인디케이터. undo/redo + `row-reorder` 이벤트
- **Fill Handle**: 선택 범위 우하단 8px 핸들 드래그로 값 복제/시리즈 채우기. 숫자 등차수열 자동 감지. undo/redo + `fill-handle-apply` 이벤트
- Ctrl+Z/Y 키가 active cell 없이도 동작하도록 개선 (전역 처리)

### Changed
- `ColumnDefinition`에 `options?: string[] | SelectOption[]` 필드 추가
- `ColumnType`에 `'select'` 추가

---

## [0.11.0] - 2026-05-18

### Added
- Mouse drag range selection: mousedown + mouseenter로 셀 범위 드래그 확장
- Fill Down (Ctrl+D): 선택 범위 첫 행 값을 아래 행에 채우기. 단일 셀 시 위 셀 값 복사
- Fill Right (Ctrl+R): 선택 범위 첫 열 값을 오른쪽 열에 채우기. 단일 셀 시 왼쪽 셀 값 복사
- 모든 Fill 동작은 undo/redo 지원

---

## [0.10.0] - 2026-03-31

### Added
- React wrapper via `@iyulab/flex-table/react` subpath export
- `FlexTableReact` component wraps `<flex-table>` for idiomatic React usage
- All 23 custom events mapped to React callback props (onCellSelect, onSortChange, etc.)
- `react` and `@lit/react` as optional peer dependencies

### Changed
- Vite build now produces multi-entry output (flex-table + react)

## [0.9.0] - 2026-03-31

### Added
- `pinned: 'right'` support for right-side fixed columns during horizontal scroll
- Scroll-only update optimization: `_recomputeView()` skipped during pure scroll events (100K+ row performance)
- `_getPinnedRight()` method for calculating right-pinned column offsets

### Changed
- `willUpdate()` uses `changedProperties` analysis to skip unnecessary filter/sort recomputation
- `ColumnDefinition.pinned` type extended: `'left' | 'right'`
- Pinned column rendering unified for header, body, and footer cells

## [0.8.0] - 2026-03-31

### Added
- ESLint configuration (`@typescript-eslint` + `eslint-plugin-lit`, flat config)
- `lint` and `lint:fix` npm scripts
- 5 API coverage tests (getColumnWidth, activeCell, editingCell, sortCriteria, filterKeys)
- `minWidth` enforcement in cell rendering (not just resize)

### Changed
- `_onKeyDown` refactored: split into `_handleCtrlKey`, `_handleAltKey`, `_handleNavigation`
- `_handlePaste` refactored: split into `_readClipboardText`, `_expandRowsForPaste`, `_applyPasteData`
- `_getColWidth` now enforces `minWidth` floor on all rendered cells

## [0.7.0] - 2026-03-31

### Added
- Date/datetime filter UI with native date range picker (from/to inputs)
- Column selection via `selectColumn(colIndex)` API and Ctrl+Click on header
- `column-select` event with column index, key, and row count detail
- Keyboard column resize with Alt+ArrowLeft/Right (±20px per keystroke)
- Validation visual feedback: red border + `aria-invalid` on cells that fail validator (auto-clears after 3s)
- Filter UI state persistence: text, number, and date filter inputs retain values when dropdown reopens

### Fixed
- Filter dropdown clipped at viewport bottom now flips upward (boundary detection)
- Number filter inputs now reflect `_numberFilterState` via `.value` binding (API↔UI sync)
- Text filter inputs now track state across open/close cycles

## [0.6.3] - 2026-03-31

### Fixed
- Pinned column rendered one row below due to block-level stacking of `position: sticky` elements
- Header pinned/prefix cells not visible on vertical scroll (nested `position: sticky` paint issue in Chrome)
- Whitespace gap between row-number and pinned columns caused by inline-flex layout hack
- Unified all prefix/pinned cell positioning to `position: absolute` with `scrollLeft` compensation across header, body, and footer

### Added
- GitHub Actions CI/CD: npm publish on release, GitHub Pages demo deployment
- `build:demo` script and `vite.config.demo.ts` for standalone demo build
- npm version existence check in publish workflow (idempotent deploys)

### Changed
- `.ft-header` z-index raised from 2 to 3 to ensure header paints above body sticky cells

## [0.6.0] - 2026-02-20

### Added
- Horizontal virtual scrolling: only columns visible in the viewport (+ 5 overscan) are rendered to DOM
- Constant DOM footprint regardless of column count (50, 100, or more columns)
- `data-col-index` attribute on cells for reliable column identification
- Demo: 100-column horizontal virtual scroll test section

### Changed
- Row/cell layout changed from CSS Grid to absolute positioning for selective column rendering
- Auto-fit resize and context menu now use `data-col-index` instead of DOM position
- `_scrollToActiveCell` uses cached column offsets instead of manual recomputation

### Fixed
- Filter predicate error handling wraps predicates in try-catch (fail-open)
- Data mutation reactivity: `hasChanged: () => true` on data property, public `refreshData()` method

## [0.5.0] - 2026-02-19

### Added
- Row selection via checkbox (`selectable` property, `selection-mode` attribute)
- `selectAll()`, `deselectAll()`, `getSelectedRows()` public API
- `selection-change` event with `{ selectedIndices, selectedRows }` detail
- Footer/summary row support (`footer-data` property)
- Data mode: `dataMode` property (`'client'` / `'server'`)
- Context menu event: `context-menu` with position, row data, and column info

## [0.4.0] - 2026-02-19

### Added
- `aria-selected` on all cells (`"true"` / `"false"`) per WAI-ARIA grid pattern
- `aria-readonly="true"` on non-editable cells (global `editable` or per-column `editable`)
- `aria-label` and `aria-expanded` on filter buttons for screen reader support
- Editor focus outline (`outline: 2px solid`) for keyboard navigation visibility
- README: full API documentation rewrite (Properties, Methods, Events, Usage Guide)

### Changed
- Filter button opacity `0.5` → `0.7` for improved visibility (WCAG)

## [0.3.0] - 2026-02-19

### Added
- `addColumn(def, index?)` method — dynamically add columns
- `deleteColumn(key)` method — remove columns with automatic filter/sort cleanup
- `moveColumn(key, newIndex)` method — reorder columns programmatically
- `updateRows(changes)` method — batch update multiple cells as single undo action
- `exportToString(format, { selectionOnly: true })` — export only selected range
- `maxUndoSize` property (`max-undo-size` attribute) — configurable undo stack size
- `showFilters` property (`show-filters` attribute) — built-in header filter dropdown UI
- `ColumnDefinition.pinned` field — freeze columns during horizontal scroll (`'left'`)
- Built-in filter UI: text search, number range (min/max), boolean toggle
- Filter active indicator — highlighted filter icon when filter is applied
- Events: `column-add`, `column-delete`, `column-reorder`, `batch-update`
- Row number column sticky positioning on horizontal scroll
- Demo: add/delete column buttons, pinned columns, built-in filter UI

## [0.2.0] - 2026-02-19

### Added
- `theme` property with `reflect: true` — programmatic theme switching (`table.theme = 'dark'`)
- `editable` property — global read-only mode (`table.editable = false`)
- `ColumnDefinition.editable` field — per-column editing control
- `maxRows` property — cap row additions and paste auto-expansion
- `canUndo` / `canRedo` public getters
- `undo-state-change` event with `{ canUndo, canRedo }` detail
- `cell-edit-start` event with `{ row, col, key, value }` detail
- `clipboard-error` event on clipboard API failure
- `getColumnWidth(key)` method — query internal resize widths
- RFC 4180 compliant clipboard parser (quoted fields, embedded tabs/newlines)
- Horizontal scroll tracking in keyboard navigation
- Column auto-fit on resize handle double-click
- Demo: filter UI, add row, export CSV, undo/redo status display
- `typecheck` and `test:coverage` npm scripts

### Fixed
- `aria-sort` no longer rendered on non-sortable columns (ARIA spec compliance)
- Column resize no longer mutates original `ColumnDefinition` objects
- Date/datetime export uses ISO 8601 for `Date` objects
- Clipboard errors now dispatch events instead of being silently swallowed

### Changed
- `addRow()` returns `DataRow | null` (returns `null` when `maxRows` reached)

## [0.1.0] - 2026-02-19

### Added
- Initial release
- `<flex-table>` Lit 3 web component with CSS Grid layout
- Column types: text, number, boolean, date, datetime
- Custom cell renderer via `ColumnDefinition.renderer` callback
- Virtual scroll (10K+ rows, overscan=5)
- Cell selection and keyboard navigation (Arrow, Tab, Home, End, Ctrl+Home/End)
- Range selection (Shift+Arrow, Shift+Click)
- Row selection via row number click
- Inline editing (Enter/F2, Escape, Tab/Enter commit)
- Type-specific editors (text, number, date, datetime-local, boolean toggle)
- Type-to-start editing (printable character starts edit with that character)
- Clipboard: copy (Ctrl+C), cut (Ctrl+X), paste (Ctrl+V) in TSV format
- Paste auto-expand rows beyond data bounds
- Delete/Backspace clears selected range
- Column sorting (header click asc/desc/none)
- Multi-column sorting (Shift+click)
- Sort indicators (arrow + order number)
- Filter API: `setFilter()`, `removeFilter()`, `clearFilters()`
- Row operations: `addRow()`, `deleteRows()`
- Undo/Redo (Ctrl+Z/Y, max 100 actions)
- Column resize (drag header border)
- Optional row numbers (`show-row-numbers` attribute)
- Dark/Light theme (CSS custom properties, `prefers-color-scheme` auto)
- Export: `exportToString('csv'|'tsv'|'json')`, `exportToFile()`
- ARIA: `role="grid"`, `aria-sort`, `aria-rowcount`, `aria-colcount`
- Events: cell-select, cell-edit-commit, cell-edit-cancel, sort-change, filter-change, row-add, row-delete, column-resize, clipboard-copy, clipboard-cut, clipboard-paste
- 16 CSS custom properties for theming
- README with full API documentation

[unreleased]: https://github.com/iyulab/flex-table/compare/v0.10.0...HEAD
[0.10.0]: https://github.com/iyulab/flex-table/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/iyulab/flex-table/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/iyulab/flex-table/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/iyulab/flex-table/compare/v0.6.3...v0.7.0
[0.6.3]: https://github.com/iyulab/flex-table/compare/v0.6.0...v0.6.3
[0.6.0]: https://github.com/iyulab/flex-table/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/iyulab/flex-table/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/iyulab/flex-table/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/iyulab/flex-table/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/iyulab/flex-table/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/iyulab/flex-table/releases/tag/v0.1.0
