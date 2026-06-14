// apps/api/src/utils/journal-idempotency.ts
// Shared idempotency helper for journal-creating endpoints.
//
// Fix #18 (R1): Prevent double-submit for POST /jurnal-umum and POST /transaksi/quick.
//
// Design:
// - Client sends base idempotency_key (e.g., "abc123")
// - Server derives: "${baseKey}:${payloadHash}" (12-char SHA-256 hex)
// - Advisory lock per tenant+endpoint+baseKey (not global tenant lock)
// - All checks INSIDE transaction (no TOCTOU)
// - 24-hour window (consistent with Fix #13)
// - 409 conflict if same key + different payload
//
// Column names (production DB):
//   journal_entries: idempotency_key, tipetransaksi, no_jurnal, entry_id FK in journal_lines

import { createHash } from 'crypto';
import type { PoolClient } from 'pg';

// ── Constants ──────────────────────────────────────────────────

const SAFE_KEY_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_BASE_KEY_LENGTH = 128;
const PAYLOAD_HASH_LENGTH = 12; // 48 bits, sufficient for fingerprint
export const IDEMPOTENCY_WINDOW_HOURS = 24;

// ── Key Validation ─────────────────────────────────────────────

export interface KeyValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate base idempotency_key format.
 * - Non-empty string
 * - Only [a-zA-Z0-9_-]
 * - No colon (reserved for derived key separator)
 * - Max 128 chars
 */
export function validateIdempotencyKey(key: string): KeyValidation {
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

// ── Payload Hash ───────────────────────────────────────────────

/**
 * Compute deterministic payload fingerprint for journal creation.
 *
 * Normalizes: sort keys alphabetically, stringify, SHA-256, truncate to 12 hex chars.
 * Handles both POST /jurnal-umum and POST /transaksi/quick payloads.
 *
 * @param payload - Object with transaction data (tanggal, lines, keterangan, tipe, etc.)
 * @returns 12-char hex string
 */
export function computeJournalPayloadHash(payload: Record<string, any>): string {
  // Deep-sort all keys recursively for deterministic hash
  const normalized = sortKeys(payload);
  const hash = createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');
  return hash.slice(0, PAYLOAD_HASH_LENGTH);
}

/**
 * Recursively sort object keys for deterministic JSON serialization.
 */
function sortKeys(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (typeof obj === 'object') {
    const sorted: Record<string, any> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeys(obj[key]);
    }
    return sorted;
  }
  return obj;
}

// ── Derived Key ────────────────────────────────────────────────

/**
 * Derive full idempotency key for storage.
 * Format: "${baseKey}:${payloadHash}"
 */
export function deriveKey(baseKey: string, payloadHash: string): string {
  return `${baseKey}:${payloadHash}`;
}

/**
 * Extract base key prefix from a derived key.
 * Returns null if format is invalid.
 */
export function extractBaseKey(derivedKey: string): string | null {
  const idx = derivedKey.indexOf(':');
  if (idx <= 0) return null;
  return derivedKey.slice(0, idx);
}

// ── Advisory Lock ──────────────────────────────────────────────

/**
 * Acquire advisory lock per tenant+endpoint+baseKey.
 * Serializes concurrent requests with the same key.
 * Must be called INSIDE a transaction (lock releases on COMMIT/ROLLBACK).
 */
export async function acquireIdempotencyLock(
  client: PoolClient,
  tenantId: string,
  endpoint: string,
  baseKey: string,
): Promise<void> {
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtext('journal-idempotency'), hashtext($1))`,
    [`${tenantId}:${endpoint}:${baseKey}`]
  );
}

// ── Idempotency Check Result ───────────────────────────────────

export type IdempotencyCheckResult =
  | { status: 'new' }
  | {
      status: 'idempotent';
      entryId: string;
      noJurnal: string;
      tanggal: string;
      tipetransaksi: string;
      lines: any[];
    }
  | {
      status: 'conflict';
      message: string;
    };

/**
 * Check idempotency INSIDE transaction (after advisory lock).
 *
 * Scans journal_entries for any entry matching baseKey prefix within 24h window:
 * - Same payloadHash → idempotent (return existing)
 * - Different payloadHash → conflict (409)
 * - No match → new (proceed)
 *
 * @param client - PoolClient with active transaction
 * @param tenantId - Tenant UUID
 * @param baseKey - Client-provided idempotency key
 * @param payloadHash - 12-char hex fingerprint
 * @param windowHours - Idempotency window (default 24)
 */
export async function checkJournalIdempotency(
  client: PoolClient,
  tenantId: string,
  baseKey: string,
  payloadHash: string,
  windowHours: number = IDEMPOTENCY_WINDOW_HOURS,
): Promise<IdempotencyCheckResult> {
  // Find ALL entries with matching baseKey prefix within window
  // Using LIKE for prefix match: "baseKey:%"
  const likePattern = baseKey.replace(/[%_\\]/g, '\\$&') + ':%';

  const existing = await client.query(
    `SELECT id, no_jurnal AS "noJurnal", tanggal, tipetransaksi, idempotency_key
     FROM journal_entries
     WHERE tenant_id=$1
       AND idempotency_key LIKE $2 ESCAPE '\\'
       AND created_at > NOW() - ($3 || ' hours')::INTERVAL
     ORDER BY created_at DESC
     LIMIT 1`,
    [tenantId, likePattern, String(windowHours)]
  );

  if (!existing.rowCount) {
    return { status: 'new' };
  }

  const found = existing.rows[0] as any;
  const foundDerivedKey = found.idempotency_key as string;

  // Extract payload hash from the found derived key
  const colonIdx = foundDerivedKey.indexOf(':');
  const foundHash = colonIdx > 0 ? foundDerivedKey.slice(colonIdx + 1) : '';

  if (foundHash === payloadHash) {
    // Same key + same payload → idempotent
    const linesRes = await client.query(
      `SELECT id, entry_id, akun_id, debit, kredit, keterangan, contact_id, inventory_item_id, qty
       FROM journal_lines WHERE entry_id=$1 ORDER BY created_at`,
      [found.id]
    );

    return {
      status: 'idempotent',
      entryId: found.id,
      noJurnal: found.noJurnal,
      tanggal: found.tanggal instanceof Date
        ? found.tanggal.toISOString().slice(0, 10)
        : String(found.tanggal).slice(0, 10),
      tipetransaksi: found.tipetransaksi,
      lines: linesRes.rows,
    };
  }

  // Same key + different payload → conflict
  return {
    status: 'conflict',
    message: 'idempotency_key sudah dipakai dengan data berbeda. Gunakan key baru atau tunggu 24 jam.',
  };
}

// ── Convenience: Full Idempotency Flow ─────────────────────────

export interface JournalIdempotencyInput {
  tenantId: string;
  endpoint: string;
  baseKey: string;
  payload: Record<string, any>;
}

export interface JournalIdempotencyResult {
  /** Lock acquired + check done. 'new' = proceed, 'idempotent' = return existing, 'conflict' = 409 */
  check: IdempotencyCheckResult;
  /** Derived key to store in journal_entries.idempotency_key */
  derivedKey: string;
  /** Payload hash for audit */
  payloadHash: string;
}

/**
 * Full idempotency flow for journal-creating endpoints.
 * Call AFTER BEGIN, BEFORE any data mutation.
 *
 * Steps:
 * 1. Validate base key format
 * 2. Compute payload hash
 * 3. Derive full key
 * 4. Acquire advisory lock
 * 5. Check existing entries
 *
 * @param client - PoolClient with active transaction (BEGIN already called)
 * @param input - Idempotency parameters
 * @returns Check result + derived key for storage
 */
export async function processJournalIdempotency(
  client: PoolClient,
  input: JournalIdempotencyInput,
): Promise<JournalIdempotencyResult> {
  const { tenantId, endpoint, baseKey, payload } = input;

  // 1. Compute payload hash + derive key
  const payloadHash = computeJournalPayloadHash(payload);
  const derivedKey = deriveKey(baseKey, payloadHash);

  // 2. Advisory lock per tenant+endpoint+baseKey
  await acquireIdempotencyLock(client, tenantId, endpoint, baseKey);

  // 3. Check existing
  const check = await checkJournalIdempotency(client, tenantId, baseKey, payloadHash);

  return { check, derivedKey, payloadHash };
}
