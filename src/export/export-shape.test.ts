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
    for (const [type, value] of [['date', '2026-09-09'], ['datetime', '2026-09-09T08:16:01.123+09:00']] as const) {
      const xml = sheetXml(exportData([{ d: value }], [{ key: 'd', label: 'D', type }], 'xlsx') as Uint8Array);
      expect(cellA2(xml), type).toMatch(/s="1"/);
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
});
