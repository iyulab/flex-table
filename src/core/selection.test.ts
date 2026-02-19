import { describe, it, expect, beforeEach } from 'vitest';
import { SelectionState } from './selection.js';

describe('SelectionState', () => {
  let state: SelectionState;

  beforeEach(() => {
    state = new SelectionState();
    state.setDimensions(10, 5); // 10 rows, 5 columns
  });

  it('should start with no active cell', () => {
    expect(state.activeCell).toBeNull();
  });

  it('should set active cell', () => {
    state.setActive(3, 2);
    expect(state.activeCell).toEqual({ row: 3, col: 2 });
  });

  it('should not set active cell out of bounds', () => {
    state.setActive(3, 2);
    state.setActive(-1, 0);
    expect(state.activeCell).toEqual({ row: 3, col: 2 });
    state.setActive(0, -1);
    expect(state.activeCell).toEqual({ row: 3, col: 2 });
    state.setActive(10, 0);
    expect(state.activeCell).toEqual({ row: 3, col: 2 });
    state.setActive(0, 5);
    expect(state.activeCell).toEqual({ row: 3, col: 2 });
  });

  it('should move up', () => {
    state.setActive(3, 2);
    state.moveUp();
    expect(state.activeCell).toEqual({ row: 2, col: 2 });
  });

  it('should not move up past first row', () => {
    state.setActive(0, 2);
    state.moveUp();
    expect(state.activeCell).toEqual({ row: 0, col: 2 });
  });

  it('should move down', () => {
    state.setActive(3, 2);
    state.moveDown();
    expect(state.activeCell).toEqual({ row: 4, col: 2 });
  });

  it('should not move down past last row', () => {
    state.setActive(9, 2);
    state.moveDown();
    expect(state.activeCell).toEqual({ row: 9, col: 2 });
  });

  it('should move right', () => {
    state.setActive(3, 2);
    state.moveRight();
    expect(state.activeCell).toEqual({ row: 3, col: 3 });
  });

  it('should move left', () => {
    state.setActive(3, 2);
    state.moveLeft();
    expect(state.activeCell).toEqual({ row: 3, col: 1 });
  });

  it('should wrap on moveNext (Tab)', () => {
    state.setActive(0, 4); // last column
    state.moveNext();
    expect(state.activeCell).toEqual({ row: 1, col: 0 }); // next row, first column
  });

  it('should wrap on movePrev (Shift+Tab)', () => {
    state.setActive(1, 0); // first column
    state.movePrev();
    expect(state.activeCell).toEqual({ row: 0, col: 4 }); // prev row, last column
  });

  it('should move to start (Ctrl+Home)', () => {
    state.setActive(5, 3);
    state.moveToStart();
    expect(state.activeCell).toEqual({ row: 0, col: 0 });
  });

  it('should move to end (Ctrl+End)', () => {
    state.setActive(0, 0);
    state.moveToEnd();
    expect(state.activeCell).toEqual({ row: 9, col: 4 });
  });

  it('should move to row start (Home)', () => {
    state.setActive(3, 3);
    state.moveToRowStart();
    expect(state.activeCell).toEqual({ row: 3, col: 0 });
  });

  it('should move to row end (End)', () => {
    state.setActive(3, 1);
    state.moveToRowEnd();
    expect(state.activeCell).toEqual({ row: 3, col: 4 });
  });

  it('should clear selection', () => {
    state.setActive(3, 2);
    state.clear();
    expect(state.activeCell).toBeNull();
  });
});
