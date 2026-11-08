/**
 * Which entries the table's two built-in menus show, decided apart from the DOM.
 *
 * The host renders the menus and wires each entry to its action; the rules for *which* entries appear
 * (a read-only table has no row insert or delete, a full table cannot insert, a column that cannot sort has
 * no sort entries) live here so they can be tested without a rendered table.
 */

/** A group of entries; groups are joined by one separator and an empty group leaves no separator behind. */
export type MenuPlan<A extends string> = Array<A | 'separator'>;

export type HeaderMenuAction = 'sort-asc' | 'sort-desc' | 'filter' | 'clear-filter' | 'hide' | 'show' | 'autofit' | 'wider' | 'narrower';

export interface HeaderMenuState {
  /** The column sorts (`sortable !== false`). */
  sortable: boolean;
  /** The table shows filters at all (`showFilters`). */
  showFilters: boolean;
  /** The column can be filtered (`filterable !== false`). */
  filterable: boolean;
  /** A filter is set on this column. */
  hasFilter: boolean;
  /** Hidden columns next to this one — each gets a «show» entry, in order. */
  hiddenNeighbors: number;
}

export type BodyMenuAction =
  | 'copy'
  | 'insert-above'
  | 'insert-below'
  | 'delete-row'
  | 'hide'
  | 'sort-asc'
  | 'sort-desc'
  | 'filter-value'
  | 'clear-filter'
  | 'comment'
  | 'delete-comment';

export interface BodyMenuState {
  /** The table is editable (`editable`) — a read-only table offers no way to add or delete rows. */
  editable: boolean;
  /** Another row fits (`maxRows` not reached). */
  canInsert: boolean;
  sortable: boolean;
  filterable: boolean;
  hasFilter: boolean;
  /** The cell already has a comment (the entry then edits it and a delete entry follows). */
  hasComment: boolean;
}

function join<A extends string>(groups: A[][]): MenuPlan<A> {
  const out: MenuPlan<A> = [];
  for (const group of groups) {
    if (group.length === 0) continue;
    if (out.length) out.push('separator');
    out.push(...group);
  }
  return out;
}

/** The column menu (opened from the header). */
export function headerMenuPlan(s: HeaderMenuState): MenuPlan<HeaderMenuAction> {
  const filters: HeaderMenuAction[] = [];
  if (s.showFilters && s.filterable) filters.push('filter');
  if (s.showFilters && s.hasFilter) filters.push('clear-filter');
  return join<HeaderMenuAction>([
    s.sortable ? ['sort-asc', 'sort-desc'] : [],
    filters,
    ['hide', ...Array<HeaderMenuAction>(s.hiddenNeighbors).fill('show')],
    ['autofit', 'wider', 'narrower'],
  ]);
}

/** The cell context menu (opened from a body cell). */
export function bodyMenuPlan(s: BodyMenuState): MenuPlan<BodyMenuAction> {
  const rows: BodyMenuAction[] = [];
  if (s.editable) {
    if (s.canInsert) rows.push('insert-above', 'insert-below');
    rows.push('delete-row');
  }
  const filters: BodyMenuAction[] = [];
  if (s.filterable) filters.push('filter-value');
  if (s.hasFilter) filters.push('clear-filter');
  return join<BodyMenuAction>([
    ['copy'],
    rows,
    ['hide'],
    s.sortable ? ['sort-asc', 'sort-desc'] : [],
    filters,
    s.hasComment ? ['comment', 'delete-comment'] : ['comment'],
  ]);
}
