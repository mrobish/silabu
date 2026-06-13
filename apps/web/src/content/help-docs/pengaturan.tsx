import React from 'react';
import type { HelpDoc } from './types';

export const pengaturanHelp: HelpDoc = {
  title: '📖 Panduan Pengaturan',
  sections: [
    {
      icon: '👤',
      title: 'Profil BUM Desa',
      content: 'Kelola informasi BUM Desa: nama, alamat, dan foto profil. Informasi ini dicetak di header semua laporan.',
    },
    {
      icon: '👥',
      title: 'Kelola Pengguna',
      content: 'Tambah atau hapus pengguna BUM Desa. Atur role: Admin (akses penuh) atau Karyawan (akses terbatas).',
    },
    {
      icon: '📋',
      title: 'Pemetaan Akun (CoA)',
      content: 'Lihat dan kelola Chart of Accounts (CoA). Akun otomatis dibuat saat onboarding. Anda bisa menambah akun baru sesuai kebutuhan.',
    },
  ],
};
