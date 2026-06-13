import React from 'react';
import type { HelpDoc } from './types';

export const bukuKasHelp: HelpDoc = {
  title: '📖 Panduan Buku Kas',
  sections: [
    {
      icon: '💰',
      title: 'Tentang Buku Kas',
      content: 'Buku Kas mencatat semua transaksi kas (tunai) BUM Desa secara kronologis. Saldo berjalan dihitung otomatis dari awal tahun.',
    },
    {
      icon: '📅',
      title: 'Saldo Berjalan',
      content: 'Saldo dihitung dari base (saldo awal tahun) + semua pemasukan – semua pengeluaran. Saldo berlanjut dari bulan ke bulan dalam tahun yang sama.',
    },
    {
      icon: '🔍',
      title: 'Filter & Pencarian',
      content: 'Filter berdasarkan bulan dan tahun. Cari transaksi berdasarkan keterangan atau nomor bukti.',
    },
  ],
};
