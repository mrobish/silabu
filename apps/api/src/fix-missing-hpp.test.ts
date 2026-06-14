/**
 * Tests for fix-missing-hpp/execute validation logic.
 *
 * Run: npx vitest run apps/api/src/fix-missing-hpp.test.ts
 */
import { describe, it, expect } from 'vitest';

// ── UUID validation regex (same as in accounting-routes.ts) ──
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return typeof id === 'string' && uuidRegex.test(id);
}

// ── Input validation (mirrors backend logic) ──
function validateEntryIds(entry_ids: unknown): { ok: boolean; error?: string } {
  if (!entry_ids || !Array.isArray(entry_ids) || entry_ids.length === 0) {
    return { ok: false, error: 'entry_ids wajib diisi (array tidak boleh kosong)' };
  }
  if (entry_ids.length > 50) {
    return { ok: false, error: `Maksimal 50 entry per request. Anda mengirim ${entry_ids.length}.` };
  }
  for (const eid of entry_ids) {
    if (typeof eid !== 'string' || !isValidUUID(eid)) {
      return { ok: false, error: `entry_id tidak valid: "${eid}"` };
    }
  }
  return { ok: true };
}

// ── Referensi format ──
function formatReferensi(entryId: string): string {
  return `KOREKSI_HPP:${entryId}`;
}

// ── HPP calculation (integer cents) ──
function calculateHppCents(totalCost: number, totalQty: number, qty: number): number {
  if (totalQty <= 0) return 0;
  const hppPerUnitCents = Math.round((totalCost / totalQty) * 100);
  return hppPerUnitCents * Math.round(qty);
}

// ── Balance check (integer cents) ──
function isBalanced(totalDebit: number, totalKredit: number): boolean {
  return Math.round(totalDebit * 100) === Math.round(totalKredit * 100);
}

// ── 2-phase gate: should block if any entry is FAILED/NEED_MANUAL_REVIEW ──
function shouldBlockAll(results: Array<{ status: string }>): boolean {
  return results.some(r => r.status === 'FAILED' || r.status === 'NEED_MANUAL_REVIEW');
}

describe('fix-missing-hpp: Input validation', () => {
  it('rejects empty entry_ids', () => {
    const result = validateEntryIds([]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/array tidak boleh kosong/);
  });

  it('rejects null/undefined entry_ids', () => {
    expect(validateEntryIds(null).ok).toBe(false);
    expect(validateEntryIds(undefined).ok).toBe(false);
  });

  it('rejects non-array entry_ids', () => {
    expect(validateEntryIds('not-an-array').ok).toBe(false);
    expect(validateEntryIds(123).ok).toBe(false);
  });

  it('rejects entry_ids > 50', () => {
    const ids = Array.from({ length: 51 }, () => 'a0b1c2d3-e4f5-6789-abcd-ef0123456789');
    const result = validateEntryIds(ids);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Maksimal 50/);
  });

  it('accepts entry_ids at limit (50)', () => {
    const ids = Array.from({ length: 50 }, (_, i) =>
      `${String(i).padStart(8, '0')}-0000-0000-0000-000000000000`
    );
    const result = validateEntryIds(ids);
    expect(result.ok).toBe(true);
  });

  it('rejects invalid UUID format', () => {
    const result = validateEntryIds(['not-a-uuid']);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/entry_id tidak valid/);
  });

  it('rejects UUID with wrong length', () => {
    expect(validateEntryIds(['a0b1c2d3-e4f5-6789-abcd']).ok).toBe(false);
    expect(validateEntryIds(['a0b1c2d3-e4f5-6789-abcd-ef0123456789-extra']).ok).toBe(false);
  });

  it('accepts valid UUIDs', () => {
    const result = validateEntryIds([
      'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      '00000000-0000-0000-0000-000000000000',
      'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
    ]);
    expect(result.ok).toBe(true);
  });
});

describe('fix-missing-hpp: Referensi format', () => {
  it('formats referensi correctly', () => {
    expect(formatReferensi('abc-123')).toBe('KOREKSI_HPP:abc-123');
  });

  it('preserves UUID in referensi', () => {
    const uuid = 'a0b1c2d3-e4f5-6789-abcd-ef0123456789';
    expect(formatReferensi(uuid)).toBe(`KOREKSI_HPP:${uuid}`);
  });
});

describe('fix-missing-hpp: HPP calculation (integer cents)', () => {
  it('calculates HPP correctly', () => {
    // totalCost=100000, totalQty=10, qty=3 → 10000/unit → 30000 total
    expect(calculateHppCents(100000, 10, 3)).toBe(3000000); // 30000 * 100 cents
  });

  it('returns 0 when totalQty is 0', () => {
    expect(calculateHppCents(100000, 0, 3)).toBe(0);
  });

  it('returns 0 when totalQty is negative', () => {
    expect(calculateHppCents(100000, -5, 3)).toBe(0);
  });

  it('handles decimal costs correctly (rounding)', () => {
    const result = calculateHppCents(100000.50, 3, 1);
    expect(result).toBe(3333350);
  });

  it('handles floating point precision', () => {
    const cost = 0.1 + 0.2; // 0.30000000000000004
    const result = calculateHppCents(cost, 1, 1);
    expect(result).toBe(30);
  });
});

describe('fix-missing-hpp: Balance check (integer cents)', () => {
  it('passes when balanced', () => {
    expect(isBalanced(100000, 100000)).toBe(true);
  });

  it('fails when imbalanced', () => {
    expect(isBalanced(100000, 99999)).toBe(false);
  });

  it('handles floating point near-equal', () => {
    expect(isBalanced(0.1 + 0.2, 0.3)).toBe(true);
  });

  it('handles zero balance', () => {
    expect(isBalanced(0, 0)).toBe(true);
  });
});

describe('fix-missing-hpp: 2-phase gate (all-or-nothing)', () => {
  it('does NOT block when all entries are FIXED', () => {
    expect(shouldBlockAll([
      { status: 'FIXED' },
      { status: 'FIXED' },
    ])).toBe(false);
  });

  it('does NOT block when entries are FIXED + SKIP', () => {
    expect(shouldBlockAll([
      { status: 'FIXED' },
      { status: 'SKIP' },
    ])).toBe(false);
  });

  it('does NOT block when all entries are SKIP', () => {
    expect(shouldBlockAll([
      { status: 'SKIP' },
      { status: 'SKIP' },
    ])).toBe(false);
  });

  it('BLOCKS when any entry is FAILED', () => {
    expect(shouldBlockAll([
      { status: 'FIXED' },
      { status: 'FAILED' },
    ])).toBe(true);
  });

  it('BLOCKS when any entry is NEED_MANUAL_REVIEW', () => {
    expect(shouldBlockAll([
      { status: 'FIXED' },
      { status: 'FIXED' },
      { status: 'NEED_MANUAL_REVIEW' },
    ])).toBe(true);
  });

  it('BLOCKS when mixed FAILED and NEED_MANUAL_REVIEW', () => {
    expect(shouldBlockAll([
      { status: 'FIXED' },
      { status: 'FAILED' },
      { status: 'NEED_MANUAL_REVIEW' },
      { status: 'SKIP' },
    ])).toBe(true);
  });

  it('BLOCKS even if only one entry has problem', () => {
    expect(shouldBlockAll([
      { status: 'FIXED' },
      { status: 'FIXED' },
      { status: 'FIXED' },
      { status: 'FIXED' },
      { status: 'NEED_MANUAL_REVIEW' },
    ])).toBe(true);
  });
});
