/**
 * A single undoable action.
 */
export interface UndoAction {
  /** Human-readable label for debugging */
  label: string;
  /** Revert the action */
  undo: () => void;
  /** Re-apply the action */
  redo: () => void;
}

const MAX_UNDO_STACK = 100;

/**
 * Manages undo/redo history.
 */
export class UndoStack {
  private _undoStack: UndoAction[] = [];
  private _redoStack: UndoAction[] = [];

  get canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  get undoCount(): number {
    return this._undoStack.length;
  }

  get redoCount(): number {
    return this._redoStack.length;
  }

  /**
   * Push a new action onto the undo stack.
   * Clears the redo stack (new action invalidates redo history).
   */
  push(action: UndoAction): void {
    this._undoStack.push(action);
    if (this._undoStack.length > MAX_UNDO_STACK) {
      this._undoStack.shift();
    }
    this._redoStack.length = 0;
  }

  /**
   * Undo the most recent action.
   * Returns the action label, or null if nothing to undo.
   */
  undo(): string | null {
    const action = this._undoStack.pop();
    if (!action) return null;
    action.undo();
    this._redoStack.push(action);
    return action.label;
  }

  /**
   * Redo the most recently undone action.
   * Returns the action label, or null if nothing to redo.
   */
  redo(): string | null {
    const action = this._redoStack.pop();
    if (!action) return null;
    action.redo();
    this._undoStack.push(action);
    return action.label;
  }

  /**
   * Clear all undo/redo history.
   */
  clear(): void {
    this._undoStack.length = 0;
    this._redoStack.length = 0;
  }
}
