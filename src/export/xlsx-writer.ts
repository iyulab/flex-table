/**
 * Minimal XLSX writer — no external dependencies.
 * Generates OOXML (.xlsx) files — ZIP STORE (sync) or DEFLATE (async, platform CompressionStream).
 * Supports string, number, boolean, and date cell types.
 */

import type { ColumnDefinition, DataRow } from '../models/types.js';
import { exportCellValue, exportDate, excelSerial } from './values.js';

// ---------------------------------------------------------------------------
// CRC32
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ---------------------------------------------------------------------------
// ZIP builder — STORE(동기) · DEFLATE(비동기, 플랫폼 CompressionStream)
// ---------------------------------------------------------------------------

const ENC = new TextEncoder();

export interface ZipFile { name: string; data: Uint8Array }

/** 압축 방식이 정해진 항목 — `body` 는 실제로 쓰이는 바이트(STORE 면 원본, DEFLATE 면 압축본). */
interface ZipEntry { name: string; data: Uint8Array; body: Uint8Array; method: 0 | 8 }

/** @internal 테스트가 실물에 가까운 통합 문서(스타일·1904 날짜 체계)를 조립하는 데 쓴다. */
export function buildZip(files: ZipFile[]): Uint8Array<ArrayBuffer> {
  return assembleZip(files.map(f => ({ ...f, body: f.data, method: 0 })));
}

/**
 * DEFLATE 로 압축한 ZIP. 항목마다 압축본이 원본보다 작을 때만 DEFLATE 를 쓰고, 아니면 STORE 로 둔다.
 * 압축은 플랫폼 `CompressionStream('deflate-raw')` 라 비동기다 — 읽기 쪽이 이미 `DecompressionStream` 을 쓴다.
 */
export async function buildZipDeflated(files: ZipFile[]): Promise<Uint8Array<ArrayBuffer>> {
  const entries: ZipEntry[] = [];
  for (const f of files) {
    const packed = await deflateRaw(f.data);
    entries.push(packed.length < f.data.length
      ? { ...f, body: packed, method: 8 }
      : { ...f, body: f.data, method: 0 });
  }
  return assembleZip(entries);
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();
  void writer.write(data as Uint8Array<ArrayBuffer>);
  void writer.close();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return concat(chunks);
}

function assembleZip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  for (const f of entries) {
    const nameBytes = ENC.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;
    const packedSize = f.body.length;
    const version = f.method === 8 ? 20 : 10;
    const dosTime = 0x0000; // 00:00:00
    const dosDate = 0x0021; // 1980-01-01

    // Local File Header
    const local = new ArrayBuffer(30 + nameBytes.length);
    const lv = new DataView(local);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, version, true);    // version needed
    lv.setUint16(6, 0, true);          // flags
    lv.setUint16(8, f.method, true);   // compression: 0 STORE · 8 DEFLATE
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, packedSize, true); // compressed size
    lv.setUint32(22, size, true);       // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);         // extra length
    new Uint8Array(local, 30).set(nameBytes);
    parts.push(new Uint8Array(local));
    parts.push(f.body);

    // Central Directory Header
    const cd = new ArrayBuffer(46 + nameBytes.length);
    const cv = new DataView(cd);
    cv.setUint32(0, 0x02014b50, true); // signature
    cv.setUint16(4, 20, true);         // version made by
    cv.setUint16(6, version, true);    // version needed
    cv.setUint16(8, 0, true);
    cv.setUint16(10, f.method, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, packedSize, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);         // extra
    cv.setUint16(32, 0, true);         // comment
    cv.setUint16(34, 0, true);         // disk start
    cv.setUint16(36, 0, true);         // internal attr
    cv.setUint32(38, 0, true);         // external attr
    cv.setUint32(42, offset, true);    // local header offset
    new Uint8Array(cd, 46).set(nameBytes);
    centralDir.push(new Uint8Array(cd));

    offset += 30 + nameBytes.length + packedSize;
  }

  const cdData = concat(centralDir);
  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true); // EOCD signature
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdData.length, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return concat([...parts, cdData, new Uint8Array(eocd)]);
}

function concat(arrays: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let i = 0;
  for (const a of arrays) { out.set(a, i); i += a.length; }
  return out;
}

// ---------------------------------------------------------------------------
// XLSX XML generators
// ---------------------------------------------------------------------------

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Convert 0-based column index to spreadsheet letter (0→A, 25→Z, 26→AA) */
function colLetter(n: number): string {
  let s = '';
  n++;
  while (n > 0) {
    s = String.fromCharCode(64 + (n % 26 || 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellRef(row: number, col: number): string {
  return colLetter(col) + (row + 1);
}

/** Excel date: days since 1900-01-00 (with Lotus 1-2-3 bug: 1900 is treated as leap year) */

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

// Style 1 = date format (numFmtId 14 = mm-dd-yy, but we use 164 custom yyyy-mm-dd)
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts>
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><sz val="11"/><b/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
</styleSheet>`;

function buildWorksheet(data: DataRow[], columns: ColumnDefinition[]): string {
  const rows: string[] = [];

  // Header row (style 2 = bold)
  const headerCells = columns.map((col, ci) => {
    const ref = cellRef(0, ci);
    return `<c r="${ref}" t="str" s="2"><v>${xmlEscape(col.label)}</v></c>`;
  });
  rows.push(`<row r="1">${headerCells.join('')}</row>`);

  // Data rows
  data.forEach((row, ri) => {
    const cells = columns.map((col, ci) => {
      const ref = cellRef(ri + 1, ci);
      const value = exportCellValue(row, col);

      if (value == null) return `<c r="${ref}" t="str"><v></v></c>`;

      const type = col.type ?? 'text';

      if (type === 'number' && typeof value === 'number') {
        return `<c r="${ref}"><v>${value}</v></c>`;
      }

      // 날짜 열의 ISO 문자열도 날짜 셀이다(표가 그것을 날짜로 보이듯) · `exportValue` 가 돌려준 `Date` 도.
      const date = exportDate(value, col);
      if (date) {
        const serial = excelSerial(date).toFixed(6);
        return `<c r="${ref}" s="1"><v>${serial}</v></c>`;
      }

      if (type === 'boolean') {
        return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
      }

      // Default: string
      return `<c r="${ref}" t="str"><v>${xmlEscape(String(value))}</v></c>`;
    });
    rows.push(`<row r="${ri + 2}">${cells.join('')}</row>`);
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rows.join('')}</sheetData>
</worksheet>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build an XLSX file as a Uint8Array.
 */
export function buildXlsx(data: DataRow[], columns: ColumnDefinition[]): Uint8Array<ArrayBuffer> {
  return buildZip(xlsxParts(data, columns));
}

/** Build a DEFLATE-compressed XLSX file — the same workbook as `buildXlsx`, a fraction of the size. */
export function buildXlsxDeflated(data: DataRow[], columns: ColumnDefinition[]): Promise<Uint8Array<ArrayBuffer>> {
  return buildZipDeflated(xlsxParts(data, columns));
}

function xlsxParts(data: DataRow[], columns: ColumnDefinition[]): ZipFile[] {
  const sheet = buildWorksheet(data, columns);
  return [
    { name: '[Content_Types].xml', data: ENC.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: ENC.encode(RELS) },
    { name: 'xl/workbook.xml', data: ENC.encode(WORKBOOK) },
    { name: 'xl/_rels/workbook.xml.rels', data: ENC.encode(WORKBOOK_RELS) },
    { name: 'xl/worksheets/sheet1.xml', data: ENC.encode(sheet) },
    { name: 'xl/styles.xml', data: ENC.encode(STYLES) },
  ];
}
