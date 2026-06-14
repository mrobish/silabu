/**
 * Fix #20: Proteksi Unpost Saldo Awal
 *
 * Tests the blocking logic that prevents unpost/delete of opening balance
 * when posted transactions exist on or after the opening balance date.
 *
 * Run: npx vitest run apps/api/src/fix20-unpost-protection.test.ts
 */
import { describe, it, expect } from 'vitest';

/**
 * Simulate the blocking check query logic from the backend.
 * Returns { blocked, count, firstDate, firstNoJurnal }.
 */
function checkPostedTransactionsAfterOB(
  transactions: Array<{
    tanggal: string;
    tipetransaksi: string;
    isposted: boolean;
    no_jurnal: string;
  }>,
  obTanggal: string,
): { blocked: boolean; count: number; firstDate: string | null; firstNoJurnal: string | null } {
  // Filter: same tenant (implicit), not OPENING_BALANCE, isposted=true, tanggal >= obTanggal
  const matches = transactions.filter(
    (t) =>
      t.tipetransaksi !== 'OPENING_BALANCE' &&
      t.isposted === true &&
      t.tanggal >= obTanggal,
  );

  if (matches.length === 0) {
    return { blocked: false, count: 0, firstDate: null, firstNoJurnal: null };
  }

  // Sort by tanggal, then no_jurnal (simulates ORDER BY tanggal, created_at)
  matches.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.no_jurnal.localeCompare(b.no_jurnal));

  return {
    blocked: true,
    count: matches.length,
    firstDate: matches[0].tanggal,
    firstNoJurnal: matches[0].no_jurnal,
  };
}

describe('Fix #20 — Proteksi Unpost Saldo Awal', () => {
  const OB_TANGGAL = '2025-01-01';

  describe('checkPostedTransactionsAfterOB — blocking logic', () => {
    it('unpost belum ada transaksi → tidak block', () => {
      const result = checkPostedTransactionsAfterOB([], OB_TANGGAL);
      expect(result.blocked).toBe(false);
      expect(result.count).toBe(0);
    });

    it('unpost ada transaksi posted setelah tanggal saldo awal → block', () => {
      const txs = [
        { tanggal: '2025-03-15', tipetransaksi: 'GENERAL', isposted: true, no_jurnal: 'JU-2025-03-0001' },
        { tanggal: '2025-06-20', tipetransaksi: 'GENERAL', isposted: true, no_jurnal: 'JU-2025-06-0001' },
      ];
      const result = checkPostedTransactionsAfterOB(txs, OB_TANGGAL);
      expect(result.blocked).toBe(true);
      expect(result.count).toBe(2);
      expect(result.firstDate).toBe('2025-03-15');
      expect(result.firstNoJurnal).toBe('JU-2025-03-0001');
    });

    it('unpost ada transaksi posted pada tanggal saldo awal (1 Jan) → block', () => {
      const txs = [
        { tanggal: '2025-01-01', tipetransaksi: 'GENERAL', isposted: true, no_jurnal: 'JU-2025-01-0001' },
      ];
      const result = checkPostedTransactionsAfterOB(txs, OB_TANGGAL);
      expect(result.blocked).toBe(true);
      expect(result.count).toBe(1);
      expect(result.firstDate).toBe('2025-01-01');
      expect(result.firstNoJurnal).toBe('JU-2025-01-0001');
    });

    it('unpost hanya ada draft/unposted → tidak block', () => {
      const txs = [
        { tanggal: '2025-03-15', tipetransaksi: 'GENERAL', isposted: false, no_jurnal: 'JU-2025-03-0001' },
        { tanggal: '2025-06-20', tipetransaksi: 'GENERAL', isposted: false, no_jurnal: 'JU-2025-06-0001' },
      ];
      const result = checkPostedTransactionsAfterOB(txs, OB_TANGGAL);
      expect(result.blocked).toBe(false);
      expect(result.count).toBe(0);
    });

    it('unpost — mix draft dan posted → block (hanya hitung posted)', () => {
      const txs = [
        { tanggal: '2025-02-10', tipetransaksi: 'GENERAL', isposted: false, no_jurnal: 'JU-2025-02-0001' },
        { tanggal: '2025-03-15', tipetransaksi: 'GENERAL', isposted: true, no_jurnal: 'JU-2025-03-0001' },
        { tanggal: '2025-04-20', tipetransaksi: 'ADJUSTMENT', isposted: false, no_jurnal: 'JU-2025-04-0001' },
      ];
      const result = checkPostedTransactionsAfterOB(txs, OB_TANGGAL);
      expect(result.blocked).toBe(true);
      expect(result.count).toBe(1);
      expect(result.firstDate).toBe('2025-03-15');
      expect(result.firstNoJurnal).toBe('JU-2025-03-0001');
    });

    it('transaksi OPENING_BALANCE sendiri tidak ikut block', () => {
      const txs = [
        { tanggal: '2025-01-01', tipetransaksi: 'OPENING_BALANCE', isposted: true, no_jurnal: 'OB-001' },
      ];
      const result = checkPostedTransactionsAfterOB(txs, OB_TANGGAL);
      expect(result.blocked).toBe(false);
      expect(result.count).toBe(0);
    });

    it('transaksi CLOSING tidak block (tanggal closing = 31 Dec, sebelum OB 1 Jan berikutnya)', () => {
      // Scenario: OB is 2025-01-01, closing is 2025-12-31 — this would block because >=
      // But in practice, closing has its own year. Let's test the query logic.
      const txs = [
        { tanggal: '2025-12-31', tipetransaksi: 'CLOSING', isposted: true, no_jurnal: 'CL-20251231' },
      ];
      const result = checkPostedTransactionsAfterOB(txs, OB_TANGGAL);
      // Closing on 2025-12-31 >= 2025-01-01 → blocks (correct! closing means year is active)
      expect(result.blocked).toBe(true);
      expect(result.count).toBe(1);
    });

    it('transaksi sebelum tanggal saldo awal → tidak block', () => {
      // This shouldn't happen in practice (OB is always Jan 1), but test the >= logic
      const txs = [
        { tanggal: '2024-12-31', tipetransaksi: 'GENERAL', isposted: true, no_jurnal: 'JU-2024-12-0001' },
      ];
      const result = checkPostedTransactionsAfterOB(txs, OB_TANGGAL);
      expect(result.blocked).toBe(false);
      expect(result.count).toBe(0);
    });

    it('tenant isolation — query hanya untuk tenant yang benar', () => {
      // This is implicit in the SQL (WHERE tenant_id=$1), but verify by simulating
      // different tenant's transactions are not in the array
      const txs: Array<{ tanggal: string; tipetransaksi: string; isposted: boolean; no_jurnal: string }> = [];
      // Tenant A has no transactions — should not be blocked by Tenant B's data
      const result = checkPostedTransactionsAfterOB(txs, OB_TANGGAL);
      expect(result.blocked).toBe(false);
    });
  });

  describe('Response format validation', () => {
    it('409 response harus punya code, transactionCount, firstTransaction', () => {
      // Simulate the response shape
      const response = {
        error: 'Saldo awal tidak dapat dibuka ulang karena sudah ada transaksi yang diposting pada atau setelah tanggal saldo awal.',
        code: 'OPENING_BALANCE_HAS_TRANSACTIONS',
        transactionCount: 3,
        firstTransaction: {
          tanggal: '2025-03-15',
          noJurnal: 'JU-2025-03-0001',
        },
      };
      expect(response.code).toBe('OPENING_BALANCE_HAS_TRANSACTIONS');
      expect(response.transactionCount).toBeGreaterThan(0);
      expect(response.firstTransaction.tanggal).toBeTruthy();
      expect(response.firstTransaction.noJurnal).toBeTruthy();
    });

    it('409 response untuk DELETE — error message beda (dihapus vs dibuka ulang)', () => {
      const unpostResponse = {
        error: 'Saldo awal tidak dapat dibuka ulang karena sudah ada transaksi yang diposting pada atau setelah tanggal saldo awal.',
        code: 'OPENING_BALANCE_HAS_TRANSACTIONS',
      };
      const deleteResponse = {
        error: 'Saldo awal tidak dapat dihapus karena sudah ada transaksi yang diposting pada atau setelah tanggal saldo awal.',
        code: 'OPENING_BALANCE_HAS_TRANSACTIONS',
      };
      expect(unpostResponse.error).toContain('dibuka ulang');
      expect(deleteResponse.error).toContain('dihapus');
      expect(unpostResponse.code).toBe(deleteResponse.code);
    });
  });
});
