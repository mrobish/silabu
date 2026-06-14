import { describe, it, expect } from 'vitest';
import {
  isKasBankKode,
  isBlockedSystemAccount,
  getAllowedTargetDescription,
} from './utils/quick-tx-validation.js';

describe('quick-tx-validation helpers', () => {
  // ─── isKasBankKode ───
  describe('isKasBankKode', () => {
    it('accepts Kas (1.1.01.xx)', () => {
      expect(isKasBankKode('1.1.01.01')).toBe(true);
      expect(isKasBankKode('1.1.01.02')).toBe(true);
    });

    it('accepts Bank (1.1.02.xx)', () => {
      expect(isKasBankKode('1.1.02.01')).toBe(true);
    });

    it('accepts Bank (1.1.04.xx)', () => {
      expect(isKasBankKode('1.1.04.01')).toBe(true);
    });

    it('accepts Bank (1.1.06.xx)', () => {
      expect(isKasBankKode('1.1.06.01')).toBe(true);
    });

    it('accepts Bank (1.1.11.xx)', () => {
      expect(isKasBankKode('1.1.11.01')).toBe(true);
    });

    it('rejects non-Kas/Bank accounts', () => {
      expect(isKasBankKode('1.1.03.01')).toBe(false); // Piutang
      expect(isKasBankKode('1.1.05.01')).toBe(false); // Persediaan
      expect(isKasBankKode('2.1.01.01')).toBe(false); // Utang
      expect(isKasBankKode('4.1.01.01')).toBe(false); // Pendapatan
      expect(isKasBankKode('5.1.01.01')).toBe(false); // Beban
    });

    it('handles whitespace in kode', () => {
      expect(isKasBankKode(' 1.1.01.01 ')).toBe(true);
    });
  });

  // ─── isBlockedSystemAccount ───
  describe('isBlockedSystemAccount', () => {
    it('blocks Saldo Laba (kelompok=saldo_laba)', () => {
      expect(isBlockedSystemAccount('3.3.01.01', 'saldo_laba')).toBe(true);
    });

    it('blocks Ikhtisar Laba Rugi', () => {
      expect(isBlockedSystemAccount('3.3.02.01', 'ikhtisar_laba_rugi')).toBe(true);
    });

    it('blocks RK Pusat', () => {
      expect(isBlockedSystemAccount('3.4.01.01', 'rk_pusat')).toBe(true);
    });

    it('blocks kode prefix 3.4.xx', () => {
      expect(isBlockedSystemAccount('3.4.01.01', 'some_kelompok')).toBe(true);
    });

    it('blocks kode prefix 3.8.xx', () => {
      expect(isBlockedSystemAccount('3.8.01.01', 'some_kelompok')).toBe(true);
    });

    it('blocks kode prefix 3.9.xx', () => {
      expect(isBlockedSystemAccount('3.9.01.01', 'some_kelompok')).toBe(true);
    });

    it('does NOT block normal accounts', () => {
      expect(isBlockedSystemAccount('1.1.01.01', 'aset_lancar')).toBe(false);
      expect(isBlockedSystemAccount('4.1.01.01', 'pendapatan')).toBe(false);
      expect(isBlockedSystemAccount('5.1.01.01', 'beban_operasional')).toBe(false);
      expect(isBlockedSystemAccount('3.1.01.01', 'modal_pemilik')).toBe(false);
      expect(isBlockedSystemAccount('3.2.01.01', 'pengambilan_pemilik')).toBe(false);
    });
  });

  // ─── getAllowedTargetDescription ───
  describe('getAllowedTargetDescription', () => {
    it('returns correct description for uang_masuk', () => {
      const desc = getAllowedTargetDescription('uang_masuk');
      expect(desc).toContain('Pendapatan');
      expect(desc).toContain('Piutang');
      expect(desc).toContain('Utang');
      expect(desc).toContain('Modal');
    });

    it('returns correct description for uang_keluar', () => {
      const desc = getAllowedTargetDescription('uang_keluar');
      expect(desc).toContain('Beban');
      expect(desc).toContain('Persediaan');
      expect(desc).toContain('Utang');
      expect(desc).toContain('Prive');
    });
  });
});
