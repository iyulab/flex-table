/**
 * Represents the active cell position.
 */
export interface CellPosition {
  row: number;
  col: number;
}

/**
 * A rectangular range of cells.
 */
export interface CellRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

/**
 * Returns normalized range (start <= end).
 */
export function normalizeRange(range: CellRange): CellRange {
  return {
    startRow: Math.min(range.startRow, range.endRow),
    startCol: Math.min(range.startCol, range.endCol),
    endRow: Math.max(range.startRow, range.endRow),
    endCol: Math.max(range.startCol, range.endCol),
  };
}

/**
 * Manages active cell state and range selection.
 */
export class SelectionState {
  activeCell: CellPosition | null = null;
  /** Anchor cell for range selection (Shift+Arrow/Click) */
  rangeAnchor: CellPosition | null = null;
  /** Current range end (the active cell is the range end during Shift selection) */
  range: CellRange | null = null;

  private _rowCount = 0;
  private _colCount = 0;

  setDimensions(rowCount: number, colCount: number): void {
    this._rowCount = rowCount;
    this._colCount = colCount;
  }

  setActive(row: number, col: number): CellPosition | null {
    if (row < 0 || row >= this._rowCount || col < 0 || col >= this._colCount) {
      return this.activeCell;
    }
    this.activeCell = { row, col };
    this.rangeAnchor = null;
    this.range = null;
    return this.activeCell;
  }

  /** Set active cell and extend range from anchor */
  setActiveWithRange(row: number, col: number): CellPosition | null {
    if (row < 0 || row >= this._rowCount || col < 0 || col >= this._colCount) {
      return this.activeCell;
    }
    if (!this.rangeAnchor && this.activeCell) {
      this.rangeAnchor = { ...this.activeCell };
    }
    this.activeCell = { row, col };
    if (this.rangeAnchor) {
      this.range = normalizeRange({
        startRow: this.rangeAnchor.row,
        startCol: this.rangeAnchor.col,
        endRow: row,
        endCol: col,
      });
    }
    return this.activeCell;
  }

  /** Check if a cell is within the current selection range */
  isInRange(row: number, col: number): boolean {
    if (!this.range) return false;
    const r = this.range;
    return row >= r.startRow && row <= r.endRow && col >= r.startCol && col <= r.endCol;
  }

  /** Get the effective range: either the explicit range or just the active cell */
  getEffectiveRange(): CellRange | null {
    if (this.range) return this.range;
    if (this.activeCell) {
      return {
        startRow: this.activeCell.row,
        startCol: this.activeCell.col,
        endRow: this.activeCell.row,
        endCol: this.activeCell.col,
      };
    }
    return null;
  }

  clear(): void {
    this.activeCell = null;
    this.rangeAnchor = null;
    this.range = null;
  }

  moveUp(): CellPosition | null {
    if (!this.activeCell) return null;
    return this.setActive(this.activeCell.row - 1, this.activeCell.col);
  }

  moveDown(): CellPosition | null {
    if (!this.activeCell) return null;
    return this.setActive(this.activeCell.row + 1, this.activeCell.col);
  }

  moveLeft(): CellPosition | null {
    if (!this.activeCell) return null;
    return this.setActive(this.activeCell.row, this.activeCell.col - 1);
  }

  moveRight(): CellPosition | null {
    if (!this.activeCell) return null;
    return this.setActive(this.activeCell.row, this.activeCell.col + 1);
  }

  moveNext(): CellPosition | null {
    if (!this.activeCell) return null;
    let { row, col } = this.activeCell;
    col++;
    if (col >= this._colCount) {
      col = 0;
      row++;
    }
    if (row >= this._rowCount) return this.activeCell;
    return this.setActive(row, col);
  }

  movePrev(): CellPosition | null {
    if (!this.activeCell) return null;
    let { row, col } = this.activeCell;
    col--;
    if (col < 0) {
      col = this._colCount - 1;
      row--;
    }
    if (row < 0) return this.activeCell;
    return this.setActive(row, col);
  }

  moveToStart(): CellPosition | null {
    return this.setActive(0, 0);
  }

  moveToEnd(): CellPosition | null {
    return this.setActive(this._rowCount - 1, this._colCount - 1);
  }

  moveToRowStart(): CellPosition | null {
    if (!this.activeCell) return null;
    return this.setActive(this.activeCell.row, 0);
  }

  moveToRowEnd(): CellPosition | null {
    if (!this.activeCell) return null;
    return this.setActive(this.activeCell.row, this._colCount - 1);
  }

  // Shift variants for range selection
  shiftMoveUp(): CellPosition | null {
    if (!this.activeCell) return null;
    return this.setActiveWithRange(this.activeCell.row - 1, this.activeCell.col);
  }

  shiftMoveDown(): CellPosition | null {
    if (!this.activeCell) return null;
    return this.setActiveWithRange(this.activeCell.row + 1, this.activeCell.col);
  }

  shiftMoveLeft(): CellPosition | null {
    if (!this.activeCell) return null;
    return this.setActiveWithRange(this.activeCell.row, this.activeCell.col - 1);
  }

  shiftMoveRight(): CellPosition | null {
    if (!this.activeCell) return null;
    return this.setActiveWithRange(this.activeCell.row, this.activeCell.col + 1);
  }
}
