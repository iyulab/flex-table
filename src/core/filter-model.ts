import { Locale } from '@iyulab/components/dist/utilities/Locale.js';
import { foldForSearch } from '@iyulab/components/dist/utilities/search.js';
import type { ColumnDefinition } from '../models/types.js';
import type { FilterPredicate } from './filtering.js';
import { readCellDate } from './date-value.js';

/**
 * 직렬화할 수 있는 열 필터 — 필터 팝오버가 사람에게 내놓는 모양 그대로다.
 *
 * 술어(`(value, row) => boolean`)는 함수라 저장 · 전송 · 서버 번역이 안 된다. 모델은 «어떤 필터인가» 를 값으로
 * 말하고, 클라이언트 술어(`filterModelPredicate`)와 OData `$filter`(`filterModelToOData`)가 같은 모델에서 나온다.
 * 술어를 직접 거는 길(`setFilter(key, predicate)`)은 탈출구로 남는다 — 모델이 없는 필터다.
 */
export type TextFilterMode = 'contains' | 'starts' | 'ends' | 'wildcard';
export type NumericOp = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte';

export interface NumberCondition {
  op: NumericOp;
  value: number;
}

export type FilterModel =
  /** 글자 일치. `contains` 는 목록 검색과 같은 규칙(대소문자 · 발음 기호 접기, 한글 초성)으로 찾는다. */
  | { type: 'text'; mode: TextFilterMode; value: string }
  /** 한두 개의 비교. 둘이면 `join`(기본 `and`)으로 잇는다. */
  | { type: 'number'; conditions: NumberCondition[]; join?: 'and' | 'or' }
  /** 날짜 범위(양끝 포함). `YYYY-MM-DD` 인 `to` 는 그날 끝까지 담는다. */
  | { type: 'date'; from?: string; to?: string }
  | { type: 'boolean'; value: boolean }
  /** 빈 셀(`null` · `''`) 또는 빈 셀이 아닌 것. */
  | { type: 'empty'; empty: 'empty' | 'non-empty' }
  /** 이 값과 같은 셀 — «이 값으로 거르기» 메뉴가 만든다. */
  | { type: 'equals'; value: string | number | boolean | null };

/** 열 키 → 모델. `filter-change.detail.filters` 와 `table.filters` 가 이 모양이다. */
export type FilterModels = Record<string, FilterModel>;

const TEXT_MODES: readonly string[] = ['contains', 'starts', 'ends', 'wildcard'];
const NUMERIC_OPS: readonly string[] = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'];

/** 모델 모양인가 — 저장소에서 읽은 값을 `filters` 에 넣기 전에. 값의 의미(날짜 해석)까지는 보지 않는다. */
export function isFilterModel(x: unknown): x is FilterModel {
  if (!x || typeof x !== 'object') return false;
  const m = x as Record<string, unknown>;
  switch (m.type) {
    case 'text': return typeof m.value === 'string' && typeof m.mode === 'string' && TEXT_MODES.includes(m.mode);
    case 'number':
      return Array.isArray(m.conditions) && m.conditions.length >= 1 && m.conditions.length <= 2 &&
        m.conditions.every((c) => !!c && typeof c === 'object' && NUMERIC_OPS.includes((c as NumberCondition).op) &&
          typeof (c as NumberCondition).value === 'number' && Number.isFinite((c as NumberCondition).value)) &&
        (m.join === undefined || m.join === 'and' || m.join === 'or');
    case 'date': return (m.from === undefined || typeof m.from === 'string') && (m.to === undefined || typeof m.to === 'string') &&
      (m.from !== undefined || m.to !== undefined);
    case 'boolean': return typeof m.value === 'boolean';
    case 'empty': return m.empty === 'empty' || m.empty === 'non-empty';
    case 'equals': return m.value === null || ['string', 'number', 'boolean'].includes(typeof m.value);
    default: return false;
  }
}

/** 이 모델이 아무것도 거르지 않는 «빈» 모델인가(빈 글자 · 날짜 끝이 둘 다 없음) — 그렇다면 필터를 거는 대신 뗀다. */
export function isEmptyFilterModel(model: FilterModel): boolean {
  switch (model.type) {
    case 'text': return model.value === '';
    case 'date': return !model.from && !model.to;
    default: return false;
  }
}

function evalCondition(n: number, c: NumberCondition): boolean {
  switch (c.op) {
    case 'eq': return n === c.value;
    case 'neq': return n !== c.value;
    case 'gt': return n > c.value;
    case 'lt': return n < c.value;
    case 'gte': return n >= c.value;
    case 'lte': return n <= c.value;
  }
}

/**
 * 클라이언트 술어. «포함» 은 components 의 검색 일치(`Locale.matchesSearch`)를, «시작» · «끝» 은 같은 접은 꼴
 * (`foldForSearch`)을 쓴다 — 목록 검색과 같은 규칙. 와일드카드는 패턴 그대로(대소문자만 접는다).
 */
export function filterModelPredicate(model: FilterModel): FilterPredicate {
  switch (model.type) {
    case 'text': {
      const { value, mode } = model;
      const folded = foldForSearch(value);
      switch (mode) {
        case 'starts': return (v) => foldForSearch(String(v ?? '')).startsWith(folded);
        case 'ends': return (v) => foldForSearch(String(v ?? '')).endsWith(folded);
        case 'wildcard': {
          const pattern = value.toLowerCase()
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
          const regex = new RegExp('^' + pattern + '$', 'i');
          return (v) => regex.test(String(v ?? ''));
        }
        default: return (v) => Locale.matchesSearch(String(v ?? ''), value);
      }
    }
    case 'number': {
      const [first, second] = model.conditions;
      return (v) => {
        const n = Number(v);
        if (isNaN(n)) return false;
        if (!second) return evalCondition(n, first);
        const a = evalCondition(n, first);
        const b = evalCondition(n, second);
        return model.join === 'or' ? a || b : a && b;
      };
    }
    case 'date': {
      const { from, to } = model;
      return (v) => {
        if (v == null || v === '') return false;
        // 셀과 경계를 표시 경로와 같은 읽기로 — `YYYY-MM-DD` 는 로컬 자정이라, 오프셋 있는 순간 값도 화면에 보이는 날로 걸러진다.
        const d = readCellDate(v);
        if (!d) return false;
        if (from) {
          const lo = readCellDate(from);
          if (lo && d < lo) return false;
        }
        if (to) {
          const hi = readCellDate(to);
          if (hi) {
            if (to.length === 10) hi.setHours(23, 59, 59, 999);
            if (d > hi) return false;
          }
        }
        return true;
      };
    }
    case 'boolean': return (v) => Boolean(v) === model.value;
    case 'empty': return model.empty === 'empty' ? (v) => v == null || v === '' : (v) => v != null && v !== '';
    case 'equals': return (v) => v === model.value;
  }
}

// --- OData `$filter` ---

const ODATA_OPS: Record<NumericOp, string> = { eq: 'eq', neq: 'ne', gt: 'gt', lt: 'lt', gte: 'ge', lte: 'le' };

/** 열 키(점 경로 `Customer.Name`)를 속성 경로(`Customer/Name`)로. */
function path(key: string): string {
  return key.replace(/\./g, '/');
}

function quote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function literal(v: string | number | boolean | null): string {
  if (v === null) return 'null';
  return typeof v === 'string' ? quote(v) : String(v);
}

/** 로컬 `YYYY-MM-DD` 를 그날 로컬 자정의 순간(UTC ISO)으로 — 클라이언트 술어가 «로컬 자정» 으로 읽는 것과 같게. */
function localMidnightIso(day: string, addDays = 0): string | undefined {
  const d = readCellDate(day);
  if (!d) return undefined;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + addDays);
  return d.toISOString();
}

/**
 * 한 열의 모델을 OData `$filter` 식으로. 번역할 수 없으면 `undefined`(호출자가 알려야 한다 — 조용히 무시하면
 * 서버가 거르지 않은 행을 보낸다).
 *
 * ⚠«포함» 은 `contains(tolower(…), …)` 다 — 서버가 대소문자만 접고, 클라이언트 술어의 발음 기호 접기 · 한글 초성은
 * 서버에서 일어나지 않는다. 와일드카드는 `*` 가 양끝에만 있을 때만 번역된다(`a*` `*a` `*a*`).
 * `column.type` 이 `datetime` 이면 날짜 경계를 순간(UTC)으로, 아니면 날짜 리터럴(`Edm.Date`)로 쓴다.
 */
export function filterModelToOData(key: string, model: FilterModel, column?: Pick<ColumnDefinition, 'type'>): string | undefined {
  const p = path(key);
  switch (model.type) {
    case 'text': {
      if (model.value === '') return undefined;
      const lowered = `tolower(${p})`;
      if (model.mode === 'wildcard') {
        const m = /^(\*?)([^*?]*)(\*?)$/.exec(model.value);
        if (!m) return undefined;
        const [, lead, body, trail] = m;
        if (!body) return undefined;
        const fn = lead && trail ? 'contains' : lead ? 'endswith' : trail ? 'startswith' : undefined;
        return fn ? `${fn}(${lowered},${quote(body.toLowerCase())})` : `${lowered} eq ${quote(body.toLowerCase())}`;
      }
      const fn = model.mode === 'starts' ? 'startswith' : model.mode === 'ends' ? 'endswith' : 'contains';
      return `${fn}(${lowered},${quote(model.value.toLowerCase())})`;
    }
    case 'number': {
      const parts = model.conditions.map((c) => `${p} ${ODATA_OPS[c.op]} ${c.value}`);
      return parts.length === 1 ? parts[0] : `(${parts.join(` ${model.join === 'or' ? 'or' : 'and'} `)})`;
    }
    case 'date': {
      const instant = column?.type === 'datetime';
      const parts: string[] = [];
      if (model.from) {
        const v = instant ? localMidnightIso(model.from) : model.from.slice(0, 10);
        if (!v) return undefined;
        parts.push(`${p} ge ${v}`);
      }
      if (model.to) {
        if (instant) {
          // 날짜만 적은 끝은 그날 끝까지 — 다음 날 자정 «미만».
          const next = model.to.length === 10 ? localMidnightIso(model.to, 1) : readCellDate(model.to)?.toISOString();
          if (!next) return undefined;
          parts.push(`${p} ${model.to.length === 10 ? 'lt' : 'le'} ${next}`);
        } else {
          parts.push(`${p} le ${model.to.slice(0, 10)}`);
        }
      }
      return parts.length ? parts.join(' and ') : undefined;
    }
    case 'boolean': return `${p} eq ${model.value}`;
    case 'empty': {
      const textual = !column?.type || column.type === 'text';
      if (model.empty === 'empty') return textual ? `(${p} eq null or ${p} eq '')` : `${p} eq null`;
      return textual ? `(${p} ne null and ${p} ne '')` : `${p} ne null`;
    }
    case 'equals': return `${p} eq ${literal(model.value)}`;
  }
}

/**
 * 모델 묶음 → 하나의 `$filter`(열마다 `and`). 번역하지 못한 열은 `untranslated` 로 돌려준다.
 * `columns` 는 날짜 열의 종류와 빈 셀 판정을 위해 열 키로 찾는다.
 */
export function filterModelsToOData(
  filters: FilterModels,
  columns: readonly Pick<ColumnDefinition, 'key' | 'type'>[] = [],
): { expression?: string; untranslated: string[] } {
  const parts: string[] = [];
  const untranslated: string[] = [];
  for (const [key, model] of Object.entries(filters)) {
    const column = columns.find((c) => c.key === key);
    const expr = filterModelToOData(key, model, column);
    if (expr) parts.push(expr);
    else untranslated.push(key);
  }
  return { expression: parts.length ? parts.join(' and ') : undefined, untranslated };
}
