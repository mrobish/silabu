import React from 'react';
import type { HelpDoc } from './types';

export const tutupBukuHelp: HelpDoc = {
  title: '\u{1F4D6} Panduan Tutup Buku',
  sections: [
    {
      icon: '\u{1F512}',
      title: 'Tentang Tutup Buku',
      content: 'Tutup Buku (Year-End Closing) mengakhiri tahun buku: Laba/Rugi dipindahkan ke akun Laba Ditahan (3.3.01.01), dan saldo awal tahun baru disiapkan.',
    },
    {
      icon: '\u{1F4DD}',
      title: 'Proses Tutup Buku',
      content: (
        <ol className="list-decimal list-inside space-y-1">
          <li>Sistem membuat jurnal CLOSING: Pendapatan & Beban \u2192 Laba Ditahan</li>
          <li>Tahun buku dikunci (tidak bisa input jurnal lagi)</li>
          <li>Saldo awal tahun baru di-generate dari Neraca</li>
        </ol>
      ),
    },
    {
      icon: '\u26A0\uFE0F',
      title: 'Peringatan',
      content: 'Tutup Buku hanya bisa dilakukan SEKALI per tahun. Pastikan semua transaksi sudah dijurnal dan Neraca sudah balance sebelum proses.',
    },
  ],
};
