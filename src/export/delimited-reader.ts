import { decodeDelimited } from '@iyulab/components/dist/utilities/tsv.js';
import type { ImportedSheet } from './xlsx-reader.js';

const CANDIDATES = [',', ';', '\t'] as const;

/**
 * The separator a CSV file uses — `,` or, as Excel writes it on locales whose decimal mark is a comma, `;` (a tab
 * also counts). Counted on the first line outside quotes; the most frequent wins, and `,` when none appears.
 */
export function detectDelimiter(text: string): string {
  const counts = new Map<string, number>(CANDIDATES.map(c => [c, 0]));
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === '\n' || ch === '\r')) break;
    else if (!quoted && counts.has(ch)) counts.set(ch, counts.get(ch)! + 1);
  }
  let best = ',';
  let most = 0;
  for (const [c, n] of counts) if (n > most) { best = c; most = n; }
  return best;
}

/**
 * A CSV or TSV file as a header row and data rows. The byte-order mark a spreadsheet-bound export starts with
 * (`exportToFile` writes one) is not part of the first header.
 */
export function readDelimited(text: string, kind: 'csv' | 'tsv'): ImportedSheet {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = decodeDelimited(body, kind === 'tsv' ? '\t' : detectDelimiter(body));
  return { headers: rows[0] ?? [], rows: rows.slice(1) };
}
