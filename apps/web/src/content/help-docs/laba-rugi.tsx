import React from 'react';
import type { HelpDoc } from './types';

export const labaRugiHelp: HelpDoc = {
  title: '📖 Panduan Laba Rugi',
  sections: [
    {
      icon: '📈',
      title: 'Tentang Laba Rugi',
      content: 'Laporan Laba Rugi menampilkan Pendapatan dikurangi Beban dalam periode tertentu. Hasilnya adalah Laba Bersih (jika positif) atau Rugi Bersih (jika negatif).',
    },
    {
      icon: '📊',
      title: 'Struktur Laporan',
      content: (
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Pendapatan</strong> — semua akun golongan 4</li>
          <li><strong>Beban</strong> — semua akun golongan 5</li>
          <li><strong>Laba Bersih</strong> = Pendapatan – Beban</li>
        </ul>
      ),
    },
    {
      icon: '💡',
      title: 'Tips',
      content: 'Laba bersih otomatis masuk ke Perubahan Modal dan Neraca. Pastikan semua transaksi sudah dijurnal sebelum cetak laporan.',
    },
  ],
};
