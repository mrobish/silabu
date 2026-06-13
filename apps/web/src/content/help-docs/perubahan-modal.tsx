import React from 'react';
import type { HelpDoc } from './types';

export const perubahanModalHelp: HelpDoc = {
  title: '📖 Panduan Perubahan Modal',
  sections: [
    {
      icon: '💰',
      title: 'Tentang Perubahan Modal',
      content: 'Laporan Perubahan Modal menunjukkan bagaimana modal pemilik BUM Desa berubah dari awal hingga akhir periode.',
    },
    {
      icon: '📊',
      title: 'Struktur Laporan',
      content: (
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Modal Awal</strong> — saldo golongan 3 di awal periode</li>
          <li><strong>Laba Bersih</strong> — dari Laporan Laba Rugi</li>
          <li><strong>Modal Akhir</strong> = Modal Awal + Laba Bersih</li>
        </ul>
      ),
    },
    {
      icon: '💡',
      title: 'Tips',
      content: 'Gunakan filter tanggal untuk melihat perubahan modal dalam periode tertentu. Laba ditahan dihitung otomatis dari Tutup Buku tahun sebelumnya.',
    },
  ],
};
