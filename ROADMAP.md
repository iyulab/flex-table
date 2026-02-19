# Roadmap

> Last updated: 2026-02-19
> Current version: **v0.4.0** (162 tests, 56.80 KB / 13.09 KB gzip)

flex-table 개발 로드맵. 완료된 기능과 향후 계획을 추적한다.

---

## Completed Releases

<details>
<summary><strong>v0.1.0 — Foundation</strong> (20 cycles, 102 tests, 39.77 KB)</summary>

CSS Grid 렌더링, 가상 스크롤(10K+), 셀 편집, 클립보드(TSV), 다중 정렬,
필터 API, Undo/Redo, 컬럼 리사이즈, 테마(Dark/Light), Export(CSV/TSV/JSON), ARIA 기본.
→ [CHANGELOG v0.1.0](CHANGELOG.md#010---2026-02-19)

</details>

<details>
<summary><strong>v0.2.0 — Stability & Editing UX</strong> (10 cycles, 122 tests, 44.51 KB)</summary>

버그 4건 수정, `editable` 속성, undo API(`canUndo`/`canRedo`), `cell-edit-start` 이벤트,
커스텀 에디터(`editor` 콜백), RFC 4180 클립보드 파서, 수평 스크롤 추적, 컬럼 auto-fit.
→ [CHANGELOG v0.2.0](CHANGELOG.md#020---2026-02-19)

</details>

<details>
<summary><strong>v0.3.0 — Column Operations & Filter UI</strong> (10 cycles, 157 tests, 56.38 KB)</summary>

컬럼 CRUD(`addColumn`/`deleteColumn`/`moveColumn`), 핀 컬럼(`pinned: 'left'`),
내장 필터 UI(text/number/boolean), batch update(`updateRows`),
선택 범위 내보내기(`selectionOnly`), undo 스택 크기 설정(`maxUndoSize`).
→ [CHANGELOG v0.3.0](CHANGELOG.md#030---2026-02-19)

</details>

<details>
<summary><strong>v0.4.0 — Documentation & Accessibility</strong> (10 cycles, 162 tests, 56.76 KB)</summary>

README 전면 재작성(Properties/Methods/Events/Usage Guide), `aria-selected`,
`aria-readonly`, filter button `aria-label`/`aria-expanded`, editor focus outline.
→ [CHANGELOG v0.4.0](CHANGELOG.md#040---2026-02-19)

</details>

---

## Known Defects & Limitations

코드 감사에서 식별된 결함과 한계. 각 항목은 해당 Phase에서 해결한다.

| ID | Severity | Description | Phase | Workaround |
|----|----------|-------------|-------|------------|
| BUG-01 | **Medium** | 직접 `data[i].x = y` 변경 시 UI 미갱신 (Lit 반응형 미추적) | Documented | `requestUpdate()` 또는 `updateRows()` — README에 명시 |
| BUG-02 | **Low** | `deleteColumn` 시 data 객체의 해당 키 값은 유지됨 | — | 데이터 정리는 소비자 책임 |
| LIM-01 | **Medium** | jsdom에서 sticky/scroll 동작 검증 불가 | v0.5.0 | Playwright E2E로 해결 |
| LIM-02 | **Low** | 필터 predicate 예외 시 그리드 중단 | v0.6.0 | predicate 내 try/catch |
| LIM-03 | **Low** | clipboard paste는 TSV만 지원 (CSV 미보장) | — | Excel/Sheets 기본 TSV 사용 |
| LIM-04 | **Low** | date/datetime 필터 UI 미구현 (text 폴백) | v0.6.0 | 외부 필터 API 사용 |
| LIM-05 | **Low** | 필터 드롭다운이 테이블 경계 밖 렌더링 가능 | v0.6.0 | — |

---

## Phase 5: Code Quality & Infrastructure — v0.5.0

> **목표**: 코드 품질 자동화, 테스트 인프라 강화, 리팩토링.
> **근거**: ESLint/CI 미설정. `_onKeyDown` 125줄, `_handlePaste` 85줄. 테스트 77개가 단일 describe 블록.

### 5.1 Tooling & CI

| ID | Task | Priority | Description |
|----|------|----------|-------------|
| T-01 | ESLint 설정 | **High** | `@typescript-eslint` + `eslint-plugin-lit` |
| T-02 | CI/CD | **High** | GitHub Actions — test, typecheck, build (PR 자동 검증) |
| T-03 | Playwright E2E 기초 | **Medium** | sticky column, scroll, resize 브라우저 통합 테스트 (LIM-01 해결) |

### 5.2 Refactoring

| ID | Task | Priority | Description |
|----|------|----------|-------------|
| R-01 | `_onKeyDown` 분리 | **Medium** | 125줄 → navigation / editing / clipboard 핸들러 추출 |
| R-02 | `_handlePaste` 분리 | **Medium** | 85줄 → 검증 / 변환 / 적용 단계 추출 |
| R-03 | 테스트 스위트 구조화 | **Medium** | 77개 통합 테스트를 `describe` 블록별 분리 (API, events, keyboard, editing) |
| R-04 | 누락 API 테스트 추가 | **Medium** | `exportToFile`, `getColumnWidth`, property getters (`activeCell` 등) |
| R-05 | JSDoc 보완 | **Low** | `activeCell`, `editingCell`, `sortCriteria`, `filterKeys` getter 문서화 |
| R-06 | `minWidth` 처리 | **Low** | 렌더링에서 `min-width` 적용하거나 types에서 제거 |

---

## Phase 6: Filter & UX Polish — v0.6.0

> **목표**: 필터 시스템 완성, 입력 경험 개선.
> **근거**: date/datetime 필터 미구현, 드롭다운 오버플로, 키보드 리사이즈 미지원.

| ID | Task | Priority | Description |
|----|------|----------|-------------|
| F-01 | Date/datetime 필터 UI | **High** | date range 입력 구현 (현재 text 폴백, LIM-04 해결) |
| F-02 | 필터 드롭다운 위치 보정 | **Medium** | boundary detection으로 오버플로 방지 (LIM-05 해결) |
| F-03 | Number 필터 양방향 동기화 | **Medium** | `setFilter()` API 호출 시 UI 상태 반영, 역방향 연동 |
| F-04 | 키보드 컬럼 리사이즈 | **Medium** | 포커스 컬럼에서 단축키로 너비 조정 |
| F-05 | 필터 predicate 오류 방어 | **Low** | 사용자 predicate 예외 시 graceful 처리 (LIM-02 해결) |
| N-03 | 컬럼 선택 | **Low** | 헤더 클릭으로 전체 컬럼 선택 |
| V-01 | 유효성 시각 피드백 | **Low** | 잘못된 입력 시 셀 테두리 빨간색 표시 |

---

## Phase 7: Performance & Advanced Features — v0.7.0

> **목표**: 대규모 데이터 최적화, 고급 기능.
> **근거**: MorphDB 연동 시 100K+ 행, 50+ 컬럼 시나리오 대비 필요.

| ID | Task | Priority | Description |
|----|------|----------|-------------|
| P-01 | 100K+ row 최적화 | **High** | `willUpdate()` dirty flag 패턴으로 `_recomputeView()` 호출 최소화 |
| P-02 | Column virtualization | **Medium** | 50+ 컬럼에서 가로 가상화 |
| P-03 | `pinned: 'right'` | **Low** | 우측 고정 컬럼 지원 |
| D-07 | 행 드래그 정렬 | **Low** | 드래그 앤 드롭으로 행 순서 변경 |
| E-06 | 붙여넣기 미리보기 | **Low** | 대량 붙여넣기 전 확인 다이얼로그 |
| A-06 | 고대비 테마 | **Low** | `@media (prefers-contrast: more)` 대응 |
| A-07 | `aria-live` | **Low** | 동적 변경(필터, 정렬) 알림 (`aria-live="polite"`) |

---

## Phase 8: Ecosystem & Production — v0.8.0

> **목표**: 프로덕션 배포 인프라, 프레임워크 에코시스템 확장.

| ID | Task | Priority | Description |
|----|------|----------|-------------|
| E-01 | React Wrapper | **High** | `@lit/react` 기반 래퍼 패키지 (MorphDB Studio 전환 대비) |
| E-02 | npm publish 자동화 | **Medium** | `npm publish --dry-run` 검증, README badge, CI release 연동 |
| A-08 | 스크린 리더 지원 강화 | **Low** | 셀 탐색 시 맥락 안내 강화 |

---

## Priority Matrix

```
              HIGH IMPACT                      LOW IMPACT
         ┌─────────────────────────────────────────────────┐
         │                                                 │
 HIGH    │  T-01 ESLint            R-05 JSDoc 보완         │
 URGENCY │  T-02 CI/CD             R-06 minWidth 처리      │
         │                                                 │
         ├─────────────────────────────────────────────────┤
         │                                                 │
 NORMAL  │  F-01 date 필터         F-05 predicate 방어     │
 URGENCY │  P-01 100K+ 최적화     N-03 컬럼 선택          │
         │  R-01 _onKeyDown 분리  V-01 유효성 피드백      │
         │  E-01 React wrapper    D-07 행 드래그 정렬      │
         │  T-03 Playwright E2E   E-06 붙여넣기 미리보기   │
         │  F-04 키보드 리사이즈   P-03 pinned right       │
         │                        A-06 고대비 테마         │
         │                        A-07 aria-live           │
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
| **v0.4.0** ✅ | 162 | 56.80 KB | 13.09 KB | 문서 완성 + 접근성 필수 (aria-selected, aria-readonly, focus outline) |
| v0.5.0 | — | — | — | 코드 품질 + CI/CD + 리팩토링 |
| v0.6.0 | — | — | — | 필터 완성 + UX 개선 |
| v0.7.0 | — | — | — | 성능 최적화 + 고급 기능 |
| v0.8.0 | — | — | — | React wrapper + 프로덕션 |

---

## Notes

- 각 Phase 완료 시 demo 페이지에 해당 기능 데모 추가
- 모든 공개 API는 CustomEvent 기반 — 프레임워크 무관 연동 보장
- 성능 기준: 10,000행 × 20컬럼에서 60fps 스크롤 유지
- 메이저 버전(1.0.0)은 Phase 8 완료 + 커뮤니티 검증 후 수동 결정
