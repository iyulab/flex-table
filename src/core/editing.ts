import type { CellPosition } from './selection.js';

export interface EditState {
  position: CellPosition;
  originalValue: unknown;
}

/**
 * Manages cell editing state.
 */
export class EditingState {
  current: EditState | null = null;

  start(position: CellPosition, originalValue: unknown): void {
    this.current = { position, originalValue };
  }

  isEditing(row: number, col: number): boolean {
    return this.current !== null
      && this.current.position.row === row
      && this.current.position.col === col;
  }

  cancel(): EditState | null {
    const prev = this.current;
    this.current = null;
    return prev;
  }

  commit(): EditState | null {
    const prev = this.current;
    this.current = null;
    return prev;
  }
}
