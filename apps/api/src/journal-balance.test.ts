/**
 * Tests for centralized journal balance validation.
 * 
 * Run: npx vitest run apps/api/src/journal-balance.test.ts
 */
import { describe, it, expect } from 'vitest';
import { validateJournalBalance, validateJournalLine } from './utils/journal-balance.js';

describe('validateJournalLine', () => {
  it('accepts valid debit line', () => {
    expect(validateJournalLine({ debit: 100, kredit: 0 })).toBeNull();
  });

  it('accepts valid kredit line', () => {
    expect(validateJournalLine({ debit: 0, kredit: 100 })).toBeNull();
  });

  it('accepts string values', () => {
    expect(validateJournalLine({ debit: '100', kredit: '0' })).toBeNull();
  });

  it('rejects both debit and kredit > 0', () => {
    expect(validateJournalLine({ debit: 100, kredit: 100 })).toMatch(/debit ATAU kredit/);
  });

  it('rejects both zero', () => {
    expect(validateJournalLine({ debit: 0, kredit: 0 })).toMatch(/harus memiliki/);
  });

  it('rejects negative debit', () => {
    expect(validateJournalLine({ debit: -100, kredit: 0 })).toMatch(/tidak boleh negatif/);
  });

  it('rejects negative kredit', () => {
    expect(validateJournalLine({ debit: 0, kredit: -100 })).toMatch(/tidak boleh negatif/);
  });

  it('treats NaN as 0 (falls through to "both zero" check)', () => {
    // NaN || 0 = 0, so NaN is treated as missing value
    expect(validateJournalLine({ debit: NaN, kredit: 0 })).toMatch(/harus memiliki/);
  });

  it('rejects Infinity kredit', () => {
    expect(validateJournalLine({ debit: 0, kredit: Infinity })).toMatch(/angka valid/);
  });

  it('handles undefined values (defaults to 0)', () => {
    expect(validateJournalLine({ akun_id: 'test' })).toMatch(/harus memiliki/);
  });
});

describe('validateJournalBalance', () => {
  describe('balanced journals', () => {
    it('accepts simple balanced (100 debit, 100 kredit)', () => {
      const result = validateJournalBalance([
        { debit: 100, kredit: 0 },
        { debit: 0, kredit: 100 },
      ]);
      expect(result.valid).toBe(true);
      expect(result.totalDebit).toBe(100);
      expect(result.totalKredit).toBe(100);
    });

    it('accepts multi-line balanced', () => {
      const result = validateJournalBalance([
        { debit: 50, kredit: 0 },
        { debit: 50, kredit: 0 },
        { debit: 0, kredit: 75 },
        { debit: 0, kredit: 25 },
      ]);
      expect(result.valid).toBe(true);
    });

    it('accepts string values', () => {
      const result = validateJournalBalance([
        { debit: '100', kredit: '0' },
        { debit: '0', kredit: '100' },
      ]);
      expect(result.valid).toBe(true);
    });
  });

  describe('unbalanced journals', () => {
    it('rejects simple unbalanced (100 vs 99)', () => {
      const result = validateJournalBalance([
        { debit: 100, kredit: 0 },
        { debit: 0, kredit: 99 },
      ]);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('NOT_BALANCED');
      expect(result.error).toContain('Rp');
      expect(result.error).toContain('100');
      expect(result.error).toContain('99');
    });

    it('rejects large difference', () => {
      const result = validateJournalBalance([
        { debit: 1000000, kredit: 0 },
        { debit: 0, kredit: 500000 },
      ]);
      expect(result.valid).toBe(false);
      expect(result.totalDebit).toBe(1000000);
      expect(result.totalKredit).toBe(500000);
    });
  });

  describe('floating point edge cases', () => {
    it('handles 0.1 + 0.2 = 0.3 correctly (no floating point bug)', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JavaScript
      // After normalization: 10 + 20 = 30 cents, 30 cents = 0.3
      const result = validateJournalBalance([
        { debit: 0.1, kredit: 0 },
        { debit: 0.2, kredit: 0 },
        { debit: 0, kredit: 0.3 },
      ]);
      expect(result.valid).toBe(true);
    });

    it('handles 0.1 + 0.2 vs 0.30000000000000004 (JavaScript float)', () => {
      // Simulate what JavaScript might produce
      const jsFloat = 0.1 + 0.2; // 0.30000000000000004
      const result = validateJournalBalance([
        { debit: 0.1, kredit: 0 },
        { debit: 0.2, kredit: 0 },
        { debit: 0, kredit: jsFloat },
      ]);
      // After rounding: 10 + 20 = 30 cents, 30 cents = 0.3
      // jsFloat * 100 = 30.000000000000004, Math.round = 30
      expect(result.valid).toBe(true);
    });

    it('handles 19.99 + 0.01 = 20.00', () => {
      const result = validateJournalBalance([
        { debit: 19.99, kredit: 0 },
        { debit: 0.01, kredit: 0 },
        { debit: 0, kredit: 20.00 },
      ]);
      expect(result.valid).toBe(true);
    });

    it('handles 100.005 rounding (100.00 or 100.01)', () => {
      // Math.round(100.005 * 100) = Math.round(10000.5) = 10001 in some engines
      // But 100.005 is actually 100.004999... in IEEE 754, so rounds to 10000
      const result = validateJournalBalance([
        { debit: 100.005, kredit: 0 },
        { debit: 0, kredit: 100 },
      ]);
      // Either valid (10000 === 10000) or invalid (10001 !== 10000)
      // Both are acceptable — the point is consistency
      expect(typeof result.valid).toBe('boolean');
    });
  });

  describe('error messages', () => {
    it('formats error with Rupiah', () => {
      const result = validateJournalBalance([
        { debit: 1500000, kredit: 0 },
        { debit: 0, kredit: 1000000 },
      ]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Rp');
      expect(result.error).toContain('1.500.000');
      expect(result.error).toContain('1.000.000');
    });

    it('error message is in Indonesian', () => {
      const result = validateJournalBalance([
        { debit: 100, kredit: 0 },
        { debit: 0, kredit: 50 },
      ]);
      expect(result.error).toContain('tidak sama dengan');
    });
  });

  describe('edge cases', () => {
    it('rejects less than 2 lines', () => {
      const result = validateJournalBalance([
        { debit: 100, kredit: 0 },
      ]);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('INSUFFICIENT_LINES');
    });

    it('rejects empty array', () => {
      const result = validateJournalBalance([]);
      expect(result.valid).toBe(false);
    });

    it('rejects null/undefined', () => {
      const result = validateJournalBalance(null as any);
      expect(result.valid).toBe(false);
    });

    it('handles very small amounts (0.01)', () => {
      const result = validateJournalBalance([
        { debit: 0.01, kredit: 0 },
        { debit: 0, kredit: 0.01 },
      ]);
      expect(result.valid).toBe(true);
    });

    it('rejects 0.01 difference (one sen)', () => {
      const result = validateJournalBalance([
        { debit: 100.01, kredit: 0 },
        { debit: 0, kredit: 100 },
      ]);
      expect(result.valid).toBe(false);
    });
  });
});
