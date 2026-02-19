import { describe, it, expect, vi } from 'vitest';
import { UndoStack } from './undo.js';

describe('UndoStack', () => {
  it('should start empty', () => {
    const stack = new UndoStack();
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
    expect(stack.undoCount).toBe(0);
    expect(stack.redoCount).toBe(0);
  });

  it('should push and undo', () => {
    const stack = new UndoStack();
    const undo = vi.fn();
    const redo = vi.fn();
    stack.push({ label: 'edit', undo, redo });

    expect(stack.canUndo).toBe(true);
    expect(stack.undoCount).toBe(1);

    const result = stack.undo();
    expect(result).toBe('edit');
    expect(undo).toHaveBeenCalledOnce();
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(true);
  });

  it('should redo after undo', () => {
    const stack = new UndoStack();
    const undo = vi.fn();
    const redo = vi.fn();
    stack.push({ label: 'edit', undo, redo });
    stack.undo();

    const result = stack.redo();
    expect(result).toBe('edit');
    expect(redo).toHaveBeenCalledOnce();
    expect(stack.canUndo).toBe(true);
    expect(stack.canRedo).toBe(false);
  });

  it('should clear redo on new push', () => {
    const stack = new UndoStack();
    stack.push({ label: 'a', undo: vi.fn(), redo: vi.fn() });
    stack.undo();
    expect(stack.canRedo).toBe(true);

    stack.push({ label: 'b', undo: vi.fn(), redo: vi.fn() });
    expect(stack.canRedo).toBe(false);
  });

  it('should return null when nothing to undo/redo', () => {
    const stack = new UndoStack();
    expect(stack.undo()).toBeNull();
    expect(stack.redo()).toBeNull();
  });

  it('should handle multiple undo/redo', () => {
    const stack = new UndoStack();
    let value = 0;
    stack.push({
      label: 'set 1',
      undo: () => { value = 0; },
      redo: () => { value = 1; },
    });
    value = 1;
    stack.push({
      label: 'set 2',
      undo: () => { value = 1; },
      redo: () => { value = 2; },
    });
    value = 2;

    stack.undo(); // value = 1
    expect(value).toBe(1);
    stack.undo(); // value = 0
    expect(value).toBe(0);
    stack.redo(); // value = 1
    expect(value).toBe(1);
    stack.redo(); // value = 2
    expect(value).toBe(2);
  });

  it('should respect max stack size', () => {
    const stack = new UndoStack();
    for (let i = 0; i < 150; i++) {
      stack.push({ label: `action-${i}`, undo: vi.fn(), redo: vi.fn() });
    }
    expect(stack.undoCount).toBe(100);
  });

  it('should allow configuring max size', () => {
    const stack = new UndoStack();
    stack.maxSize = 5;
    expect(stack.maxSize).toBe(5);

    for (let i = 0; i < 10; i++) {
      stack.push({ label: `action-${i}`, undo: vi.fn(), redo: vi.fn() });
    }
    expect(stack.undoCount).toBe(5);
  });

  it('should trim existing stack when reducing maxSize', () => {
    const stack = new UndoStack();
    for (let i = 0; i < 20; i++) {
      stack.push({ label: `action-${i}`, undo: vi.fn(), redo: vi.fn() });
    }
    expect(stack.undoCount).toBe(20);

    stack.maxSize = 5;
    expect(stack.undoCount).toBe(5);
  });

  it('should enforce minimum maxSize of 1', () => {
    const stack = new UndoStack();
    stack.maxSize = 0;
    expect(stack.maxSize).toBe(1);
    stack.maxSize = -5;
    expect(stack.maxSize).toBe(1);
  });

  it('should clear all history', () => {
    const stack = new UndoStack();
    stack.push({ label: 'a', undo: vi.fn(), redo: vi.fn() });
    stack.push({ label: 'b', undo: vi.fn(), redo: vi.fn() });
    stack.undo();
    stack.clear();
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
  });
});
