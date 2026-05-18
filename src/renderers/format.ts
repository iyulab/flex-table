/**
 * Cell value formatting: number and date patterns.
 * Patterns follow Excel-like conventions.
 */

/**
 * Apply a format string or function to a cell value.
 * Returns empty string for null/undefined.
 */
export function applyFormat(
  value: unknown,
  format: string | ((value: unknown) => string)
): string {
  if (value == null) return '';
  if (typeof format === 'function') {
    return format(value);
  }
  if (isDatePattern(format)) {
    return formatDateValue(value, format);
  }
  return formatNumberValue(value, format);
}

/** Heuristic: contains date/time tokens */
function isDatePattern(fmt: string): boolean {
  return /[yMdHhms]/.test(fmt);
}

// ---------------------------------------------------------------------------
// Number format
// ---------------------------------------------------------------------------

/**
 * Parse an Excel-style number format string and apply it.
 * Supported patterns: '#,##0', '#,##0.00', '0.00%', '$#,##0.00', '#,##0.00%'
 */
export function formatNumberValue(value: unknown, fmt: string): string {
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) return String(value);

  const isPercent = fmt.endsWith('%');
  const currencyMatch = fmt.match(/^([^#0.,%]+)/);
  const currencyPrefix = currencyMatch ? currencyMatch[1] : '';
  const suffixAfterPercent = '';

  const innerFmt = fmt
    .replace(/^[^#0.,%]+/, '')  // strip leading currency prefix
    .replace(/%$/, '');          // strip trailing %

  // Count decimal places from '0.00' or '#,##0.00' pattern
  const decimalMatch = innerFmt.match(/\.([0#]+)$/);
  const decimalPlaces = decimalMatch ? decimalMatch[1].length : 0;

  // Use grouping if comma appears (e.g. '#,##0')
  const useGrouping = innerFmt.includes(',');

  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
    useGrouping,
  };

  let result: string;
  if (isPercent) {
    // Excel %: value 0.1235 → '12.35%'. Intl style:'percent' does the same.
    result = new Intl.NumberFormat(undefined, { ...opts, style: 'percent' }).format(num);
  } else {
    result = new Intl.NumberFormat(undefined, opts).format(num);
    if (currencyPrefix) result = currencyPrefix + result;
  }

  return result + suffixAfterPercent;
}

// ---------------------------------------------------------------------------
// Date format
// ---------------------------------------------------------------------------

/**
 * Format a Date or ISO string value using a pattern.
 * Tokens: yyyy, yy, MM, dd, HH, hh, mm, ss
 */
export function formatDateValue(value: unknown, fmt: string): string {
  let d: Date;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    d = new Date(value);
  } else {
    return String(value);
  }
  if (isNaN(d.getTime())) return String(value);

  const yyyy = String(d.getFullYear());
  const yy = yyyy.slice(-2);
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const hh = String(d.getHours() % 12 || 12).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  // Replace longest tokens first to avoid partial replacement
  return fmt
    .replace('yyyy', yyyy)
    .replace('yy', yy)
    .replace('MM', MM)
    .replace('dd', dd)
    .replace('HH', HH)
    .replace('hh', hh)
    .replace('mm', mm)
    .replace('ss', ss);
}
