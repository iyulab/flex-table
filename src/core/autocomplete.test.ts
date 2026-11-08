import { describe, it, expect } from 'vitest';
import { AUTOCOMPLETE_LIMIT, autocompleteCandidates, columnHasValue, stepAutocomplete } from './autocomplete.js';

const rows = (values: unknown[]) => values.map((tag) => ({ tag }));

describe('autocompleteCandidates', () => {
  it('lists the distinct matching values in row order', () => {
    const data = rows(['apple', 'apricot', 'apple', 'banana']);
    expect(autocompleteCandidates(data, 'tag', 'ap')).toEqual(['apple', 'apricot']);
  });

  it('lists every distinct value for empty text, skipping missing ones', () => {
    const data = rows(['b', null, 'a', undefined, 'b']);
    expect(autocompleteCandidates(data, 'tag', '')).toEqual(['b', 'a']);
  });

  it('stops at the limit', () => {
    const data = rows(Array.from({ length: 50 }, (_, i) => `v${i}`));
    expect(autocompleteCandidates(data, 'tag', '')).toHaveLength(AUTOCOMPLETE_LIMIT);
    expect(autocompleteCandidates(data, 'tag', '', false, 5)).toEqual(['v0', 'v1', 'v2', 'v3', 'v4']);
  });

  it('compares the number values by their text', () => {
    expect(autocompleteCandidates(rows([10, 100, 20]), 'tag', '10')).toEqual(['10', '100']);
  });
});

describe('columnHasValue', () => {
  it('finds a value anywhere in the column, past the suggestion limit', () => {
    const data = rows(Array.from({ length: 50 }, (_, i) => `v${i}`));
    expect(columnHasValue(data, 'tag', 'v49')).toBe(true);
    expect(autocompleteCandidates(data, 'tag', '')).not.toContain('v49');
  });

  it('compares by text and does not match a missing value or another one', () => {
    const data = rows([7, null, 'x']);
    expect(columnHasValue(data, 'tag', '7')).toBe(true);
    expect(columnHasValue(data, 'tag', 7)).toBe(true);
    expect(columnHasValue(data, 'tag', 'y')).toBe(false);
    expect(columnHasValue(data, 'tag', 'null')).toBe(false);
  });
});

describe('stepAutocomplete', () => {
  const state = { candidates: ['a', 'b', 'c'], activeIndex: -1 };

  it('Down steps toward the last and stops there', () => {
    const one = stepAutocomplete(state, 1);
    expect(one.activeIndex).toBe(0);
    expect(stepAutocomplete({ ...state, activeIndex: 2 }, 1).activeIndex).toBe(2);
  });

  it('Up steps toward none and stops there', () => {
    expect(stepAutocomplete({ ...state, activeIndex: 1 }, -1).activeIndex).toBe(0);
    expect(stepAutocomplete({ ...state, activeIndex: 0 }, -1).activeIndex).toBe(-1);
    expect(stepAutocomplete(state, -1).activeIndex).toBe(-1);
  });

  it('returns a new state and keeps the candidates', () => {
    const next = stepAutocomplete(state, 1);
    expect(next).not.toBe(state);
    expect(next.candidates).toBe(state.candidates);
    expect(state.activeIndex).toBe(-1);
  });
});
