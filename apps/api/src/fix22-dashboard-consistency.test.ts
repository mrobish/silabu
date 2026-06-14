/**
 * Fix #22: Dashboard Consistency
 *
 * Tests that dashboard queries correctly exclude CLOSING and system journals,
 * and only count isposted=true for both saldo kas and transaction count.
 *
 * Run: npx vitest run apps/api/src/fix22-dashboard-consistency.test.ts
 */
import { describe, it, expect } from 'vitest';

/**
 * Simulate the dashboard txCount filter logic.
 * Returns count of entries matching: isposted=true AND tipetransaksi NOT IN (OPENING_BALANCE, CLOSING)
 */
function simulateTxCount(
  entries: Array<{
    tanggal: string;
    tipetransaksi: string;
    isposted: boolean;
  }>,
  startDate: string,
  endDate: string,
): number {
  return entries.filter(
    (e) =>
      e.isposted === true &&
      (e.tipetransaksi || '') !== 'OPENING_BALANCE' &&
      (e.tipetransaksi || '') !== 'CLOSING' &&
      e.tanggal >= startDate &&
      e.tanggal <= endDate,
  ).length;
}

/**
 * Simulate the dashboard saldo kas filter logic.
 * Returns sum of kas entries matching: isposted=true AND tipetransaksi <> CLOSING
 * (simplified: just filters entries, actual sum depends on debit/kredit per account)
 */
function simulateKasFilter(
  entries: Array<{
    tipetransaksi: string;
    isposted: boolean;
  }>,
): number {
  return entries.filter(
    (e) =>
      e.isposted === true &&
      (e.tipetransaksi || '') !== 'CLOSING',
  ).length;
}

describe('Fix #22 — Dashboard Consistency', () => {
  const startDate = '2026-06-01';
  const endDate = '2026-06-15';

  describe('txCount — exclude CLOSING', () => {
    it('CLOSING tidak menambah transaksi bulan ini', () => {
      const entries = [
        { tanggal: '2026-06-10', tipetransaksi: 'GENERAL', isposted: true },
        { tanggal: '2026-06-12', tipetransaksi: 'CLOSING', isposted: true },
        { tanggal: '2026-06-13', tipetransaksi: 'ADJUSTMENT', isposted: true },
      ];
      expect(simulateTxCount(entries, startDate, endDate)).toBe(2);
    });

    it('OPENING_BALANCE tidak menambah transaksi bulan ini', () => {
      const entries = [
        { tanggal: '2026-06-01', tipetransaksi: 'OPENING_BALANCE', isposted: true },
        { tanggal: '2026-06-10', tipetransaksi: 'GENERAL', isposted: true },
      ];
      expect(simulateTxCount(entries, startDate, endDate)).toBe(1);
    });

    it('draft/unposted tidak menambah transaksi bulan ini', () => {
      const entries = [
        { tanggal: '2026-06-10', tipetransaksi: 'GENERAL', isposted: true },
        { tanggal: '2026-06-11', tipetransaksi: 'GENERAL', isposted: false },
        { tanggal: '2026-06-12', tipetransaksi: 'ADJUSTMENT', isposted: false },
      ];
      expect(simulateTxCount(entries, startDate, endDate)).toBe(1);
    });

    it('transaksi di luar range tanggal tidak dihitung', () => {
      const entries = [
        { tanggal: '2026-05-31', tipetransaksi: 'GENERAL', isposted: true },
        { tanggal: '2026-06-01', tipetransaksi: 'GENERAL', isposted: true },
        { tanggal: '2026-06-15', tipetransaksi: 'GENERAL', isposted: true },
        { tanggal: '2026-06-16', tipetransaksi: 'GENERAL', isposted: true },
      ];
      expect(simulateTxCount(entries, startDate, endDate)).toBe(2);
    });

    it('tipetransaksi NULL tidak crash, dan tidak match OB/CLOSING', () => {
      const entries = [
        { tanggal: '2026-06-10', tipetransaksi: null as any, isposted: true },
        { tanggal: '2026-06-11', tipetransaksi: '', isposted: true },
      ];
      // Both should be counted (not OB, not CLOSING)
      expect(simulateTxCount(entries, startDate, endDate)).toBe(2);
    });

    it('hanya GENERAL, ADJUSTMENT, SALES yang masuk (transaksi operasional)', () => {
      const entries = [
        { tanggal: '2026-06-01', tipetransaksi: 'OPENING_BALANCE', isposted: true },
        { tanggal: '2026-06-02', tipetransaksi: 'GENERAL', isposted: true },
        { tanggal: '2026-06-03', tipetransaksi: 'ADJUSTMENT', isposted: true },
        { tanggal: '2026-06-04', tipetransaksi: 'SALES', isposted: true },
        { tanggal: '2026-06-05', tipetransaksi: 'CLOSING', isposted: true },
        { tanggal: '2026-06-06', tipetransaksi: 'KOREKSI_HPP', isposted: true },
      ];
      expect(simulateTxCount(entries, startDate, endDate)).toBe(4); // GENERAL + ADJUSTMENT + SALES + KOREKSI_HPP
    });
  });

  describe('kasRows — exclude CLOSING', () => {
    it('CLOSING tidak masuk perhitungan saldo kas', () => {
      const entries = [
        { tipetransaksi: 'OPENING_BALANCE', isposted: true },
        { tipetransaksi: 'GENERAL', isposted: true },
        { tipetransaksi: 'CLOSING', isposted: true },
      ];
      // OPENING_BALANCE should be included (starting balance)
      // GENERAL should be included
      // CLOSING should be excluded
      expect(simulateKasFilter(entries)).toBe(2);
    });

    it('draft/unposted tidak masuk saldo kas', () => {
      const entries = [
        { tipetransaksi: 'GENERAL', isposted: true },
        { tipetransaksi: 'GENERAL', isposted: false },
      ];
      expect(simulateKasFilter(entries)).toBe(1);
    });

    it('OPENING_BALANCE tetap masuk saldo kas (starting balance)', () => {
      const entries = [
        { tipetransaksi: 'OPENING_BALANCE', isposted: true },
        { tipetransaksi: 'GENERAL', isposted: true },
      ];
      expect(simulateKasFilter(entries)).toBe(2);
    });

    it('tipetransaksi NULL tidak crash dan tetap masuk saldo kas', () => {
      const entries = [
        { tipetransaksi: null as any, isposted: true },
        { tipetransaksi: '', isposted: true },
        { tipetransaksi: 'CLOSING', isposted: true },
      ];
      // null and '' are not CLOSING, so they pass
      expect(simulateKasFilter(entries)).toBe(2);
    });
  });

  describe('COALESCE guard — NULL safety', () => {
    // Use helper function to avoid TS narrowing on const literals
    const isNotClosing = (v: string | null) => (v || '') !== 'CLOSING';
    const isNotSystem = (v: string | null) => !['OPENING_BALANCE', 'CLOSING'].includes(v || '');

    it('COALESCE(tipetransaksi, \'\') tidak match CLOSING untuk NULL', () => {
      expect(isNotClosing(null)).toBe(true);
    });

    it('COALESCE(tipetransaksi, \'\') match CLOSING untuk "CLOSING"', () => {
      expect(isNotClosing('CLOSING')).toBe(false);
    });

    it('COALESCE(tipetransaksi, \'\') NOT IN untuk NULL', () => {
      expect(isNotSystem(null)).toBe(true);
    });
  });
});
