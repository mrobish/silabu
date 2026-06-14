import { createHash } from 'crypto';

/**
 * Batch idempotency helpers for POST /jurnal-umum/batch
 * 
 * Design: Opsi B — derived key per group with payload fingerprint
 * 
 * Key format: "${baseKey}:${payloadHash}:${groupIndex}"
 * - baseKey: client-provided idempotency_key (alphanumeric + underscore + hyphen only)
 * - payloadHash: SHA-256 of normalized payload, truncated to 12 hex chars
 * - groupIndex: zero-based integer
 * 
 * Example: "abc123:a1b2c3d4e5f6:0", "abc123:a1b2c3d4e5f6:1"
 */

// Allowed characters for base idempotency key
const SAFE_KEY_PATTERN = /^[a-zA-Z0-9_-]+$/;

// Max length for base key (derived keys will be longer due to hash + index)
const MAX_BASE_KEY_LENGTH = 128;

// Idempotency window: 24 hours (retry can be slow)
export const IDEMPOTENCY_WINDOW = '24 hours';

/**
 * Validate base idempotency_key format.
 * Only alphanumeric, underscore, and hyphen allowed.
 */
export function validateBaseKey(key: string): { valid: boolean; error?: string } {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'idempotency_key harus berupa string tidak kosong' };
  }
  if (key.length > MAX_BASE_KEY_LENGTH) {
    return { valid: false, error: `idempotency_key maksimal ${MAX_BASE_KEY_LENGTH} karakter` };
  }
  if (!SAFE_KEY_PATTERN.test(key)) {
    return { valid: false, error: 'idempotency_key hanya boleh berisi huruf, angka, underscore, dan hyphen' };
  }
  return { valid: true };
}

/**
 * Compute payload fingerprint hash.
 * Normalize payload: sort keys, remove whitespace, JSON.stringify.
 * Returns 12-char hex string (48 bits, sufficient for fingerprint).
 */
export function computePayloadHash(rows: any[]): string {
  // Normalize: sort rows by (tanggal, no_bukti, akun_id) for deterministic hash
  const normalized = rows
    .map(r => ({
      tanggal: (r.tanggal || '').slice(0, 10),
      no_bukti: (r.no_bukti || '').trim(),
      keterangan: (r.keterangan || '').trim(),
      akun_id: r.akun_id,
      debit: String(r.debit || '0'),
      kredit: String(r.kredit || '0'),
      contact_id: r.contact_id || null,
      inventory_item_id: r.inventory_item_id || null,
      qty: r.qty || null,
    }))
    .sort((a, b) => {
      // Sort by tanggal, then no_bukti, then akun_id
      const cmpTanggal = a.tanggal.localeCompare(b.tanggal);
      if (cmpTanggal !== 0) return cmpTanggal;
      const cmpBukti = a.no_bukti.localeCompare(b.no_bukti);
      if (cmpBukti !== 0) return cmpBukti;
      return (a.akun_id || '').localeCompare(b.akun_id || '');
    });

  const hash = createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');

  // Truncate to 12 chars (48 bits) — sufficient for fingerprint uniqueness
  return hash.slice(0, 12);
}

/**
 * Derive idempotency key for a specific group in a batch.
 * Format: "${baseKey}:${payloadHash}:${groupIndex}"
 */
export function deriveGroupKey(baseKey: string, payloadHash: string, groupIndex: number): string {
  return `${baseKey}:${payloadHash}:${groupIndex}`;
}

/**
 * Extract base key and payload hash from a derived key.
 * Returns null if format is invalid.
 */
export function parseDerivedKey(derivedKey: string): { baseKey: string; payloadHash: string; groupIndex: number } | null {
  // Format: baseKey:payloadHash:groupIndex
  const parts = derivedKey.split(':');
  if (parts.length !== 3) return null;

  const [baseKey, payloadHash, indexStr] = parts;
  const groupIndex = parseInt(indexStr, 10);

  if (isNaN(groupIndex) || groupIndex < 0) return null;
  if (!SAFE_KEY_PATTERN.test(baseKey)) return null;
  if (!/^[a-f0-9]{12}$/.test(payloadHash)) return null;

  return { baseKey, payloadHash, groupIndex };
}

/**
 * Build LIKE pattern for finding all entries in a batch.
 * Escapes special LIKE characters in baseKey and payloadHash.
 */
export function buildBatchLikePattern(baseKey: string, payloadHash: string): string {
  // Escape LIKE special characters: %, _, \
  const escapeLike = (s: string) => s.replace(/[%_\\]/g, '\\$&');
  return `${escapeLike(baseKey)}:${escapeLike(payloadHash)}:%`;
}

/**
 * Sort entries by their group index (parsed from derived key).
 * Handles numeric sorting: 1, 2, ..., 9, 10 (not string sort: 1, 10, 2, ...)
 */
export function sortByGroupIndex(entries: any[]): any[] {
  return entries.sort((a, b) => {
    const indexA = parseDerivedKey(a.idempotency_key)?.groupIndex ?? 0;
    const indexB = parseDerivedKey(b.idempotency_key)?.groupIndex ?? 0;
    return indexA - indexB;
  });
}

/**
 * Extract group index from derived key for sorting.
 * Returns -1 if key format is invalid (will sort to beginning).
 */
export function extractGroupIndex(derivedKey: string): number {
  const parsed = parseDerivedKey(derivedKey);
  return parsed?.groupIndex ?? -1;
}
