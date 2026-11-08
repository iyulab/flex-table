import { describe, it, expect, vi } from 'vitest';
import { SelectionState, type CellPosition } from '../core/selection.js';
import { CursorController, type CursorContext } from './cursor.js';

/** A cursor over a 100-row, 5-column table (200px columns, 30px rows, 40px header) with the host's scroll box as plain numbers. */
function setup(over: Partial<CursorContext> = {}) {
  const selection = new SelectionState();
  selection.setDimensions(100, 5);
  const host = { scrollTop: 0, scrollLeft: 0, clientHeight: 300, clientWidth: 500, focus: vi.fn() } as unknown as HTMLElement;
  let active: CellPosition | null = null;
  const calls = { commit: 0, startEdit: 0, activate: [] as number[], select: [] as unknown[], column: [] as unknown[], invalidate: 0 };
  let rowDrag = false;
  const ctx: CursorContext = {
    host,
    selection,
    activeCell: () => active,
    setActiveCell: (p) => { active = p; },
    commitEdit: () => { calls.commit++; },
    startEdit: () => { calls.startEdit++; },
    activateRow: (col) => { calls.activate.push(col); },
    consumeRowDrag: () => { const was = rowDrag; rowDrag = false; return was; },
    rowCount: () => 100,
    columnKey: (i) => `c${i}`,
    rowId: (r) => `id-${r}`,
    rowHeight: () => 30,
    headerHeight: () => 40,
    frozenRowCount: () => 0,
    frozenRowsHeight: () => 0,
    colLeftOffsets: () => [0, 200, 400, 600, 800],
    colWidth: () => 200,
    emitCellSelect: (d) => { calls.select.push(d); },
    emitColumnSelect: (d) => { calls.column.push(d); },
    invalidate: () => { calls.invalidate++; },
    ...over,
  };
  const cursor = new CursorController(ctx);
  return {
    cursor, host, selection, calls,
    active: () => active,
    setActive: (p: CellPosition | null) => { active = p; },
    dragRow: () => { rowDrag = true; },
  };
}

const press = (init: MouseEventInit = {}) => new MouseEvent('mousedown', { button: 0, cancelable: true, ...init });

describe('CursorController — follow scroll', () => {
  it('scrolls right just far enough to show a column past the right edge', () => {
    const t = setup();
    t.cursor.scrollColumnIntoView(3); // 600..800, viewport 0..500
    expect(t.host.scrollLeft).toBe(300);
  });

  it('scrolls left to a column before the left edge, and leaves a visible column alone', () => {
    const t = setup();
    t.host.scrollLeft = 600;
    t.cursor.scrollColumnIntoView(1); // 200..400
    expect(t.host.scrollLeft).toBe(200);
    t.cursor.scrollColumnIntoView(1);
    expect(t.host.scrollLeft).toBe(200);
  });

  it('scrolls down to put the active row at the bottom edge, and up to the top edge under the header', () => {
    const t = setup();
    t.setActive({ row: 20, col: 0 }); // top 640, bottom 670; viewport 0..300
    t.cursor.scrollToActive();
    expect(t.host.scrollTop).toBe(370);
    t.setActive({ row: 2, col: 0 }); // top 100 < scrollTop(370) + header(40)
    t.cursor.scrollToActive();
    expect(t.host.scrollTop).toBe(60);
  });

  it('does not scroll vertically for a frozen row, but still follows its column', () => {
    const t = setup({ frozenRowCount: () => 2, frozenRowsHeight: () => 60 });
    t.host.scrollTop = 500;
    t.setActive({ row: 1, col: 4 });
    t.cursor.scrollToActive();
    expect(t.host.scrollTop).toBe(500);
    expect(t.host.scrollLeft).toBe(500); // 800..1000, viewport width 500
  });

  it('does nothing without an active cell', () => {
    const t = setup();
    t.cursor.scrollToActive();
    expect(t.host.scrollTop).toBe(0);
    expect(t.host.scrollLeft).toBe(0);
  });
});

describe('CursorController — pointer', () => {
  it('a plain click selects the cell, announces it with the row id, and opens the row', () => {
    const t = setup();
    const cell = document.createElement('div');
    t.cursor.click(new MouseEvent('click'), 3, 2, cell);
    expect(t.active()).toEqual({ row: 3, col: 2 });
    expect(t.calls.select).toEqual([{ row: 3, col: 2, id: 'id-3' }]);
    expect(t.calls.activate).toEqual([2]);
    expect(t.calls.commit).toBe(1);
  });

  it('a shift-click extends the range and a ctrl-click toggles — neither opens the row', () => {
    const t = setup();
    const cell = document.createElement('div');
    t.cursor.click(new MouseEvent('click'), 1, 1, cell);
    t.cursor.click(new MouseEvent('click', { shiftKey: true }), 3, 2, cell);
    expect(t.selection.range).toEqual({ startRow: 1, startCol: 1, endRow: 3, endCol: 2 });
    t.cursor.click(new MouseEvent('click', { ctrlKey: true }), 5, 0, cell);
    expect(t.calls.activate).toEqual([1]);
  });

  it('a drag over other cells extends the range, and the click that ends it is not a new select', () => {
    const t = setup();
    const down = press();
    t.cursor.mouseDown(down, 1, 1);
    expect(down.defaultPrevented).toBe(true);
    t.cursor.mouseEnter(2, 2);
    expect(t.selection.range).toEqual({ startRow: 1, startCol: 1, endRow: 2, endCol: 2 });
    const before = t.calls.select.length;
    t.cursor.click(new MouseEvent('click'), 2, 2, document.createElement('div'));
    expect(t.calls.select.length).toBe(before);
    expect(t.calls.activate).toEqual([]);
  });

  it('moving over cells without a press selects nothing', () => {
    const t = setup();
    t.cursor.mouseEnter(2, 2);
    expect(t.selection.range).toBeNull();
    expect(t.calls.select).toEqual([]);
  });

  it('a press released elsewhere ends the drag; reset forgets a press in progress', () => {
    const t = setup();
    t.cursor.mouseDown(press(), 1, 1);
    document.dispatchEvent(new MouseEvent('mouseup'));
    t.cursor.mouseEnter(3, 3);
    expect(t.selection.range).toBeNull();

    t.cursor.mouseDown(press(), 1, 1);
    t.cursor.reset();
    t.cursor.mouseEnter(3, 3);
    expect(t.selection.range).toBeNull();
  });

  it('ignores other buttons and shift-presses; a ctrl-press only takes focus', () => {
    const t = setup();
    t.cursor.mouseDown(press({ button: 2 }), 1, 1);
    t.cursor.mouseDown(press({ shiftKey: true }), 1, 1);
    expect(t.active()).toBeNull();
    const ctrl = press({ ctrlKey: true });
    t.cursor.mouseDown(ctrl, 1, 1);
    expect(ctrl.defaultPrevented).toBe(true);
    expect(t.host.focus).toHaveBeenCalledTimes(1);
    expect(t.active()).toBeNull();
  });

  it('a row number selects the whole row — unless a row drag just ended', () => {
    const t = setup();
    t.dragRow();
    t.cursor.rowNumberClick(4, 4);
    expect(t.active()).toBeNull();
    t.cursor.rowNumberClick(4, 4);
    expect(t.active()).toEqual({ row: 4, col: 4 });
    expect(t.selection.range).toEqual({ startRow: 4, startCol: 0, endRow: 4, endCol: 4 });
  });

  it('a double click selects the cell and starts editing', () => {
    const t = setup();
    t.cursor.doubleClick(2, 1);
    expect(t.active()).toEqual({ row: 2, col: 1 });
    expect(t.calls.startEdit).toBe(1);
  });

  it('a column is selected top to bottom and announced with its key', () => {
    const t = setup();
    t.cursor.selectColumn(2);
    expect(t.selection.range).toEqual({ startRow: 0, startCol: 2, endRow: 99, endCol: 2 });
    expect(t.calls.column).toEqual([{ colIndex: 2, key: 'c2', rowCount: 100 }]);
    t.cursor.selectColumn(-1);
    expect(t.calls.column.length).toBe(1);
  });

  it('following the selection (the keyboard) syncs the cell, scrolls to it and announces it', () => {
    const t = setup();
    t.selection.setActive(20, 3);
    t.cursor.followSelection();
    expect(t.active()).toEqual({ row: 20, col: 3 });
    expect(t.host.scrollTop).toBe(370);
    expect(t.host.scrollLeft).toBe(300);
    expect(t.calls.select).toEqual([{ row: 20, col: 3, id: 'id-20' }]);
  });
});
