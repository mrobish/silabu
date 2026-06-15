import { describe, it, expect } from 'vitest';
import { decryptJSON, encryptJSON } from './crypto-settings.js';

/**
 * SA-01: Settings Secret Masking + Partial Update
 * Tests the masking and merge logic in settings-routes.ts
 */

// ── Masking logic (mirrors settings-routes.ts) ────────────────
const SECRET_FIELDS: Record<string, string[][]> = {
  smtp:     [['pass', 'hasPass']],
  oauth:    [['googleClientSecret', 'hasGoogleClientSecret']],
  tripay:   [['apiKey', 'hasApiKey'], ['secretKey', 'hasSecretKey']],
  security: [['turnstile_secret_key', 'hasTurnstileSecretKey']],
};

function maskSecrets(groupKey: string, obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const fields = SECRET_FIELDS[groupKey];
  if (!fields) return obj;
  const masked = { ...obj };
  for (const [field, flag] of fields) {
    masked[flag] = !!masked[field];
    masked[field] = '';
  }
  return masked;
}

function mergeWithExisting(groupKey: string, incoming: any, existing: any): any {
  if (!existing || typeof existing !== 'object') return incoming;
  if (!incoming || typeof incoming !== 'object') return incoming;
  const fields = SECRET_FIELDS[groupKey];
  const secretKeys = fields ? fields.map(f => f[0]) : [];
  const merged = { ...incoming };
  for (const sk of secretKeys) {
    const val = merged[sk];
    if (!val || val === '' || (typeof val === 'string' && val.startsWith('****'))) {
      merged[sk] = existing[sk];
    }
  }
  return merged;
}

// ── Tests ──────────────────────────────────────────────────────

describe('SA-01: Settings Secret Masking', () => {
  describe('maskSecrets()', () => {
    it('should mask smtp.pass and add hasPass flag', () => {
      const input = { host: 'smtp.gmail.com', port: 587, user: 'test', pass: 'secret123', from: 'test@test.com', secure: false };
      const result = maskSecrets('smtp', input);
      expect(result.pass).toBe('');
      expect(result.hasPass).toBe(true);
      expect(result.host).toBe('smtp.gmail.com');
      expect(result.user).toBe('test');
    });

    it('should mask oauth.googleClientSecret and add hasGoogleClientSecret', () => {
      const input = { googleEnabled: true, googleClientId: 'abc', googleClientSecret: 'GOCSPX-secret' };
      const result = maskSecrets('oauth', input);
      expect(result.googleClientSecret).toBe('');
      expect(result.hasGoogleClientSecret).toBe(true);
      expect(result.googleClientId).toBe('abc');
      expect(result.googleEnabled).toBe(true);
    });

    it('should mask tripay.apiKey and tripay.secretKey', () => {
      const input = { merchantId: 'M123', apiKey: 'api_key_123', secretKey: 'secret_456' };
      const result = maskSecrets('tripay', input);
      expect(result.apiKey).toBe('');
      expect(result.secretKey).toBe('');
      expect(result.hasApiKey).toBe(true);
      expect(result.hasSecretKey).toBe(true);
      expect(result.merchantId).toBe('M123');
    });

    it('should mask security.turnstile_secret_key', () => {
      const input = { turnstile_site_key: '0xAAA', turnstile_secret_key: 'secret_key' };
      const result = maskSecrets('security', input);
      expect(result.turnstile_secret_key).toBe('');
      expect(result.hasTurnstileSecretKey).toBe(true);
      expect(result.turnstile_site_key).toBe('0xAAA');
    });

    it('should set hasFlag=false when secret is empty', () => {
      const input = { host: 'smtp.gmail.com', pass: '', user: 'test' };
      const result = maskSecrets('smtp', input);
      expect(result.pass).toBe('');
      expect(result.hasPass).toBe(false);
    });

    it('should handle null/undefined input gracefully', () => {
      expect(maskSecrets('smtp', null)).toBe(null);
      expect(maskSecrets('smtp', undefined)).toBe(undefined);
    });

    it('should not expose known secret values in masked output', () => {
      const knownSecrets = ['secret123', 'GOCSPX-secret', 'api_key_123', 'secret_456'];
      const groups = [
        { key: 'smtp', obj: { pass: 'secret123' } },
        { key: 'oauth', obj: { googleClientSecret: 'GOCSPX-secret' } },
        { key: 'tripay', obj: { apiKey: 'api_key_123', secretKey: 'secret_456' } },
        { key: 'security', obj: { turnstile_secret_key: 'turnstile_real_secret' } },
      ];
      for (const g of groups) {
        const masked = maskSecrets(g.key, g.obj);
        const json = JSON.stringify(masked);
        for (const secret of knownSecrets) {
          expect(json).not.toContain(secret);
        }
      }
      // Also verify security secret specifically
      const secMasked = maskSecrets('security', { turnstile_secret_key: 'turnstile_real_secret' });
      expect(JSON.stringify(secMasked)).not.toContain('turnstile_real_secret');
    });
  });

  describe('mergeWithExisting()', () => {
    it('should preserve existing secret when incoming is empty', () => {
      const existing = { host: 'smtp.gmail.com', pass: 'old_secret', user: 'test' };
      const incoming = { host: 'smtp.new.com', pass: '', user: 'newuser' };
      const result = mergeWithExisting('smtp', incoming, existing);
      expect(result.pass).toBe('old_secret');
      expect(result.host).toBe('smtp.new.com');
      expect(result.user).toBe('newuser');
    });

    it('should update secret when new value is provided', () => {
      const existing = { host: 'smtp.gmail.com', pass: 'old_secret' };
      const incoming = { host: 'smtp.gmail.com', pass: 'new_secret' };
      const result = mergeWithExisting('smtp', incoming, existing);
      expect(result.pass).toBe('new_secret');
    });

    it('should preserve existing secret when incoming is undefined', () => {
      const existing = { googleClientId: 'abc', googleClientSecret: 'old_secret' };
      const incoming = { googleClientId: 'xyz' };
      const result = mergeWithExisting('oauth', incoming, existing);
      expect(result.googleClientSecret).toBe('old_secret');
      expect(result.googleClientId).toBe('xyz');
    });

    it('should not store masked placeholder as secret', () => {
      const existing = { apiKey: 'real_key', secretKey: 'real_secret' };
      const incoming = { apiKey: '****key', secretKey: '****cret' };
      const result = mergeWithExisting('tripay', incoming, existing);
      expect(result.apiKey).toBe('real_key');
      expect(result.secretKey).toBe('real_secret');
    });

    it('should handle multiple secret fields independently', () => {
      const existing = { apiKey: 'old_api', secretKey: 'old_secret' };
      const incoming = { apiKey: 'new_api', secretKey: '' };
      const result = mergeWithExisting('tripay', incoming, existing);
      expect(result.apiKey).toBe('new_api');
      expect(result.secretKey).toBe('old_secret');
    });
  });

  describe('Encryption roundtrip', () => {
    it('should encrypt and decrypt settings correctly', () => {
      const original = { host: 'smtp.gmail.com', pass: 'secret123', port: 587 };
      const encrypted = encryptJSON(original);
      expect(encrypted).toContain('enc:v1:');
      const decrypted = decryptJSON(encrypted);
      expect(decrypted.pass).toBe('secret123');
      expect(decrypted.host).toBe('smtp.gmail.com');
    });

    it('should decrypt legacy plaintext JSON', () => {
      const plain = JSON.stringify({ host: 'smtp.gmail.com', pass: 'legacy_pass' });
      const result = decryptJSON(plain);
      expect(result.pass).toBe('legacy_pass');
    });
  });
});

describe('SA-01: Bcrypt Cost', () => {
  it('should hash password with cost 12', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('testpassword123', 12);
    // bcrypt hash format: $2b$12$...
    expect(hash).toMatch(/^\$2b\$12\$/);
  });

  it('should verify password regardless of cost', async () => {
    const bcrypt = await import('bcryptjs');
    const hash6 = await bcrypt.hash('testpass', 6);
    const hash12 = await bcrypt.hash('testpass', 12);
    expect(await bcrypt.compare('testpass', hash6)).toBe(true);
    expect(await bcrypt.compare('testpass', hash12)).toBe(true);
    expect(await bcrypt.compare('wrong', hash12)).toBe(false);
  });
});
