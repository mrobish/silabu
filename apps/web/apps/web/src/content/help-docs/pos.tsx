import React from 'react';
import type { HelpDoc } from './types';

export const posHelp: HelpDoc = {
  title: '\u{1F4D6} Panduan Mini POS',
  sections: [
    {
      icon: '\u{1F6D2}',
      title: 'Tentang Mini POS',
      content: 'Mini POS (Point of Sale) adalah fitur kasir sederhana untuk mencatat penjualan produk/jasa BUM Desa. Transaksi otomatis tercatat di Jurnal Umum.',
    },
    {
      icon: '\u{1F50D}',
      title: 'Pencarian Produk',
      content: 'Ketik nama produk di kolom pencarian untuk menemukan dengan cepat. Produk ditampilkan dengan stok terkini dan harga jual.',
    },
    {
      icon: '\u{1F6D2}',
      title: 'Keranjang & Checkout',
      content: 'Tambahkan produk ke keranjang, sesuaikan jumlah, lalu proses pembayaran. Stok otomatis berkurang dan jurnal otomatis terbuat.',
    },
    {
      icon: '\u{1F4A1}',
      title: 'Tips',
      content: 'Sistem mengizinkan penjualan meski stok minus (dengan peringatan). Ini sesuai kondisi riil BUM Desa yang kadang jual dulu, stok menyusul.',
    },
  ],
};
