import { readDateValue } from '@iyulab/components/dist/utilities/dateValue.js';

/** Text shaped like an ISO date (`YYYY-MM-DD…`) — when the strict reader rejects it, the day does not exist. */
const ISO_SHAPED = /^\s*\d{4}-\d{2}-\d{2}/;

/**
 * A cell value read as a moment — the rule the display path (`@iyulab/components` `formatDate`) uses, so a
 * cell sorts, filters and formats as it shows. A `Date` is itself; a number is an epoch time; text is read by
 * kind (`readDateValue`): a plain date is local midnight (not UTC midnight — `new Date('2026-10-02')` is the
 * day before in negative offsets), a plain date-time its wall clock, an instant that moment. ISO-shaped text
 * that names no real day (`2026-02-30`) is `null` rather than a rolled-over date; other text goes to the
 * platform parser. `null` when nothing reads.
 */
export function readCellDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value !== 'string') return null;
  const read = readDateValue(value);
  if (read) return read.date;
  if (ISO_SHAPED.test(value)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
