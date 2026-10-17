import { describe, it, expect } from 'vitest';
import { exportData } from './export.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';

/**
 * 내보낸 파일의 «모양» 이 목록이 보여 주는 것과 같다.
 *
 * ⑴ CSV/TSV 는 BOM 을 붙일 수 있다 — 없으면 Excel(비 UTF-8 시스템 코드 페이지)이 한글을 깨뜨린다.
 * ⑵ 날짜 열의 ISO 문자열(JSON 으로 오는 모든 소스 — OData 포함)은 XLSX 에 날짜 셀로 — 표가 그것을 날짜로 보이듯.
 * ⑶ Excel 직렬값은 벽시계 시각 — 로컬 자정은 정수(종전 UTC 로 세어 +09 에서 전날 오후가 됐다).
 * ⑷ 열이 `exportValue` 로 «내보낼 값» 을 말한다(코드 → 라벨).
 */

/** STORE(무압축) XLSX 의 시트 XML 을 글자로 — 압축하지 않은 바이트 안에 그대로 있다. */
function sheetXml(bytes: Uint8Array): string {
  const text = new TextDecoder('latin1').decode(bytes);
  const start = text.indexOf('<worksheet');
  return text.slice(start, text.indexOf('</worksheet>', start));
}

/** STORE XLSX 의 스타일 XML(서식 코드에 한글이 있으므로 UTF-8 로 읽는다). */
function stylesXml(bytes: Uint8Array): string {
  const text = new TextDecoder().decode(bytes);
  const start = text.indexOf('<styleSheet');
  return text.slice(start, text.indexOf('</styleSheet>', start));
}

/** A2 셀의 XML. */
const cellA2 = (xml: string) => /<c r="A2"[^>]*>(?:<v>[^<]*<\/v>)?<\/c>/.exec(xml)?.[0] ?? '';

describe('export file shape', () => {
  const rows: DataRow[] = [{ name: '홍길동', status: 'InProgress' }];
  const cols: ColumnDefinition[] = [
    { key: 'name', label: '이름' },
    { key: 'status', label: '상태' },
  ];

  it('⑴ CSV/TSV start with a BOM when asked — NEGATIVE not by default', () => {
    expect((exportData(rows, cols, 'csv', { bom: true }) as string).startsWith('﻿이름,상태')).toBe(true);
    expect((exportData(rows, cols, 'tsv', { bom: true }) as string).startsWith('﻿')).toBe(true);
    expect((exportData(rows, cols, 'csv') as string).startsWith('이름')).toBe(true);
    expect((exportData(rows, cols, 'json', { bom: true }) as string).startsWith('[')).toBe(true);
  });

  it('⑵ an ISO string in a date/datetime column is a date cell in XLSX', () => {
    // 날짜는 스타일 1(yyyy-mm-dd) · 날짜-시각은 스타일 3(yyyy-mm-dd hh:mm:ss) — 종전에는 둘 다 1 이라 시각이 파일에서 보이지 않았다.
    for (const [type, value, style] of [['date', '2026-09-09', 1], ['datetime', '2026-09-09T08:16:01.123+09:00', 3]] as const) {
      const xml = sheetXml(exportData([{ d: value }], [{ key: 'd', label: 'D', type }], 'xlsx') as Uint8Array);
      expect(cellA2(xml), type).toMatch(new RegExp(`s="${style}"`));
    }
  });

  it('⑵ NEGATIVE — a string in a text column, and an unreadable date string, stay text', () => {
    const text = sheetXml(exportData([{ d: '2026-09-09' }], [{ key: 'd', label: 'D' }], 'xlsx') as Uint8Array);
    expect(cellA2(text)).toMatch(/t="str"/);
    const bad = sheetXml(exportData([{ d: 'soon' }], [{ key: 'd', label: 'D', type: 'date' }], 'xlsx') as Uint8Array);
    expect(cellA2(bad)).toMatch(/t="str"/);
    expect(bad).toContain('soon');
  });

  it('⑶ the serial is wall-clock time — a local midnight is a whole day', () => {
    const xml = sheetXml(exportData([{ d: new Date(2026, 8, 9) }], [{ key: 'd', label: 'D', type: 'date' }], 'xlsx') as Uint8Array);
    const serial = Number(/<v>([^<]+)<\/v>/.exec(cellA2(xml))?.[1]);
    expect(serial).toBe((Date.UTC(2026, 8, 9) - Date.UTC(1899, 11, 30)) / 86400000);
    // date-only 문자열도 같은 날이다(표의 표시 규칙 — 그 날의 로컬 자정).
    const fromString = sheetXml(exportData([{ d: '2026-09-09' }], [{ key: 'd', label: 'D', type: 'date' }], 'xlsx') as Uint8Array);
    expect(Number(/<v>([^<]+)<\/v>/.exec(cellA2(fromString))?.[1])).toBe(serial);
  });

  it('⑷ exportValue says what to write — CSV, JSON and XLSX; NEGATIVE other columns stay raw', () => {
    const labelled: ColumnDefinition[] = [
      { key: 'name', label: '이름' },
      { key: 'status', label: '상태', exportValue: (v) => (v === 'InProgress' ? '진행 중' : String(v)) },
    ];
    expect(exportData(rows, labelled, 'csv') as string).toBe('이름,상태\n홍길동,진행 중');
    expect(JSON.parse(exportData(rows, labelled, 'json') as string)).toEqual([{ name: '홍길동', status: '진행 중' }]);
    // XLSX 의 글자는 UTF-8 이라 latin1 로 읽지 않고 원시 코드가 없음을 잰다.
    const xml = sheetXml(exportData(rows, labelled, 'xlsx') as Uint8Array);
    expect(xml).not.toContain('InProgress');
  });

  it('⑷ an exportValue that returns a Date is a date cell', () => {
    const c: ColumnDefinition[] = [{ key: 'at', label: 'At', exportValue: (v) => new Date(Number(v)) }];
    const xml = sheetXml(exportData([{ at: Date.UTC(2026, 0, 2) }], c, 'xlsx') as Uint8Array);
    expect(cellA2(xml)).toMatch(/s="1"/);
  });

  it('⑸ a column format travels into the file as its number format — the file shows what the list shows', () => {
    const cols5: ColumnDefinition[] = [
      { key: 'amt', label: 'Amt', type: 'number', format: '#,##0;[Red](#,##0)' },
      { key: 'won', label: 'Won', type: 'number', format: '#,##0원' },
      { key: 'again', label: 'Again', type: 'number', format: '#,##0;[Red](#,##0)' },
      { key: 'at', label: 'At', type: 'date', format: 'yyyy/MM/dd' },
      { key: 'fn', label: 'Fn', type: 'number', format: (v) => String(v) },
      { key: 'plain', label: 'Plain', type: 'number' },
    ];
    const bytes = exportData([{ amt: -1234, won: 5, again: 7, at: '2026-09-09', fn: 1, plain: 2 }], cols5, 'xlsx') as Uint8Array;
    const styles = stylesXml(bytes);
    expect(styles).toContain('formatCode="#,##0;[Red](#,##0)"');
    expect(styles).toContain('formatCode="#,##0원"');
    expect(styles).toContain('formatCode="yyyy/mm/dd"');
    expect(styles.split('formatCode="#,##0;[Red](#,##0)"')).toHaveLength(2); // 같은 코드는 한 번만 등록
    const xml = sheetXml(bytes);
    const styleOf = (ref: string) => new RegExp(`<c r="${ref}"(?: s="(\\d+)")?`).exec(xml)?.[1];
    expect(styleOf('A2')).toBe(styleOf('C2'));
    expect(Number(styleOf('A2'))).toBeGreaterThanOrEqual(4);
    expect(Number(styleOf('B2'))).toBeGreaterThanOrEqual(4);
    expect(Number(styleOf('D2'))).toBeGreaterThanOrEqual(4);
    // NEGATIVE — 함수 서식과 서식 없는 숫자 열은 General
    expect(styleOf('E2')).toBeUndefined();
    expect(styleOf('F2')).toBeUndefined();
  });

  it('⑸ a styled file reads back the raw values — a [Red] number is not taken for a date', async () => {
    const { readXlsx } = await import('./xlsx-reader.js');
    const bytes = exportData([{ amt: -1234, at: '2026-09-09' }], [
      { key: 'amt', label: 'Amt', type: 'number', format: '#,##0;[Red](#,##0)' },
      { key: 'at', label: 'At', type: 'date', format: 'yyyy/MM/dd' },
    ], 'xlsx') as Uint8Array;
    const sheet = await readXlsx(bytes.slice().buffer);
    expect(sheet.rows[0]).toEqual(['-1234', '2026-09-09']);
  });
});
