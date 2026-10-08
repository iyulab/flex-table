import { describe, it, expect } from 'vitest';
import { exportData } from './export.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';

const cols: ColumnDefinition[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'age', label: 'Age', type: 'number' },
  { key: 'active', label: 'Active', type: 'boolean' },
];

const data: DataRow[] = [
  { name: 'Alice', age: 30, active: true },
  { name: 'Bob', age: 25, active: false },
];

describe('exportData', () => {
  describe('csv', () => {
    it('should export with headers', () => {
      const result = exportData(data, cols, 'csv') as string;
      const lines = result.split('\n');
      expect(lines[0]).toBe('Name,Age,Active');
      expect(lines[1]).toBe('Alice,30,true');
      expect(lines[2]).toBe('Bob,25,false');
    });

    it('should escape commas in values', () => {
      const d: DataRow[] = [{ name: 'Doe, Jane', age: 20, active: true }];
      const result = exportData(d, cols, 'csv') as string;
      expect(result).toContain('"Doe, Jane"');
    });

    it('should escape quotes in values', () => {
      const d: DataRow[] = [{ name: 'He said "hi"', age: 20, active: true }];
      const result = exportData(d, cols, 'csv') as string;
      expect(result).toContain('"He said ""hi"""');
    });

    it('should handle null values', () => {
      const d: DataRow[] = [{ name: null, age: undefined, active: true }];
      const result = exportData(d, cols, 'csv') as string;
      const lines = result.split('\n');
      expect(lines[1]).toBe(',,true');
    });

    it('should handle empty data', () => {
      const result = exportData([], cols, 'csv') as string;
      expect(result).toBe('Name,Age,Active');
    });
  });

  describe('tsv', () => {
    it('should use tab delimiter', () => {
      const result = exportData(data, cols, 'tsv') as string;
      const lines = result.split('\n');
      expect(lines[0]).toBe('Name\tAge\tActive');
      expect(lines[1]).toBe('Alice\t30\ttrue');
    });
  });

  describe('json', () => {
    it('should export as JSON array', () => {
      const result = exportData(data, cols, 'json') as string;
      const parsed = JSON.parse(result);
      expect(parsed).toEqual([
        { name: 'Alice', age: 30, active: true },
        { name: 'Bob', age: 25, active: false },
      ]);
    });

    it('should only include column keys', () => {
      const d: DataRow[] = [{ name: 'Alice', age: 30, active: true, extra: 'hidden' }];
      const result = exportData(d, cols, 'json') as string;
      const parsed = JSON.parse(result);
      expect(parsed[0]).not.toHaveProperty('extra');
    });

    it('should handle null values', () => {
      const d: DataRow[] = [{ name: null, age: undefined, active: true }];
      const result = exportData(d, cols, 'json') as string;
      const parsed = JSON.parse(result);
      expect(parsed[0].name).toBeNull();
      expect(parsed[0].age).toBeNull();
    });
  });

  describe('dates in text formats — the wall clock the table shows', () => {
    const dateCols: ColumnDefinition[] = [
      { key: 'created', label: 'Created', type: 'date' },
      { key: 'updated', label: 'Updated', type: 'datetime' },
    ];
    const pad = (n: number) => String(n).padStart(2, '0');
    // 기대값은 이 프로세스의 시간대에서 센 벽시계다 — 어느 시간대에서 돌아도 같은 규칙을 잰다.
    const wall = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    it('🔴a UTC instant (OData `…Z`) is written as local wall-clock text, not as the UTC string', () => {
      const instant = '2026-09-05T06:54:57Z';
      const d: DataRow[] = [{ created: '2026-09-05', updated: instant }];
      for (const [format, sep] of [['csv', ','], ['tsv', '\t']] as const) {
        const lines = (exportData(d, dateCols, format) as string).split('\n');
        expect(lines[1]).toBe(`2026-09-05${sep}${wall(new Date(instant))}`);
      }
    });

    it('🔴a local-midnight `Date` in a date column stays on its day (no UTC shift to the day before)', () => {
      const d: DataRow[] = [{ created: new Date(2026, 9, 2), updated: new Date(2026, 9, 2, 14, 5, 9) }];
      const lines = (exportData(d, dateCols, 'csv') as string).split('\n');
      expect(lines[1]).toBe('2026-10-02,2026-10-02 14:05:09');
    });

    it('a `Date` from exportValue is wall-clock text too', () => {
      const cols: ColumnDefinition[] = [{ key: 'at', label: 'At', exportValue: (v) => new Date(v as number) }];
      const at = Date.UTC(2026, 0, 1, 23, 30, 0);
      const lines = (exportData([{ at }], cols, 'csv') as string).split('\n');
      expect(lines[1]).toBe(wall(new Date(at)));
    });

    it('NEGATIVE text in a date column that is not a date stays as it is', () => {
      const lines = (exportData([{ created: 'TBD', updated: 'soon' }], dateCols, 'csv') as string).split('\n');
      expect(lines[1]).toBe('TBD,soon');
    });

    it('should export Date objects as ISO 8601 in JSON', () => {
      const d: DataRow[] = [{ created: new Date('2024-03-15'), updated: new Date('2024-03-15T10:30:00Z') }];
      const result = exportData(d, dateCols, 'json') as string;
      const parsed = JSON.parse(result);
      expect(parsed[0].created).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(parsed[0].updated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('a date string without an offset is already wall clock — written in the same shape', () => {
      const d: DataRow[] = [{ created: '2024-03-15', updated: '2024-03-15T10:30:00' }];
      const result = exportData(d, dateCols, 'csv') as string;
      const lines = result.split('\n');
      expect(lines[1]).toBe('2024-03-15,2024-03-15 10:30:00');
    });
  });
});
