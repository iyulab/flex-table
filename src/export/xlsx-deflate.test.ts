import { describe, it, expect } from 'vitest';
import { readXlsx } from './xlsx-reader.js';
import { buildXlsx, buildXlsxDeflated } from './xlsx-writer.js';
import { exportDataBlob } from './export.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';

/**
 * 압축 내보내기(DEFLATE) — 같은 통합 문서를 더 작게. 동기 `buildXlsx`(STORE)는 그대로다.
 * 압축은 플랫폼 `CompressionStream('deflate-raw')` 이고, 읽기 쪽(`readXlsx`)이 `DecompressionStream` 으로 푼다.
 */
const cols: ColumnDefinition[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'qty', label: 'Qty', type: 'number' },
  { key: 'ok', label: 'OK', type: 'boolean' },
];
const rows: DataRow[] = Array.from({ length: 500 }, (_, i) => ({ name: `Item ${i % 17}`, qty: i, ok: i % 2 === 0 }));

/** 중앙 디렉터리의 항목별 압축 방식(0 STORE · 8 DEFLATE). */
function methods(bytes: Uint8Array): number[] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: number[] = [];
  for (let i = 0; i + 4 <= bytes.length; i++) if (v.getUint32(i, true) === 0x02014b50) out.push(v.getUint16(i + 10, true));
  return out;
}

describe('XLSX DEFLATE', () => {
  it('🔴같은 내용을 읽어 낸다 — 왕복', async () => {
    const sheet = await readXlsx((await buildXlsxDeflated(rows, cols)).buffer as ArrayBuffer);
    expect(sheet.headers).toEqual(['Name', 'Qty', 'OK']);
    expect(sheet.rows).toHaveLength(500);
    expect(sheet.rows[499]).toEqual(['Item 6', '499', 'false']);
  });

  it('🔴STORE 보다 작다 — 반복이 많은 시트는 크게 준다', async () => {
    const stored = buildXlsx(rows, cols).length;
    const packed = (await buildXlsxDeflated(rows, cols)).length;
    expect(packed).toBeLessThan(stored / 4);
  });

  it('워크시트는 DEFLATE 로 실린다(방식 8)', async () => {
    expect(methods(await buildXlsxDeflated(rows, cols))).toContain(8);
  });

  it('NEGATIVE 동기 buildXlsx 는 STORE 그대로다(방식 0 뿐)', () => {
    expect(new Set(methods(buildXlsx(rows, cols)))).toEqual(new Set([0]));
  });

  it('exportDataBlob 은 xlsx MIME 의 압축본을 낸다 · 텍스트 형식은 문자열 그대로', async () => {
    const x = await exportDataBlob(rows, cols, 'xlsx');
    expect(x.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(x.size).toBe((await buildXlsxDeflated(rows, cols)).length);
    const csv = await exportDataBlob(rows.slice(0, 1), cols, 'csv');
    expect(await csv.text()).toBe('Name,Qty,OK\nItem 0,0,true');
  });
});
