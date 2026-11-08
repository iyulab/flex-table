import { parseDate, parseDateTime } from '@iyulab/components/dist/utilities/format.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';
import { columnHasValue } from './autocomplete.js';

/** The messages the checks report in the table's language. */
export type EditMessageKey = 'notInList' | 'notANumber' | 'notADate' | 'notADateTime';

/** Why an edit was turned away. `live` re-reads the message when the language changes (the cell keeps showing it). */
export interface EditProblem {
  message: string;
  live?: () => string;
}

/**
 * Checks a value typed or picked into a cell before it is written, in the order the table applies them:
 * `autocomplete: 'strict'` needs a value the column already holds; a number, date or datetime column keeps
 * text it cannot read for a paste but not for an edit — the person typing into the cell is told instead; then the
 * column's own `validator`. An empty value passes the first check (it is the cell being cleared). `null` = fine.
 */
export function validateEdit(
  col: ColumnDefinition,
  value: unknown,
  rows: readonly DataRow[],
  target: DataRow,
  translate: (key: EditMessageKey) => string,
): EditProblem | null {
  const translated = (key: EditMessageKey): EditProblem => ({ message: translate(key), live: () => translate(key) });

  if (col.autocomplete === 'strict' && value != null && value !== '' && !columnHasValue(rows, col.key, value)) {
    return translated('notInList');
  }

  if (col.type === 'number' && typeof value === 'string') return translated('notANumber');
  if (col.type === 'date' && typeof value === 'string' && parseDate(value) === null) return translated('notADate');
  if (col.type === 'datetime' && typeof value === 'string' && parseDateTime(value) === null) return translated('notADateTime');

  if (col.validator) {
    const error = col.validator(value, target, col);
    if (error) return { message: error };
  }
  return null;
}
