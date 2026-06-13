import React from 'react';
import type { HelpDoc } from './types';

export const neracaSaldoHelp: HelpDoc = {
  title: '\u{1F4D6} Panduan Neraca Saldo',
  sections: [
    {
      icon: '\u{1F4CA}',
      title: 'Tentang Neraca Saldo',
      content: 'Neraca Saldo menampilkan saldo semua akun dalam periode tertentu. Gunakan untuk memverifikasi bahwa total Debit = total Kredit di seluruh akun.',
    },
    {
      icon: '\u{1F50D}',
      title: 'Fitur Utama',
      content: (
        <ul className="list-disc list-inside space-y-1">
          <li>Filter berdasarkan bulan dan tahun</li>
          <li>Export ke PDF untuk cetak</li>
          <li>Ringkasan total Debit, Kredit, dan Saldo</li>
          <li>Klik akun untuk melihat detail transaksi</li>
        </ul>
      ),
    },
    {
      icon: '\u{1F4A1}',
      title: 'Tips',
      content: 'Jika Neraca Saldo tidak balance, periksa jurnal yang belum balance di Jurnal Umum. Gunakan filter tanggal untuk menyempitkan pencarian.',
    },
  ],
};
