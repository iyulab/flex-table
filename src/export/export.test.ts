import { describe, it, expect } from 'vitest';
import { exportData } from './export.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';

const cols: ColumnDefinition[] = [
  { key: 'name', header: 'Name', type: 'text' },
  { key: 'age', header: 'Age', type: 'number' },
  { key: 'active', header: 'Active', type: 'boolean' },
];

const data: DataRow[] = [
  { name: 'Alice', age: 30, active: true },
  { name: 'Bob', age: 25, active: false },
];

describe('exportData', () => {
  describe('csv', () => {
    it('should export with headers', () => {
      const result = exportData(data, cols, 'csv');
      const lines = result.split('\n');
      expect(lines[0]).toBe('Name,Age,Active');
      expect(lines[1]).toBe('Alice,30,true');
      expect(lines[2]).toBe('Bob,25,false');
    });

    it('should escape commas in values', () => {
      const d: DataRow[] = [{ name: 'Doe, Jane', age: 20, active: true }];
      const result = exportData(d, cols, 'csv');
      expect(result).toContain('"Doe, Jane"');
    });

    it('should escape quotes in values', () => {
      const d: DataRow[] = [{ name: 'He said "hi"', age: 20, active: true }];
      const result = exportData(d, cols, 'csv');
      expect(result).toContain('"He said ""hi"""');
    });

    it('should handle null values', () => {
      const d: DataRow[] = [{ name: null, age: undefined, active: true }];
      const result = exportData(d, cols, 'csv');
      const lines = result.split('\n');
      expect(lines[1]).toBe(',,true');
    });

    it('should handle empty data', () => {
      const result = exportData([], cols, 'csv');
      expect(result).toBe('Name,Age,Active');
    });
  });

  describe('tsv', () => {
    it('should use tab delimiter', () => {
      const result = exportData(data, cols, 'tsv');
      const lines = result.split('\n');
      expect(lines[0]).toBe('Name\tAge\tActive');
      expect(lines[1]).toBe('Alice\t30\ttrue');
    });
  });

  describe('json', () => {
    it('should export as JSON array', () => {
      const result = exportData(data, cols, 'json');
      const parsed = JSON.parse(result);
      expect(parsed).toEqual([
        { name: 'Alice', age: 30, active: true },
        { name: 'Bob', age: 25, active: false },
      ]);
    });

    it('should only include column keys', () => {
      const d: DataRow[] = [{ name: 'Alice', age: 30, active: true, extra: 'hidden' }];
      const result = exportData(d, cols, 'json');
      const parsed = JSON.parse(result);
      expect(parsed[0]).not.toHaveProperty('extra');
    });

    it('should handle null values', () => {
      const d: DataRow[] = [{ name: null, age: undefined, active: true }];
      const result = exportData(d, cols, 'json');
      const parsed = JSON.parse(result);
      expect(parsed[0].name).toBeNull();
      expect(parsed[0].age).toBeNull();
    });
  });
});
