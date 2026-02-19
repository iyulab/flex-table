# Roadmap

flex-table 개발 로드맵. 각 Phase는 이전 Phase 완료를 전제로 한다.

---

## Phase 0: Project Bootstrap

프로젝트 스켈레톤 세팅. 이 Phase 완료 후 `npm run dev`로 빈 테이블이 렌더링되어야 한다.

- [ ] npm 프로젝트 초기화 (`package.json`, `tsconfig.json`)
- [ ] Lit 3, Vite, TypeScript 의존성 설치 및 설정
- [ ] Vite config: library mode 빌드 + demo dev server
- [ ] `src/flex-table.ts` — 빈 `<flex-table>` 컴포넌트 등록
- [ ] `demo/index.html` — 기본 데모 페이지
- [ ] Vitest + @open-wc/testing 설정, 첫 번째 스모크 테스트
- [ ] `.gitignore` 정리, `CLAUDE.md` 최종 반영

---

## Phase 1: Table Rendering

데이터를 화면에 보여주는 것. 편집 없이 "보기"에 집중한다.

- [ ] **Column Model** 설계: `ColumnDefinition` 인터페이스 (`key`, `header`, `type`, `width`, `hidden`, `sortable`, `renderer`)
- [ ] **Data Model** 설계: `Record<string, unknown>[]` 기반, schema-agnostic
- [ ] **기본 테이블 렌더링**: 헤더 행 + 데이터 행, CSS Grid 또는 table 레이아웃
- [ ] **컬럼 타입별 기본 렌더러**: text, number, boolean, date, datetime — 포맷팅 로직 포함
- [ ] **커스텀 렌더러**: `renderer` 콜백으로 사용자 정의 셀 렌더링 지원
- [ ] **가상 스크롤**: 10,000행 이상 부드러운 스크롤 (고정 행 높이 기준)
- [ ] **컬럼 리사이즈**: 드래그로 컬럼 너비 조정
- [ ] **행 번호 컬럼**: 선택적 행 번호 표시
- [ ] demo: 1,000행 샘플 데이터 렌더링 확인

---

## Phase 2: Selection & Navigation

키보드 중심의 셀 탐색 경험. 이 Phase 완료 후 마우스 없이 테이블 전체를 탐색할 수 있어야 한다.

- [ ] **셀 포커스**: 클릭으로 셀 선택, 활성 셀 시각적 강조
- [ ] **키보드 네비게이션**: Arrow, Tab, Shift+Tab, Home, End, Ctrl+Home, Ctrl+End
- [ ] **범위 선택**: Shift+Arrow, Shift+Click으로 다중 셀 범위 선택
- [ ] **행 선택**: 행 번호 클릭으로 전체 행 선택, Shift+클릭으로 범위 행 선택
- [ ] **컬럼 선택**: 헤더 클릭으로 전체 컬럼 선택
- [ ] **선택 시각화**: 선택 범위 파란색 하이라이트, 활성 셀 테두리

---

## Phase 3: Inline Editing

셀 단위 즉시 편집. Enter로 편집 모드 진입, Escape로 취소.

- [ ] **편집 모드 진입/종료**: Enter/F2로 진입, Escape으로 취소, Tab/Enter로 확정 후 이동
- [ ] **타입별 에디터**: text input, number input, checkbox (boolean), date picker, select (enum)
- [ ] **커스텀 에디터**: `editor` 콜백으로 사용자 정의 편집기 지원
- [ ] **유효성 표시**: 잘못된 입력 시 셀 테두리 빨간색 표시
- [ ] **이벤트 발행**: `cell-edit-start`, `cell-edit-commit`, `cell-edit-cancel` CustomEvent
- [ ] **빈 행 자동 추가**: 마지막 행에서 Tab/Enter 시 새 행 자동 생성 (선택적)

---

## Phase 4: Clipboard

스프레드시트와 자유롭게 데이터를 주고받는 것. 이것이 flex-table의 킬러 기능.

- [ ] **Copy** (Ctrl+C): 선택된 셀 범위를 TSV 형식으로 클립보드에 복사
- [ ] **Paste** (Ctrl+V): TSV/CSV 데이터 붙여넣기, 필요 시 행/컬럼 자동 확장
- [ ] **Cut** (Ctrl+X): 선택 범위 잘라내기
- [ ] **Delete/Backspace**: 선택 범위 값 삭제
- [ ] **Excel/Google Sheets 호환**: 실제 스프레드시트에서 복사한 데이터로 테스트
- [ ] **붙여넣기 미리보기**: 대량 붙여넣기 전 확인 다이얼로그 (선택적)
- [ ] 이벤트: `clipboard-paste`, `clipboard-copy` CustomEvent

---

## Phase 5: Sorting & Filtering

데이터를 원하는 시각으로 볼 수 있는 기능.

- [ ] **컬럼 정렬**: 헤더 클릭으로 asc/desc/none 순환
- [ ] **다중 컬럼 정렬**: Shift+클릭으로 보조 정렬 추가
- [ ] **정렬 표시**: 헤더에 화살표 아이콘 + 정렬 순서 번호
- [ ] **필터 UI**: 컬럼 헤더 드롭다운 필터 (text: contains/equals, number: >, <, =, date: range)
- [ ] **활성 필터 표시**: 필터가 적용된 컬럼 헤더 시각적 구분
- [ ] 이벤트: `sort-change`, `filter-change` CustomEvent (외부 서버사이드 정렬/필터 지원)

---

## Phase 6: Row Operations

행 단위 CRUD.

- [ ] **행 추가**: API + 키보드 단축키 (Ctrl+Enter 또는 설정 가능)
- [ ] **행 삭제**: 선택된 행 삭제, 확인 없이 즉시 (undo로 복구)
- [ ] **다중 행 삭제**: 범위 선택 후 일괄 삭제
- [ ] **행 드래그 정렬**: 드래그 앤 드롭으로 행 순서 변경 (선택적)
- [ ] **Undo/Redo**: Ctrl+Z / Ctrl+Shift+Z, 편집 히스토리 스택
- [ ] 이벤트: `row-add`, `row-delete`, `rows-reorder` CustomEvent

---

## Phase 7: Column Operations

동적 스키마 지원.

- [ ] **컬럼 추가**: API를 통한 런타임 컬럼 추가
- [ ] **컬럼 삭제**: API를 통한 컬럼 제거
- [ ] **컬럼 숨기기/표시**: 특정 컬럼 토글
- [ ] **컬럼 순서 변경**: 드래그 앤 드롭으로 컬럼 재배치
- [ ] **컬럼 고정 (Freeze)**: 좌측 컬럼 고정, 수평 스크롤 시 유지
- [ ] 이벤트: `column-add`, `column-delete`, `column-reorder`, `column-resize` CustomEvent

---

## Phase 8: Theming & Accessibility

범용 컴포넌트로서 필수적인 마무리.

- [ ] **CSS Custom Properties**: 색상, 폰트, 간격, 테두리 등 전체 테마 변수
- [ ] **Dark/Light 테마**: 기본 제공 테마 2종
- [ ] **ARIA 속성**: `role="grid"`, `role="row"`, `role="gridcell"`, `aria-selected`, `aria-sort`
- [ ] **스크린 리더 지원**: 셀 탐색 시 적절한 안내
- [ ] **고대비 모드**: 접근성 고대비 테마

---

## Phase 9: Export & Integration

외부 시스템과의 데이터 교환.

- [ ] **Export API**: `export('csv')`, `export('json')`, `export('tsv')`
- [ ] **React Wrapper**: `@lit/react`를 사용한 React 컴포넌트 래퍼 패키지
- [ ] **API 문서**: 모든 속성, 이벤트, 메서드의 JSDoc + 사용 예제
- [ ] **npm 배포**: 첫 `0.1.0` 릴리스

---

## Notes

- 각 Phase 완료 시 demo 페이지에 해당 기능 데모 추가
- 모든 공개 API는 CustomEvent 기반 — 프레임워크 무관 연동 보장
- 성능 기준: 10,000행 × 20컬럼에서 60fps 스크롤 유지
