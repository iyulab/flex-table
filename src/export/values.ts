import type { ColumnDefinition, DataRow } from '../models/types.js';
import { getCellValue } from '../core/cell-value.js';

/**
 * 내보낼 셀 값 — 열이 `exportValue` 를 주면 그 결과, 아니면 원시값. 표시 규칙(`format`·`render`)은 쓰지 않는다:
 * 원시값이 맞는 내보내기(다시 적재)가 있고, 라벨이 맞는 열은 그것을 열 스스로 말한다.
 */
export function exportCellValue(row: DataRow, col: ColumnDefinition): unknown {
  const raw = getCellValue(row, col.key);
  return col.exportValue ? col.exportValue(raw, row) : raw;
}

/**
 * 날짜로 내보낼 값이면 `Date` — 표시 경로(`@iyulab/components` `formatDate`)와 같은 규칙이다: `Date` 는 그대로, 날짜 열의
 * 문자열은 `YYYY-MM-DD` 면 그 날(로컬 달력), 아니면 ISO 로 읽는다. 읽지 못하면 `null`(글자로 남긴다 — 버리지 않는다).
 * JSON 으로 오는 소스(OData 포함)는 날짜가 문자열이라, 종전에는 날짜 열이어도 XLSX 에 글자 셀로 들어갔다.
 */
export function exportDate(value: unknown, col: ColumnDefinition): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' || (col.type !== 'date' && col.type !== 'datetime')) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Excel 직렬값 — **벽시계 시각**으로 센다(표가 보여 주는 로컬 날짜·시각과 같은 칸). 직렬값에는 시간대가 없어, UTC 시각으로
 * 세면 로컬 자정의 날짜가 UTC 와 다른 시간대(한국 +09)에서 전날 오후로 들어가 날짜 서식에 전날이 보였다.
 */
export function excelSerial(d: Date): number {
  const wall = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  return (wall - Date.UTC(1899, 11, 30)) / 86400000;
}
