// apps/api/src/journal-idempotency.test.ts
// Fix #18 (R1) — Tests for journal idempotency shared helper

import { describe, it, expect } from 'vitest';
import {
  validateIdempotencyKey,
  computeJournalPayloadHash,
  deriveKey,
  extractBaseKey,
  checkJournalIdempotency,
  processJournalIdempotency,
  IDEMPOTENCY_WINDOW_HOURS,
  type IdempotencyCheckResult,
} from './utils/journal-idempotency.js';
import { pool } from './db.js';

// ── Unit Tests: validateIdempotencyKey ─────────────────────────

describe('validateIdempotencyKey', () => {
  it('accepts valid alphanumeric key', () => {
    const result = validateIdempotencyKey('abc123');
    expect(result.valid).toBe(true);
  });

  it('accepts key with underscore and hyphen', () => {
    const result = validateIdempotencyKey('my_key-2026');
    expect(result.valid).toBe(true);
  });

  it('rejects empty string', () => {
    const result = validateIdempotencyKey('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('tidak kosong');
  });

  it('rejects null/undefined', () => {
    const result = validateIdempotencyKey(null as any);
    expect(result.valid).toBe(false);
  });

  it('rejects key with colon (reserved separator)', () => {
    const result = validateIdempotencyKey('abc:def');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('huruf, angka, underscore, dan hyphen');
  });

  it('rejects key with spaces', () => {
    const result = validateIdempotencyKey('abc def');
    expect(result.valid).toBe(false);
  });

  it('rejects key with special characters', () => {
    const result = validateIdempotencyKey('abc@def!');
    expect(result.valid).toBe(false);
  });

  it('rejects key exceeding 128 chars', () => {
    const longKey = 'a'.repeat(129);
    const result = validateIdempotencyKey(longKey);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('128');
  });

  it('accepts key at exactly 128 chars', () => {
    const key128 = 'a'.repeat(128);
    const result = validateIdempotencyKey(key128);
    expect(result.valid).toBe(true);
  });
});

// ── Unit Tests: computeJournalPayloadHash ──────────────────────

describe('computeJournalPayloadHash', () => {
  it('returns 12-char hex string', () => {
    const hash = computeJournalPayloadHash({ tanggal: '2026-06-15', lines: [] });
    expect(hash).toMatch(/^[a-f0-9]{12}$/);
  });

  it('is deterministic for same input', () => {
    const payload = { tanggal: '2026-06-15', keterangan: 'Test', lines: [{ akun_id: 'a1', debit: 100, kredit: 0 }] };
    const hash1 = computeJournalPayloadHash(payload);
    const hash2 = computeJournalPayloadHash(payload);
    expect(hash1).toBe(hash2);
  });

  it('produces same hash regardless of key order', () => {
    const payload1 = { tanggal: '2026-06-15', keterangan: 'Test' };
    const payload2 = { keterangan: 'Test', tanggal: '2026-06-15' };
    expect(computeJournalPayloadHash(payload1)).toBe(computeJournalPayloadHash(payload2));
  });

  it('produces different hash for different payloads', () => {
    const payload1 = { tanggal: '2026-06-15', keterangan: 'Test A' };
    const payload2 = { tanggal: '2026-06-15', keterangan: 'Test B' };
    expect(computeJournalPayloadHash(payload1)).not.toBe(computeJournalPayloadHash(payload2));
  });

  it('handles nested arrays deterministically', () => {
    const payload = {
      tanggal: '2026-06-15',
      lines: [
        { akun_id: 'z', debit: 100, kredit: 0 },
        { akun_id: 'a', debit: 0, kredit: 100 },
      ],
    };
    const hash1 = computeJournalPayloadHash(payload);
    const hash2 = computeJournalPayloadHash({
      tanggal: '2026-06-15',
      lines: [
        { akun_id: 'a', debit: 0, kredit: 100 },
        { akun_id: 'z', debit: 100, kredit: 0 },
      ],
    });
    // Lines array order matters (not sorted), but object keys within each line are sorted
    expect(hash1).not.toBe(hash2);
  });

  it('handles null/undefined values', () => {
    const hash = computeJournalPayloadHash({ tanggal: '2026-06-15', referensi: null, keterangan: undefined });
    expect(hash).toMatch(/^[a-f0-9]{12}$/);
  });
});

// ── Unit Tests: deriveKey / extractBaseKey ──────────────────────

describe('deriveKey', () => {
  it('combines baseKey and payloadHash', () => {
    const derived = deriveKey('abc123', 'def456789012');
    expect(derived).toBe('abc123:def456789012');
  });

  it('extractBaseKey returns base from derived key', () => {
    expect(extractBaseKey('abc123:def456789012')).toBe('abc123');
  });

  it('extractBaseKey returns null for invalid format', () => {
    expect(extractBaseKey('no-colon')).toBeNull();
    expect(extractBaseKey('')).toBeNull();
  });
});

// ── Unit Tests: IDEMPOTENCY_WINDOW_HOURS ───────────────────────

describe('IDEMPOTENCY_WINDOW_HOURS', () => {
  it('is 24 hours (consistent with Fix #13)', () => {
    expect(IDEMPOTENCY_WINDOW_HOURS).toBe(24);
  });
});

// ── Integration Tests: checkJournalIdempotency (DB required) ───

describe('checkJournalIdempotency (integration)', () => {
  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const BASE_KEY = 'test-idem-001';
  const PAYLOAD_HASH_A = 'aaaa1111bbbb';
  const PAYLOAD_HASH_B = 'cccc2222dddd';

  it('returns "new" when no existing entry', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await checkJournalIdempotency(client, TENANT_ID, BASE_KEY, PAYLOAD_HASH_A);
      expect(result.status).toBe('new');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('advisory lock does not throw', async () => {
    const { acquireIdempotencyLock } = await import('./utils/journal-idempotency.js');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await expect(
        acquireIdempotencyLock(client, TENANT_ID, 'test-endpoint', BASE_KEY)
      ).resolves.not.toThrow();
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('processJournalIdempotency returns check=new + derivedKey', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await processJournalIdempotency(client, {
        tenantId: TENANT_ID,
        endpoint: 'test',
        baseKey: BASE_KEY,
        payload: { tanggal: '2026-06-15', lines: [] },
      });
      expect(result.check.status).toBe('new');
      expect(result.derivedKey).toContain(':');
      expect(result.payloadHash).toMatch(/^[a-f0-9]{12}$/);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
