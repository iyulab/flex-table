import type { SelectionState } from '../core/selection.js';

/** What the keyboard walk needs from the table — the controller knows where a key moves the cursor, the table acts on it. */
export interface KeyboardNavContext {
  selection: SelectionState;
  /** Makes the selection's active cell the table's (scrolled to, announced) and leaves the header row. */
  followSelection(): void;
  /** Puts the keyboard on a header cell, or takes it off the header row (`null`). */
  setHeaderCol(col: number | null): void;
  scrollColumnIntoView(col: number): void;
}

/** Where the keys move the cell cursor, in the body and along the header row. Reaching other things (editing, menus, sorting) is the table's. */
export class KeyboardNavController {
  constructor(private readonly ctx: KeyboardNavContext) {}

  /**
   * Moves the body cursor for an arrow, Tab, Home or End (Shift extends the range; Ctrl+Home / Ctrl+End go to the corners).
   * Returns whether the key was taken — a Tab off the last cell (Shift+Tab off the first) is not, so it leaves the grid
   * like any other Tab stop and the grid never keeps the focus (WCAG 2.1.2).
   */
  moveBody(e: KeyboardEvent): boolean {
    const sel = this.ctx.selection;
    switch (e.key) {
      case 'ArrowUp':
        e.shiftKey ? sel.shiftMoveUp() : sel.moveUp();
        return true;
      case 'ArrowDown':
        e.shiftKey ? sel.shiftMoveDown() : sel.moveDown();
        return true;
      case 'ArrowLeft':
        e.shiftKey ? sel.shiftMoveLeft() : sel.moveLeft();
        return true;
      case 'ArrowRight':
        e.shiftKey ? sel.shiftMoveRight() : sel.moveRight();
        return true;
      case 'Tab': {
        const from = sel.activeCell;
        const to = e.shiftKey ? sel.movePrev() : sel.moveNext();
        return !(from && to && from.row === to.row && from.col === to.col);
      }
      case 'Home':
        e.ctrlKey ? sel.moveToStart() : sel.moveToRowStart();
        return true;
      case 'End':
        e.ctrlKey ? sel.moveToEnd() : sel.moveToRowEnd();
        return true;
      default:
        return false;
    }
  }

  /**
   * The header cell a key moves to along the header row from column `at` of `count`: the arrows step one (clamped at the
   * ends), Home / End jump to the ends. `null` for any other key — and for Alt+Arrow, which resizes instead of moving.
   */
  headerTarget(e: KeyboardEvent, at: number, count: number): number | null {
    switch (e.key) {
      case 'ArrowLeft':
        return e.altKey ? null : Math.max(0, at - 1);
      case 'ArrowRight':
        return e.altKey ? null : Math.min(count - 1, at + 1);
      case 'Home':
        return 0;
      case 'End':
        return count - 1;
      default:
        return null;
    }
  }

  /** Moves the keyboard to header cell `col` and brings it into view. */
  goToHeader(col: number): void {
    this.ctx.setHeaderCol(col);
    this.ctx.scrollColumnIntoView(col);
  }

  /** From the body onto the header cell of visible column `col` (ArrowUp off the first row). */
  enterHeader(col: number): void {
    this.ctx.selection.clear();
    this.ctx.followSelection();
    this.goToHeader(col);
  }

  /** From the header back down onto the first row of column `col`. */
  returnToBody(col: number): void {
    this.ctx.selection.setActive(0, col);
    this.ctx.followSelection();
  }

  /** Puts the cursor on the first cell — the first navigation key on a grid with nothing active. */
  startAtFirstCell(): void {
    this.ctx.selection.setActive(0, 0);
    this.ctx.followSelection();
  }
}
