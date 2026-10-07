import type { CellPosition } from './selection.js';
import type { DataRow } from '../models/types.js';

export interface EditState {
  /** Where the editor is drawn — the visual cell. The grid moves it when the view moves the row. */
  position: CellPosition;
  originalValue: unknown;
  /** The row being edited — the commit writes it, wherever `data` has moved it. */
  row: DataRow;
  /** What the editor held when the row moved and the editor was drawn again — handed to the new one. */
  draft?: unknown;
}

/**
 * Manages cell editing state.
 */
export class EditingState {
  current: EditState | null = null;

  start(position: CellPosition, originalValue: unknown, row: DataRow): void {
    this.current = { position, originalValue, row };
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
