import { css } from 'lit';

export const flexTableStyles = css`
  /* --- Theme Variables (Light defaults) --- */
  :host {
    --ft-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --ft-font-size: 14px;

    /* --- 치수·위계 축 (기본값 = 종전 렌더값) ---
       이 표는 가상 스크롤이라 행 높이가 **JS 로 계산된다**(index * rowHeight).
       그래서 --ft-row-height 는 CSS 만으로는 닿지 않고, 컴포넌트가 첫 렌더에서
       판독해 가상화 계산에 넣는다. 그 결과가 rowHeight 프로퍼티의 기본값이다.

       ⚠여백과 행 높이의 관계: 행 높이는 **고정**이고 여백은 그 안에서 글자를
       배치한다. 행 높이를 줄이면서 여백을 그대로 두면 아래가 잘린다
       (padding-block * 2 + 한 줄 높이 <= row-height 를 유지할 것). */
    --ft-row-height: 32px;
    --ft-cell-padding-block: 6px;
    --ft-cell-padding-inline: 12px;
    --ft-header-font-size: var(--ft-font-size);
    --ft-header-font-weight: 600;
    --ft-border-color: var(--u-border-color, #e0e0e0);
    --ft-bg: var(--u-bg-color, #fff);
    --ft-text-color: var(--u-txt-color, #202124);
    --ft-header-bg: var(--u-bg-color-raised, #f8f9fa);
    --ft-header-hover-bg: var(--u-bg-color-active, #e8eaed);
    --ft-header-text-color: var(--u-txt-color, #202124);
    --ft-row-even-bg: var(--u-bg-color, #fff);
    --ft-row-odd-bg: var(--u-bg-color-raised, #fafafa);
    --ft-row-hover-bg: var(--u-bg-color-hover, #f0f4ff);
    --ft-active-color: var(--u-primary-color, #1a73e8);
    --ft-selection-bg: var(--u-primary-bg-color, #e8f0fe);
    --ft-bool-color: var(--u-primary-color, #2196f3);
    --ft-sort-indicator-color: var(--u-txt-color-weak, #5f6368);
    --ft-editor-bg: var(--u-input-bg-color, #fff);
    /* #999 was 2.85 against --ft-bg (#fff); AA needs 4.5. The dark value (#9aa0a6 on
       #1e1e2e = 6.31) was already fine, so this was a light-only defect. #5f6368 is the
       same grey the sort indicator uses, which keeps the palette to one family. */
    --ft-empty-color: var(--u-txt-color-weak, #5f6368);

    /* 상태 색 — 종전에는 규칙 안에 리터럴로 박혀 있어 소비자가 덮을 경로가 없었고
       테마도 따라오지 않았다(다크에서 라이트용 값 그대로).

       ★**셀 배경은 불투명 면이 아니라 반투명 겹침이다.** 줄무늬(홀/짝 행)와 선택 표시가
       아래에 있고 그것이 비쳐야 "어느 행의 어떤 셀"인지 읽힌다. 그래서 면 토큰
       (--u-*-bg-color)이 아니라 **상태 색에서 알파를 뽑는다** — 부수 효과로 두 테마
       모두에서 성립하므로 아래 다크 블록에 이 셋을 다시 적을 필요가 없다. */
    --ft-invalid-color: var(--u-danger-color, #d93025);
    --ft-invalid-bg: color-mix(in srgb, var(--ft-invalid-color) 8%, transparent);
    --ft-drop-color: var(--u-primary-color, #1a73e8);
    --ft-drop-bg: color-mix(in srgb, var(--ft-drop-color) 15%, transparent);
    --ft-find-color: var(--u-warning-color, #f9a825);
    --ft-find-bg: color-mix(in srgb, var(--ft-find-color) 25%, transparent);
    --ft-find-current-bg: color-mix(in srgb, var(--ft-find-color) 50%, transparent);
  }

  /* --- Dark Theme (auto via prefers-color-scheme) ---
     ★**토큰 시트가 로드된 환경에서 아래 두 블록은 아무 일도 하지 않는다** — --u-* 가
     이미 테마별로 다른 값을 가리키므로 base 규칙만으로 두 테마가 성립한다.
     남겨 두는 이유는 **시트가 없는 소비자**다: 그때는 각 var() 의 리터럴 폴백이
     발동하고, 아래 블록이 그 폴백을 다크 값으로 바꿔 준다.
     ⇒ 즉 이 표는 시트 없이도 종전처럼 자체 테마를 갖는다(그것이 이 패키지의 계약이었다). */
  @media (prefers-color-scheme: dark) {
    :host(:not([theme="light"])) {
      --ft-border-color: var(--u-border-color, #3c4043);
      --ft-bg: var(--u-bg-color, #1e1e1e);
      --ft-text-color: var(--u-txt-color, #e8eaed);
      --ft-header-bg: var(--u-bg-color-raised, #292a2d);
      --ft-header-hover-bg: var(--u-bg-color-active, #3c4043);
      --ft-header-text-color: var(--u-txt-color, #e8eaed);
      --ft-row-even-bg: var(--u-bg-color, #1e1e1e);
      --ft-row-odd-bg: var(--u-bg-color-raised, #252526);
      --ft-row-hover-bg: var(--u-bg-color-hover, #2a2d2e);
      --ft-active-color: var(--u-primary-color, #4da3ff);
      --ft-selection-bg: var(--u-primary-bg-color, #264f78);
      --ft-bool-color: var(--u-primary-color, #64b5f6);
      --ft-sort-indicator-color: var(--u-txt-color-weak, #9aa0a6);
      --ft-editor-bg: var(--u-input-bg-color, #2d2d2d);
      --ft-empty-color: var(--u-txt-color-weak, #9aa0a6);
    }
  }

  /* --- Force dark via attribute --- */
  :host([theme="dark"]) {
    --ft-border-color: var(--u-border-color, #3c4043);
    --ft-bg: var(--u-bg-color, #1e1e1e);
    --ft-text-color: var(--u-txt-color, #e8eaed);
    --ft-header-bg: var(--u-bg-color-raised, #292a2d);
    --ft-header-hover-bg: var(--u-bg-color-active, #3c4043);
    --ft-header-text-color: var(--u-txt-color, #e8eaed);
    --ft-row-even-bg: var(--u-bg-color, #1e1e1e);
    --ft-row-odd-bg: var(--u-bg-color-raised, #252526);
    --ft-row-hover-bg: var(--u-bg-color-hover, #2a2d2e);
    --ft-active-color: var(--u-primary-color, #4da3ff);
    --ft-selection-bg: var(--u-primary-bg-color, #264f78);
    --ft-bool-color: var(--u-primary-color, #64b5f6);
    --ft-sort-indicator-color: var(--u-txt-color-weak, #9aa0a6);
    --ft-editor-bg: var(--u-input-bg-color, #2d2d2d);
    --ft-empty-color: var(--u-txt-color-weak, #9aa0a6);
  }

  /* --- Layout --- */
  :host {
    display: block;
    position: relative;
    overflow: auto;
    font-family: var(--ft-font-family);
    font-size: var(--ft-font-size);
    color: var(--ft-text-color);
    background: var(--ft-bg);
    border: 1px solid var(--ft-border-color);
    outline: none;
  }

  .ft-header {
    display: block;
    position: sticky;
    top: 0;
    z-index: 3;
  }

  .ft-header-cell {
    position: absolute;
    top: 0;
    /* 머리행은 종전에도 본문보다 상하 2px 넉넉했다 — 그 관계를 유지한다. */
    padding: calc(var(--ft-cell-padding-block) + 2px) var(--ft-cell-padding-inline);
    background: var(--ft-header-bg);
    color: var(--ft-header-text-color);
    font-size: var(--ft-header-font-size);
    font-weight: var(--ft-header-font-weight);
    user-select: none;
    border-bottom: 2px solid var(--ft-border-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .ft-header-cell.ft-sortable { cursor: pointer; }
  .ft-header-cell.ft-sortable:hover { background: var(--ft-header-hover-bg); }

  .ft-resize-handle {
    position: absolute;
    right: 0; top: 0; bottom: 0;
    width: 6px;
    cursor: col-resize;
    z-index: 3;
  }

  .ft-resize-handle:hover,
  .ft-resize-handle.ft-resizing {
    background: var(--ft-active-color);
    opacity: 0.3;
  }

  .ft-header-cell.ft-col-dragging {
    opacity: 0.5;
  }

  .ft-drop-indicator {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--ft-active-color);
    pointer-events: none;
    z-index: 5;
    transform: translateX(-1px);
  }

  .ft-row-drop-indicator {
    position: absolute;
    left: 0;
    height: 2px;
    background: var(--ft-active-color);
    pointer-events: none;
    z-index: 5;
    transform: translateY(-1px);
  }

  .ft-fill-handle {
    position: absolute;
    width: 8px;
    height: 8px;
    background: var(--ft-active-color);
    cursor: crosshair;
    z-index: 6;
    border: 1px solid white;
  }

  .ft-fill-preview {
    position: absolute;
    border: 2px dashed var(--ft-active-color);
    pointer-events: none;
    z-index: 4;
    box-sizing: border-box;
  }

  .ft-sort-indicator {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--ft-sort-indicator-color);
  }

  .ft-sort-order {
    font-size: 10px;
    color: var(--ft-sort-indicator-color);
  }

  .ft-body { position: relative; }

  .ft-frozen-rows {
    display: block;
    position: sticky;
    z-index: 3;
    border-bottom: 2px solid var(--ft-active-color);
    background: var(--ft-bg);
  }

  .ft-row {
    display: block;
    position: absolute;
    left: 0;
  }

  .ft-cell {
    position: absolute;
    top: 0;
    padding: var(--ft-cell-padding-block) var(--ft-cell-padding-inline);
    border-bottom: 1px solid var(--ft-border-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    box-sizing: border-box;
    cursor: default;
  }

  .ft-row-even .ft-cell { background: var(--ft-row-even-bg); }
  .ft-row-odd .ft-cell { background: var(--ft-row-odd-bg); }
  .ft-row:hover .ft-cell { background: var(--ft-row-hover-bg); }

  .ft-cell.ft-active {
    outline: 2px solid var(--ft-active-color);
    outline-offset: -2px;
    z-index: 1;
  }

  .ft-cell.ft-selected {
    background: var(--ft-selection-bg) !important;
  }

  .ft-cell.ft-invalid {
    outline: 2px solid var(--ft-invalid-color);
    outline-offset: -2px;
    background: var(--ft-invalid-bg);
  }

  .ft-cell.ft-editing { padding: 0; overflow: visible; }

  .ft-editor {
    width: 100%; height: 100%;
    border: none; outline: none;
    /* 편집기는 셀 위에 겹쳐 뜬다 — 여백이 어긋나면 글자가 튄다. */
    padding: var(--ft-cell-padding-block) var(--ft-cell-padding-inline);
    font: inherit;
    color: var(--ft-text-color);
    background: var(--ft-editor-bg);
    box-sizing: border-box;
  }
  .ft-editor:focus {
    outline: 2px solid var(--ft-active-color);
    outline-offset: -2px;
  }

  .ft-editor-number { text-align: right; }

  select.ft-editor {
    cursor: pointer;
    padding: 4px 6px;
    appearance: auto;
  }

  .ft-autocomplete-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 100;
    min-width: 100%;
    max-height: 180px;
    overflow-y: auto;
    background: var(--ft-editor-bg, #fff);
    border: 1px solid var(--ft-active-color);
    border-top: none;
    box-shadow: 0 4px 8px rgba(0,0,0,0.12);
  }

  .ft-autocomplete-item {
    padding: 4px 8px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: var(--ft-font-size, 14px);
    color: var(--ft-text-color);
  }

  .ft-autocomplete-item:hover,
  .ft-autocomplete-item.ft-autocomplete-active {
    background: var(--ft-selection-bg);
    color: var(--ft-active-color);
  }

  .ft-cell.ft-type-number {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .ft-cell.ft-type-boolean { text-align: center; }
  .ft-bool { color: var(--ft-bool-color); }

  .ft-empty {
    padding: 24px;
    text-align: center;
    color: var(--ft-empty-color);
  }

  .ft-has-comment {
    position: relative;
  }

  .ft-comment-indicator {
    position: absolute;
    top: 0;
    right: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 7px 7px 0;
    border-color: transparent #f59e0b transparent transparent;
    pointer-events: none;
    z-index: 1;
  }

  .ft-import-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    background: var(--ft-drop-bg);
    border: 2px dashed var(--ft-drop-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 500;
    color: var(--ft-drop-color);
    pointer-events: none;
    border-radius: 4px;
  }

  .ft-loading-overlay {
    position: absolute;
    inset: 0;
    z-index: 90;
    background: rgba(255, 255, 255, 0.5);
    pointer-events: none;
  }

  @media (prefers-color-scheme: dark) {
    :host(:not([theme="light"])) .ft-loading-overlay {
      background: rgba(30, 30, 30, 0.5);
    }
  }

  :host([theme="dark"]) .ft-loading-overlay {
    background: rgba(30, 30, 30, 0.5);
  }

  .ft-row-num-header,
  .ft-row-num {
    position: absolute;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ft-sort-indicator-color);
    font-size: 12px;
    padding: 6px 4px;
    box-sizing: border-box;
    user-select: none;
  }

  .ft-row-num-header {
    background: var(--ft-header-bg);
    font-weight: 600;
    border-bottom: 2px solid var(--ft-border-color);
    padding: 8px 4px;
  }

  .ft-row-num {
    border-bottom: 1px solid var(--ft-border-color);
    cursor: pointer;
    background: var(--ft-row-even-bg);
  }

  .ft-row-odd .ft-row-num { background: var(--ft-row-odd-bg); }
  .ft-row:hover .ft-row-num { background: var(--ft-row-hover-bg); }

  .ft-row-num:hover {
    background: var(--ft-header-hover-bg);
  }

  /* --- Pinned Columns --- */

  .ft-pinned {
    background: var(--ft-bg);
  }

  .ft-header-cell.ft-pinned {
    background: var(--ft-header-bg);
  }

  .ft-row-even .ft-cell.ft-pinned { background: var(--ft-row-even-bg); }
  .ft-row-odd .ft-cell.ft-pinned { background: var(--ft-row-odd-bg); }
  .ft-row:hover .ft-cell.ft-pinned { background: var(--ft-row-hover-bg); }
  .ft-cell.ft-pinned.ft-selected { background: var(--ft-selection-bg) !important; }

  /* --- Filter UI --- */

  .ft-filter-btn {
    all: unset;
    cursor: pointer;
    font-size: 10px;
    color: var(--ft-sort-indicator-color);
    padding: 0 2px;
    margin-left: auto;
    opacity: 0.7;
    flex-shrink: 0;
  }

  .ft-filter-btn:hover { opacity: 1; }

  .ft-filter-btn.ft-filter-active {
    color: var(--ft-active-color);
    opacity: 1;
  }

  .ft-filter-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 200px;
    background: var(--ft-bg);
    border: 1px solid var(--ft-border-color);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 8px;
    z-index: 10;
    box-sizing: border-box;
  }

  .ft-filter-input {
    width: 100%;
    padding: 4px 8px;
    font: inherit;
    font-size: 13px;
    border: 1px solid var(--ft-border-color);
    border-radius: 3px;
    color: var(--ft-text-color);
    background: var(--ft-editor-bg);
    box-sizing: border-box;
  }

  .ft-filter-input:focus {
    outline: 1px solid var(--ft-active-color);
  }

  .ft-filter-range {
    display: flex;
    gap: 4px;
  }

  .ft-filter-range .ft-filter-input {
    width: 50%;
  }

  .ft-filter-actions {
    margin-top: 6px;
    text-align: right;
  }

  .ft-filter-clear {
    all: unset;
    cursor: pointer;
    font-size: 12px;
    color: var(--ft-sort-indicator-color);
    padding: 2px 8px;
    border-radius: 3px;
  }

  .ft-filter-clear:hover {
    background: var(--ft-header-hover-bg);
    color: var(--ft-text-color);
  }

  .ft-filter-mode-row {
    display: flex;
    gap: 4px;
    margin-bottom: 4px;
  }

  .ft-filter-mode-select {
    flex: 1;
    padding: 3px 6px;
    font: inherit;
    font-size: 12px;
    border: 1px solid var(--ft-border-color);
    border-radius: 3px;
    color: var(--ft-text-color);
    background: var(--ft-editor-bg);
    cursor: pointer;
  }

  .ft-num-cond-row {
    display: flex;
    gap: 4px;
    margin-bottom: 4px;
  }

  .ft-num-op-select {
    flex: 0 0 44px;
  }

  .ft-num-cond-input {
    flex: 1;
  }

  .ft-filter-empty-row {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--ft-border-color);
  }

  .ft-filter-empty-row label {
    display: block;
    font-size: 11px;
    color: var(--ft-sort-indicator-color);
    margin-bottom: 3px;
  }

  /* --- Row Selection (Checkbox) --- */

  .ft-checkbox-header,
  .ft-checkbox-cell {
    position: absolute;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    box-sizing: border-box;
    user-select: none;
  }

  .ft-checkbox-header {
    background: var(--ft-header-bg);
    border-bottom: 2px solid var(--ft-border-color);
  }

  .ft-checkbox-cell {
    border-bottom: 1px solid var(--ft-border-color);
    background: var(--ft-row-even-bg);
  }

  .ft-row-odd .ft-checkbox-cell { background: var(--ft-row-odd-bg); }
  .ft-row:hover .ft-checkbox-cell { background: var(--ft-row-hover-bg); }
  .ft-row-selected .ft-checkbox-cell { background: var(--ft-selection-bg); }
  .ft-row-selected .ft-cell { background: var(--ft-selection-bg) !important; }
  .ft-row-selected .ft-row-num { background: var(--ft-selection-bg); }

  .ft-checkbox-header input[type="checkbox"],
  .ft-checkbox-cell input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--ft-active-color);
  }

  /* --- Footer Row --- */

  .ft-footer {
    display: block;
    position: sticky;
    bottom: 0;
    z-index: 2;
    background: var(--ft-header-bg);
    border-top: 2px solid var(--ft-border-color);
  }

  .ft-footer-cell {
    position: absolute;
    top: 0;
    padding: 6px 12px;
    font-weight: 600;
    font-size: 13px;
    color: var(--ft-header-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    box-sizing: border-box;
  }

  /* Header context menu */
  .ft-header-menu {
    background: var(--ft-editor-bg, #fff);
    border: 1px solid var(--ft-border-color);
    box-shadow: 0 2px 8px rgba(0,0,0,0.16);
    min-width: 160px;
    border-radius: 4px;
    overflow: hidden;
  }

  .ft-header-menu-item {
    padding: 6px 12px;
    cursor: pointer;
    font-size: var(--ft-font-size, 14px);
    color: var(--ft-text-color);
    white-space: nowrap;
  }

  .ft-header-menu-item:hover {
    background: var(--ft-selection-bg);
    color: var(--ft-active-color);
  }

  /* Hidden column indicator in header */
  .ft-hidden-col-indicator {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 16px;
    background: var(--ft-selection-bg);
    border-right: 2px solid var(--ft-active-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: var(--ft-active-color);
    padding: 0;
    border-top: none;
    border-bottom: none;
    border-left: none;
    flex-shrink: 0;
  }

  .ft-hidden-col-indicator:hover {
    background: var(--ft-active-color);
    color: white;
  }

  /* Body context menu */
  .ft-body-context-menu {
    background: var(--ft-editor-bg, #fff);
    border: 1px solid var(--ft-border-color);
    box-shadow: 0 2px 8px rgba(0,0,0,0.16);
    min-width: 180px;
    border-radius: 4px;
    overflow: hidden;
    padding: 4px 0;
  }

  .ft-context-menu-item {
    padding: 6px 14px;
    cursor: pointer;
    font-size: var(--ft-font-size, 14px);
    color: var(--ft-text-color);
    white-space: nowrap;
    user-select: none;
  }

  .ft-context-menu-item:hover {
    background: var(--ft-selection-bg);
    color: var(--ft-active-color);
  }

  .ft-context-menu-item.ft-context-menu-danger:hover {
    background: #fdd;
    color: #c0392b;
  }

  .ft-context-menu-separator {
    height: 1px;
    background: var(--ft-border-color);
    margin: 4px 0;
  }

  /* Comment edit popup */
  .ft-comment-popup {
    background: var(--ft-editor-bg, #fff);
    border: 1px solid var(--ft-border-color);
    box-shadow: 0 2px 10px rgba(0,0,0,0.18);
    border-radius: 4px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 220px;
  }

  .ft-comment-popup-textarea {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    font-size: var(--ft-font-size, 14px);
    font-family: inherit;
    color: var(--ft-text-color);
    background: var(--ft-editor-bg, #fff);
    border: 1px solid var(--ft-border-color);
    border-radius: 3px;
    padding: 4px 6px;
    outline: none;
    min-height: 72px;
  }

  .ft-comment-popup-textarea:focus {
    border-color: var(--ft-active-color, #3b82f6);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ft-active-color) 20%, transparent);
  }

  .ft-comment-popup-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }

  .ft-comment-popup-cancel,
  .ft-comment-popup-save {
    padding: 4px 12px;
    font-size: var(--ft-font-size, 13px);
    border-radius: 3px;
    border: 1px solid var(--ft-border-color);
    cursor: pointer;
    background: var(--ft-editor-bg, #fff);
    color: var(--ft-text-color);
  }

  .ft-comment-popup-save {
    background: var(--ft-active-color, #3b82f6);
    color: #fff;
    border-color: transparent;
  }

  .ft-comment-popup-cancel:hover {
    background: var(--ft-selection-bg);
  }

  .ft-comment-popup-save:hover {
    opacity: 0.9;
  }

  /* Find / Replace panel */
  .ft-find-panel {
    position: sticky;
    top: 0;
    right: 0;
    z-index: 20;
    background: var(--ft-header-bg);
    border-bottom: 1px solid var(--ft-border-color);
    padding: 4px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }

  .ft-find-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .ft-find-input, .ft-find-replace-input {
    flex: 1;
    min-width: 120px;
    padding: 3px 6px;
    border: 1px solid var(--ft-border-color);
    border-radius: 3px;
    font: inherit;
    font-size: 13px;
    background: var(--ft-editor-bg);
    color: var(--ft-text-color);
  }

  .ft-find-input:focus, .ft-find-replace-input:focus {
    outline: 2px solid var(--ft-active-color);
    outline-offset: -1px;
  }

  .ft-find-count {
    font-size: 12px;
    color: var(--ft-sort-indicator-color);
    min-width: 60px;
    text-align: center;
  }

  .ft-find-panel button {
    padding: 2px 8px;
    border: 1px solid var(--ft-border-color);
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    background: var(--ft-header-bg);
    color: var(--ft-text-color);
  }

  .ft-find-panel button:hover:not(:disabled) {
    background: var(--ft-header-hover-bg);
  }

  .ft-find-panel button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .ft-find-panel label {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 12px;
    cursor: pointer;
    user-select: none;
  }

  /* Find highlight */
  .ft-cell.ft-find-match {
    background: var(--ft-find-bg) !important;
  }

  .ft-cell.ft-find-current {
    background: var(--ft-find-current-bg) !important;
    outline: 2px solid var(--ft-find-color);
    outline-offset: -2px;
  }
`;
