/**
 * Centralized server config — single source of truth for secrets.
 * Throws at import time if required env vars are missing (fail-fast).
 */

const _jwtSecret = process.env.JWT_SECRET;
if (!_jwtSecret) {
  throw new Error(
    '[CONFIG] JWT_SECRET environment variable wajib diisi! ' +
    'Set di .env atau server environment. Tidak boleh pakai hardcoded fallback.'
  );
}
if (_jwtSecret.length < 32) {
  throw new Error(
    `[CONFIG] JWT_SECRET terlalu pendek (${_jwtSecret.length} chars). Minimal 32 karakter, disarankan 64.`
  );
}

export const JWT_SECRET: string = _jwtSecret;

// ENCRYPTION_KEY: separate env, falls back to JWT_SECRET only if explicitly intended
export const ENCRYPTION_KEY: string = process.env.ENCRYPTION_KEY || _jwtSecret;
