import React from 'react';
import type { HelpDoc } from './types';

export const neracaHelp: HelpDoc = {
  title: '📖 Panduan Neraca',
  sections: [
    {
      icon: '⚖️',
      title: 'Tentang Neraca',
      content: 'Neraca (Balance Sheet) menampilkan posisi keuangan BUM Desa: Aset = Liabilitas + Ekuitas. Ini adalah laporan kesehatan keuangan utama.',
    },
    {
      icon: '📊',
      title: 'Struktur Neraca',
      content: (
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Aset</strong> — golongan 1 (Kas, Bank, Piutang, Persediaan, Aset Tetap)</li>
          <li><strong>Liabilitas</strong> — golongan 2 (Utang)</li>
          <li><strong>Ekuitas</strong> — golongan 3 (Modal + Laba Ditahan)</li>
        </ul>
      ),
    },
    {
      icon: '💡',
      title: 'Tips',
      content: 'Neraca harus selalu balance (Aset = Liabilitas + Ekuitas). Jika tidak balance, kemungkinan ada jurnal yang belum di-posting atau tidak balance.',
    },
  ],
};
