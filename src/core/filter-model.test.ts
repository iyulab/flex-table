import { describe, it, expect } from 'vitest';
import {
  filterModelPredicate,
  filterModelToOData,
  filterModelsToOData,
  isEmptyFilterModel,
  isFilterModel,
} from './filter-model.js';
import type { FilterModel } from './filter-model.js';

const row = {};
const pass = (m: FilterModel, v: unknown) => filterModelPredicate(m)(v, row);

describe('filterModelPredicate', () => {
  it('text — contains folds case; starts / ends fold the same way', () => {
    expect(pass({ type: 'text', mode: 'contains', value: 'ali' }, 'Alice')).toBe(true);
    expect(pass({ type: 'text', mode: 'contains', value: 'xyz' }, 'Alice')).toBe(false);
    expect(pass({ type: 'text', mode: 'starts', value: 'AL' }, 'alice')).toBe(true);
    expect(pass({ type: 'text', mode: 'ends', value: 'CE' }, 'alice')).toBe(true);
    expect(pass({ type: 'text', mode: 'ends', value: 'al' }, 'alice')).toBe(false);
  });

  it('text — wildcard is the whole value (anchored), * and ? only', () => {
    expect(pass({ type: 'text', mode: 'wildcard', value: 'a*e' }, 'Alice')).toBe(true);
    expect(pass({ type: 'text', mode: 'wildcard', value: 'a*e' }, 'Alicex')).toBe(false);
    expect(pass({ type: 'text', mode: 'wildcard', value: 'a?ice' }, 'alice')).toBe(true);
    // NEGATIVE — a regex metacharacter in the pattern is a letter, not syntax
    expect(pass({ type: 'text', mode: 'wildcard', value: 'a.c' }, 'abc')).toBe(false);
    expect(pass({ type: 'text', mode: 'wildcard', value: 'a.c' }, 'a.c')).toBe(true);
  });

  it('number — one condition, two joined by and / or, NaN never passes', () => {
    const gt5 = { op: 'gt', value: 5 } as const;
    const lt2 = { op: 'lt', value: 2 } as const;
    expect(pass({ type: 'number', conditions: [gt5] }, 6)).toBe(true);
    expect(pass({ type: 'number', conditions: [gt5] }, '6')).toBe(true);
    expect(pass({ type: 'number', conditions: [gt5, lt2] }, 1)).toBe(false);
    expect(pass({ type: 'number', conditions: [gt5, lt2], join: 'or' }, 1)).toBe(true);
    expect(pass({ type: 'number', conditions: [gt5] }, 'abc')).toBe(false);
  });

  it('date — inclusive range; a YYYY-MM-DD end covers that whole day', () => {
    const m: FilterModel = { type: 'date', from: '2026-03-01', to: '2026-03-31' };
    expect(pass(m, '2026-03-01')).toBe(true);
    expect(pass(m, '2026-03-31')).toBe(true);
    expect(pass(m, '2026-04-01')).toBe(false);
    expect(pass(m, '2026-02-28')).toBe(false);
    expect(pass(m, null)).toBe(false);
    expect(pass(m, '')).toBe(false);
  });

  it('boolean · empty · equals', () => {
    expect(pass({ type: 'boolean', value: true }, 1)).toBe(true);
    expect(pass({ type: 'boolean', value: false }, 0)).toBe(true);
    expect(pass({ type: 'empty', empty: 'empty' }, '')).toBe(true);
    expect(pass({ type: 'empty', empty: 'empty' }, null)).toBe(true);
    expect(pass({ type: 'empty', empty: 'empty' }, 0)).toBe(false);
    expect(pass({ type: 'empty', empty: 'non-empty' }, 'x')).toBe(true);
    expect(pass({ type: 'equals', value: 'a' }, 'a')).toBe(true);
    expect(pass({ type: 'equals', value: 1 }, '1')).toBe(false);
  });
});

describe('isFilterModel / isEmptyFilterModel', () => {
  it('accepts what the table produces and rejects what a stale store could hold', () => {
    expect(isFilterModel({ type: 'text', mode: 'contains', value: 'a' })).toBe(true);
    expect(isFilterModel({ type: 'number', conditions: [{ op: 'gt', value: 1 }], join: 'or' })).toBe(true);
    expect(isFilterModel({ type: 'date', from: '2026-01-01' })).toBe(true);
    expect(isFilterModel({ type: 'equals', value: null })).toBe(true);
  });

  it('NEGATIVE — unknown type, bad mode, three conditions, NaN, no date bound, non-objects', () => {
    expect(isFilterModel({ type: 'regex', value: 'a' })).toBe(false);
    expect(isFilterModel({ type: 'text', mode: 'fuzzy', value: 'a' })).toBe(false);
    const c = { op: 'gt', value: 1 };
    expect(isFilterModel({ type: 'number', conditions: [c, c, c] })).toBe(false);
    expect(isFilterModel({ type: 'number', conditions: [{ op: 'gt', value: NaN }] })).toBe(false);
    expect(isFilterModel({ type: 'date' })).toBe(false);
    expect(isFilterModel(null)).toBe(false);
    expect(isFilterModel('text')).toBe(false);
    expect(isFilterModel({ type: 'equals', value: {} })).toBe(false);
  });

  it('a model that filters nothing is empty', () => {
    expect(isEmptyFilterModel({ type: 'text', mode: 'contains', value: '' })).toBe(true);
    expect(isEmptyFilterModel({ type: 'date' })).toBe(true);
    expect(isEmptyFilterModel({ type: 'text', mode: 'contains', value: 'a' })).toBe(false);
    expect(isEmptyFilterModel({ type: 'boolean', value: false })).toBe(false);
  });
});

describe('filterModelToOData', () => {
  it('text', () => {
    expect(filterModelToOData('Name', { type: 'text', mode: 'contains', value: 'Ali' })).toBe("contains(tolower(Name),'ali')");
    expect(filterModelToOData('Name', { type: 'text', mode: 'starts', value: 'A' })).toBe("startswith(tolower(Name),'a')");
    expect(filterModelToOData('Name', { type: 'text', mode: 'ends', value: 'E' })).toBe("endswith(tolower(Name),'e')");
  });

  it('★a quote in the value is doubled — it cannot close the literal', () => {
    expect(filterModelToOData('Name', { type: 'text', mode: 'contains', value: "o'brien" })).toBe("contains(tolower(Name),'o''brien')");
    expect(filterModelToOData('Name', { type: 'equals', value: "x' or 1 eq 1 or Name eq 'y" }))
      .toBe("Name eq 'x'' or 1 eq 1 or Name eq ''y'");
  });

  it('wildcard translates only when * is at the ends — otherwise undefined, never a wrong filter', () => {
    expect(filterModelToOData('N', { type: 'text', mode: 'wildcard', value: 'a*' })).toBe("startswith(tolower(N),'a')");
    expect(filterModelToOData('N', { type: 'text', mode: 'wildcard', value: '*a' })).toBe("endswith(tolower(N),'a')");
    expect(filterModelToOData('N', { type: 'text', mode: 'wildcard', value: '*a*' })).toBe("contains(tolower(N),'a')");
    expect(filterModelToOData('N', { type: 'text', mode: 'wildcard', value: 'a*e' })).toBeUndefined();
    expect(filterModelToOData('N', { type: 'text', mode: 'wildcard', value: 'a?e' })).toBeUndefined();
  });

  it('number — one or two conditions; the dotted key becomes a path', () => {
    expect(filterModelToOData('Customer.Age', { type: 'number', conditions: [{ op: 'gte', value: 18 }] })).toBe('Customer/Age ge 18');
    expect(filterModelToOData('Age', { type: 'number', conditions: [{ op: 'gt', value: 1 }, { op: 'neq', value: 5 }], join: 'or' }))
      .toBe('(Age gt 1 or Age ne 5)');
    expect(filterModelToOData('Age', { type: 'number', conditions: [{ op: 'gt', value: 1 }, { op: 'lt', value: 9 }] }))
      .toBe('(Age gt 1 and Age lt 9)');
  });

  it('date column — date literals, both ends inclusive', () => {
    expect(filterModelToOData('D', { type: 'date', from: '2026-03-01', to: '2026-03-31' }, { type: 'date' }))
      .toBe('D ge 2026-03-01 and D le 2026-03-31');
    expect(filterModelToOData('D', { type: 'date', to: '2026-03-31' }, { type: 'date' })).toBe('D le 2026-03-31');
  });

  it('datetime column — instants; a date-only end is «before the next local midnight»', () => {
    const expr = filterModelToOData('At', { type: 'date', from: '2026-03-01', to: '2026-03-31' }, { type: 'datetime' })!;
    const lo = new Date(2026, 2, 1).toISOString();
    const hi = new Date(2026, 3, 1).toISOString();
    expect(expr).toBe(`At ge ${lo} and At lt ${hi}`);
  });

  it('boolean · empty by column type · equals literals', () => {
    expect(filterModelToOData('Active', { type: 'boolean', value: true })).toBe('Active eq true');
    expect(filterModelToOData('Note', { type: 'empty', empty: 'empty' })).toBe("(Note eq null or Note eq '')");
    expect(filterModelToOData('Qty', { type: 'empty', empty: 'non-empty' }, { type: 'number' })).toBe('Qty ne null');
    expect(filterModelToOData('X', { type: 'equals', value: null })).toBe('X eq null');
    expect(filterModelToOData('X', { type: 'equals', value: 3 })).toBe('X eq 3');
  });

  it('an empty text model has no expression', () => {
    expect(filterModelToOData('N', { type: 'text', mode: 'contains', value: '' })).toBeUndefined();
  });
});

describe('filterModelsToOData', () => {
  it('joins the columns with and and reports what it could not translate', () => {
    const r = filterModelsToOData(
      {
        Name: { type: 'text', mode: 'contains', value: 'a' },
        Qty: { type: 'number', conditions: [{ op: 'gt', value: 1 }] },
        Code: { type: 'text', mode: 'wildcard', value: 'a*b' },
      },
      [{ key: 'Qty', type: 'number' }],
    );
    expect(r.expression).toBe("contains(tolower(Name),'a') and Qty gt 1");
    expect(r.untranslated).toEqual(['Code']);
  });

  it('no filters — no expression', () => {
    expect(filterModelsToOData({})).toEqual({ expression: undefined, untranslated: [] });
  });
});
