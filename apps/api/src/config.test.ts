/**
 * Tests for centralized config (JWT_SECRET + ENCRYPTION_KEY fail-fast)
 * 
 * Run: npx vitest run apps/api/src/config.test.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('config.ts — fail-fast validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules to re-import config fresh each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('JWT_SECRET', () => {
    it('throws if JWT_SECRET is empty string', async () => {
      process.env.JWT_SECRET = '';
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      
      await expect(async () => {
        await import('./config.js');
      }).rejects.toThrow(/JWT_SECRET.*wajib diisi/i);
    });

    it('throws if JWT_SECRET < 32 chars', async () => {
      process.env.JWT_SECRET = 'short-key-1234567890'; // 20 chars
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      
      await expect(async () => {
        await import('./config.js');
      }).rejects.toThrow(/JWT_SECRET.*terlalu pendek/i);
    });

    it('accepts JWT_SECRET with exactly 32 chars', async () => {
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.ENCRYPTION_KEY = 'b'.repeat(64);
      
      const { JWT_SECRET } = await import('./config.js');
      expect(JWT_SECRET).toHaveLength(32);
    });

    it('accepts JWT_SECRET with 64 chars', async () => {
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.ENCRYPTION_KEY = 'b'.repeat(64);
      
      const { JWT_SECRET } = await import('./config.js');
      expect(JWT_SECRET).toHaveLength(64);
    });
  });

  describe('ENCRYPTION_KEY', () => {
    it('throws if ENCRYPTION_KEY is missing', async () => {
      process.env.JWT_SECRET = 'a'.repeat(64);
      delete process.env.ENCRYPTION_KEY;
      
      await expect(async () => {
        await import('./config.js');
      }).rejects.toThrow(/ENCRYPTION_KEY.*wajib diisi/i);
    });

    it('throws if ENCRYPTION_KEY is empty string', async () => {
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.ENCRYPTION_KEY = '';
      
      await expect(async () => {
        await import('./config.js');
      }).rejects.toThrow(/ENCRYPTION_KEY.*wajib diisi/i);
    });

    it('throws if ENCRYPTION_KEY < 32 chars', async () => {
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.ENCRYPTION_KEY = 'short-key-1234567890'; // 20 chars
      
      await expect(async () => {
        await import('./config.js');
      }).rejects.toThrow(/ENCRYPTION_KEY.*terlalu pendek/i);
    });

    it('accepts ENCRYPTION_KEY with exactly 32 chars', async () => {
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.ENCRYPTION_KEY = 'b'.repeat(32);
      
      const { ENCRYPTION_KEY } = await import('./config.js');
      expect(ENCRYPTION_KEY).toHaveLength(32);
    });

    it('warns if ENCRYPTION_KEY === JWT_SECRET', async () => {
      const secret = 'a'.repeat(64);
      process.env.JWT_SECRET = secret;
      process.env.ENCRYPTION_KEY = secret;
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await import('./config.js');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ENCRYPTION_KEY sama dengan JWT_SECRET')
      );
      
      consoleSpy.mockRestore();
    });

    it('does NOT warn if ENCRYPTION_KEY !== JWT_SECRET', async () => {
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.ENCRYPTION_KEY = 'b'.repeat(64);
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await import('./config.js');
      
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('both secrets present', () => {
    it('exports both secrets correctly', async () => {
      const jwt = 'jwt-secret-' + 'x'.repeat(50);
      const enc = 'enc-secret-' + 'y'.repeat(50);
      process.env.JWT_SECRET = jwt;
      process.env.ENCRYPTION_KEY = enc;
      
      const config = await import('./config.js');
      
      expect(config.JWT_SECRET).toBe(jwt);
      expect(config.ENCRYPTION_KEY).toBe(enc);
      expect(config.JWT_SECRET).not.toBe(config.ENCRYPTION_KEY);
    });
  });
});
