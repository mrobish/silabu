import React from 'react';
import type { HelpDoc } from './types';

export const pengaturanHelp: HelpDoc = {
  title: '\u{1F4D6} Panduan Pengaturan',
  sections: [
    {
      icon: '\u{1F464}',
      title: 'Profil BUM Desa',
      content: 'Kelola informasi BUM Desa: nama, alamat, dan foto profil. Informasi ini dicetak di header semua laporan.',
    },
    {
      icon: '\u{1F465}',
      title: 'Kelola Pengguna',
      content: 'Tambah atau hapus pengguna BUM Desa. Atur role: Admin (akses penuh) atau Karyawan (akses terbatas).',
    },
    {
      icon: '\u{1F4CB}',
      title: 'Pemetaan Akun (CoA)',
      content: 'Lihat dan kelola Chart of Accounts (CoA). Akun otomatis dibuat saat onboarding. Anda bisa menambah akun baru sesuai kebutuhan.',
    },
  ],
};
