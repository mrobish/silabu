import React from 'react';
import type { HelpDoc } from './types';

export const inventoryHelp: HelpDoc = {
  title: '\u{1F4D6} Panduan Persediaan',
  sections: [
    {
      icon: '\u{1F4E6}',
      title: 'Tentang Persediaan',
      content: 'Halaman Persediaan menampilkan daftar semua produk/jasa BUM Desa beserta stok, harga beli, dan harga jual.',
    },
    {
      icon: '\u{1F534}',
      title: 'Badge Stok Minus',
      content: 'Produk dengan stok minus ditandai badge merah. Ini bisa terjadi karena penjualan melebihi stok (diizinkan oleh sistem).',
    },
    {
      icon: '\u{1F4DD}',
      title: 'Kelola Produk',
      content: 'Tambah, edit, atau hapus produk. Atur harga beli dan harga jual. Stok diperbarui otomatis dari transaksi POS.',
    },
  ],
};
