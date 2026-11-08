import { Locale } from '@iyulab/components/dist/utilities/Locale.js';
import { getCellValue } from './cell-value.js';
import type { DataRow } from '../models/types.js';

/** How many suggestions the dropdown offers. */
export const AUTOCOMPLETE_LIMIT = 20;

/** The suggestion list open under a cell editor, and which one the arrow keys are on (`-1` = none). */
export interface AutocompleteState {
  candidates: string[];
  activeIndex: number;
}

/**
 * The distinct values of column `key` that match `text`, in row order, at most `limit` — what the dropdown suggests.
 * `composing` — the last syllable of `text` is still being composed by an IME (the match then compares jamo prefixes).
 */
export function autocompleteCandidates(
  rows: readonly DataRow[],
  key: string,
  text: string,
  composing = false,
  limit = AUTOCOMPLETE_LIMIT,
): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const row of rows) {
    const v = getCellValue(row, key);
    if (v == null) continue;
    const s = String(v);
    if (!seen.has(s) && (text === '' || Locale.matchesSearch(s, text, { composing }))) {
      seen.add(s);
      results.push(s);
      if (results.length >= limit) break;
    }
  }
  return results;
}

/**
 * Whether `value` is one of the column's values — the check behind `autocomplete: 'strict'`. It looks at the whole column:
 * the suggestion list is capped, so asking it would turn away every value past the first twenty.
 */
export function columnHasValue(rows: readonly DataRow[], key: string, value: unknown): boolean {
  const wanted = String(value);
  for (const row of rows) {
    const v = getCellValue(row, key);
    if (v != null && String(v) === wanted) return true;
  }
  return false;
}

/** The arrow keys over the suggestion list: Down steps toward the last (stopping there), Up toward "none" (`-1`). */
export function stepAutocomplete(state: AutocompleteState, direction: 1 | -1): AutocompleteState {
  const activeIndex = direction === 1
    ? Math.min(state.activeIndex + 1, state.candidates.length - 1)
    : Math.max(state.activeIndex - 1, -1);
  return { ...state, activeIndex };
}
