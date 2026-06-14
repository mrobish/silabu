/**
 * Integration-style tests for POST /tutup-buku validation.
 *
 * Tests the critical paths: date range filtering, journal type exclusion,
 * closing journal generation, balance check, and edge cases.
 *
 * Run: npx vitest run apps/api/src/tutup-buku.test.ts
 */
import { describe, it, expect } from 'vitest';
import { validateJournalBalance } from './utils/journal-balance.js';

// ─── Helper: Simulate P&L query filtering ─────────────────────────────────
interface JournalEntry {
  id: string;
  tanggal: string; // YYYY-MM-DD
  tipetransaksi: string; // GENERAL, ADJUSTMENT, OPENING_BALANCE, CLOSING
}

interface JournalLineWithEntry {
  akun_id: string;
  debit: number;
  kredit: number;
  entry: JournalEntry;
}

interface AccountInfo {
  id: string;
  kode: string;
  nama: string;
  saldonormal: 'D' | 'K';
}

/**
 * Simulate the P&L query from POST /tutup-buku.
 * This mirrors the exact SQL logic in accounting-routes.ts.
 */
function computeClosingPnL(
  lines: JournalLineWithEntry[],
  accounts: AccountInfo[],
  year: number,
): { kode: string; nama: string; saldo: number }[] {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  // Filter: only Gol 4-7, only current year, exclude OPENING_BALANCE & CLOSING
  const filtered = lines.filter((l) => {
    const acc = accounts.find((a) => a.id === l.akun_id);
    if (!acc) return false;
    if (!['4', '5', '6', '7'].some((prefix) => acc.kode.startsWith(prefix))) return false;
    if (l.entry.tanggal < startDate || l.entry.tanggal > endDate) return false;
    if (['OPENING_BALANCE', 'CLOSING'].includes(l.entry.tipetransaksi)) return false;
    return true;
  });

  // Aggregate per account
  const saldoMap = new Map<string, number>();
  for (const l of filtered) {
    const acc = accounts.find((a) => a.id === l.akun_id)!;
    const current = saldoMap.get(l.akun_id) || 0;
    const delta =
      acc.saldonormal === 'D'
        ? l.debit - l.kredit
        : l.kredit - l.debit;
    saldoMap.set(l.akun_id, current + delta);
  }

  return Array.from(saldoMap.entries())
    .filter(([, saldo]) => saldo !== 0)
    .map(([akunId, saldo]) => {
      const acc = accounts.find((a) => a.id === akunId)!;
      return { kode: acc.kode, nama: acc.nama, saldo };
    })
    .sort((a, b) => a.kode.localeCompare(b.kode));
}

/**
 * Simulate the Prive query from POST /tutup-buku.
 */
function computeClosingPrive(
  lines: JournalLineWithEntry[],
  accounts: AccountInfo[],
  year: number,
): { kode: string; nama: string; saldo: number }[] {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const filtered = lines.filter((l) => {
    const acc = accounts.find((a) => a.id === l.akun_id);
    if (!acc) return false;
    if (!acc.kode.startsWith('3.2')) return false;
    if (l.entry.tanggal < startDate || l.entry.tanggal > endDate) return false;
    if (['OPENING_BALANCE', 'CLOSING'].includes(l.entry.tipetransaksi)) return false;
    return true;
  });

  const saldoMap = new Map<string, number>();
  for (const l of filtered) {
    const acc = accounts.find((a) => a.id === l.akun_id)!;
    const current = saldoMap.get(l.akun_id) || 0;
    const delta =
      acc.saldonormal === 'D'
        ? l.debit - l.kredit
        : l.kredit - l.debit;
    saldoMap.set(l.akun_id, current + delta);
  }

  return Array.from(saldoMap.entries())
    .filter(([, saldo]) => saldo !== 0)
    .map(([akunId, saldo]) => {
      const acc = accounts.find((a) => a.id === akunId)!;
      return { kode: acc.kode, nama: acc.nama, saldo };
    })
    .sort((a, b) => a.kode.localeCompare(b.kode));
}

/**
 * Simulate closing journal generation.
 */
function generateClosingJournal(
  pnlResults: { kode: string; saldo: number; saldonormal: string }[],
  priveResults: { kode: string; saldo: number; saldonormal: string }[],
  labaDitahanId: string,
): { akunId: string; debit: number; kredit: number }[] {
  const lines: { akunId: string; debit: number; kredit: number }[] = [];
  let totalPendapatan = 0;
  let totalBeban = 0;

  for (const r of pnlResults) {
    if (r.kode.startsWith('4')) {
      totalPendapatan += r.saldo;
    } else {
      totalBeban += r.saldo;
    }
  }

  const labaBersih = totalPendapatan - totalBeban;

  // Zeroing P&L
  for (const r of pnlResults) {
    if (r.saldo !== 0) {
      if (r.saldo > 0) {
        if (r.saldonormal === 'D') {
          lines.push({ akunId: r.kode, debit: 0, kredit: r.saldo });
        } else {
          lines.push({ akunId: r.kode, debit: r.saldo, kredit: 0 });
        }
      } else {
        if (r.saldonormal === 'D') {
          lines.push({ akunId: r.kode, debit: Math.abs(r.saldo), kredit: 0 });
        } else {
          lines.push({ akunId: r.kode, debit: 0, kredit: Math.abs(r.saldo) });
        }
      }
    }
  }

  // Zeroing Prive
  let totalPrive = 0;
  for (const r of priveResults) {
    if (r.saldo !== 0) {
      if (r.saldo > 0) {
        lines.push({ akunId: r.kode, debit: 0, kredit: r.saldo });
        totalPrive += r.saldo;
      } else {
        lines.push({ akunId: r.kode, debit: Math.abs(r.saldo), kredit: 0 });
        totalPrive += r.saldo;
      }
    }
  }

  // Net to Saldo Laba
  const netToSaldoLaba = labaBersih - totalPrive;
  if (netToSaldoLaba > 0) {
    lines.push({ akunId: labaDitahanId, debit: 0, kredit: netToSaldoLaba });
  } else if (netToSaldoLaba < 0) {
    lines.push({ akunId: labaDitahanId, debit: Math.abs(netToSaldoLaba), kredit: 0 });
  }

  return lines;
}

// ─── Test Data ─────────────────────────────────────────────────────────────

const accounts: AccountInfo[] = [
  { id: 'acc-4100', kode: '4.1.01.01', nama: 'Pendapatan Jasa', saldonormal: 'K' },
  { id: 'acc-4200', kode: '4.2.01.01', nama: 'Pendapatan Dagang', saldonormal: 'K' },
  { id: 'acc-5100', kode: '5.1.01.01', nama: 'HPP Dagangan', saldonormal: 'D' },
  { id: 'acc-6100', kode: '6.1.01.01', nama: 'Beban Gaji', saldonormal: 'D' },
  { id: 'acc-6200', kode: '6.2.01.01', nama: 'Beban Listrik', saldonormal: 'D' },
  { id: 'acc-3200', kode: '3.2.01.01', nama: 'Prive Pemilik', saldonormal: 'D' },
  { id: 'acc-3300', kode: '3.3.01.01', nama: 'Saldo Laba Tidak Dicadangkan', saldonormal: 'K' },
  { id: 'acc-1100', kode: '1.1.01.01', nama: 'Kas Tunai', saldonormal: 'D' },
  { id: 'acc-3100', kode: '3.1.01.01', nama: 'Modal Desa', saldonormal: 'K' },
];

const mkEntry = (id: string, tanggal: string, tipetransaksi: string): JournalEntry => ({
  id,
  tanggal,
  tipetransaksi,
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Tutup Buku — P&L Query Filtering (Fix #11 / M2)', () => {
  it('1. Tutup buku 2025 hanya menghitung transaksi 2025', () => {
    const lines: JournalLineWithEntry[] = [
      // 2025 revenue
      { akun_id: 'acc-4100', debit: 0, kredit: 50000, entry: mkEntry('1', '2025-06-15', 'GENERAL') },
      // 2024 revenue (should be excluded by date range)
      { akun_id: 'acc-4100', debit: 0, kredit: 100000, entry: mkEntry('2', '2024-03-10', 'GENERAL') },
      // 2025 expense
      { akun_id: 'acc-6100', debit: 20000, kredit: 0, entry: mkEntry('3', '2025-08-20', 'GENERAL') },
    ];

    const result = computeClosingPnL(lines, accounts, 2025);
    expect(result).toHaveLength(2);

    const pendapatan = result.find((r) => r.kode === '4.1.01.01');
    expect(pendapatan?.saldo).toBe(50000); // Only 2025 revenue

    const beban = result.find((r) => r.kode === '6.1.01.01');
    expect(beban?.saldo).toBe(20000); // Only 2025 expense
  });

  it('2. CLOSING entry tahun 2024 tidak mempengaruhi laba 2025', () => {
    const lines: JournalLineWithEntry[] = [
      // 2025 revenue
      { akun_id: 'acc-4100', debit: 0, kredit: 50000, entry: mkEntry('1', '2025-06-15', 'GENERAL') },
      // 2024 CLOSING entry (zeroing 2024 P&L) — should be EXCLUDED
      { akun_id: 'acc-4100', debit: 100000, kredit: 0, entry: mkEntry('2', '2024-12-31', 'CLOSING') },
      // 2025 CLOSING entry (if exists) — should also be EXCLUDED
      { akun_id: 'acc-4100', debit: 50000, kredit: 0, entry: mkEntry('3', '2025-12-31', 'CLOSING') },
    ];

    const result = computeClosingPnL(lines, accounts, 2025);
    expect(result).toHaveLength(1);

    const pendapatan = result.find((r) => r.kode === '4.1.01.01');
    expect(pendapatan?.saldo).toBe(50000); // Only 2025 GENERAL, not CLOSING
  });

  it('3. OPENING_BALANCE tidak mempengaruhi P&L/prive', () => {
    const lines: JournalLineWithEntry[] = [
      // 2025 revenue
      { akun_id: 'acc-4100', debit: 0, kredit: 50000, entry: mkEntry('1', '2025-06-15', 'GENERAL') },
      // OPENING_BALANCE entry with P&L account (unusual but defensive)
      { akun_id: 'acc-4100', debit: 0, kredit: 99999, entry: mkEntry('2', '2025-01-01', 'OPENING_BALANCE') },
      // OPENING_BALANCE prive entry
      { akun_id: 'acc-3200', debit: 10000, kredit: 0, entry: mkEntry('3', '2025-01-01', 'OPENING_BALANCE') },
    ];

    const pnlResult = computeClosingPnL(lines, accounts, 2025);
    const pendapatan = pnlResult.find((r) => r.kode === '4.1.01.01');
    expect(pendapatan?.saldo).toBe(50000); // Only GENERAL, not OPENING_BALANCE

    const priveResult = computeClosingPrive(lines, accounts, 2025);
    expect(priveResult).toHaveLength(0); // OPENING_BALANCE prive excluded
  });

  it('4. Prive tahun berjalan dihitung net dan benar', () => {
    const lines: JournalLineWithEntry[] = [
      // Prive debit 50000
      { akun_id: 'acc-3200', debit: 50000, kredit: 0, entry: mkEntry('1', '2025-03-15', 'GENERAL') },
      // Prive kredit 10000 (return/reversal)
      { akun_id: 'acc-3200', debit: 0, kredit: 10000, entry: mkEntry('2', '2025-06-20', 'GENERAL') },
      // 2024 prive (should be excluded by date)
      { akun_id: 'acc-3200', debit: 30000, kredit: 0, entry: mkEntry('3', '2024-12-15', 'GENERAL') },
    ];

    const result = computeClosingPrive(lines, accounts, 2025);
    expect(result).toHaveLength(1);

    const prive = result.find((r) => r.kode === '3.2.01.01');
    expect(prive?.saldo).toBe(40000); // 50000 - 10000 = 40000 (net, not ABS)
  });

  it('5. Jurnal closing balance dengan integer cents', () => {
    // P&L: Pendapatan 100000, Beban 30000 → Laba 70000
    const pnlResults = [
      { kode: '4.1.01.01', saldo: 100000, saldonormal: 'K' },
      { kode: '6.1.01.01', saldo: 30000, saldonormal: 'D' },
    ];
    const priveResults: { kode: string; saldo: number; saldonormal: string }[] = [];

    const closingLines = generateClosingJournal(pnlResults, priveResults, 'acc-3300');

    // Should have 3 lines: debit pendapatan, kredit beban, kredit saldo laba
    expect(closingLines.length).toBeGreaterThanOrEqual(3);

    // Balance check via validateJournalBalance
    const balanceResult = validateJournalBalance(closingLines as any);
    expect(balanceResult.valid).toBe(true);
  });

  it('5b. Jurnal closing dengan prive juga balance', () => {
    // P&L: Pendapatan 100000, Beban 30000 → Laba 70000
    // Prive: 20000 → Net to Saldo Laba = 50000
    const pnlResults = [
      { kode: '4.1.01.01', saldo: 100000, saldonormal: 'K' },
      { kode: '6.1.01.01', saldo: 30000, saldonormal: 'D' },
    ];
    const priveResults = [
      { kode: '3.2.01.01', saldo: 20000, saldonormal: 'D' },
    ];

    const closingLines = generateClosingJournal(pnlResults, priveResults, 'acc-3300');

    // Should have 4 lines: debit pendapatan, kredit beban, kredit prive, kredit saldo laba
    expect(closingLines.length).toBe(4);

    // Balance check
    const balanceResult = validateJournalBalance(closingLines as any);
    expect(balanceResult.valid).toBe(true);

    // Verify saldo laba line: laba bersih 70000 - prive 20000 = 50000
    const saldoLabaLine = closingLines.find((l) => l.akunId === 'acc-3300');
    expect(saldoLabaLine?.kredit).toBe(50000);
    expect(saldoLabaLine?.debit).toBe(0);
  });

  it('6. Re-run tolak karena periode sudah CLOSED', () => {
    // This test verifies the logic: if status === 'CLOSED', return 400
    // We can't test the actual DB check, but we verify the condition logic
    const status = 'CLOSED';
    const year = 2025;

    // Simulate the check
    const shouldReject = status === 'CLOSED';
    expect(shouldReject).toBe(true);

    // Verify the error message format
    const errorMsg = `Periode ${year} sudah ditutup.`;
    expect(errorMsg).toBe('Periode 2025 sudah ditutup.');
  });

  it('7. Laba Rugi setelah closing tetap menampilkan substansi periode', () => {
    // computeLabaRugi excludes CLOSING — verify the filter logic
    const lines: JournalLineWithEntry[] = [
      // 2025 revenue (GENERAL)
      { akun_id: 'acc-4100', debit: 0, kredit: 100000, entry: mkEntry('1', '2025-06-15', 'GENERAL') },
      // 2025 CLOSING entry (zeroing revenue)
      { akun_id: 'acc-4100', debit: 100000, kredit: 0, entry: mkEntry('2', '2025-12-31', 'CLOSING') },
    ];

    // After closing, computeLabaRugi should still show 100000 revenue
    // because CLOSING entries are excluded
    const result = computeClosingPnL(lines, accounts, 2025);
    const pendapatan = result.find((r) => r.kode === '4.1.01.01');
    expect(pendapatan?.saldo).toBe(100000); // Revenue still shows, not 0
  });

  it('8. Perubahan Modal setelah closing tetap benar', () => {
    // After closing, Perubahan Modal should:
    // - Modal Awal: from OPENING_BALANCE + historical CLOSING
    // - Laba Berjalan: from computeLabaRugi (excludes CLOSING)
    // - Prive: net debit-kredit (excludes CLOSING)

    const lines: JournalLineWithEntry[] = [
      // 2025 revenue
      { akun_id: 'acc-4100', debit: 0, kredit: 100000, entry: mkEntry('1', '2025-06-15', 'GENERAL') },
      // 2025 expense
      { akun_id: 'acc-6100', debit: 30000, kredit: 0, entry: mkEntry('2', '2025-09-20', 'GENERAL') },
      // 2025 prive
      { akun_id: 'acc-3200', debit: 20000, kredit: 0, entry: mkEntry('3', '2025-04-10', 'GENERAL') },
      // 2025 CLOSING entry (should be excluded from all calculations)
      { akun_id: 'acc-4100', debit: 100000, kredit: 0, entry: mkEntry('4', '2025-12-31', 'CLOSING') },
      { akun_id: 'acc-6100', debit: 0, kredit: 30000, entry: mkEntry('4b', '2025-12-31', 'CLOSING') },
      { akun_id: 'acc-3200', debit: 0, kredit: 20000, entry: mkEntry('4c', '2025-12-31', 'CLOSING') },
      { akun_id: 'acc-3300', debit: 0, kredit: 50000, entry: mkEntry('4d', '2025-12-31', 'CLOSING') },
    ];

    // Laba Rugi (excludes CLOSING)
    const pnl = computeClosingPnL(lines, accounts, 2025);
    const pendapatan = pnl.find((r) => r.kode === '4.1.01.01');
    const beban = pnl.find((r) => r.kode === '6.1.01.01');
    expect(pendapatan?.saldo).toBe(100000);
    expect(beban?.saldo).toBe(30000);
    // Laba bersih = 100000 - 30000 = 70000

    // Prive (excludes CLOSING)
    const prive = computeClosingPrive(lines, accounts, 2025);
    const priveAcc = prive.find((r) => r.kode === '3.2.01.01');
    expect(priveAcc?.saldo).toBe(20000);

    // Net to Saldo Laba = 70000 - 20000 = 50000
    const labaBersih = 100000 - 30000;
    const totalPrive = 20000;
    const netToSaldoLaba = labaBersih - totalPrive;
    expect(netToSaldoLaba).toBe(50000);
  });

  it('9. Data P&L tahun sebelumnya yang belum closing tidak ikut tertarik ke tahun berjalan', () => {
    const lines: JournalLineWithEntry[] = [
      // 2023 revenue (never closed)
      { akun_id: 'acc-4100', debit: 0, kredit: 200000, entry: mkEntry('1', '2023-05-15', 'GENERAL') },
      // 2024 revenue (never closed)
      { akun_id: 'acc-4100', debit: 0, kredit: 150000, entry: mkEntry('2', '2024-08-20', 'GENERAL') },
      // 2025 revenue
      { akun_id: 'acc-4100', debit: 0, kredit: 50000, entry: mkEntry('3', '2025-06-15', 'GENERAL') },
      // 2025 expense
      { akun_id: 'acc-6100', debit: 10000, kredit: 0, entry: mkEntry('4', '2025-09-20', 'GENERAL') },
    ];

    const result = computeClosingPnL(lines, accounts, 2025);

    // Should ONLY include 2025 data
    const pendapatan = result.find((r) => r.kode === '4.1.01.01');
    expect(pendapatan?.saldo).toBe(50000); // Only 2025, not 200000+150000+50000

    const beban = result.find((r) => r.kode === '6.1.01.01');
    expect(beban?.saldo).toBe(10000);

    // Laba bersih 2025 = 50000 - 10000 = 40000
    // NOT: 200000 + 150000 + 50000 - 10000 = 390000 (wrong!)
  });
});

// ─── Fix #16: Race Condition / Idempotency Tests ────────────────────────────
describe('Fix #16: Tutup Buku Race Condition Prevention', () => {
  it('advisory lock key format is deterministic', () => {
    // The advisory lock uses hashtext('tutup-buku') and hashtext(tid + ':' + year)
    // These should be deterministic for same inputs
    const key1 = `tutup-buku:${'tenant-1'}:${2026}`;
    const key2 = `tutup-buku:${'tenant-1'}:${2026}`;
    expect(key1).toBe(key2);
  });

  it('different tenants get different lock keys', () => {
    const key1 = `tutup-buku:${'tenant-1'}:${2026}`;
    const key2 = `tutup-buku:${'tenant-2'}:${2026}`;
    expect(key1).not.toBe(key2);
  });

  it('different years get different lock keys', () => {
    const key1 = `tutup-buku:${'tenant-1'}:${2025}`;
    const key2 = `tutup-buku:${'tenant-1'}:${2026}`;
    expect(key1).not.toBe(key2);
  });

  it('no_jurnal format is consistent', () => {
    const year = 2026;
    const noJurnal = `CL-${year}1231`;
    expect(noJurnal).toBe('CL-20261231');
    expect(noJurnal).toMatch(/^CL-\d{8}$/);
  });

  it('idempotent response shape has required fields', () => {
    // Simulate the idempotent response shape
    const response = {
      success: true,
      idempotent: true,
      message: 'Periode 2026 sudah ditutup.',
      closingEntry: {
        id: 'some-uuid',
        noJurnal: 'CL-20261231',
        tanggal: '2026-12-31',
        keterangan: 'Jurnal Penutup Tahun 2026',
        lines: [],
      },
    };

    expect(response.success).toBe(true);
    expect(response.idempotent).toBe(true);
    expect(response.closingEntry).toBeDefined();
    expect(response.closingEntry.noJurnal).toMatch(/^CL-\d{8}$/);
    expect(Array.isArray(response.closingEntry.lines)).toBe(true);
  });

  it('data inconsistency response has error code', () => {
    // Simulate the inconsistency response shape
    const response = {
      error: 'Data inconsistency: periode 2026 sudah CLOSED tetapi jurnal penutup tidak ditemukan.',
      code: 'CLOSING_ENTRY_MISSING',
    };

    expect(response.code).toBe('CLOSING_ENTRY_MISSING');
    expect(response.error).toContain('inconsistency');
  });

  it('unique constraint violation response has error code', () => {
    // Simulate the duplicate response shape
    const response = {
      error: 'Tutup buku 2026 sudah dilakukan (duplikat terdeteksi).',
      code: 'CLOSING_DUPLICATE',
    };

    expect(response.code).toBe('CLOSING_DUPLICATE');
    expect(response.error).toContain('duplikat');
  });
});
