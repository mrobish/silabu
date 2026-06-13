import React from 'react';
import type { HelpDoc } from './types';

export const neracaHelp: HelpDoc = {
  title: '\u{1F4D6} Panduan Neraca',
  sections: [
    {
      icon: '\u2696\uFE0F',
      title: 'Tentang Neraca',
      content: 'Neraca (Balance Sheet) menampilkan posisi keuangan BUM Desa: Aset = Liabilitas + Ekuitas. Ini adalah laporan kesehatan keuangan utama.',
    },
    {
      icon: '\u{1F4CA}',
      title: 'Struktur Neraca',
      content: (
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Aset</strong> \u2014 golongan 1 (Kas, Bank, Piutang, Persediaan, Aset Tetap)</li>
          <li><strong>Liabilitas</strong> \u2014 golongan 2 (Utang)</li>
          <li><strong>Ekuitas</strong> \u2014 golongan 3 (Modal + Laba Ditahan)</li>
        </ul>
      ),
    },
    {
      icon: '\u{1F4A1}',
      title: 'Tips',
      content: 'Neraca harus selalu balance (Aset = Liabilitas + Ekuitas). Jika tidak balance, kemungkinan ada jurnal yang belum di-posting atau tidak balance.',
    },
  ],
};
