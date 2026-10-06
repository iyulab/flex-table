import { describe, it, expect } from 'vitest';
import './flex-table.js';
import type { SortCriteria } from './core/sorting.js';
import type { CellPosition } from './core/selection.js';

/**
 * Listeners on `<flex-table>` get the event map's detail types — before, every event reached a
 * TypeScript listener as a plain `Event` (and the React wrapper's `on*` props as `CustomEvent<any>`).
 * The assignments below are the test: `npm run typecheck` fails if the overloads stop applying.
 */
describe('typed events', () => {
  it('addEventListener gives the detail type from FlexTableEventMap', () => {
    const table = document.createElement('flex-table');
    const seen: SortCriteria[][] = [];
    table.addEventListener('sort-change', (e) => {
      const criteria: SortCriteria[] = e.detail.criteria;
      seen.push(criteria);
    });
    table.addEventListener('cell-select', (e) => {
      const position: CellPosition | null = e.detail;
      void position;
    });
    // Native events keep their own types.
    table.addEventListener('keydown', (e) => {
      const key: string = e.key;
      void key;
    });
    table.dispatchEvent(new CustomEvent('sort-change', { detail: { criteria: [{ key: 'a', direction: 'asc' }] } }));
    expect(seen).toEqual([[{ key: 'a', direction: 'asc' }]]);
  });
});
