/**
 * Centralized journal balance validation.
 * 
 * All journal endpoints (POST, PUT, batch) MUST use this helper.
 * Uses integer cents (minor units) for precise comparison — no floating point bugs.
 * 
 * Rules:
 * - Normalize to integer cents: Math.round(value * 100)
 * - Compare integers directly: totalDebitCents !== totalKreditCents
 * - Zero tolerance after normalization
 * - Consistent error message format: "Total debit (Rp xxx) tidak sama dengan total kredit (Rp xxx)"
 */

export interface JournalLine {
  debit?: string | number;
  kredit?: string | number;
  akun_id?: string;
  [key: string]: any;
}

export interface BalanceValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
  totalDebit?: number;
  totalKredit?: number;
}

/**
 * Format number as Indonesian Rupiah (no currency symbol, just formatted number).
 * Example: 1500000 → "1.500.000"
 */
function formatRupiah(amount: number): string {
  return amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Validate a single journal line.
 * Returns error message if invalid, null if valid.
 */
export function validateJournalLine(line: JournalLine): string | null {
  const debit = Number(line.debit || 0);
  const kredit = Number(line.kredit || 0);

  // Must be valid numbers
  if (!Number.isFinite(debit) || !Number.isFinite(kredit)) {
    return 'Debit/kredit harus angka valid (bukan NaN/Infinity)';
  }

  // Must be non-negative
  if (debit < 0 || kredit < 0) {
    return 'Debit/kredit tidak boleh negatif';
  }

  // Must have at least one side
  if (debit === 0 && kredit === 0) {
    return 'Setiap baris harus memiliki debit atau kredit';
  }

  // XOR: cannot have both debit and kredit
  if (debit > 0 && kredit > 0) {
    return 'Satu baris hanya boleh debit ATAU kredit, tidak keduanya';
  }

  return null;
}

/**
 * Validate that journal lines are balanced (total debit === total kredit).
 * 
 * Uses integer cents for precise comparison:
 * - Convert each value to cents: Math.round(value * 100)
 * - Sum as integers
 * - Compare integers directly (no floating point issues)
 * 
 * This handles edge cases like 0.1 + 0.2 = 0.3 correctly:
 * - 0.1 → 10 cents, 0.2 → 20 cents, sum = 30 cents
 * - 0.3 → 30 cents
 * - 30 === 30 ✓ (no floating point bug)
 */
export function validateJournalBalance(lines: JournalLine[]): BalanceValidationResult {
  if (!lines || !Array.isArray(lines) || lines.length < 2) {
    return {
      valid: false,
      error: 'Minimal 2 baris jurnal',
      code: 'INSUFFICIENT_LINES',
    };
  }

  // Step 1: Validate each line individually
  for (const line of lines) {
    const lineError = validateJournalLine(line);
    if (lineError) {
      return { valid: false, error: lineError, code: 'INVALID_LINE' };
    }
  }

  // Step 2: Sum as integer cents (avoid floating point accumulation)
  let totalDebitCents = 0;
  let totalKreditCents = 0;

  for (const line of lines) {
    const debitCents = Math.round(Number(line.debit || 0) * 100);
    const kreditCents = Math.round(Number(line.kredit || 0) * 100);
    totalDebitCents += debitCents;
    totalKreditCents += kreditCents;
  }

  // Step 3: Compare integers directly (zero tolerance)
  if (totalDebitCents !== totalKreditCents) {
    // Convert back to display format for error message
    const totalDebit = totalDebitCents / 100;
    const totalKredit = totalKreditCents / 100;

    return {
      valid: false,
      error: `Total debit (Rp ${formatRupiah(totalDebit)}) tidak sama dengan total kredit (Rp ${formatRupiah(totalKredit)})`,
      code: 'NOT_BALANCED',
      totalDebit,
      totalKredit,
    };
  }

  // Step 4: Return totals in regular units for caller convenience
  return {
    valid: true,
    totalDebit: totalDebitCents / 100,
    totalKredit: totalKreditCents / 100,
  };
}
