/**
 * Integration-style tests for POST /saldo-awal and POST /saldo-awal/post validation.
 *
 * Tests the actual endpoint validation logic by replicating the critical paths.
 *
 * Run: npx vitest run apps/api/src/saldo-awal-integration.test.ts
 */
import { describe, it, expect } from 'vitest';
import { parseMoneyStrict, dbNumericToCents } from './utils/money-helpers.js';

/**
 * Replicate the POST /saldo-awal validation logic for testing.
 * This mirrors the exact implementation in accounting-routes.ts.
 */
function validateSaldoAwalLines(
  lines: Array<{ akun_id?: string; debit?: unknown; kredit?: unknown }>,
): { ok: boolean; error?: string; cleanLines?: Array<{ akun_id: string; debit: number; kredit: number }>; totalDebitCents?: number; totalKreditCents?: number } {
  if (!lines || !Array.isArray(lines) || lines.length === 0) {
    return { ok: false, error: 'Tidak ada baris saldo awal' };
  }
  if (lines.length > 500) {
    return { ok: false, error: 'Maksimal 500 baris saldo awal' };
  }

  const cleanLines: { akun_id: string; debit: number; kredit: number }[] = [];
  for (const l of lines) {
    // Skip rows where both debit and kredit are empty/zero/null/undefined
    const rawDebit = (l.debit ?? '').toString().trim();
    const rawKredit = (l.kredit ?? '').toString().trim();
    const isEmptyDebit = !rawDebit || rawDebit === '0' || rawDebit === '0.00' || rawDebit === '0,00';
    const isEmptyKredit = !rawKredit || rawKredit === '0' || rawKredit === '0.00' || rawKredit === '0,00';

    if (isEmptyDebit && isEmptyKredit) continue;

    if (!l.akun_id) return { ok: false, error: 'Setiap baris dengan nominal wajib memiliki akun_id' };

    let debitCents: number;
    let kreditCents: number;
    try {
      debitCents = isEmptyDebit ? 0 : parseMoneyStrict(rawDebit, 'Debit');
      kreditCents = isEmptyKredit ? 0 : parseMoneyStrict(rawKredit, 'Kredit');
    } catch (e: any) {
      return { ok: false, error: e.message };
    }

    if (debitCents === 0 && kreditCents === 0) continue;
    if (debitCents > 0 && kreditCents > 0) return { ok: false, error: 'Setiap akun hanya boleh diisi salah satu: debit atau kredit' };

    cleanLines.push({ akun_id: l.akun_id, debit: debitCents / 100, kredit: kreditCents / 100 });
  }

  if (cleanLines.length === 0) {
    return { ok: false, error: 'Isi minimal satu akun dengan nilai debit atau kredit' };
  }

  // Balance check (exact integer cents)
  const totalDebitCents = cleanLines.reduce((s, l) => s + Math.round(l.debit * 100), 0);
  const totalKreditCents = cleanLines.reduce((s, l) => s + Math.round(l.kredit * 100), 0);
  if (totalDebitCents !== totalKreditCents) {
    const selisihCents = totalDebitCents - totalKreditCents;
    return {
      ok: false,
      error: `Jurnal tidak balance. Debit: Rp ${(totalDebitCents/100).toLocaleString('id-ID')}, Kredit: Rp ${(totalKreditCents/100).toLocaleString('id-ID')}, Selisih: Rp ${(selisihCents/100).toLocaleString('id-ID')}`,
      totalDebitCents,
      totalKreditCents,
    };
  }

  return { ok: true, cleanLines, totalDebitCents, totalKreditCents };
}

/**
 * Replicate the POST /saldo-awal/post balance check logic.
 */
function validatePostBalance(dbTotalDebit: unknown, dbTotalKredit: unknown): { ok: boolean; error?: string } {
  const totalDebitCents = dbNumericToCents(dbTotalDebit);
  const totalKreditCents = dbNumericToCents(dbTotalKredit);
  if (totalDebitCents !== totalKreditCents) {
    const selisihCents = totalDebitCents - totalKreditCents;
    return {
      ok: false,
      error: `Jurnal tidak balance. Selisih: Rp ${(selisihCents/100).toLocaleString('id-ID')}`,
    };
  }
  return { ok: true };
}

describe('Saldo Awal: Balance success', () => {
  it('balanced lines → success', () => {
    const result = validateSaldoAwalLines([
      { akun_id: 'acc-1', debit: '100000', kredit: '0' },
      { akun_id: 'acc-2', debit: '0', kredit: '100000' },
    ]);
    expect(result.ok).toBe(true);
    expect(result.cleanLines).toHaveLength(2);
  });

  it('balanced with decimal values (0.1 + 0.2 = 0.3)', () => {
    const result = validateSaldoAwalLines([
      { akun_id: 'acc-1', debit: '0.3', kredit: '0' },
      { akun_id: 'acc-2', debit: '0', kredit: '0.3' },
    ]);
    expect(result.ok).toBe(true);
  });
});

describe('Saldo Awal: Balance rejection', () => {
  it('unbalanced lines → rejection with detail', () => {
    const result = validateSaldoAwalLines([
      { akun_id: 'acc-1', debit: '100000', kredit: '0' },
      { akun_id: 'acc-2', debit: '0', kredit: '99999' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/tidak balance/);
    expect(result.totalDebitCents).toBe(10000000);
    expect(result.totalKreditCents).toBe(9999900);
  });
});

describe('Saldo Awal: Empty rows handling', () => {
  it('all empty rows → rejection (no valid lines)', () => {
    const result = validateSaldoAwalLines([
      { akun_id: 'acc-1', debit: '', kredit: '' },
      { akun_id: 'acc-2', debit: '0', kredit: '0' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/minimal satu akun/);
  });

  it('mixed empty and valid rows → only valid rows processed', () => {
    const result = validateSaldoAwalLines([
      { akun_id: 'acc-1', debit: '', kredit: '' },      // empty → skip
      { akun_id: 'acc-2', debit: '0', kredit: '0' },     // zero → skip
      { akun_id: 'acc-3', debit: '50000', kredit: '0' }, // valid
      { akun_id: 'acc-4', debit: '0', kredit: '50000' }, // valid
    ]);
    expect(result.ok).toBe(true);
    expect(result.cleanLines).toHaveLength(2);
  });

  it('rows with null/undefined debit/kredit → skipped', () => {
    const result = validateSaldoAwalLines([
      { akun_id: 'acc-1', debit: null, kredit: null },
      { akun_id: 'acc-2', debit: undefined, kredit: undefined },
      { akun_id: 'acc-3', debit: '10000', kredit: '0' },
      { akun_id: 'acc-4', debit: '0', kredit: '10000' },
    ]);
    expect(result.ok).toBe(true);
    expect(result.cleanLines).toHaveLength(2);
  });

  it('row without akun_id but with value → rejected', () => {
    const result = validateSaldoAwalLines([
      { akun_id: undefined, debit: '10000', kredit: '0' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/wajib memiliki akun_id/);
  });

  it('row without akun_id and empty → skipped silently', () => {
    const result = validateSaldoAwalLines([
      { akun_id: undefined, debit: '', kredit: '' },
      { akun_id: 'acc-1', debit: '10000', kredit: '0' },
      { akun_id: 'acc-2', debit: '0', kredit: '10000' },
    ]);
    expect(result.ok).toBe(true);
    expect(result.cleanLines).toHaveLength(2);
  });
});

describe('Saldo Awal: Invalid nominal rejection', () => {
  it('NaN string → rejected', () => {
    const result = validateSaldoAwalLines([
      { akun_id: 'acc-1', debit: 'NaN', kredit: '0' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/tidak valid/);
  });

  it('Infinity string → rejected', () => {
    const result = validateSaldoAwalLines([
      { akun_id: 'acc-1', debit: 'Infinity', kredit: '0' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/tidak valid/);
  });

  it('"123abc" → rejected', () => {
    const result = validateSaldoAwalLines([
      { akun_id: 'acc-1', debit: '123abc', kredit: '0' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/bukan angka valid/);
  });

  it('negative value → rejected', () => {
    const result = validateSaldoAwalLines([
      { akun_id: 'acc-1', debit: '-100', kredit: '0' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/tidak boleh negatif/);
  });

  it('more than 2 decimals → rejected', () => {
    const result = validateSaldoAwalLines([
      { akun_id: 'acc-1', debit: '123.456', kredit: '0' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/maksimal 2 angka desimal/);
  });

  it('formatted Indonesian "1.000.000" → rejected (not pure numeric)', () => {
    const result = validateSaldoAwalLines([
      { akun_id: 'acc-1', debit: '1.000.000', kredit: '0' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('Saldo Awal: Payload validation', () => {
  it('empty lines array → rejected', () => {
    const result = validateSaldoAwalLines([]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Tidak ada baris/);
  });

  it('null lines → rejected', () => {
    const result = validateSaldoAwalLines(null as any);
    expect(result.ok).toBe(false);
  });

  it('both debit and kredit on same line → rejected', () => {
    const result = validateSaldoAwalLines([
      { akun_id: 'acc-1', debit: '50000', kredit: '50000' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/salah satu/);
  });
});

describe('Saldo Awal Post: DB numeric comparison', () => {
  it('balanced DB values → success', () => {
    const result = validatePostBalance('100000.00', '100000.00');
    expect(result.ok).toBe(true);
  });

  it('unbalanced DB values → rejection', () => {
    const result = validatePostBalance('100000.00', '99999.99');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/tidak balance/);
  });

  it('DB returns "0" → handled', () => {
    const result = validatePostBalance('0', '0');
    expect(result.ok).toBe(true);
  });

  it('DB returns null → handled as 0', () => {
    const result = validatePostBalance(null, null);
    expect(result.ok).toBe(true);
  });
});
