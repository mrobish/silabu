import { describe, it, expect } from 'vitest';
import {
  parseMoneyStrict,
  dbNumericToCents,
  MAX_AMOUNT,
  MAX_AMOUNT_CENTS,
} from './utils/money-helpers.js';

// ─── Constants ───────────────────────────────────────────────────────────────

describe('MAX_AMOUNT / MAX_AMOUNT_CENTS', () => {
  it('MAX_AMOUNT is 999,999,999,999.99', () => {
    expect(MAX_AMOUNT).toBe(999_999_999_999.99);
  });

  it('MAX_AMOUNT_CENTS is MAX_AMOUNT * 100', () => {
    expect(MAX_AMOUNT_CENTS).toBe(99_999_999_999_999);
  });
});

// ─── parseMoneyStrict ────────────────────────────────────────────────────────

describe('parseMoneyStrict', () => {
  describe('valid numeric inputs', () => {
    it('converts whole number to cents (123 → 12300)', () => {
      expect(parseMoneyStrict(123)).toBe(12300);
    });

    it('converts decimal string to cents ("123.45" → 12345)', () => {
      expect(parseMoneyStrict('123.45')).toBe(12345);
    });

    it('handles zero string ("0" → 0)', () => {
      expect(parseMoneyStrict('0')).toBe(0);
    });

    it('handles smallest positive ("0.01" → 1)', () => {
      expect(parseMoneyStrict('0.01')).toBe(1);
    });

    it('trims whitespace ("  123.45  " → 12345)', () => {
      expect(parseMoneyStrict('  123.45  ')).toBe(12345);
    });

    it('handles MAX_AMOUNT boundary ("999999999999.99" → 99999999999999)', () => {
      expect(parseMoneyStrict('999999999999.99')).toBe(99_999_999_999_999);
    });

    it('handles floating point edge case (0.1 + 0.2 → 30)', () => {
      expect(parseMoneyStrict(0.1 + 0.2)).toBe(30);
    });
  });

  describe('rejects NaN / Infinity (string)', () => {
    it('throws on "NaN" string', () => {
      expect(() => parseMoneyStrict('NaN')).toThrow('tidak valid (NaN)');
    });

    it('throws on "Infinity" string', () => {
      expect(() => parseMoneyStrict('Infinity')).toThrow('tidak valid (Infinity)');
    });
  });

  describe('rejects NaN / Infinity (number)', () => {
    it('throws on NaN number', () => {
      expect(() => parseMoneyStrict(NaN)).toThrow('tidak valid');
    });

    it('throws on Infinity number', () => {
      expect(() => parseMoneyStrict(Infinity)).toThrow('tidak valid');
    });
  });

  describe('rejects malformed strings', () => {
    it('throws on mixed alphanumeric ("123abc")', () => {
      expect(() => parseMoneyStrict('123abc')).toThrow('bukan angka valid');
    });
  });

  describe('rejects negative values', () => {
    it('throws on negative string ("-100")', () => {
      expect(() => parseMoneyStrict('-100')).toThrow('tidak boleh negatif');
    });

    it('throws on negative decimal string ("-50.00")', () => {
      expect(() => parseMoneyStrict('-50.00')).toThrow('tidak boleh negatif');
    });
  });

  describe('rejects too many decimal places', () => {
    it('throws on 3 decimals ("123.456")', () => {
      expect(() => parseMoneyStrict('123.456')).toThrow('maksimal 2 angka desimal');
    });

    it('throws on 3 decimals for small value ("0.001")', () => {
      expect(() => parseMoneyStrict('0.001')).toThrow('maksimal 2 angka desimal');
    });
  });

  describe('rejects empty / null / undefined', () => {
    it('throws on empty string', () => {
      expect(() => parseMoneyStrict('')).toThrow('tidak boleh kosong');
    });

    it('throws on null', () => {
      expect(() => parseMoneyStrict(null)).toThrow('tidak boleh kosong');
    });

    it('throws on undefined', () => {
      expect(() => parseMoneyStrict(undefined)).toThrow('tidak boleh kosong');
    });
  });

  describe('rejects values above MAX_AMOUNT', () => {
    it('throws on amount above limit ("1000000000000.00")', () => {
      expect(() => parseMoneyStrict('1000000000000.00')).toThrow('melebihi batas maksimal');
    });
  });

  describe('rejects invalid types', () => {
    it('throws on plain object', () => {
      expect(() => parseMoneyStrict({})).toThrow('tipe tidak valid');
    });
  });
});

// ─── dbNumericToCents ────────────────────────────────────────────────────────

describe('dbNumericToCents', () => {
  it('converts decimal string ("100000.00" → 10000000)', () => {
    expect(dbNumericToCents('100000.00')).toBe(10_000_000);
  });

  it('handles zero string ("0" → 0)', () => {
    expect(dbNumericToCents('0')).toBe(0);
  });

  it('handles zero with decimals ("0.00" → 0)', () => {
    expect(dbNumericToCents('0.00')).toBe(0);
  });

  it('treats null as 0', () => {
    expect(dbNumericToCents(null)).toBe(0);
  });

  it('treats undefined as 0', () => {
    expect(dbNumericToCents(undefined)).toBe(0);
  });

  it('treats numeric 0 as 0', () => {
    expect(dbNumericToCents(0)).toBe(0);
  });
});
