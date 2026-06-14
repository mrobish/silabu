/**
 * Fix #21: HPP Average Cost Berbasis Tanggal Transaksi
 *
 * Tests the remaining inventory average cost calculation logic.
 * The old approach used all-time purchase average (SUM(debit) / SUM(qty debit)).
 * The new approach uses remaining inventory: net cost (debit-kredit) / net qty (qty debit - qty kredit)
 * filtered by tanggal <= transaction date.
 *
 * Run: npx vitest run apps/api/src/fix21-hpp-average-cost.test.ts
 */
import { describe, it, expect } from 'vitest';
import { calculateHppCents } from './utils/hpp-helpers.js';
import { dbNumericToCents } from './utils/money-helpers.js';

/**
 * Simulate the getInventoryAverageCost query logic.
 * Each journal line has: debit, kredit, qty, tanggal, tipetransaksi, isposted.
 * Returns remaining inventory { totalCostCents, totalQty } as of tanggal.
 */
function simulateGetInventoryAverageCost(
  lines: Array<{
    debit: number;
    kredit: number;
    qty: number;
    tanggal: string;
    tipetransaksi: string;
    isposted: boolean;
  }>,
  tanggal: string,
): { totalCostCents: number; totalQty: number } {
  let totalCostCents = 0;
  let totalQty = 0;

  for (const l of lines) {
    if (!l.isposted) continue;
    if (l.tipetransaksi === 'OPENING_BALANCE') continue;
    if (l.tanggal > tanggal) continue;

    // Net cost: debit - kredit
    totalCostCents += Math.round(l.debit * 100) - Math.round(l.kredit * 100);
    // Net qty: qty for debit lines, -qty for credit lines
    totalQty += l.debit > 0 ? l.qty : -l.qty;
  }

  return { totalCostCents, totalQty };
}

describe('Fix #21 — HPP Average Cost Berbasis Tanggal', () => {
  describe('getInventoryAverageCost simulation', () => {
    it('beli 10 @ 10K → avg = 10,000', () => {
      const lines = [
        { debit: 100000, kredit: 0, qty: 10, tanggal: '2025-01-15', tipetransaksi: 'GENERAL', isposted: true },
      ];
      const r = simulateGetInventoryAverageCost(lines, '2025-01-31');
      expect(r.totalCostCents).toBe(10000000); // Rp 100,000 = 10,000,000 cents
      expect(r.totalQty).toBe(10);
      // avg = 100000 / 10 = 10,000
      const hpp = calculateHppCents(r.totalCostCents / 100, r.totalQty, 5);
      expect(hpp.hppTotalCents).toBe(5000000); // 5 * 10,000 = 50,000 = 5,000,000 cents
    });

    it('beli 10 @ 10K, jual 5 → avg tetap 10,000 (remaining: 5 unit @ 50K)', () => {
      const lines = [
        { debit: 100000, kredit: 0, qty: 10, tanggal: '2025-01-15', tipetransaksi: 'GENERAL', isposted: true },
        { debit: 0, kredit: 50000, qty: 5, tanggal: '2025-02-20', tipetransaksi: 'SALES', isposted: true },
      ];
      const r = simulateGetInventoryAverageCost(lines, '2025-03-01');
      expect(r.totalCostCents).toBe(5000000); // 100K - 50K = 50K = 5,000,000 cents
      expect(r.totalQty).toBe(5); // 10 - 5 = 5
      // avg = 50,000 / 5 = 10,000 ✓
      const hpp = calculateHppCents(r.totalCostCents / 100, r.totalQty, 3);
      expect(hpp.hppTotalCents).toBe(3000000); // 3 * 10,000 = 30,000 = 3,000,000 cents
    });

    it('beli 10 @ 10K, jual 5, beli 10 @ 15K → remaining avg = 13,333', () => {
      const lines = [
        { debit: 100000, kredit: 0, qty: 10, tanggal: '2025-01-15', tipetransaksi: 'GENERAL', isposted: true },
        { debit: 0, kredit: 50000, qty: 5, tanggal: '2025-02-20', tipetransaksi: 'SALES', isposted: true },
        { debit: 150000, kredit: 0, qty: 10, tanggal: '2025-03-10', tipetransaksi: 'GENERAL', isposted: true },
      ];
      const r = simulateGetInventoryAverageCost(lines, '2025-04-01');
      // remaining: 100K - 50K + 150K = 200K, qty: 10 - 5 + 10 = 15
      expect(r.totalCostCents).toBe(20000000); // Rp 200,000 = 20,000,000 cents
      expect(r.totalQty).toBe(15);
      // avg = 200,000 / 15 = 13,333.33
      const hpp = calculateHppCents(r.totalCostCents / 100, r.totalQty, 5);
      // hppTotalCents = Math.round((20000000 * 5) / 15) = Math.round(6666666.67) = 6666667
      expect(hpp.hppTotalCents).toBe(6666667); // Rp 66,666.67
    });

    it('beli masa depan tidak memengaruhi HPP penjualan masa lalu', () => {
      const lines = [
        { debit: 100000, kredit: 0, qty: 10, tanggal: '2025-01-15', tipetransaksi: 'GENERAL', isposted: true },
        { debit: 200000, kredit: 0, qty: 20, tanggal: '2025-06-01', tipetransaksi: 'GENERAL', isposted: true },
      ];
      // Sale on Feb 20 — should NOT include Jun purchase
      const r = simulateGetInventoryAverageCost(lines, '2025-02-20');
      expect(r.totalCostCents).toBe(10000000); // Only Jan purchase
      expect(r.totalQty).toBe(10);
      // avg = 100,000 / 10 = 10,000 (NOT 300,000 / 30 = 10,000 — happens to be same here)
    });

    it('beli masa depan dengan harga berbeda → avg berubah setelah beli', () => {
      const lines = [
        { debit: 100000, kredit: 0, qty: 10, tanggal: '2025-01-15', tipetransaksi: 'GENERAL', isposted: true },
        { debit: 300000, kredit: 0, qty: 10, tanggal: '2025-06-01', tipetransaksi: 'GENERAL', isposted: true },
      ];
      // Before Jun purchase: avg = 10,000
      const r1 = simulateGetInventoryAverageCost(lines, '2025-05-01');
      expect(r1.totalCostCents).toBe(10000000);
      expect(r1.totalQty).toBe(10);

      // After Jun purchase: avg = 20,000
      const r2 = simulateGetInventoryAverageCost(lines, '2025-07-01');
      expect(r2.totalCostCents).toBe(40000000); // 100K + 300K
      expect(r2.totalQty).toBe(20); // 10 + 10
    });

    it('beli sebelum tanggal penjualan ikut dihitung', () => {
      const lines = [
        { debit: 100000, kredit: 0, qty: 10, tanggal: '2025-01-15', tipetransaksi: 'GENERAL', isposted: true },
        { debit: 150000, kredit: 0, qty: 10, tanggal: '2025-03-10', tipetransaksi: 'GENERAL', isposted: true },
      ];
      // Sale on Mar 15 — should include both purchases
      const r = simulateGetInventoryAverageCost(lines, '2025-03-15');
      expect(r.totalCostCents).toBe(25000000); // 100K + 150K
      expect(r.totalQty).toBe(20);
    });

    it('stok habis (totalQty=0) → totalCostCents=0', () => {
      const lines = [
        { debit: 100000, kredit: 0, qty: 10, tanggal: '2025-01-15', tipetransaksi: 'GENERAL', isposted: true },
        { debit: 0, kredit: 100000, qty: 10, tanggal: '2025-02-20', tipetransaksi: 'SALES', isposted: true },
      ];
      const r = simulateGetInventoryAverageCost(lines, '2025-03-01');
      expect(r.totalCostCents).toBe(0);
      expect(r.totalQty).toBe(0);
    });

    it('stok habis → caller harus tolak transaksi', () => {
      const lines = [
        { debit: 100000, kredit: 0, qty: 10, tanggal: '2025-01-15', tipetransaksi: 'GENERAL', isposted: true },
        { debit: 0, kredit: 100000, qty: 10, tanggal: '2025-02-20', tipetransaksi: 'SALES', isposted: true },
      ];
      const r = simulateGetInventoryAverageCost(lines, '2025-03-01');
      // Caller should check: totalQty <= 0 || totalCostCents <= 0 → reject
      expect(r.totalQty <= 0 || r.totalCostCents <= 0).toBe(true);
    });

    it('draft/unposted transactions tidak memengaruhi avg', () => {
      const lines = [
        { debit: 100000, kredit: 0, qty: 10, tanggal: '2025-01-15', tipetransaksi: 'GENERAL', isposted: true },
        { debit: 200000, kredit: 0, qty: 20, tanggal: '2025-02-01', tipetransaksi: 'GENERAL', isposted: false },
      ];
      const r = simulateGetInventoryAverageCost(lines, '2025-03-01');
      expect(r.totalCostCents).toBe(10000000); // Only posted
      expect(r.totalQty).toBe(10);
    });

    it('OPENING_BALANCE tidak masuk perhitungan HPP', () => {
      const lines = [
        { debit: 50000, kredit: 0, qty: 5, tanggal: '2025-01-01', tipetransaksi: 'OPENING_BALANCE', isposted: true },
        { debit: 100000, kredit: 0, qty: 10, tanggal: '2025-03-15', tipetransaksi: 'GENERAL', isposted: true },
      ];
      const r = simulateGetInventoryAverageCost(lines, '2025-04-01');
      expect(r.totalCostCents).toBe(10000000); // Only Mar purchase
      expect(r.totalQty).toBe(10);
    });
  });

  describe('calculateHppCents with new avg values', () => {
    it('hppTotalCents rounding: totalCost=200K, totalQty=15, qtySold=5', () => {
      // avg = 200,000 / 15 = 13,333.33... per unit
      // hppTotal = Math.round((20000000 * 5) / 15) = Math.round(6666666.67) = 6666667 cents
      const hpp = calculateHppCents(200000, 15, 5);
      expect(hpp.hppTotalCents).toBe(6666667); // Rp 66,666.67
    });

    it('hppTotalCents rounding: totalCost=1K, totalQty=3, qtySold=1', () => {
      // avg = 1000 / 3 = 333.33... per unit
      // hppTotal = Math.round((100000 * 1) / 3) = Math.round(33333.33) = 33333 cents
      const hpp = calculateHppCents(1000, 3, 1);
      expect(hpp.hppTotalCents).toBe(33333); // Rp 333.33
    });

    it('hppTotalCents: totalCost=100K, totalQty=10, qtySold=3 → exact', () => {
      const hpp = calculateHppCents(100000, 10, 3);
      expect(hpp.hppTotalCents).toBe(3000000); // Rp 30,000.00
    });
  });

  describe('dbNumericToCents conversion', () => {
    it('string "100000.00" → 10000000 cents', () => {
      expect(dbNumericToCents('100000.00')).toBe(10000000);
    });

    it('string "200000.00" → 20000000 cents', () => {
      expect(dbNumericToCents('200000.00')).toBe(20000000);
    });

    it('number 0 → 0 cents', () => {
      expect(dbNumericToCents(0)).toBe(0);
    });

    it('null → 0 cents', () => {
      expect(dbNumericToCents(null)).toBe(0);
    });
  });

  describe('Old vs New behavior comparison', () => {
    it('OLD: beli 10@10K, jual 5, beli 10@15K → old avg=12,500 (WRONG)', () => {
      // Old approach: SUM(debit) / SUM(qty debit) = 250K / 20 = 12,500
      const oldTotalCost = 100000 + 150000; // 250,000
      const oldTotalQty = 10 + 10; // 20
      const oldHpp = calculateHppCents(oldTotalCost, oldTotalQty, 5);
      expect(oldHpp.hppPerUnitCents).toBe(1250000); // Rp 12,500 per unit
    });

    it('NEW: beli 10@10K, jual 5, beli 10@15K → new avg=13,333 (CORRECT)', () => {
      // New approach: remaining = 200K / 15 = 13,333.33
      const newTotalCostCents = 10000000 - 5000000 + 15000000; // 20,000,000 cents
      const newTotalQty = 10 - 5 + 10; // 15
      const newHpp = calculateHppCents(newTotalCostCents / 100, newTotalQty, 5);
      // hppPerUnitCents = Math.round(20000000 / 15) = 1333333 cents = Rp 13,333.33
      expect(newHpp.hppPerUnitCents).toBe(1333333);
    });

    it('selisih old vs new untuk 5 unit: Rp 4,167', () => {
      const oldHpp = calculateHppCents(250000, 20, 5);
      const newHpp = calculateHppCents(200000, 15, 5);
      const selisihCents = newHpp.hppTotalCents - oldHpp.hppTotalCents;
      // old: 6,250,000 cents, new: 6,666,667 cents, diff: 416,667 cents = Rp 4,166.67
      expect(selisihCents).toBe(416667);
    });
  });
});
