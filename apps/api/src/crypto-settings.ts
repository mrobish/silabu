import crypto from 'crypto';

// AES-256-GCM encryption for app_settings credentials.
// Key derived from ENCRYPTION_KEY env (or JWT_SECRET fallback) via scrypt.
const RAW_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'silabu-digi-secret-2026';
const KEY = crypto.scryptSync(RAW_KEY, 'silabu-settings-salt', 32);
const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

/** Encrypt a plain string. Returns prefixed base64 (iv:tag:ciphertext). */
export function encryptValue(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

/** Decrypt a value. Transparently returns plaintext if not encrypted (legacy/migration). */
export function decryptValue(stored: string): string {
  if (!stored) return stored;
  if (!stored.startsWith(PREFIX)) return stored; // legacy plain JSON — pass through
  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return stored; // corrupt — return as-is so caller's JSON.parse fails gracefully
  }
}

/** Encrypt a JSON-serializable object. */
export function encryptJSON(obj: any): string {
  return encryptValue(JSON.stringify(obj));
}

/** Decrypt + parse JSON. Returns {} on failure. */
export function decryptJSON(stored: string): any {
  if (!stored) return {};
  try { return JSON.parse(decryptValue(stored)); } catch { return {}; }
}
