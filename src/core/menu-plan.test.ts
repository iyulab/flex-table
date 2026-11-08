import { describe, it, expect } from 'vitest';
import { headerMenuPlan, bodyMenuPlan, type BodyMenuState, type HeaderMenuState } from './menu-plan.js';

const body = (o: Partial<BodyMenuState> = {}): BodyMenuState => ({
  editable: true, canInsert: true, sortable: true, filterable: true, hasFilter: false, hasComment: false, ...o,
});
const header = (o: Partial<HeaderMenuState> = {}): HeaderMenuState => ({
  sortable: true, showFilters: true, filterable: true, hasFilter: false, hiddenNeighbors: 0, ...o,
});

describe('bodyMenuPlan', () => {
  it('lists everything for an editable table, one separator between groups and none at the ends', () => {
    expect(bodyMenuPlan(body())).toEqual([
      'copy', 'separator',
      'insert-above', 'insert-below', 'delete-row', 'separator',
      'hide', 'separator',
      'sort-asc', 'sort-desc', 'separator',
      'filter-value', 'separator',
      'comment',
    ]);
  });

  it('a read-only table offers no way to insert or delete a row — and no stray separator where they were', () => {
    const plan = bodyMenuPlan(body({ editable: false }));
    expect(plan).not.toContain('insert-above');
    expect(plan).not.toContain('insert-below');
    expect(plan).not.toContain('delete-row');
    expect(plan.slice(0, 3)).toEqual(['copy', 'separator', 'hide']);
    expect(plan.includes('separator') && plan.some((e, i) => e === 'separator' && plan[i + 1] === 'separator')).toBe(false);
  });

  it('a full table (maxRows reached) keeps «delete» but drops both inserts', () => {
    const plan = bodyMenuPlan(body({ canInsert: false }));
    expect(plan).toContain('delete-row');
    expect(plan).not.toContain('insert-above');
    expect(plan).not.toContain('insert-below');
  });

  it('a column that cannot sort or filter has no such entries; a set filter can always be cleared', () => {
    const none = bodyMenuPlan(body({ sortable: false, filterable: false }));
    expect(none).not.toContain('sort-asc');
    expect(none).not.toContain('filter-value');
    expect(none).not.toContain('clear-filter');
    expect(bodyMenuPlan(body({ filterable: false, hasFilter: true }))).toContain('clear-filter');
    expect(bodyMenuPlan(body({ filterable: false, hasFilter: true }))).not.toContain('filter-value');
  });

  it('a cell with a comment gets the delete entry after the edit entry', () => {
    const plan = bodyMenuPlan(body({ hasComment: true }));
    expect(plan.slice(-2)).toEqual(['comment', 'delete-comment']);
  });

  it('never starts or ends with a separator, whatever is switched off', () => {
    for (const editable of [true, false]) for (const sortable of [true, false]) for (const filterable of [true, false]) {
      const plan = bodyMenuPlan(body({ editable, sortable, filterable }));
      expect(plan[0]).not.toBe('separator');
      expect(plan[plan.length - 1]).not.toBe('separator');
    }
  });
});

describe('headerMenuPlan', () => {
  it('lists sort, filter, hide and width entries in groups', () => {
    expect(headerMenuPlan(header())).toEqual([
      'sort-asc', 'sort-desc', 'separator',
      'filter', 'separator',
      'hide', 'separator',
      'autofit', 'wider', 'narrower',
    ]);
  });

  it('adds one «show» per hidden neighbour, right after «hide»', () => {
    const plan = headerMenuPlan(header({ hiddenNeighbors: 2 }));
    const i = plan.indexOf('hide');
    expect(plan.slice(i, i + 4)).toEqual(['hide', 'show', 'show', 'separator']);
  });

  it('without filters shown there is no filter group (and no doubled separator)', () => {
    const plan = headerMenuPlan(header({ showFilters: false, hasFilter: true }));
    expect(plan).not.toContain('filter');
    expect(plan).not.toContain('clear-filter');
    expect(plan.some((e, i) => e === 'separator' && plan[i + 1] === 'separator')).toBe(false);
  });

  it('a filtered column that cannot be filtered again can still clear its filter', () => {
    const plan = headerMenuPlan(header({ filterable: false, hasFilter: true }));
    expect(plan).toContain('clear-filter');
    expect(plan).not.toContain('filter');
  });

  it('an unsortable column starts at the filter group', () => {
    expect(headerMenuPlan(header({ sortable: false }))[0]).toBe('filter');
  });
});
