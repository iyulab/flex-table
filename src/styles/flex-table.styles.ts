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
    display: grid;
    position: sticky;
    top: 0;
    z-index: 2;
  }

  .ft-header-cell {
    position: relative;
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

  .ft-row {
    display: grid;
    position: absolute;
    left: 0; right: 0;
  }

  .ft-cell {
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

  .ft-editor-number { text-align: right; }

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
    text-align: center;
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
  }

  .ft-row-num:hover {
    background: var(--ft-header-hover-bg);
  }
`;
