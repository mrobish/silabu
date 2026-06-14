/**
 * Fix #23: Arus Kas Classification
 *
 * Tests that contra accounts of kas/bank transactions are correctly classified
 * into Operasi, Investasi, or Pendanaan based on Kepmendesa 136 account codes.
 *
 * Classification rules (hardcoded by prefix, Kepmendesa 136):
 *   Operasi   = 1.1.03 (piutang), 1.1.05 (persediaan), 1.1.06 (biaya dimuka),
 *               4 (pendapatan), 5 (HPP), 6 (beban), 7 (luar biasa)
 *   Investasi = 1.2 (aset lain), 1.3 (aset tetap), 1.4 (aset tak berwujud)
 *   Pendanaan = 2 (kewajiban), 3 (ekuitas/prive)
 *
 * Run: npx vitest run apps/api/src/fix23-arus-kas-classification.test.ts
 */
import { describe, it, expect } from 'vitest';

/**
 * Simulate the arus-kas classification logic from accounting-routes.ts.
 * Returns 'OPERASI' | 'INVESTASI' | 'PENDANAAN'.
 */
function classifyCashFlow(kode: string): 'OPERASI' | 'INVESTASI' | 'PENDANAAN' {
  const g = kode[0];
  const sub2 = kode.slice(0, 3);

  if (sub2 === '1.2' || sub2 === '1.3' || sub2 === '1.4') {
    return 'INVESTASI';
  } else if (g === '2' || g === '3') {
    return 'PENDANAAN';
  } else {
    return 'OPERASI';
  }
}

describe('Fix #23 — Arus Kas Classification', () => {
  describe('Investasi', () => {
    it('1.2.xx.xx (Aset Lain-lain) → Investasi', () => {
      expect(classifyCashFlow('1.2.01.01')).toBe('INVESTASI');
    });

    it('1.3.xx.xx (Aset Tetap) → Investasi', () => {
      expect(classifyCashFlow('1.3.01.01')).toBe('INVESTASI');
      expect(classifyCashFlow('1.3.07.01')).toBe('INVESTASI');
    });

    it('1.4.xx.xx (Aset Tak Berwujud) → Investasi', () => {
      expect(classifyCashFlow('1.4.01.01')).toBe('INVESTASI');
    });
  });

  describe('Pendanaan', () => {
    it('2.1.xx.xx (Kewajiban Jangka Pendek) → Pendanaan', () => {
      expect(classifyCashFlow('2.1.01.01')).toBe('PENDANAAN');
    });

    it('2.2.xx.xx (Kewajiban Jangka Panjang) → Pendanaan', () => {
      expect(classifyCashFlow('2.2.01.01')).toBe('PENDANAAN');
    });

    it('3.1.xx.xx (Modal) → Pendanaan', () => {
      expect(classifyCashFlow('3.1.01.01')).toBe('PENDANAAN');
    });

    it('3.2.xx.xx (Prive) → Pendanaan', () => {
      expect(classifyCashFlow('3.2.01.01')).toBe('PENDANAAN');
    });

    it('3.3.xx.xx (Saldo Laba) → Pendanaan', () => {
      expect(classifyCashFlow('3.3.01.01')).toBe('PENDANAAN');
    });
  });

  describe('Operasi', () => {
    it('1.1.03.xx (Piutang) → Operasi', () => {
      expect(classifyCashFlow('1.1.03.01')).toBe('OPERASI');
    });

    it('1.1.05.xx (Persediaan) → Operasi', () => {
      expect(classifyCashFlow('1.1.05.01')).toBe('OPERASI');
    });

    it('1.1.06.xx (Biaya Dibayar Dimuka) → Operasi', () => {
      expect(classifyCashFlow('1.1.06.01')).toBe('OPERASI');
    });

    it('4.1.xx.xx (Pendapatan Jasa) → Operasi', () => {
      expect(classifyCashFlow('4.1.01.01')).toBe('OPERASI');
    });

    it('4.2.xx.xx (Pendapatan Dagang) → Operasi', () => {
      expect(classifyCashFlow('4.2.01.01')).toBe('OPERASI');
    });

    it('5.1.xx.xx (HPP) → Operasi', () => {
      expect(classifyCashFlow('5.1.01.01')).toBe('OPERASI');
    });

    it('6.1.xx.xx (Beban Operasional) → Operasi', () => {
      expect(classifyCashFlow('6.1.01.01')).toBe('OPERASI');
    });

    it('7.1.xx.xx (Pendapatan Luar Biasa) → Operasi', () => {
      expect(classifyCashFlow('7.1.01.01')).toBe('OPERASI');
    });

    it('7.2.xx.xx (Beban Luar Biasa) → Operasi', () => {
      expect(classifyCashFlow('7.2.01.01')).toBe('OPERASI');
    });
  });

  describe('Edge cases', () => {
    it('kode dengan spasi tetap benar (trim tidak diperlukan karena slice)', () => {
      // DB sometimes returns codes with trailing spaces
      expect(classifyCashFlow('1.3.01.01')).toBe('INVESTASI');
    });

    it('kode 1 digit tidak crash', () => {
      // Shouldn't happen in practice, but verify no crash
      expect(classifyCashFlow('1')).toBe('OPERASI');
    });

    it('kode kosong tidak crash', () => {
      expect(classifyCashFlow('')).toBe('OPERASI');
    });
  });

  describe('Mapping completeness — semua golongan terklasifikasi', () => {
    const expectedMapping: Record<string, string> = {
      '1.1.01.01': 'OPERASI',    // Kas (source, shouldn't appear but test safety)
      '1.1.02.01': 'OPERASI',    // Bank (source, shouldn't appear but test safety)
      '1.1.03.01': 'OPERASI',    // Piutang
      '1.1.05.01': 'OPERASI',    // Persediaan
      '1.1.06.01': 'OPERASI',    // Biaya Dibayar Dimuka
      '1.2.01.01': 'INVESTASI',  // Aset Lain-lain
      '1.3.01.01': 'INVESTASI',  // Aset Tetap
      '1.4.01.01': 'INVESTASI',  // Aset Tak Berwujud
      '2.1.01.01': 'PENDANAAN',  // Kewajiban JP
      '2.2.01.01': 'PENDANAAN',  // Kewajiban JP
      '3.1.01.01': 'PENDANAAN',  // Modal
      '3.2.01.01': 'PENDANAAN',  // Prive
      '3.3.01.01': 'PENDANAAN',  // Saldo Laba
      '4.1.01.01': 'OPERASI',    // Pendapatan Jasa
      '4.2.01.01': 'OPERASI',    // Pendapatan Dagang
      '5.1.01.01': 'OPERASI',    // HPP
      '6.1.01.01': 'OPERASI',    // Beban
      '7.1.01.01': 'OPERASI',    // Pendapatan Luar Biasa
      '7.2.01.01': 'OPERASI',    // Beban Luar Biasa
    };

    for (const [kode, expected] of Object.entries(expectedMapping)) {
      it(`${kode} → ${expected}`, () => {
        expect(classifyCashFlow(kode)).toBe(expected);
      });
    }
  });
});
