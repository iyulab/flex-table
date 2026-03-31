# Roadmap

> Last updated: 2026-03-31
> Current version: **v0.10.0** (179 tests, 74.6 KB / 16.6 KB gzip + 1.1 KB react wrapper)

flex-table 개발 로드맵. 완료된 기능과 향후 계획을 추적한다.

---

## Completed Releases

<details>
<summary><strong>v0.1.0 — Foundation</strong> (102 tests, 39.77 KB)</summary>

CSS Grid 렌더링, 가상 스크롤(10K+), 셀 편집, 클립보드(TSV), 다중 정렬,
필터 API, Undo/Redo, 컬럼 리사이즈, 테마(Dark/Light), Export(CSV/TSV/JSON), ARIA 기본.
→ [CHANGELOG v0.1.0](CHANGELOG.md#010---2026-02-19)

</details>

<details>
<summary><strong>v0.2.0 — Stability & Editing UX</strong> (122 tests, 44.51 KB)</summary>

버그 4건 수정, `editable` 속성, undo API(`canUndo`/`canRedo`), `cell-edit-start` 이벤트,
커스텀 에디터(`editor` 콜백), RFC 4180 클립보드 파서, 수평 스크롤 추적, 컬럼 auto-fit.
→ [CHANGELOG v0.2.0](CHANGELOG.md#020---2026-02-19)

</details>

<details>
<summary><strong>v0.3.0 — Column Operations & Filter UI</strong> (157 tests, 56.38 KB)</summary>

컬럼 CRUD(`addColumn`/`deleteColumn`/`moveColumn`), 핀 컬럼(`pinned: 'left'`),
내장 필터 UI(text/number/boolean), batch update(`updateRows`),
선택 범위 내보내기(`selectionOnly`), undo 스택 크기 설정(`maxUndoSize`).
→ [CHANGELOG v0.3.0](CHANGELOG.md#030---2026-02-19)

</details>

<details>
<summary><strong>v0.4.0 — Documentation & Accessibility</strong> (162 tests, 56.76 KB)</summary>

README 전면 재작성(Properties/Methods/Events/Usage Guide), `aria-selected`,
`aria-readonly`, filter button `aria-label`/`aria-expanded`, editor focus outline.
→ [CHANGELOG v0.4.0](CHANGELOG.md#040---2026-02-19)

</details>

<details>
<summary><strong>v0.5.0 — Row Selection & Context</strong> (162 tests, 56.80 KB)</summary>

행 선택 체크박스(`selectable`, `selection-mode`), `selectAll()`/`deselectAll()`/`getSelectedRows()` API,
Footer/summary row(`footer-data`), 데이터 모드(`dataMode`), 컨텍스트 메뉴 이벤트.
→ [CHANGELOG v0.5.0](CHANGELOG.md#050---2026-02-19)

</details>

<details>
<summary><strong>v0.6.0–0.6.3 — Horizontal Virtual Scroll & Pinned Column Fix</strong> (165 tests, 68.7 KB)</summary>

**v0.6.0**: 수평 가상 스크롤(viewport + overscan 5만 DOM 렌더), absolute positioning 기반 셀 레이아웃,
필터 predicate try-catch, `refreshData()` 메서드.

**v0.6.1–0.6.3**: Pinned column 렌더링 버그 3건 수정 — block-level 스택킹 → nested sticky paint 실패 →
inline whitespace gap. 최종 해결: 모든 prefix/pinned 셀을 `position: absolute + scrollLeft 보상` 방식으로 통일.

**인프라**: GitHub Actions CI/CD (npm publish on release, GitHub Pages demo 자동 배포).
→ [CHANGELOG v0.6.0](CHANGELOG.md#060---2026-02-20)

</details>

---

## Known Defects & Limitations

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| BUG-01 | **Medium** | 직접 `data[i].x = y` 변경 시 UI 미갱신 | `refreshData()` 또는 `updateRows()` 사용 (문서화) |
| BUG-02 | **Low** | `deleteColumn` 시 data 객체의 해당 키 값 유지됨 | 소비자 책임 (문서화) |
| ~~LIM-02~~ | ~~Low~~ | ~~필터 predicate 예외 시 그리드 중단~~ | **v0.6.0에서 해결** (try-catch) |
| LIM-03 | **Low** | clipboard paste는 TSV만 지원 (CSV 미보장) | Excel/Sheets 기본 TSV |
| ~~LIM-04~~ | ~~Low~~ | ~~date/datetime 필터 UI 미구현 (text 폴백)~~ | **v0.7.0에서 해결** |
| ~~LIM-05~~ | ~~Low~~ | ~~필터 드롭다운이 테이블 경계 밖 렌더링 가능~~ | **v0.7.0에서 해결** |

---

## Phase 7: Filter Polish & UX — v0.7.0 ✅ COMPLETE

> **완료**: 필터 시스템 완성, 입력 UX 개선, 소비자 편의 기능.

| ID | Task | Status | Description |
|----|------|--------|-------------|
| F-01 | Date/datetime 필터 UI | ✅ | date range 입력 구현 (LIM-04 해결) |
| F-02 | 필터 드롭다운 위치 보정 | ✅ | viewport boundary detection으로 flip (LIM-05 해결) |
| F-03 | Number 필터 양방향 동기화 | ✅ | .value 바인딩으로 API↔UI 상태 동기화 |
| N-01 | 컬럼 선택 | ✅ | Ctrl+Click 헤더 + `selectColumn()` API |
| F-04 | 키보드 컬럼 리사이즈 | ✅ | Alt+Arrow ±20px |
| V-01 | 유효성 시각 피드백 | ✅ | validator 실패 시 빨간 테두리 + aria-invalid (3초 후 자동 해제) |

---

## Phase 8: Code Quality & Refactoring — v0.8.0 ✅ COMPLETE

> **완료**: 코드 품질 자동화, 대형 메서드 분리, API 테스트 보강.

| ID | Task | Status | Description |
|----|------|--------|-------------|
| T-01 | ESLint 설정 | ✅ | `@typescript-eslint` + `eslint-plugin-lit` flat config |
| R-01 | `_onKeyDown` 분리 | ✅ | → `_handleCtrlKey`, `_handleAltKey`, `_handleNavigation` |
| R-02 | `_handlePaste` 분리 | ✅ | → `_readClipboardText`, `_expandRowsForPaste`, `_applyPasteData` |
| R-03 | 테스트 구조 평가 | ✅ | 주석 기반 분리가 충분, 향후 describe 도입 가능 |
| R-04 | 누락 API 테스트 | ✅ | getColumnWidth, activeCell, editingCell, sortCriteria, filterKeys |
| R-06 | `minWidth` 처리 | ✅ | `_getColWidth`에서 minWidth 하한 보장 |

---

## Phase 9: Performance & Advanced — v0.9.0 ✅ COMPLETE

> **완료**: 대규모 데이터 최적화, 우측 고정 컬럼.

| ID | Task | Status | Description |
|----|------|--------|-------------|
| P-01 | 100K+ row 최적화 | ✅ | scroll-only update skip, `_viewDirty` flag |
| P-03 | `pinned: 'right'` | ✅ | 우측 고정 컬럼 (header, body, footer) |
| D-07 | 행 드래그 정렬 | 🔮 | 향후 고려 |
| E-06 | 붙여넣기 미리보기 | 🔮 | 향후 고려 |
| A-06 | 고대비 테마 | 🔮 | 향후 고려 |
| A-07 | `aria-live` | 🔮 | 향후 고려 |

---

## Phase 10: Ecosystem & Production — v0.10.0 ✅ COMPLETE

> **완료**: React wrapper, MorphDB Studio 전환 준비 완료.

| ID | Task | Status | Description |
|----|------|--------|-------------|
| E-01 | React Wrapper | ✅ | `@lit/react` 기반, `@iyulab/flex-table/react` subpath export |
| E-03 | Vue Wrapper | 🔮 | Vue 3 래퍼 (수요에 따라) |
| A-08 | 스크린 리더 지원 강화 | 🔮 | 셀 탐색 시 맥락 안내 강화 |

---

## Priority Matrix

```
              HIGH IMPACT                      LOW IMPACT
         ┌─────────────────────────────────────────────────┐
         │                                                 │
 HIGH    │  F-01 date 필터          R-06 minWidth 처리     │
 URGENCY │  T-01 ESLint             R-04 누락 API 테스트   │
         │                                                 │
         ├─────────────────────────────────────────────────┤
         │                                                 │
 NORMAL  │  F-02 드롭다운 위치 보정 F-04 키보드 리사이즈   │
 URGENCY │  P-01 100K+ 최적화      V-01 유효성 피드백      │
         │  R-01 _onKeyDown 분리   N-01 컬럼 선택          │
         │  E-01 React wrapper     D-07 행 드래그 정렬      │
         │  P-03 pinned right      E-06 붙여넣기 미리보기   │
         │                         A-06 고대비 테마         │
         │                         A-07 aria-live           │
         │                                                 │
         └─────────────────────────────────────────────────┘
```

---

## Metrics Tracker

| Version | Tests | Bundle | gzip | Key Milestone |
|---------|-------|--------|------|---------------|
| **v0.1.0** ✅ | 102 | 39.77 KB | 9.73 KB | 핵심 기능 (렌더링, 편집, 클립보드, 정렬, 필터 API, Export) |
| **v0.2.0** ✅ | 122 | 44.51 KB | 10.77 KB | 안정성 + 편집 UX (editable, undo API, RFC 4180) |
| **v0.3.0** ✅ | 157 | 56.38 KB | 12.99 KB | 컬럼 CRUD, 필터 UI, 핀 컬럼, batch update |
| **v0.4.0** ✅ | 162 | 56.80 KB | 13.09 KB | 문서 완성 + 접근성 (aria-selected, aria-readonly) |
| **v0.5.0** ✅ | 162 | 56.80 KB | 13.09 KB | 행 선택, footer, 컨텍스트 메뉴, 데이터 모드 |
| **v0.6.3** ✅ | 165 | 68.72 KB | 15.42 KB | 수평 가상 스크롤, pinned column 수정, CI/CD |
| **v0.7.0** ✅ | 172 | 73.21 KB | 16.30 KB | 필터 완성 (date/datetime), 컬럼 선택, 키보드 리사이즈, 유효성 피드백 |
| **v0.8.0** ✅ | 177 | 73.38 KB | 16.37 KB | ESLint, _onKeyDown/_handlePaste 분리, minWidth, API 테스트 |
| **v0.9.0** ✅ | 179 | 74.67 KB | 16.62 KB | 100K+ 스크롤 최적화, pinned right 컬럼 |
| **v0.10.0** ✅ | 179 | 74.62 KB | 16.60 KB | React wrapper (`@iyulab/flex-table/react`) |

---

## Notes

- 각 Phase 완료 시 demo 페이지에 해당 기능 데모 추가
- 모든 공개 API는 CustomEvent 기반 — 프레임워크 무관 연동 보장
- 성능 기준: 10,000행 × 20컬럼에서 60fps 스크롤 유지
- 메이저 버전(1.0.0)은 Phase 10 완료 + 커뮤니티 검증 후 수동 결정
- GitHub Pages demo: https://iyulab.github.io/flex-table/
- npm: `npm install @iyulab/flex-table` (GitHub Release 생성 시 자동 배포)
