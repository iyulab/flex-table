import { describe, it, expect } from 'vitest';
import { SelectionState } from '../core/selection.js';
import { KeyboardNavController } from './keyboard-nav.js';

function setup() {
  const selection = new SelectionState();
  selection.setDimensions(10, 4);
  const calls = { follow: 0, header: [] as Array<number | null>, scroll: [] as number[] };
  const nav = new KeyboardNavController({
    selection,
    followSelection: () => { calls.follow++; },
    setHeaderCol: (c) => { calls.header.push(c); },
    scrollColumnIntoView: (c) => { calls.scroll.push(c); },
  });
  return { nav, selection, calls };
}

const key = (k: string, init: KeyboardEventInit = {}) => new KeyboardEvent('keydown', { key: k, ...init });

describe('KeyboardNavController — body', () => {
  it('arrows move the cell and Shift extends the range', () => {
    const t = setup();
    t.selection.setActive(2, 1);
    expect(t.nav.moveBody(key('ArrowDown'))).toBe(true);
    expect(t.selection.activeCell).toEqual({ row: 3, col: 1 });
    expect(t.nav.moveBody(key('ArrowRight', { shiftKey: true }))).toBe(true);
    expect(t.selection.range).toEqual({ startRow: 3, startCol: 1, endRow: 3, endCol: 2 });
    expect(t.nav.moveBody(key('ArrowUp'))).toBe(true);
    expect(t.nav.moveBody(key('ArrowLeft'))).toBe(true);
  });

  it('Home / End go to the row ends and, with Ctrl, to the corners', () => {
    const t = setup();
    t.selection.setActive(4, 2);
    t.nav.moveBody(key('Home'));
    expect(t.selection.activeCell).toEqual({ row: 4, col: 0 });
    t.nav.moveBody(key('End'));
    expect(t.selection.activeCell).toEqual({ row: 4, col: 3 });
    t.nav.moveBody(key('Home', { ctrlKey: true }));
    expect(t.selection.activeCell).toEqual({ row: 0, col: 0 });
    t.nav.moveBody(key('End', { ctrlKey: true }));
    expect(t.selection.activeCell).toEqual({ row: 9, col: 3 });
  });

  it('Tab walks the cells and is left alone off the last cell (and Shift+Tab off the first) so the grid lets go', () => {
    const t = setup();
    t.selection.setActive(0, 3);
    expect(t.nav.moveBody(key('Tab'))).toBe(true);
    expect(t.selection.activeCell).toEqual({ row: 1, col: 0 });
    expect(t.nav.moveBody(key('Tab', { shiftKey: true }))).toBe(true);
    expect(t.selection.activeCell).toEqual({ row: 0, col: 3 });

    t.selection.setActive(9, 3);
    expect(t.nav.moveBody(key('Tab'))).toBe(false);
    t.selection.setActive(0, 0);
    expect(t.nav.moveBody(key('Tab', { shiftKey: true }))).toBe(false);
  });

  it('takes no other key', () => {
    const t = setup();
    t.selection.setActive(1, 1);
    expect(t.nav.moveBody(key('a'))).toBe(false);
    expect(t.nav.moveBody(key('Enter'))).toBe(false);
    expect(t.selection.activeCell).toEqual({ row: 1, col: 1 });
  });
});

describe('KeyboardNavController — header row', () => {
  it('arrows step one and clamp at the ends; Home / End jump to them', () => {
    const t = setup();
    expect(t.nav.headerTarget(key('ArrowLeft'), 2, 5)).toBe(1);
    expect(t.nav.headerTarget(key('ArrowLeft'), 0, 5)).toBe(0);
    expect(t.nav.headerTarget(key('ArrowRight'), 2, 5)).toBe(3);
    expect(t.nav.headerTarget(key('ArrowRight'), 4, 5)).toBe(4);
    expect(t.nav.headerTarget(key('Home'), 3, 5)).toBe(0);
    expect(t.nav.headerTarget(key('End'), 1, 5)).toBe(4);
  });

  it('Alt+Arrow resizes rather than moves, and other keys are not movement', () => {
    const t = setup();
    expect(t.nav.headerTarget(key('ArrowLeft', { altKey: true }), 2, 5)).toBeNull();
    expect(t.nav.headerTarget(key('ArrowRight', { altKey: true }), 2, 5)).toBeNull();
    expect(t.nav.headerTarget(key('Enter'), 2, 5)).toBeNull();
    expect(t.nav.headerTarget(key('ArrowDown'), 2, 5)).toBeNull();
  });

  it('entering the header clears the body cursor first, then lands on the header cell and brings it into view', () => {
    const t = setup();
    t.selection.setActive(0, 2);
    const order: string[] = [];
    const nav = new KeyboardNavController({
      selection: t.selection,
      followSelection: () => { order.push(`follow:${t.selection.activeCell === null}`); },
      setHeaderCol: (c) => { order.push(`header:${c}`); },
      scrollColumnIntoView: (c) => { order.push(`scroll:${c}`); },
    });
    nav.enterHeader(2);
    expect(order).toEqual(['follow:true', 'header:2', 'scroll:2']);
  });

  it('returning to the body lands on the first row of that column; starting on an empty grid lands on the first cell', () => {
    const t = setup();
    t.nav.returnToBody(3);
    expect(t.selection.activeCell).toEqual({ row: 0, col: 3 });
    t.nav.startAtFirstCell();
    expect(t.selection.activeCell).toEqual({ row: 0, col: 0 });
    expect(t.calls.follow).toBe(2);
  });
});
