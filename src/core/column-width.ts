/** Width of a column that declares none and has not been measured yet (no rows rendered), in px. */
export const DEFAULT_COL_WIDTH = 120;

/** Narrowest a column can be resized to when it declares no `minWidth`, in px. */
export const MIN_COL_WIDTH = 40;

/** Widest a column that declares no `width` sizes itself to from its content, in px — a long value is cut, not the table. */
export const AUTO_MAX_COL_WIDTH = 320;

/**
 * The width each group of cells needs to show its content unclipped, in px (border box, rounded up).
 * Cells are laid out at a fixed width; each is set to `max-content` for the reading and put back, so the
 * reading is the content's own width, narrower or wider than the cell. All groups are set before any is
 * read, so the page lays out once. A group with nothing rendered reads 0.
 */
export function naturalWidths(groups: readonly (readonly HTMLElement[])[]): number[] {
  const saved = groups.map(cells => cells.map(cell => cell.style.width));
  for (const cells of groups) for (const cell of cells) cell.style.width = 'max-content';
  const widths = groups.map(cells => cells.reduce((max, cell) => Math.max(max, Math.ceil(cell.getBoundingClientRect().width)), 0));
  groups.forEach((cells, g) => cells.forEach((cell, i) => { cell.style.width = saved[g][i]; }));
  return widths;
}

/**
 * Divides `spare` px among columns in proportion to their `grow` — whole pixels, the remainder to the last growing
 * column, so the columns fill the space exactly and no fraction opens a scrollbar. Returns the extra width per index
 * (0 for a column that does not grow). Nothing to divide, or nothing growing: all zeros.
 */
export function growShares(grows: readonly number[], spare: number): number[] {
  const shares = grows.map(() => 0);
  const total = grows.reduce((sum, g) => sum + (g > 0 ? g : 0), 0);
  if (spare <= 0 || total <= 0) return shares;
  const whole = Math.floor(spare);
  let given = 0;
  let last = -1;
  grows.forEach((g, i) => {
    if (g <= 0) return;
    shares[i] = Math.floor((whole * g) / total);
    given += shares[i];
    last = i;
  });
  shares[last] += whole - given;
  return shares;
}
