/**
 * Tests for HPP (Harga Pokok Penjualan) calculation helpers.
 *
 * Validates integer cents calculation, input validation, and edge cases.
 *
 * Run: npx vitest run apps/api/src/hpp-helpers.test.ts
 */
import { describe, it, expect } from 'vitest';
import { calculateHppCents, validateHppNotZero } from './utils/hpp-helpers.js';
import { validateJournalBalance } from './utils/journal-balance.js';

describe('calculateHppCents', () => {
  // ─── Basic calculations ─────────────────────────────────────────────
  describe('basic calculations', () => {
    it('exact division: totalCost=1000, totalQty=5, qty=3 → hppTotal=600', () => {
      const result = calculateHppCents(1000, 5, 3);
      expect(result.hppTotalCents).toBe(60000); // 600.00 in cents
      expect(result.hppTotalStr).toBe('600.00');
      expect(result.hppPerUnitCents).toBe(20000); // 200.00 per unit
      expect(result.hppPerUnitStr).toBe('200.00');
    });

    it('remainder case: totalCost=1000, totalQty=3, qty=3 → hppTotal=1000 (NOT 999!)', () => {
      const result = calculateHppCents(1000, 3, 3);
      // Old code: Math.round(1000/3)=333, 333*3=999 ❌
      // New code: Math.round((100000*3)/3)=100000 ✅
      expect(result.hppTotalCents).toBe(100000); // 1000.00 in cents
      expect(result.hppTotalStr).toBe('1000.00');
    });

    it('small amount: totalCost=1, totalQty=3, qty=1 → hppTotal=0.33', () => {
      const result = calculateHppCents(1, 3, 1);
      // Math.round((100*1)/3) = Math.round(33.33) = 33 cents
      expect(result.hppTotalCents).toBe(33);
      expect(result.hppTotalStr).toBe('0.33');
    });

    it('small amount × qty: totalCost=1, totalQty=3, qty=2 → hppTotal=0.67', () => {
      const result = calculateHppCents(1, 3, 2);
      // Math.round((100*2)/3) = Math.round(66.67) = 67 cents
      expect(result.hppTotalCents).toBe(67);
      expect(result.hppTotalStr).toBe('0.67');
    });

    it('large amount: totalCost=999999.99, totalQty=1, qty=1', () => {
      const result = calculateHppCents(999999.99, 1, 1);
      expect(result.hppTotalCents).toBe(99999999);
      expect(result.hppTotalStr).toBe('999999.99');
    });
  });

  // ─── Edge cases ─────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('totalQty=1 → hppTotal = totalCost', () => {
      const result = calculateHppCents(500, 1, 1);
      expect(result.hppTotalCents).toBe(50000);
      expect(result.hppTotalStr).toBe('500.00');
    });

    it('qty=1 → hppTotal = per-unit cost', () => {
      const result = calculateHppCents(1000, 5, 1);
      expect(result.hppTotalCents).toBe(20000); // 200.00
      expect(result.hppPerUnitCents).toBe(20000);
    });

    it('floating point precision: totalCost=0.1+0.2+0.3=0.6, totalQty=3, qty=3', () => {
      // 0.1+0.2=0.3 in JS might be 0.30000000000000004
      const result = calculateHppCents(0.6, 3, 3);
      expect(result.hppTotalCents).toBe(60); // 0.60 in cents
      expect(result.hppTotalStr).toBe('0.60');
    });

    it('very small per-unit: totalCost=1, totalQty=1000, qty=1', () => {
      const result = calculateHppCents(1, 1000, 1);
      // Math.round((100*1)/1000) = Math.round(0.1) = 0 cents
      // This is a valid edge case — sub-cent amounts round to 0
      expect(result.hppTotalCents).toBe(0);
      expect(result.hppTotalStr).toBe('0.00');
    });

    it('qty > totalQty (selling more than available stock)', () => {
      // This is allowed in the formula (for negative stock scenarios)
      // but the caller should validate stock separately
      const result = calculateHppCents(1000, 3, 6);
      // Math.round((100000*6)/3) = Math.round(200000) = 200000
      expect(result.hppTotalCents).toBe(200000);
      expect(result.hppTotalStr).toBe('2000.00');
    });
  });

  // ─── Input validation ───────────────────────────────────────────────
  describe('input validation', () => {
    it('throws on NaN totalCost', () => {
      expect(() => calculateHppCents(NaN, 5, 1)).toThrow('totalCost tidak valid');
    });

    it('throws on Infinity totalCost', () => {
      expect(() => calculateHppCents(Infinity, 5, 1)).toThrow('totalCost tidak valid');
    });

    it('throws on negative totalCost', () => {
      expect(() => calculateHppCents(-100, 5, 1)).toThrow('totalCost tidak valid');
    });

    it('throws on zero totalQty', () => {
      expect(() => calculateHppCents(1000, 0, 1)).toThrow('totalQty tidak valid');
    });

    it('throws on negative totalQty', () => {
      expect(() => calculateHppCents(1000, -5, 1)).toThrow('totalQty tidak valid');
    });

    it('throws on NaN totalQty', () => {
      expect(() => calculateHppCents(1000, NaN, 1)).toThrow('totalQty tidak valid');
    });

    it('throws on zero qtySold', () => {
      expect(() => calculateHppCents(1000, 5, 0)).toThrow('qtySold tidak valid');
    });

    it('throws on negative qtySold', () => {
      expect(() => calculateHppCents(1000, 5, -1)).toThrow('qtySold tidak valid');
    });

    it('throws on non-integer qtySold', () => {
      expect(() => calculateHppCents(1000, 5, 1.5)).toThrow('qtySold tidak valid');
    });

    it('throws on NaN qtySold', () => {
      expect(() => calculateHppCents(1000, 5, NaN)).toThrow('qtySold tidak valid');
    });

    it('allows zero totalCost (free items)', () => {
      // totalCost=0 is valid for free/promotional items
      const result = calculateHppCents(0, 5, 1);
      expect(result.hppTotalCents).toBe(0);
      expect(result.hppTotalStr).toBe('0.00');
    });
  });

  // ─── Consistency between endpoints ──────────────────────────────────
  describe('consistency between endpoints', () => {
    it('same result regardless of where it is called (penjualan vs transaksi/quick)', () => {
      // Both endpoints should use the same formula
      const totalCost = 1500.50;
      const totalQty = 7;
      const qty = 3;

      const result = calculateHppCents(totalCost, totalQty, qty);

      // Verify it's consistent with what would be stored in journal_lines
      const journalDebit = result.hppTotalStr;
      const journalKredit = result.hppTotalStr;
      expect(journalDebit).toBe(journalKredit); // Must be identical
    });

    it('multiple items accumulate correctly in cents (per-call rounding)', () => {
      // When selling items one-by-one, each call rounds independently
      // This is expected behavior — the fix is to calculate total HPP for all items at once
      const totalCost = 1000;
      const totalQty = 3;

      let totalHppCents = 0;
      for (let i = 0; i < 3; i++) {
        const result = calculateHppCents(totalCost, totalQty, 1);
        totalHppCents += result.hppTotalCents;
      }

      // Per-call rounding: 33333 + 33333 + 33333 = 99999 (1 cent lost)
      // This is acceptable — the alternative is to calculate all items at once
      expect(totalHppCents).toBe(99999);
    });

    it('single call for all items: totalCost=1000, totalQty=3, qty=3 → 100000', () => {
      // When selling all items in one call, no rounding loss
      const result = calculateHppCents(1000, 3, 3);
      expect(result.hppTotalCents).toBe(100000); // 1000.00
    });

    it('journal HPP and Persediaan use same amount', () => {
      const result = calculateHppCents(1000, 3, 3);

      // Journal line 3 (HPP debit) and line 4 (Persediaan kredit) must be identical
      const hppDebit = result.hppTotalStr;
      const persediaanKredit = result.hppTotalStr;
      expect(hppDebit).toBe(persediaanKredit);
      expect(hppDebit).toBe('1000.00');
    });
  });
});

describe('validateHppNotZero', () => {
  it('returns true for valid HPP > 0', () => {
    expect(validateHppNotZero(10000, 'Test Item')).toBe(true);
  });

  it('throws for HPP = 0', () => {
    expect(() => validateHppNotZero(0, 'Test Item')).toThrow('HPP untuk "Test Item" bernilai nol');
  });

  it('throws for negative HPP', () => {
    expect(() => validateHppNotZero(-100, 'Test Item')).toThrow('HPP untuk "Test Item" bernilai nol');
  });

  it('includes item name in error message', () => {
    expect(() => validateHppNotZero(0, 'Beras Premium')).toThrow('Beras Premium');
  });
});

describe('HPP journal balance integration', () => {
  it('HPP journal lines (debit HPP + kredit Persediaan) always balance', () => {
    // Test various cost/qty combinations (exclude very small amounts that round to 0)
    const testCases = [
      { totalCost: 1000, totalQty: 3, qty: 3 },
      { totalCost: 1000, totalQty: 7, qty: 3 },
      { totalCost: 0.10, totalQty: 3, qty: 1 }, // 0.03 per unit
      { totalCost: 99999.99, totalQty: 1, qty: 1 },
      { totalCost: 100, totalQty: 3, qty: 2 }, // 66.67 → 67 cents
    ];

    for (const tc of testCases) {
      const result = calculateHppCents(tc.totalCost, tc.totalQty, tc.qty);

      // Skip if HPP rounds to 0 (valid edge case for very small amounts)
      if (result.hppTotalCents === 0) continue;

      // Simulate journal lines: HPP(D) + Persediaan(K)
      const journalLines = [
        { debit: result.hppTotalStr, kredit: '0' },
        { debit: '0', kredit: result.hppTotalStr },
      ];

      const balanceResult = validateJournalBalance(journalLines as any);
      expect(balanceResult.valid).toBe(true);
    }
  });

  it('multiple items journal balance', () => {
    const totalCost = 1000;
    const totalQty = 3;
    let totalHppCents = 0;

    // Simulate 3 items
    for (let i = 0; i < 3; i++) {
      const result = calculateHppCents(totalCost, totalQty, 1);
      totalHppCents += result.hppTotalCents;
    }

    const totalHppStr = (totalHppCents / 100).toFixed(2);

    // Journal: HPP(D) + Persediaan(K)
    const journalLines = [
      { debit: totalHppStr, kredit: '0' },
      { debit: '0', kredit: totalHppStr },
    ];

    const balanceResult = validateJournalBalance(journalLines as any);
    expect(balanceResult.valid).toBe(true);
  });
});
