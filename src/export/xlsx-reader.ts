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

async function decompressDeflateRaw(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
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

async function extractEntry(view: DataView<ArrayBuffer>, entry: CdEntry): Promise<Uint8Array<ArrayBuffer>> {
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

async function readZipEntries(buffer: ArrayBuffer): Promise<Map<string, Uint8Array<ArrayBuffer>>> {
  const view = new DataView(buffer);
  const entries = readCentralDirectory(view);
  const result = new Map<string, Uint8Array<ArrayBuffer>>();
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

/**
 * 날짜 형식인 내장 숫자 형식 ID(ECMA-376 Part 1 §18.8.30).
 * 14–17·22 는 어느 로캘에서나 날짜이고, 27–31·36·50–54·57–58 은 동아시아 로캘의 날짜 형식이다.
 * ⚠시간만 있는 형식(18–21·32–35·45–47·55–56)은 넣지 않는다 — 날짜 부분이 없는 값을 ISO 날짜로
 *   바꾸면 없는 사실을 만든다.
 */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 36, 50, 51, 52, 53, 54, 57, 58]);

/**
 * 사용자 형식 코드가 날짜를 그리는가 — 첫 구역에 일(`d`)·연(`y`) 토큰이 있는가.
 * 따옴표 안 글자(`0.0 "days"`)·이스케이프(`\d`)·대괄호(`[Red]`·`[$-409]`)는 토큰이 아니므로 먼저 걷는다.
 * ⚠`m` 만으로는 판정하지 않는다 — 월과 분이 같은 글자다.
 */
function isDateFormatCode(code: string): boolean {
  const first = code
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .replace(/\[[^\]]*\]/g, '')
    .split(';')[0];
  return /[dy]/i.test(first);
}

/** styles.xml → 날짜 형식을 가진 셀 스타일(`cellXfs` 의 인덱스) 집합. 없으면 빈 집합(=날짜 없음). */
function parseDateStyles(data: Uint8Array | undefined): Set<number> {
  const result = new Set<number>();
  if (!data) return result;
  const doc = parseXml(data);
  const custom = new Map<number, string>();
  for (const f of Array.from(doc.querySelectorAll('numFmts > numFmt'))) {
    custom.set(parseInt(f.getAttribute('numFmtId') ?? '', 10), f.getAttribute('formatCode') ?? '');
  }
  Array.from(doc.querySelectorAll('cellXfs > xf')).forEach((xf, index) => {
    const id = parseInt(xf.getAttribute('numFmtId') ?? '0', 10);
    const code = custom.get(id);
    if (code !== undefined ? isDateFormatCode(code) : BUILTIN_DATE_FORMATS.has(id)) result.add(index);
  });
  return result;
}

/** workbook.xml 의 `workbookPr/@date1904` — 맥에서 만든 통합 문서는 1904-01-01 이 0 이다. */
function usesDate1904(data: Uint8Array | undefined): boolean {
  if (!data) return false;
  const v = parseXml(data).querySelector('workbookPr')?.getAttribute('date1904');
  return v === '1' || v === 'true';
}

/**
 * 날짜 일련번호 → ISO 날짜. 1900 체계는 1899-12-30 이 0 이다(1900-02-29 라는 없는 날을 세는 Lotus
 * 호환 버그를 이 기준점이 흡수한다 — 1900-03-01 이후는 정확하다). 시각 부분은 버린다.
 */
function excelSerialToDateStr(serial: number, date1904: boolean): string {
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return new Date(epoch + Math.floor(serial) * 86400000).toISOString().slice(0, 10);
}

/** Parse xl/worksheets/sheet1.xml → 2D string array (all rows including header) */
function parseSheet(data: Uint8Array, sst: string[], dateStyles: Set<number>, date1904: boolean): string[][] {
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
        // 숫자 — 날짜인지는 셀 스타일의 숫자 형식이 정한다(값의 크기가 아니라).
        const numVal = parseFloat(v);
        const isDate = s !== '' && dateStyles.has(parseInt(s, 10)) && !isNaN(numVal) && numVal >= 0;
        value = isDate ? excelSerialToDateStr(numVal, date1904) : v;
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

  const dateStyles = parseDateStyles(entries.get('xl/styles.xml'));
  const date1904 = usesDate1904(entries.get('xl/workbook.xml'));
  const allRows = parseSheet(sheetData, sst, dateStyles, date1904);
  if (allRows.length === 0) return { headers: [], rows: [] };

  const headers = allRows[0];
  const rows = allRows.slice(1);

  return { headers, rows };
}
