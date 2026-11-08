import { describe, it, expect } from 'vitest';
import type { ColumnDefinition } from '../models/types.js';
import { validateEdit, type EditMessageKey } from './edit-validation.js';

const tr = (key: EditMessageKey) => `msg:${key}`;
const rows = [{ tag: 'a' }, { tag: 'b' }];
const check = (col: ColumnDefinition, value: unknown, target = rows[0]) => validateEdit(col, value, rows, target, tr);

describe('validateEdit — strict list', () => {
  const col: ColumnDefinition = { key: 'tag', label: 'Tag', autocomplete: 'strict' };

  it('turns away a value the column does not hold, with a message that follows the language', () => {
    const problem = check(col, 'zzz');
    expect(problem?.message).toBe('msg:notInList');
    expect(problem?.live?.()).toBe('msg:notInList');
  });

  it('accepts a value the column holds, and an empty or cleared one', () => {
    expect(check(col, 'b')).toBeNull();
    expect(check(col, '')).toBeNull();
    expect(check(col, null)).toBeNull();
  });

  it('does not apply to a column that is not strict', () => {
    expect(check({ key: 'tag', label: 'Tag', autocomplete: true }, 'zzz')).toBeNull();
    expect(check({ key: 'tag', label: 'Tag' }, 'zzz')).toBeNull();
  });
});

describe('validateEdit — unreadable text', () => {
  it('a number column rejects text but takes a number or an empty value', () => {
    const col: ColumnDefinition = { key: 'n', label: 'N', type: 'number' };
    expect(check(col, 'abc')?.message).toBe('msg:notANumber');
    expect(check(col, 12)).toBeNull();
    expect(check(col, null)).toBeNull();
  });

  it('a date column rejects text it cannot read and takes a date', () => {
    const col: ColumnDefinition = { key: 'd', label: 'D', type: 'date' };
    expect(check(col, 'not a date')?.message).toBe('msg:notADate');
    expect(check(col, '2026-11-08')).toBeNull();
    expect(check(col, null)).toBeNull();
  });

  it('a datetime column rejects text it cannot read and takes a datetime', () => {
    const col: ColumnDefinition = { key: 'd', label: 'D', type: 'datetime' };
    expect(check(col, 'later')?.message).toBe('msg:notADateTime');
    expect(check(col, '2026-11-08T09:30')).toBeNull();
  });
});

describe('validateEdit — validator', () => {
  it('reports the validator\'s own error as plain text, and passes what it accepts', () => {
    const col: ColumnDefinition = { key: 'tag', label: 'Tag', validator: (v) => (v === 'bad' ? 'Not allowed' : null) };
    const problem = check(col, 'bad');
    expect(problem).toEqual({ message: 'Not allowed' });
    expect(check(col, 'fine')).toBeNull();
  });

  it('hands the validator the value, the row being edited and the column', () => {
    const seen: unknown[] = [];
    const col: ColumnDefinition = { key: 'tag', label: 'Tag', validator: (...args) => { seen.push(...args); return null; } };
    check(col, 'x', rows[1]);
    expect(seen).toEqual(['x', rows[1], col]);
  });

  it('runs after the built-in checks — an unreadable number never reaches it', () => {
    let called = false;
    const col: ColumnDefinition = { key: 'n', label: 'N', type: 'number', validator: () => { called = true; return null; } };
    expect(check(col, 'abc')?.message).toBe('msg:notANumber');
    expect(called).toBe(false);
  });
});
