import { describe, it, expect } from 'vitest';
import {
  validateBaseKey,
  computePayloadHash,
  deriveGroupKey,
  buildBatchLikePattern,
  sortByGroupIndex,
  parseDerivedKey,
  extractGroupIndex,
} from './utils/batch-idempotency.js';

describe('batch-idempotency helpers', () => {
  // ─── validateBaseKey ───
  describe('validateBaseKey', () => {
    it('accepts alphanumeric key', () => {
      expect(validateBaseKey('abc123')).toEqual({ valid: true });
    });

    it('accepts key with underscore', () => {
      expect(validateBaseKey('my_key_123')).toEqual({ valid: true });
    });

    it('accepts key with hyphen', () => {
      expect(validateBaseKey('my-key-123')).toEqual({ valid: true });
    });

    it('rejects empty string', () => {
      expect(validateBaseKey('').valid).toBe(false);
    });

    it('rejects null/undefined', () => {
      expect(validateBaseKey(null as any).valid).toBe(false);
      expect(validateBaseKey(undefined as any).valid).toBe(false);
    });

    it('rejects key with spaces', () => {
      expect(validateBaseKey('my key').valid).toBe(false);
    });

    it('rejects key with colon (reserved for derive)', () => {
      expect(validateBaseKey('my:key').valid).toBe(false);
    });

    it('rejects key with special characters', () => {
      expect(validateBaseKey('key@#$%').valid).toBe(false);
    });

    it('rejects key exceeding max length', () => {
      const longKey = 'a'.repeat(129);
      expect(validateBaseKey(longKey).valid).toBe(false);
    });

    it('accepts key at max length', () => {
      const maxKey = 'a'.repeat(128);
      expect(validateBaseKey(maxKey)).toEqual({ valid: true });
    });
  });

  // ─── computePayloadHash ───
  describe('computePayloadHash', () => {
    const rows1 = [
      { tanggal: '2026-06-12', no_bukti: 'B001', akun_id: 'acc1', debit: '1000', kredit: '0' },
      { tanggal: '2026-06-12', no_bukti: 'B001', akun_id: 'acc2', debit: '0', kredit: '1000' },
    ];

    const rows2 = [
      { tanggal: '2026-06-12', no_bukti: 'B001', akun_id: 'acc2', debit: '0', kredit: '1000' },
      { tanggal: '2026-06-12', no_bukti: 'B001', akun_id: 'acc1', debit: '1000', kredit: '0' },
    ];

    it('returns 12-char hex string', () => {
      const hash = computePayloadHash(rows1);
      expect(hash).toMatch(/^[a-f0-9]{12}$/);
    });

    it('is deterministic (same input → same hash)', () => {
      expect(computePayloadHash(rows1)).toBe(computePayloadHash(rows1));
    });

    it('is order-independent (sorts before hashing)', () => {
      expect(computePayloadHash(rows1)).toBe(computePayloadHash(rows2));
    });

    it('differs for different payloads', () => {
      const rows3 = [
        { tanggal: '2026-06-12', no_bukti: 'B002', akun_id: 'acc1', debit: '2000', kredit: '0' },
        { tanggal: '2026-06-12', no_bukti: 'B002', akun_id: 'acc2', debit: '0', kredit: '2000' },
      ];
      expect(computePayloadHash(rows1)).not.toBe(computePayloadHash(rows3));
    });

    it('handles empty rows', () => {
      const hash = computePayloadHash([]);
      expect(hash).toMatch(/^[a-f0-9]{12}$/);
    });

    it('normalizes missing fields', () => {
      const sparse = [{ tanggal: null, debit: null }];
      const hash = computePayloadHash(sparse);
      expect(hash).toMatch(/^[a-f0-9]{12}$/);
    });
  });

  // ─── deriveGroupKey ───
  describe('deriveGroupKey', () => {
    it('produces baseKey:hash:index format', () => {
      const key = deriveGroupKey('abc123', 'a1b2c3d4e5f6', 0);
      expect(key).toBe('abc123:a1b2c3d4e5f6:0');
    });

    it('increments index correctly', () => {
      expect(deriveGroupKey('abc', 'hash1234hash', 0)).toBe('abc:hash1234hash:0');
      expect(deriveGroupKey('abc', 'hash1234hash', 1)).toBe('abc:hash1234hash:1');
      expect(deriveGroupKey('abc', 'hash1234hash', 9)).toBe('abc:hash1234hash:9');
      expect(deriveGroupKey('abc', 'hash1234hash', 10)).toBe('abc:hash1234hash:10');
    });
  });

  // ─── parseDerivedKey ───
  describe('parseDerivedKey', () => {
    it('parses valid derived key', () => {
      const result = parseDerivedKey('abc123:a1b2c3d4e5f6:2');
      expect(result).toEqual({
        baseKey: 'abc123',
        payloadHash: 'a1b2c3d4e5f6',
        groupIndex: 2,
      });
    });

    it('returns null for invalid format (no colons)', () => {
      expect(parseDerivedKey('abc123')).toBeNull();
    });

    it('returns null for wrong number of parts', () => {
      expect(parseDerivedKey('a:b')).toBeNull();
      expect(parseDerivedKey('a:b:c:d')).toBeNull();
    });

    it('returns null for non-numeric index', () => {
      expect(parseDerivedKey('abc:hash1234hash:xyz')).toBeNull();
    });

    it('returns null for negative index', () => {
      expect(parseDerivedKey('abc:hash1234hash:-1')).toBeNull();
    });

    it('returns null for invalid hash length', () => {
      expect(parseDerivedKey('abc:short:0')).toBeNull();
    });

    it('returns null for invalid baseKey chars', () => {
      expect(parseDerivedKey('a b c:hash1234hash:0')).toBeNull();
    });
  });

  // ─── buildBatchLikePattern ───
  describe('buildBatchLikePattern', () => {
    it('produces correct pattern', () => {
      expect(buildBatchLikePattern('abc', 'hash1234hash')).toBe('abc:hash1234hash:%');
    });

    it('escapes LIKE special chars in baseKey', () => {
      expect(buildBatchLikePattern('a%b', 'hash1234hash')).toBe('a\\%b:hash1234hash:%');
    });

    it('escapes underscore in baseKey', () => {
      expect(buildBatchLikePattern('a_b', 'hash1234hash')).toBe('a\\_b:hash1234hash:%');
    });
  });

  // ─── sortByGroupIndex ───
  describe('sortByGroupIndex', () => {
    it('sorts by numeric index (not string)', () => {
      const entries = [
        { idempotency_key: 'abc:a1b2c3d4e5f6:10' },
        { idempotency_key: 'abc:a1b2c3d4e5f6:2' },
        { idempotency_key: 'abc:a1b2c3d4e5f6:1' },
        { idempotency_key: 'abc:a1b2c3d4e5f6:9' },
      ];
      const sorted = sortByGroupIndex(entries);
      expect(sorted.map((e: any) => extractGroupIndex(e.idempotency_key))).toEqual([1, 2, 9, 10]);
    });

    it('handles empty array', () => {
      expect(sortByGroupIndex([])).toEqual([]);
    });

    it('handles single entry', () => {
      const entries = [{ idempotency_key: 'abc:a1b2c3d4e5f6:0' }];
      expect(sortByGroupIndex(entries)).toEqual(entries);
    });
  });

  // ─── extractGroupIndex ───
  describe('extractGroupIndex', () => {
    it('extracts index from valid key', () => {
      expect(extractGroupIndex('abc:a1b2c3d4e5f6:5')).toBe(5);
    });

    it('returns -1 for invalid key', () => {
      expect(extractGroupIndex('invalid')).toBe(-1);
    });
  });
});
