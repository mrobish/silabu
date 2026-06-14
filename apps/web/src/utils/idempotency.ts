// apps/web/src/utils/idempotency.ts
// Frontend idempotency key generator for journal-creating endpoints.
//
// Fix #18 (R1): Generate unique key per submit attempt.
// Format: "web-{timestamp}-{random}" (alphanumeric + hyphen, no colon)

/**
 * Generate a unique idempotency key for a single submit attempt.
 * Format: "web-{timestamp base36}-{random 8 chars}"
 *
 * Rules:
 * - Unique per submit (never reuse for different submits)
 * - Valid characters: [a-zA-Z0-9_-] (no colon)
 * - Max 128 chars (this generates ~30 chars)
 */
export function generateIdempotencyKey(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `web-${ts}-${rand}`;
}
