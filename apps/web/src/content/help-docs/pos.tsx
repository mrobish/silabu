import React from 'react';
import type { HelpDoc } from './types';

export const posHelp: HelpDoc = {
  title: '📖 Panduan Mini POS',
  sections: [
    {
      icon: '🛒',
      title: 'Tentang Mini POS',
      content: 'Mini POS (Point of Sale) adalah fitur kasir sederhana untuk mencatat penjualan produk/jasa BUM Desa. Transaksi otomatis tercatat di Jurnal Umum.',
    },
    {
      icon: '🔍',
      title: 'Pencarian Produk',
      content: 'Ketik nama produk di kolom pencarian untuk menemukan dengan cepat. Produk ditampilkan dengan stok terkini dan harga jual.',
    },
    {
      icon: '🛒',
      title: 'Keranjang & Checkout',
      content: 'Tambahkan produk ke keranjang, sesuaikan jumlah, lalu proses pembayaran. Stok otomatis berkurang dan jurnal otomatis terbuat.',
    },
    {
      icon: '💡',
      title: 'Tips',
      content: 'Sistem mengizinkan penjualan meski stok minus (dengan peringatan). Ini sesuai kondisi riil BUM Desa yang kadang jual dulu, stok menyusul.',
    },
  ],
};
