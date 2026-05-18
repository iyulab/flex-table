import { css } from 'lit';

export const flexTableStyles = css`
  /* --- Theme Variables (Light defaults) --- */
  :host {
    --ft-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --ft-font-size: 14px;
    --ft-border-color: #e0e0e0;
    --ft-bg: #fff;
    --ft-text-color: #202124;
    --ft-header-bg: #f8f9fa;
    --ft-header-hover-bg: #e8eaed;
    --ft-header-text-color: #202124;
    --ft-row-even-bg: #fff;
    --ft-row-odd-bg: #fafafa;
    --ft-row-hover-bg: #f0f4ff;
    --ft-active-color: #1a73e8;
    --ft-selection-bg: #e8f0fe;
    --ft-bool-color: #2196f3;
    --ft-sort-indicator-color: #5f6368;
    --ft-editor-bg: #fff;
    --ft-empty-color: #999;
  }

  /* --- Dark Theme (auto via prefers-color-scheme) --- */
  @media (prefers-color-scheme: dark) {
    :host(:not([theme="light"])) {
      --ft-border-color: #3c4043;
      --ft-bg: #1e1e1e;
      --ft-text-color: #e8eaed;
      --ft-header-bg: #292a2d;
      --ft-header-hover-bg: #3c4043;
      --ft-header-text-color: #e8eaed;
      --ft-row-even-bg: #1e1e1e;
      --ft-row-odd-bg: #252526;
      --ft-row-hover-bg: #2a2d2e;
      --ft-active-color: #4da3ff;
      --ft-selection-bg: #264f78;
      --ft-bool-color: #64b5f6;
      --ft-sort-indicator-color: #9aa0a6;
      --ft-editor-bg: #2d2d2d;
      --ft-empty-color: #9aa0a6;
    }
  }

  /* --- Force dark via attribute --- */
  :host([theme="dark"]) {
    --ft-border-color: #3c4043;
    --ft-bg: #1e1e1e;
    --ft-text-color: #e8eaed;
    --ft-header-bg: #292a2d;
    --ft-header-hover-bg: #3c4043;
    --ft-header-text-color: #e8eaed;
    --ft-row-even-bg: #1e1e1e;
    --ft-row-odd-bg: #252526;
    --ft-row-hover-bg: #2a2d2e;
    --ft-active-color: #4da3ff;
    --ft-selection-bg: #264f78;
    --ft-bool-color: #64b5f6;
    --ft-sort-indicator-color: #9aa0a6;
    --ft-editor-bg: #2d2d2d;
    --ft-empty-color: #9aa0a6;
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
    padding: 8px 12px;
    background: var(--ft-header-bg);
    color: var(--ft-header-text-color);
    font-weight: 600;
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
    padding: 6px 12px;
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
    outline: 2px solid #d93025;
    outline-offset: -2px;
    background: rgba(217, 48, 37, 0.08);
  }

  .ft-cell.ft-editing { padding: 0; overflow: visible; }

  .ft-editor {
    width: 100%; height: 100%;
    border: none; outline: none;
    padding: 6px 12px;
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
    background: rgba(255, 200, 0, 0.25) !important;
  }

  .ft-cell.ft-find-current {
    background: rgba(255, 160, 0, 0.5) !important;
    outline: 2px solid orange;
    outline-offset: -2px;
  }
`;
