/**
 * Minimal XLSX reader — no external dependencies.
 * Reads OOXML (.xlsx) files using ZIP central directory + DOMParser.
 * Handles STORE (no compression) and DEFLATE compression.
 * Supports string, number, boolean, and date cell types.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed sheet data from an XLSX file */
export interface ImportedSheet {
  /** Column header strings from the first row */
  headers: string[];
  /** Data rows as raw string values (one string per cell) */
  rows: string[][];
}

// ---------------------------------------------------------------------------
// ZIP reader (central directory based)
// ---------------------------------------------------------------------------

interface CdEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

function findEocd(view: DataView): number {
  for (let i = view.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  throw new Error('XLSX: End of central directory not found — not a valid ZIP file');
}

function readCentralDirectory(view: DataView): CdEntry[] {
  const eocdOffset = findEocd(view);
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const cdSize = view.getUint32(eocdOffset + 12, true);

  const dec = new TextDecoder('utf-8');
  const entries: CdEntry[] = [];
  let pos = cdOffset;
  const end = cdOffset + cdSize;

  while (pos < end) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;
    const compressionMethod = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const uncompressedSize = view.getUint32(pos + 24, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localHeaderOffset = view.getUint32(pos + 42, true);
    const name = dec.decode(new Uint8Array(view.buffer, pos + 46, nameLen));
    entries.push({ name, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
    pos += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

async function decompressDeflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  writer.write(data);
  writer.close();

  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

async function extractEntry(view: DataView, entry: CdEntry): Promise<Uint8Array> {
  const lhOffset = entry.localHeaderOffset;
  const nameLen = view.getUint16(lhOffset + 26, true);
  const extraLen = view.getUint16(lhOffset + 28, true);
  const dataOffset = lhOffset + 30 + nameLen + extraLen;
  const compressed = new Uint8Array(view.buffer, dataOffset, entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return compressed.slice(); // STORE: copy as-is
  }
  if (entry.compressionMethod === 8) {
    return decompressDeflateRaw(compressed);
  }
  throw new Error(`XLSX: Unsupported compression method ${entry.compressionMethod}`);
}

async function readZipEntries(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const view = new DataView(buffer);
  const entries = readCentralDirectory(view);
  const result = new Map<string, Uint8Array>();
  for (const entry of entries) {
    if (entry.compressedSize === 0 && entry.name.endsWith('/')) continue; // directory
    result.set(entry.name, await extractEntry(view, entry));
  }
  return result;
}

// ---------------------------------------------------------------------------
// OOXML parser
// ---------------------------------------------------------------------------

const DEC = new TextDecoder('utf-8');

function parseXml(data: Uint8Array): Document {
  const xml = DEC.decode(data);
  return new DOMParser().parseFromString(xml, 'application/xml');
}

/** Parse xl/sharedStrings.xml → array of strings */
function parseSharedStrings(data: Uint8Array | undefined): string[] {
  if (!data) return [];
  const doc = parseXml(data);
  return Array.from(doc.querySelectorAll('si')).map(si => {
    // <t> elements may have xml:space="preserve"; concatenate all <t> text
    return Array.from(si.querySelectorAll('t'))
      .map(t => t.textContent ?? '')
      .join('');
  });
}

/** Convert Excel date serial to ISO date string */
function excelSerialToDateStr(serial: number): string {
  // Excel epoch: 1899-12-30 (accounting for Lotus 1-2-3 1900 leap year bug)
  const ms = (serial - 1) * 86400000 + Date.UTC(1899, 11, 30);
  return new Date(ms).toISOString().slice(0, 10);
}

/** Parse xl/worksheets/sheet1.xml → 2D string array (all rows including header) */
function parseSheet(data: Uint8Array, sst: string[]): string[][] {
  const doc = parseXml(data);
  const rowEls = doc.querySelectorAll('row');
  if (rowEls.length === 0) return [];

  // Determine max column from all cell refs
  let maxCol = 0;
  const rowMap = new Map<number, Map<number, string>>();

  for (const rowEl of rowEls) {
    const rowIdx = parseInt(rowEl.getAttribute('r') ?? '1', 10) - 1;
    const colMap = new Map<number, string>();
    rowMap.set(rowIdx, colMap);

    for (const cell of rowEl.querySelectorAll('c')) {
      const ref = cell.getAttribute('r') ?? '';
      const colIdx = cellRefToColIndex(ref);
      if (colIdx > maxCol) maxCol = colIdx;

      const t = cell.getAttribute('t') ?? '';
      const s = cell.getAttribute('s') ?? '';
      const v = cell.querySelector('v')?.textContent ?? '';
      const is = cell.querySelector('is > t')?.textContent ?? null; // inline string

      let value: string;

      if (t === 's') {
        // shared string
        value = sst[parseInt(v, 10)] ?? '';
      } else if (t === 'str' || t === 'inlineStr') {
        value = is ?? v;
      } else if (t === 'b') {
        value = v === '1' ? 'true' : 'false';
      } else if (v === '') {
        value = '';
      } else {
        // number or date — check style for date detection
        const numVal = parseFloat(v);
        if (!isNaN(numVal) && s !== '' && parseInt(s, 10) > 0) {
          // Heuristic: if style index > 0 and value looks like a date serial,
          // treat as date. We don't parse styles.xml here for simplicity.
          // Only apply for values in plausible date range (1 Jan 1900 to 31 Dec 2100).
          if (numVal >= 1 && numVal <= 73050) {
            value = excelSerialToDateStr(numVal);
          } else {
            value = v;
          }
        } else {
          value = v;
        }
      }

      colMap.set(colIdx, value);
    }
  }

  if (rowMap.size === 0) return [];

  const maxRow = Math.max(...rowMap.keys());
  const result: string[][] = [];

  for (let r = 0; r <= maxRow; r++) {
    const colMap = rowMap.get(r) ?? new Map();
    const row: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      row.push(colMap.get(c) ?? '');
    }
    result.push(row);
  }

  return result;
}

/** Convert cell ref like "A1", "BC3" to 0-based column index */
function cellRefToColIndex(ref: string): number {
  let col = 0;
  let i = 0;
  while (i < ref.length && ref[i] >= 'A' && ref[i] <= 'Z') {
    col = col * 26 + (ref.charCodeAt(i) - 64);
    i++;
  }
  return col - 1;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse an XLSX file buffer into a structured ImportedSheet.
 * The first row is treated as headers; subsequent rows are data.
 * All values are returned as raw strings — type coercion is left to the consumer.
 */
export async function readXlsx(buffer: ArrayBuffer): Promise<ImportedSheet> {
  const entries = await readZipEntries(buffer);

  const sstData = entries.get('xl/sharedStrings.xml');
  const sst = parseSharedStrings(sstData);

  // Find the first sheet
  let sheetData = entries.get('xl/worksheets/sheet1.xml');
  if (!sheetData) {
    // Try case-insensitive match
    for (const [key, val] of entries) {
      if (key.toLowerCase().includes('worksheets/sheet')) {
        sheetData = val;
        break;
      }
    }
  }
  if (!sheetData) throw new Error('XLSX: No worksheet found');

  const allRows = parseSheet(sheetData, sst);
  if (allRows.length === 0) return { headers: [], rows: [] };

  const headers = allRows[0];
  const rows = allRows.slice(1);

  return { headers, rows };
}
