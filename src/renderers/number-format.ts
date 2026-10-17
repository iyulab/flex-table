/**
 * Spreadsheet number format codes (the subset of ECMA-376 §18.8.31 a list needs).
 *
 * Supported: up to four `;` sections (positive;negative;zero;text) · digit placeholders `0` `#` `?`
 * with `.` and grouping `,` · trailing `,` scaling (÷1000 each) · `%` · quoted literals `"…"` ·
 * escaped literals `\x` · alignment space `_x` · fill `*x` (ignored) · colors `[Red]` `[Green]`
 * `[Blue]` `[Yellow]` `[Black]` · currency `[$₩-412]` · `@` in the text section · any other
 * character as a literal (so `#,##0원` keeps its unit).
 *
 * Not supported (the caller shows the value unformatted): conditions `[>100]`, `[Color N]`,
 * scientific `E+`, fractions `# ?/?`.
 */

// 숫자 구분 기호는 앱이 정한 로캘을 따른다(`Locale.get()`) — 런타임 기본 로캘이 아니라.
import { Locale } from '@iyulab/components/dist/utilities/Locale.js';

/** The status tone a section color maps to — colors come from the theme, not from the format. */
export type FormatTone = 'danger' | 'success' | 'info' | 'warning';

export interface FormattedNumber {
  text: string;
  tone?: FormatTone;
}

// [Black] 은 «기본 글자색» 이라 톤이 없다. 흰·청록·자홍은 하우스 상태 색에 대응이 없어 지원 밖.
const COLOR_TONES: Record<string, FormatTone | null> = {
  red: 'danger',
  green: 'success',
  blue: 'info',
  yellow: 'warning',
  black: null,
};

type Token =
  | { kind: 'literal'; text: string }
  | { kind: 'number' }
  | { kind: 'text' };

interface Section {
  tokens: Token[];
  tone?: FormatTone;
  /** Digits before the decimal point that are `0` (minimum integer digits). */
  intZeros: number;
  minFraction: number;
  maxFraction: number;
  grouping: boolean;
  /** Divide by 1000 per trailing comma. */
  scale: number;
  percent: boolean;
  /** The section carries digit placeholders (a pure-literal section, e.g. `"-"`, does not). */
  hasNumber: boolean;
}

/** A parsed format — `null` when the code uses syntax this engine does not support. */
interface ParsedFormat {
  sections: Section[];
}

const cache = new Map<string, ParsedFormat | null>();

/** Split on `;` outside quotes, brackets and escapes. */
function splitSections(code: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  let bracket = false;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (quoted) {
      cur += ch;
      if (ch === '"') quoted = false;
    } else if (bracket) {
      cur += ch;
      if (ch === ']') bracket = false;
    } else if (ch === '\\' || ch === '_' || ch === '*') {
      cur += ch + (code[i + 1] ?? '');
      i++;
    } else if (ch === '"') {
      quoted = true;
      cur += ch;
    } else if (ch === '[') {
      bracket = true;
      cur += ch;
    } else if (ch === ';') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseSection(src: string): Section | null {
  const tokens: Token[] = [];
  let literal = '';
  let tone: FormatTone | undefined;
  let intZeros = 0;
  let minFraction = 0;
  let maxFraction = 0;
  let grouping = false;
  let scale = 0;
  let percent = false;
  let numberSeen = false;
  let inFraction = false;
  // 숫자 자리표시 묶음이 끝났는가 — 끝난 뒤의 쉼표는 배율, 사이의 쉼표는 자릿수 구분.
  let numberClosed = false;
  let pendingCommas = 0;

  const flushLiteral = () => {
    if (literal) tokens.push({ kind: 'literal', text: literal });
    literal = '';
  };
  const closeNumber = () => {
    if (numberSeen && !numberClosed) {
      scale += pendingCommas;
      pendingCommas = 0;
      numberClosed = true;
    }
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"') {
      closeNumber();
      const end = src.indexOf('"', i + 1);
      literal += src.slice(i + 1, end === -1 ? src.length : end);
      i = end === -1 ? src.length : end;
    } else if (ch === '\\') {
      closeNumber();
      literal += src[i + 1] ?? '';
      i++;
    } else if (ch === '_') {
      closeNumber();
      // 정렬용 공백 — 그 글자의 폭만큼. 문장부호 폭에 가까운 공백으로 근사한다.
      literal += ' ';
      i++;
    } else if (ch === '*') {
      i++; // 채움 — 칸 폭을 모르는 목록에서는 의미가 없다
    } else if (ch === '[') {
      const end = src.indexOf(']', i);
      if (end === -1) return null;
      const inner = src.slice(i + 1, end);
      i = end;
      if (inner.startsWith('$')) {
        // [$₩-412] — 기호만 쓴다(로캘 id 는 앱 로캘이 대신한다).
        closeNumber();
        const dash = inner.indexOf('-');
        literal += inner.slice(1, dash === -1 ? undefined : dash);
        continue;
      }
      const key = inner.toLowerCase();
      if (key in COLOR_TONES) {
        tone = COLOR_TONES[key] ?? undefined;
        continue;
      }
      return null; // 조건 · [Color N] · 경과 시간 등
    } else if (ch === '0' || ch === '#' || ch === '?') {
      if (numberClosed) return null; // 자리표시 묶음이 둘(분수 등)
      if (!numberSeen) {
        flushLiteral();
        tokens.push({ kind: 'number' });
        numberSeen = true;
      }
      if (pendingCommas) {
        grouping = true;
        pendingCommas = 0;
      }
      if (inFraction) {
        maxFraction++;
        if (ch === '0') minFraction++;
      } else if (ch === '0') {
        intZeros++;
      }
    } else if (ch === '.' && numberSeen && !numberClosed && !inFraction) {
      inFraction = true;
    } else if (ch === '.' && !numberSeen && /[0#?]/.test(src[i + 1] ?? '')) {
      // `.00` — 정수 자리 없는 숫자
      flushLiteral();
      tokens.push({ kind: 'number' });
      numberSeen = true;
      inFraction = true;
    } else if (ch === ',' && numberSeen && !numberClosed) {
      pendingCommas++;
    } else if (ch === '%') {
      closeNumber();
      percent = true;
      literal += '%';
    } else if ((ch === 'E' || ch === 'e') && /[+-]/.test(src[i + 1] ?? '')) {
      return null; // 지수 표기
    } else if (ch === '/' && numberSeen) {
      return null; // 분수
    } else if (ch === '@') {
      closeNumber();
      flushLiteral();
      tokens.push({ kind: 'text' });
    } else {
      closeNumber();
      literal += ch;
    }
  }
  closeNumber();
  flushLiteral();
  return { tokens, tone, intZeros, minFraction, maxFraction, grouping, scale, percent, hasNumber: numberSeen };
}

function parseFormat(code: string): ParsedFormat | null {
  if (cache.has(code)) return cache.get(code)!;
  const parts = splitSections(code);
  let parsed: ParsedFormat | null = null;
  if (parts.length <= 4) {
    const sections: Section[] = [];
    for (const p of parts) {
      const s = parseSection(p);
      if (!s) {
        sections.length = 0;
        break;
      }
      sections.push(s);
    }
    if (sections.length === parts.length) parsed = { sections };
  }
  cache.set(code, parsed);
  return parsed;
}

/** Whether `code` is a date/time pattern: date letters outside quotes and brackets, no digit placeholders. */
export function isDateFormat(code: string): boolean {
  const bare = code
    .replace(/"[^"]*"/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\\./g, '');
  return /[yMdHhs]/.test(bare) && !/[0#?]/.test(bare);
}

function renderDigits(abs: number, s: Section): string {
  let n = abs;
  if (s.percent) n *= 100;
  if (s.scale) n /= 1000 ** s.scale;
  const text = new Intl.NumberFormat(Locale.get(), {
    minimumIntegerDigits: Math.max(1, s.intZeros),
    minimumFractionDigits: s.minFraction,
    maximumFractionDigits: s.maxFraction,
    useGrouping: s.grouping,
  }).format(n);
  // `#.##` 는 0.5 를 «.5» 로 — 정수 자리에 `0` 이 없으면 앞의 0 을 쓰지 않는다.
  if (s.intZeros === 0 && /^0(?=\D)/.test(text)) return text.slice(1);
  if (s.intZeros === 0 && text === '0') return '';
  return text;
}

function renderSection(s: Section, abs: number, text: string): string {
  let out = '';
  for (const t of s.tokens) {
    if (t.kind === 'literal') out += t.text;
    else if (t.kind === 'number') out += renderDigits(abs, s);
    else out += text;
  }
  return out;
}

/**
 * Format `value` with a spreadsheet number format code.
 * Returns `null` when the code uses syntax this engine does not support — show the value as is.
 */
export function formatWithCode(value: unknown, code: string): FormattedNumber | null {
  const parsed = parseFormat(code);
  if (!parsed) return null;
  const { sections } = parsed;
  const num = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;

  if (Number.isNaN(num)) {
    // 텍스트 섹션(넷째)이 있으면 그것으로, 없으면 글자 그대로.
    const textSection = sections[3];
    if (!textSection) return { text: String(value) };
    return { text: renderSection(textSection, 0, String(value)), tone: textSection.tone };
  }

  let section = sections[0];
  let sign = '';
  if (num < 0 && sections.length >= 2) section = sections[1];
  else if (num === 0 && sections.length >= 3) section = sections[2];
  else if (num < 0) sign = '-';

  // 한 섹션이면 Excel 처럼 부호가 접두(통화 기호)보다 앞에 선다: -₩1,234.
  const body = renderSection(section, Math.abs(num), String(value));
  // 반올림해 0 이 된 음수는 부호를 붙이지 않는다(Excel 은 «-0» 을 쓰지 않는다).
  const roundsToZero = sign && section.hasNumber && !/[1-9]/.test(renderDigits(Math.abs(num), section));
  return { text: (roundsToZero ? '' : sign) + body, tone: section.tone };
}
