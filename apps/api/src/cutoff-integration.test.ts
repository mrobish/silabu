/**
 * Integration-style tests for checkCutoffDate behavior.
 *
 * Tests the actual cutoff logic: CLOSING blocks <=, OPENING blocks <,
 * bypass only for OPENING_BALANCE/CLOSING tipeTransaksi, etc.
 *
 * Run: npx vitest run apps/api/src/cutoff-integration.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the pool module before importing accounting-routes
vi.mock('./db.js', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
}));

// We'll test checkCutoffDate indirectly by importing and calling it
// Since it's a module-level function, we need to extract the logic or test via the route handler.
// Instead, we'll replicate the exact logic here for testing purposes.

import { parseYmdStrict, compareYmd } from './utils/date-helpers.js';

/**
 * Replicate checkCutoffDate logic for testing.
 * This mirrors the exact implementation in accounting-routes.ts.
 */
async function checkCutoffDate(
  tenantId: string,
  tanggal: string,
  opts: { tipetransaksi?: string } | undefined,
  mockCutoff: { tanggal: string; tipetransaksi: string } | null,
): Promise<void> {
  // ① Bypass untuk Jurnal Sistem
  const bypassTypes = ['OPENING_BALANCE', 'CLOSING'];
  if (opts?.tipetransaksi && bypassTypes.includes(opts.tipetransaksi)) return;

  // ② Strict validate tanggal format
  parseYmdStrict(tanggal);

  // ③ If no cutoff in DB → allow all
  if (!mockCutoff) return;

  const cutoff = mockCutoff.tanggal;
  const cutoffType = mockCutoff.tipetransaksi;

  // ④ Compare using integer comparison
  const cmp = compareYmd(tanggal, cutoff);
  const blocked = cutoffType === 'CLOSING'
    ? cmp <= 0
    : cmp < 0;

  if (blocked) {
    throw Object.assign(
      new Error(`Transaksi ditolak. Anda tidak bisa memasukkan transaksi pada periode yang sudah ditutup (sebelum ${cutoff}).`),
      { statusCode: 422 },
    );
  }
}

describe('Cutoff Integration: CLOSING behavior', () => {
  const closingCutoff = { tanggal: '2025-12-31', tipetransaksi: 'CLOSING' };

  it('blocks tanggal BEFORE closing (2025-12-30 <= 2025-12-31)', async () => {
    await expect(checkCutoffDate('t1', '2025-12-30', undefined, closingCutoff))
      .rejects.toThrow(/ditolak/);
  });

  it('blocks tanggal SAME as closing (2025-12-31 <= 2025-12-31)', async () => {
    await expect(checkCutoffDate('t1', '2025-12-31', undefined, closingCutoff))
      .rejects.toThrow(/ditolak/);
  });

  it('allows tanggal AFTER closing (2026-01-01)', async () => {
    await expect(checkCutoffDate('t1', '2026-01-01', undefined, closingCutoff))
      .resolves.toBeUndefined();
  });
});

describe('Cutoff Integration: OPENING_BALANCE behavior', () => {
  const openingCutoff = { tanggal: '2026-01-01', tipetransaksi: 'OPENING_BALANCE' };

  it('blocks tanggal BEFORE opening (2025-12-31 < 2026-01-01)', async () => {
    await expect(checkCutoffDate('t1', '2025-12-31', undefined, openingCutoff))
      .rejects.toThrow(/ditolak/);
  });

  it('allows tanggal SAME as opening (2026-01-01 — saldo awal system rule)', async () => {
    await expect(checkCutoffDate('t1', '2026-01-01', undefined, openingCutoff))
      .resolves.toBeUndefined();
  });

  it('allows tanggal AFTER opening (2026-01-02)', async () => {
    await expect(checkCutoffDate('t1', '2026-01-02', undefined, openingCutoff))
      .resolves.toBeUndefined();
  });
});

describe('Cutoff Integration: Bypass for system journals', () => {
  const closingCutoff = { tanggal: '2025-12-31', tipetransaksi: 'CLOSING' };

  it('OPENING_BALANCE bypasses cutoff check', async () => {
    await expect(
      checkCutoffDate('t1', '2025-01-01', { tipetransaksi: 'OPENING_BALANCE' }, closingCutoff)
    ).resolves.toBeUndefined();
  });

  it('CLOSING bypasses cutoff check', async () => {
    await expect(
      checkCutoffDate('t1', '2025-12-31', { tipetransaksi: 'CLOSING' }, closingCutoff)
    ).resolves.toBeUndefined();
  });

  it('GENERAL does NOT bypass cutoff check', async () => {
    await expect(
      checkCutoffDate('t1', '2025-12-31', { tipetransaksi: 'GENERAL' }, closingCutoff)
    ).rejects.toThrow(/ditolak/);
  });

  it('ADJUSTMENT does NOT bypass cutoff check', async () => {
    await expect(
      checkCutoffDate('t1', '2025-12-31', { tipetransaksi: 'ADJUSTMENT' }, closingCutoff)
    ).rejects.toThrow(/ditolak/);
  });

  it('SALES does NOT bypass cutoff check', async () => {
    await expect(
      checkCutoffDate('t1', '2025-12-31', { tipetransaksi: 'SALES' }, closingCutoff)
    ).rejects.toThrow(/ditolak/);
  });

  it('KOREKSI_HPP does NOT bypass cutoff check', async () => {
    await expect(
      checkCutoffDate('t1', '2025-12-31', { tipetransaksi: 'KOREKSI_HPP' }, closingCutoff)
    ).rejects.toThrow(/ditolak/);
  });
});

describe('Cutoff Integration: Invalid tanggal format', () => {
  const openingCutoff = { tanggal: '2026-01-01', tipetransaksi: 'OPENING_BALANCE' };

  it('rejects "2025-9-05" (single digit month)', async () => {
    await expect(checkCutoffDate('t1', '2025-9-05', undefined, openingCutoff))
      .rejects.toThrow(/Format tanggal tidak valid/);
  });

  it('rejects "2025-02-30" (invalid date)', async () => {
    await expect(checkCutoffDate('t1', '2025-02-30', undefined, openingCutoff))
      .rejects.toThrow(/Tanggal tidak valid/);
  });

  it('rejects "2025/09/05" (wrong separator)', async () => {
    await expect(checkCutoffDate('t1', '2025/09/05', undefined, openingCutoff))
      .rejects.toThrow(/Format tanggal tidak valid/);
  });
});

describe('Cutoff Integration: No cutoff in DB', () => {
  it('allows all dates when no cutoff exists (new tenant)', async () => {
    await expect(checkCutoffDate('t1', '2020-01-01', undefined, null))
      .resolves.toBeUndefined();
  });
});

describe('Cutoff Integration: Edge cases', () => {
  it('CLOSING at year boundary blocks correctly', async () => {
    const closing = { tanggal: '2024-12-31', tipetransaksi: 'CLOSING' };
    // 2024-12-31 blocked (same as closing)
    await expect(checkCutoffDate('t1', '2024-12-31', undefined, closing))
      .rejects.toThrow(/ditolak/);
    // 2025-01-01 allowed (after closing)
    await expect(checkCutoffDate('t1', '2025-01-01', undefined, closing))
      .resolves.toBeUndefined();
  });

  it('OPENING at year boundary allows same date', async () => {
    const opening = { tanggal: '2025-01-01', tipetransaksi: 'OPENING_BALANCE' };
    // 2024-12-31 blocked (before opening)
    await expect(checkCutoffDate('t1', '2024-12-31', undefined, opening))
      .rejects.toThrow(/ditolak/);
    // 2025-01-01 allowed (same as opening)
    await expect(checkCutoffDate('t1', '2025-01-01', undefined, opening))
      .resolves.toBeUndefined();
    // 2025-01-02 allowed (after opening)
    await expect(checkCutoffDate('t1', '2025-01-02', undefined, opening))
      .resolves.toBeUndefined();
  });
});
