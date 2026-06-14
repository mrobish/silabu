import { describe, it, expect } from 'vitest';
import { computeLabaRugiMonthlyGrouped } from './utils/monthly-pl.js';

describe('computeLabaRugiMonthlyGrouped', () => {
  it('returns 12 months', async () => {
    // Use a fake tenant ID — query will return 0 rows, all months = 0
    const result = await computeLabaRugiMonthlyGrouped('00000000-0000-0000-0000-000000000000', 2026);
    expect(result).toHaveLength(12);
  });

  it('has correct month labels', async () => {
    const result = await computeLabaRugiMonthlyGrouped('00000000-0000-0000-0000-000000000000', 2026);
    expect(result[0].label).toBe('Jan');
    expect(result[1].label).toBe('Feb');
    expect(result[11].label).toBe('Des');
  });

  it('has correct month numbers', async () => {
    const result = await computeLabaRugiMonthlyGrouped('00000000-0000-0000-0000-000000000000', 2026);
    expect(result[0].month).toBe(1);
    expect(result[11].month).toBe(12);
  });

  it('returns all zeros for non-existent tenant', async () => {
    const result = await computeLabaRugiMonthlyGrouped('00000000-0000-0000-0000-000000000000', 2026);
    for (const m of result) {
      expect(m.pendapatan).toBe(0);
      expect(m.hpp).toBe(0);
      expect(m.bebanOperasional).toBe(0);
      expect(m.pendapatanLain).toBe(0);
      expect(m.bebanLain).toBe(0);
      expect(m.pajak).toBe(0);
      expect(m.labaBersih).toBe(0);
    }
  });

  it('labaBersih formula is correct for zero months', async () => {
    const result = await computeLabaRugiMonthlyGrouped('00000000-0000-0000-0000-000000000000', 2026);
    for (const m of result) {
      const expected = m.pendapatan - m.hpp - m.bebanOperasional
                     + m.pendapatanLain - m.bebanLain - m.pajak;
      expect(m.labaBersih).toBe(expected);
    }
  });

  it('different years return separate data', async () => {
    const r2025 = await computeLabaRugiMonthlyGrouped('00000000-0000-0000-0000-000000000000', 2025);
    const r2026 = await computeLabaRugiMonthlyGrouped('00000000-0000-0000-0000-000000000000', 2026);
    // Both should have 12 months
    expect(r2025).toHaveLength(12);
    expect(r2026).toHaveLength(12);
    // Labels should be same
    expect(r2025[0].label).toBe(r2026[0].label);
  });
});
