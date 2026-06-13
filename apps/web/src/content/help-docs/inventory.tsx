import React from 'react';
import type { HelpDoc } from './types';

export const inventoryHelp: HelpDoc = {
  title: '📖 Panduan Persediaan',
  sections: [
    {
      icon: '📦',
      title: 'Tentang Persediaan',
      content: 'Halaman Persediaan menampilkan daftar semua produk/jasa BUM Desa beserta stok, harga beli, dan harga jual.',
    },
    {
      icon: '🔴',
      title: 'Badge Stok Minus',
      content: 'Produk dengan stok minus ditandai badge merah. Ini bisa terjadi karena penjualan melebihi stok (diizinkan oleh sistem).',
    },
    {
      icon: '📝',
      title: 'Kelola Produk',
      content: 'Tambah, edit, atau hapus produk. Atur harga beli dan harga jual. Stok diperbarui otomatis dari transaksi POS.',
    },
  ],
};
