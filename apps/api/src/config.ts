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

// ENCRYPTION_KEY: MUST be separate from JWT_SECRET (different purpose, different rotation policy)
// WARNING: Jangan rotate ENCRYPTION_KEY jika sudah ada data terenkripsi di database,
//          karena data lama tidak akan bisa dibaca!
const _encryptionKey = process.env.ENCRYPTION_KEY;
if (!_encryptionKey) {
  throw new Error(
    '[CONFIG] ENCRYPTION_KEY environment variable wajib diisi! ' +
    'Set di .env atau server environment. HARUS BERBEDA dari JWT_SECRET.'
  );
}
if (_encryptionKey.length < 32) {
  throw new Error(
    `[CONFIG] ENCRYPTION_KEY terlalu pendek (${_encryptionKey.length} chars). Minimal 32 karakter, disarankan 64.`
  );
}
if (_encryptionKey === _jwtSecret) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[CONFIG] ENCRYPTION_KEY tidak boleh sama dengan JWT_SECRET di production! ' +
      'Gunakan secret yang BERBEDA karena punya purpose dan rotation policy berbeda.'
    );
  }
  console.warn('[CONFIG] ⚠️ ENCRYPTION_KEY sama dengan JWT_SECRET! Gunakan secret yang BERBEDA untuk keamanan.');
}

export const ENCRYPTION_KEY: string = _encryptionKey;
