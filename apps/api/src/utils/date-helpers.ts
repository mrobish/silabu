/**
 * Strict date helpers for YYYY-MM-DD format.
 * 
 * Rules:
 * - Format wajib "YYYY-MM-DD" (regex validated)
 * - Tanggal kalender harus valid (tolak 2025-02-30, 2025-13-01, dll)
 * - Perbandingan menggunakan integer YYYYMMDD (bukan string, bukan Date object)
 * - Tidak ada normalisasi diam-diam — format salah = reject
 */

const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Days in each month (non-leap year)
const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Parse YYYY-MM-DD string with strict validation.
 * Returns { year, month, day } or throws descriptive error.
 * 
 * Rejects:
 * - Non-YYYY-MM-DD format (e.g. "2025-9-05", "2025/09/05")
 * - Invalid calendar dates (e.g. "2025-02-30", "2025-13-01")
 * - Non-numeric parts
 */
export function parseYmdStrict(dateString: string): { year: number; month: number; day: number } {
  if (typeof dateString !== 'string') {
    throw new Error('Tanggal harus berupa string');
  }

  if (!YMD_REGEX.test(dateString)) {
    throw new Error(`Format tanggal tidak valid: "${dateString}". Wajib YYYY-MM-DD (contoh: 2025-01-15)`);
  }

  const [yearStr, monthStr, dayStr] = dateString.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (year < 2000 || year > 2100) {
    throw new Error(`Tahun tidak valid: ${year}. Harus antara 2000-2100`);
  }

  if (month < 1 || month > 12) {
    throw new Error(`Bulan tidak valid: ${monthStr}. Harus 01-12`);
  }

  const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month];
  if (day < 1 || day > maxDay) {
    throw new Error(`Tanggal tidak valid: ${dateString}. ${monthStr} ${year} hanya punya ${maxDay} hari`);
  }

  return { year, month, day };
}

/**
 * Convert parsed date to comparable integer YYYYMMDD.
 * Example: "2025-09-05" → 20250905
 */
export function toYmdInt(parsed: { year: number; month: number; day: number }): number {
  return parsed.year * 10000 + parsed.month * 100 + parsed.day;
}

/**
 * Compare two YYYY-MM-DD date strings.
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 * 
 * Both dates must be valid YYYY-MM-DD format (throws if not).
 */
export function compareYmd(a: string, b: string): -1 | 0 | 1 {
  const parsedA = parseYmdStrict(a);
  const parsedB = parseYmdStrict(b);
  const intA = toYmdInt(parsedA);
  const intB = toYmdInt(parsedB);

  if (intA < intB) return -1;
  if (intA > intB) return 1;
  return 0;
}

/**
 * Check if date string is valid YYYY-MM-DD format.
 * Returns true/false (does not throw).
 */
export function isValidYmd(dateString: unknown): dateString is string {
  if (typeof dateString !== 'string') return false;
  if (!YMD_REGEX.test(dateString)) return false;
  try {
    parseYmdStrict(dateString);
    return true;
  } catch {
    return false;
  }
}
