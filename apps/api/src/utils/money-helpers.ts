/**
 * Strict money/nominal parser for accounting inputs.
 *
 * Rules:
 * - Only accepts valid numeric strings or numbers
 * - Rejects NaN, Infinity, -Infinity
 * - Rejects mixed strings like "123abc", "abc123"
 * - Rejects negative values
 * - Max 2 decimal places (reject "123.456")
 * - Upper bound: MAX_AMOUNT (default 999,999,999,999.99)
 * - Returns integer cents (multiply by 100, round)
 * - Reusable across all endpoints that handle money
 */

/** Maximum allowed amount (999 billion 999 million 999 thousand 999.99) */
export const MAX_AMOUNT = 999_999_999_999.99;

/** Maximum allowed amount in cents */
export const MAX_AMOUNT_CENTS = Math.round(MAX_AMOUNT * 100);

/**
 * Strict regex: optional minus, digits, optional dot + 1-2 digits.
 * Rejects: "123abc", "Infinity", "NaN", "", "123.456", ".5", "123."
 */
const MONEY_REGEX = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

/**
 * Parse a money value strictly into integer cents.
 *
 * Accepts:
 * - number: 123, 123.45, 0, 0.01
 * - string: "123", "123.45", "0", "0.01"
 *
 * Rejects (throws descriptive error):
 * - NaN, Infinity, -Infinity
 * - null, undefined, objects, arrays
 * - Mixed strings: "123abc", "abc", ""
 * - Negative numbers: -100, "-50"
 * - More than 2 decimals: "123.456", "0.001"
 * - Empty string: ""
 * - Above MAX_AMOUNT
 *
 * @returns integer cents (e.g. 123.45 → 12345)
 */
export function parseMoneyStrict(value: unknown, fieldName = 'nominal'): number {
  // Type check
  if (value === null || value === undefined) {
    throw new Error(`${fieldName}: nilai tidak boleh kosong`);
  }

  let num: number;

  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      throw new Error(`${fieldName}: nilai tidak boleh kosong`);
    }

    // Strict regex: must be pure numeric, max 2 decimals
    if (!MONEY_REGEX.test(trimmed)) {
      // Provide specific error messages
      if (trimmed === 'Infinity' || trimmed === '-Infinity') {
        throw new Error(`${fieldName}: nilai tidak valid (Infinity)`);
      }
      if (trimmed === 'NaN') {
        throw new Error(`${fieldName}: nilai tidak valid (NaN)`);
      }
      if (trimmed.includes('.')) {
        const parts = trimmed.split('.');
        if (parts[1] && parts[1].length > 2) {
          throw new Error(`${fieldName}: maksimal 2 angka desimal (diterima: "${trimmed}")`);
        }
      }
      if (trimmed.startsWith('-')) {
        throw new Error(`${fieldName}: tidak boleh negatif`);
      }
      throw new Error(`${fieldName}: "${trimmed}" bukan angka valid`);
    }

    num = parseFloat(trimmed);
  } else {
    throw new Error(`${fieldName}: tipe tidak valid (${typeof value})`);
  }

  // Safety checks on parsed number
  if (!Number.isFinite(num)) {
    throw new Error(`${fieldName}: nilai tidak valid (Infinity/NaN)`);
  }

  if (num < 0) {
    throw new Error(`${fieldName}: tidak boleh negatif`);
  }

  if (num > MAX_AMOUNT) {
    throw new Error(`${fieldName}: melebihi batas maksimal Rp ${MAX_AMOUNT.toLocaleString('id-ID')}`);
  }

  // Convert to integer cents
  const cents = Math.round(num * 100);

  // Double-check: cents should be non-negative and finite
  if (!Number.isFinite(cents) || cents < 0) {
    throw new Error(`${fieldName}: nilai tidak valid setelah konversi`);
  }

  return cents;
}

/**
 * Parse a DB NUMERIC string to integer cents safely.
 * DB numeric(18,2) returns strings like "100000.00" or "0".
 * This function handles edge cases that parseFloat might miss.
 *
 * @param dbValue - string or number from DB (e.g. "100000.00", 0)
 * @returns integer cents
 */
export function dbNumericToCents(dbValue: unknown): number {
  if (dbValue === null || dbValue === undefined) return 0;

  const str = String(dbValue).trim();
  if (str === '' || str === '0' || str === '0.00') return 0;

  // Validate format
  if (!MONEY_REGEX.test(str) && !/^(?:0|[1-9]\d*)\.0$/.test(str)) {
    // Also allow "100.0" (single decimal from DB)
    throw new Error(`DB numeric tidak valid: "${str}"`);
  }

  return Math.round(parseFloat(str) * 100);
}
