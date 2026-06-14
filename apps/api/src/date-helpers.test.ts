import { describe, it, expect } from 'vitest';
import { parseYmdStrict, compareYmd, isValidYmd } from './utils/date-helpers.js';

describe('parseYmdStrict', () => {
  it('throws on single-digit month', () => {
    expect(() => parseYmdStrict('2025-9-05')).toThrow('Format tanggal tidak valid');
  });

  it('parses a valid date string', () => {
    expect(parseYmdStrict('2025-09-05')).toEqual({ year: 2025, month: 9, day: 5 });
  });

  it('throws on invalid day for February (2025-02-30)', () => {
    expect(() => parseYmdStrict('2025-02-30')).toThrow('Tanggal tidak valid');
  });

  it('accepts Feb 29 in a leap year', () => {
    expect(parseYmdStrict('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it('throws on Feb 29 in a non-leap year', () => {
    expect(() => parseYmdStrict('2025-02-29')).toThrow();
  });

  it('throws on invalid month (13)', () => {
    expect(() => parseYmdStrict('2025-13-01')).toThrow('Bulan tidak valid');
  });
});

describe('compareYmd', () => {
  it('returns -1 when a < b', () => {
    expect(compareYmd('2025-09-05', '2025-10-01')).toBe(-1);
  });

  it('returns 1 when a > b', () => {
    expect(compareYmd('2025-10-01', '2025-09-05')).toBe(1);
  });

  it('returns 0 when a === b', () => {
    expect(compareYmd('2025-12-31', '2025-12-31')).toBe(0);
  });

  it('throws on invalid format in first argument', () => {
    expect(() => compareYmd('2025-9-05', '2025-10-01')).toThrow();
  });

  it('throws on invalid format in second argument', () => {
    expect(() => compareYmd('2025-10-01', '2025-9-05')).toThrow();
  });
});

describe('isValidYmd', () => {
  it('returns true for a valid date string', () => {
    expect(isValidYmd('2025-09-05')).toBe(true);
  });

  it('returns false for single-digit month', () => {
    expect(isValidYmd('2025-9-05')).toBe(false);
  });

  it('returns false for invalid day in February', () => {
    expect(isValidYmd('2025-02-30')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidYmd(null)).toBe(false);
  });
});
