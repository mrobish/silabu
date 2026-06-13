import React from 'react';
import type { HelpDoc } from './types';

export const bukuKasHelp: HelpDoc = {
  title: '\u{1F4D6} Panduan Buku Kas',
  sections: [
    {
      icon: '\u{1F4B0}',
      title: 'Tentang Buku Kas',
      content: 'Buku Kas mencatat semua transaksi kas (tunai) BUM Desa secara kronologis. Saldo berjalan dihitung otomatis dari awal tahun.',
    },
    {
      icon: '\u{1F4C5}',
      title: 'Saldo Berjalan',
      content: 'Saldo dihitung dari base (saldo awal tahun) + semua pemasukan \u2013 semua pengeluaran. Saldo berlanjut dari bulan ke bulan dalam tahun yang sama.',
    },
    {
      icon: '\u{1F50D}',
      title: 'Filter & Pencarian',
      content: 'Filter berdasarkan bulan dan tahun. Cari transaksi berdasarkan keterangan atau nomor bukti.',
    },
  ],
};
