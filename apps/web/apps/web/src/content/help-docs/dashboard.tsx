import React from 'react';
import type { HelpDoc } from './types';

export const dashboardHelp: HelpDoc = {
  title: '\u{1F4D6} Panduan Dashboard',
  sections: [
    {
      icon: '\u{1F3E0}',
      title: 'Ringkasan Keuangan',
      content: 'Dashboard menampilkan ringkasan keuangan BUM Desa Anda secara real-time: total aset, kas, pendapatan, dan beban dalam periode berjalan.',
    },
    {
      icon: '\u{1F4CA}',
      title: 'Grafik & Tren',
      content: 'Lihat grafik tren pemasukan dan pengeluaran per bulan. Gunakan untuk memantau kesehatan keuangan BUM Desa dari waktu ke waktu.',
    },
    {
      icon: '\u26A1',
      title: 'Akses Cepat',
      content: 'Gunakan shortcut di dashboard untuk langsung menuju Jurnal Umum, Neraca Saldo, atau laporan lainnya tanpa melalui sidebar.',
    },
  ],
};
