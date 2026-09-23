import { describe, it, expect } from 'vitest';
import { readXlsx } from './xlsx-reader.js';
import { buildXlsx } from './xlsx-writer.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';

// Round-trip test data (write with xlsx-writer, read with xlsx-reader)
const cols: ColumnDefinition[] = [
  { key: 'name', header: 'Name', type: 'text' },
  { key: 'age', header: 'Age', type: 'number' },
  { key: 'active', header: 'Active', type: 'boolean' },
];

const data: DataRow[] = [
  { name: 'Alice', age: 30, active: true },
  { name: 'Bob', age: 25, active: false },
  { name: 'Charlie', age: 40, active: true },
];

function xlsxBuffer(d: DataRow[], c: ColumnDefinition[]): ArrayBuffer {
  return buildXlsx(d, c).buffer as ArrayBuffer;
}

describe('readXlsx', () => {
  it('should return correct headers', async () => {
    const buf = xlsxBuffer(data, cols);
    const sheet = await readXlsx(buf);
    expect(sheet.headers).toEqual(['Name', 'Age', 'Active']);
  });

  it('should return correct row count', async () => {
    const buf = xlsxBuffer(data, cols);
    const sheet = await readXlsx(buf);
    expect(sheet.rows).toHaveLength(3);
  });

  it('should read text cell values', async () => {
    const buf = xlsxBuffer(data, cols);
    const sheet = await readXlsx(buf);
    expect(sheet.rows[0][0]).toBe('Alice');
    expect(sheet.rows[1][0]).toBe('Bob');
    expect(sheet.rows[2][0]).toBe('Charlie');
  });

  it('should read number cell values as strings', async () => {
    const buf = xlsxBuffer(data, cols);
    const sheet = await readXlsx(buf);
    expect(sheet.rows[0][1]).toBe('30');
    expect(sheet.rows[1][1]).toBe('25');
    expect(sheet.rows[2][1]).toBe('40');
  });

  it('should read boolean cell values as "true"/"false"', async () => {
    const buf = xlsxBuffer(data, cols);
    const sheet = await readXlsx(buf);
    expect(sheet.rows[0][2]).toBe('true');
    expect(sheet.rows[1][2]).toBe('false');
    expect(sheet.rows[2][2]).toBe('true');
  });

  it('should handle empty data (headers only)', async () => {
    const buf = xlsxBuffer([], cols);
    const sheet = await readXlsx(buf);
    expect(sheet.headers).toEqual(['Name', 'Age', 'Active']);
    expect(sheet.rows).toHaveLength(0);
  });

  it('should handle single column', async () => {
    const singleCol: ColumnDefinition[] = [{ key: 'id', header: 'ID', type: 'number' }];
    const singleData: DataRow[] = [{ id: 1 }, { id: 2 }];
    const buf = xlsxBuffer(singleData, singleCol);
    const sheet = await readXlsx(buf);
    expect(sheet.headers).toEqual(['ID']);
    expect(sheet.rows[0][0]).toBe('1');
    expect(sheet.rows[1][0]).toBe('2');
  });

  it('should handle null/undefined cell values', async () => {
    const d: DataRow[] = [{ name: null, age: undefined, active: true }];
    const buf = xlsxBuffer(d, cols);
    const sheet = await readXlsx(buf);
    expect(sheet.rows[0][0]).toBe('');
    expect(sheet.rows[0][2]).toBe('true');
  });

  it('should handle special characters in strings', async () => {
    const d: DataRow[] = [{ name: 'A & B < C > D "E"', age: 1, active: true }];
    const buf = xlsxBuffer(d, cols);
    const sheet = await readXlsx(buf);
    expect(sheet.rows[0][0]).toBe('A & B < C > D "E"');
  });

  it('should handle large datasets (100 rows)', async () => {
    const bigData: DataRow[] = Array.from({ length: 100 }, (_, i) => ({
      name: `Name${i}`,
      age: i,
      active: i % 2 === 0,
    }));
    const buf = xlsxBuffer(bigData, cols);
    const sheet = await readXlsx(buf);
    expect(sheet.rows).toHaveLength(100);
    expect(sheet.rows[50][0]).toBe('Name50');
    expect(sheet.rows[99][1]).toBe('99');
  });

  it('should handle many columns (10 columns)', async () => {
    const manyCols: ColumnDefinition[] = Array.from({ length: 10 }, (_, i) => ({
      key: `col${i}`,
      header: `Col${i}`,
      type: 'text' as const,
    }));
    const manyData: DataRow[] = [
      Object.fromEntries(manyCols.map(c => [c.key, `val_${c.key}`])),
    ];
    const buf = xlsxBuffer(manyData, manyCols);
    const sheet = await readXlsx(buf);
    expect(sheet.headers).toHaveLength(10);
    expect(sheet.rows[0][9]).toBe('val_col9');
  });
});

// ── 날짜는 «스타일의 숫자 형식» 이 정한다 ────────────────────────────────────────
// 종전 판정은 «스타일 인덱스 > 0 이고 1~73050» 이었다 — 굵은 글씨·천 단위 구분·통화 형식이 붙은
// 숫자(실무 스프레드시트의 거의 모든 숫자)가 날짜가 됐고, 날짜 자체도 하루 앞당겨졌다.
import { buildZip } from './xlsx-writer.js';

const enc = new TextEncoder();
function workbook({ cells, numFmts = '', xfs, date1904 = false }: {
  cells: string; numFmts?: string; xfs: string[]; date1904?: boolean;
}): ArrayBuffer {
  const files = [
    { name: '[Content_Types].xml', data: enc.encode('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>') },
    { name: 'xl/workbook.xml', data: enc.encode(`<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${date1904 ? '<workbookPr date1904="1"/>' : '<workbookPr/>'}<sheets><sheet name="S" sheetId="1"/></sheets></workbook>`) },
    { name: 'xl/styles.xml', data: enc.encode(`<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${numFmts ? `<numFmts>${numFmts}</numFmts>` : ''}<cellXfs count="${xfs.length}">${xfs.map((id) => `<xf numFmtId="${id}" fontId="0"/>`).join('')}</cellXfs></styleSheet>`) },
    { name: 'xl/worksheets/sheet1.xml', data: enc.encode(`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>H</t></is></c></row><row r="2">${cells}</row></sheetData></worksheet>`) },
  ];
  return buildZip(files).buffer as ArrayBuffer;
}
const secondRow = async (buf: ArrayBuffer) => (await readXlsx(buf)).rows[0];

describe('readXlsx — dates come from the cell style\'s number format', () => {
  it('🔴keeps styled numbers as numbers — bold, thousands separator, currency, percent', async () => {
    const buf = workbook({
      // xf 0 General · 1 General (bold 등 — 형식은 같다) · 2 #,##0 · 3 통화(사용자) · 4 0%
      xfs: ['0', '0', '3', '164', '9'],
      numFmts: '<numFmt numFmtId="164" formatCode="[$₩-412]#,##0"/>',
      cells: '<c r="A2" s="1"><v>12450</v></c><c r="B2" s="2"><v>30</v></c><c r="C2" s="3"><v>45000</v></c><c r="D2" s="4"><v>0.25</v></c>',
    });
    expect(await secondRow(buf)).toEqual(['12450', '30', '45000', '0.25']);
  });

  it('reads built-in date formats as ISO dates (14 · 22)', async () => {
    const buf = workbook({ xfs: ['0', '14', '22'], cells: '<c r="A2" s="1"><v>46288</v></c><c r="B2" s="2"><v>46288.5</v></c>' });
    expect(await secondRow(buf)).toEqual(['2026-09-23', '2026-09-23']);
  });

  it('reads custom date formats — and ignores date letters inside quotes or brackets', async () => {
    const buf = workbook({
      xfs: ['0', '164', '165', '166'],
      numFmts: '<numFmt numFmtId="164" formatCode="yyyy&quot;년&quot; m&quot;월&quot; d&quot;일&quot;"/>'
        + '<numFmt numFmtId="165" formatCode="0.0 &quot;days&quot;"/>'
        + '<numFmt numFmtId="166" formatCode="[Red][$-409]#,##0"/>',
      cells: '<c r="A2" s="1"><v>46288</v></c><c r="B2" s="2"><v>12.5</v></c><c r="C2" s="3"><v>7</v></c>',
    });
    expect(await secondRow(buf)).toEqual(['2026-09-23', '12.5', '7']);
  });

  it('treats an escaped date letter as a literal, not a token', async () => {
    const buf = workbook({ xfs: ['0', '164'], numFmts: '<numFmt numFmtId="164" formatCode="0\\d"/>', cells: '<c r="A2" s="1"><v>3</v></c>' });
    expect(await secondRow(buf)).toEqual(['3']);
  });

  it('keeps time-only formats as numbers — there is no date to show', async () => {
    const buf = workbook({ xfs: ['0', '20', '46'], cells: '<c r="A2" s="1"><v>0.5</v></c><c r="B2" s="2"><v>1.25</v></c>' });
    expect(await secondRow(buf)).toEqual(['0.5', '1.25']);
  });

  it('🔴round-trips a date exported by buildXlsx on the same day, not the day before', async () => {
    const d = new Date(Date.UTC(2026, 8, 23));
    const buf = buildXlsx([{ when: d }], [{ key: 'when', header: 'When', type: 'date' }]).buffer as ArrayBuffer;
    expect((await readXlsx(buf)).rows[0][0]).toBe('2026-09-23');
  });

  it('honors the 1904 date system', async () => {
    // 1904 체계에서 44826 = 2026-09-23 (1900 체계보다 1462 일 적다)
    const buf = workbook({ xfs: ['0', '14'], date1904: true, cells: '<c r="A2" s="1"><v>44826</v></c>' });
    expect(await secondRow(buf)).toEqual(['2026-09-23']);
  });

  it('treats numbers as numbers when styles.xml is absent', async () => {
    const buf = buildZip([
      { name: 'xl/worksheets/sheet1.xml', data: enc.encode('<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>H</t></is></c></row><row r="2"><c r="A2" s="1"><v>46288</v></c></row></sheetData></worksheet>') },
    ]).buffer as ArrayBuffer;
    expect(await secondRow(buf)).toEqual(['46288']);
  });
});
