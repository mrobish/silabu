import React from 'react';
import { HelpLink } from '../../pages/HelpContext';
import type { HelpDoc } from './types';

export const bukuKasHelp: HelpDoc = {
  title: '📘 Buku Saku: Buku Kas',
  sections: [
    {
      icon: '💰',
      title: 'Rekening Tunai Harian',
      content: (
        <p>
          Halaman ini adalah buku saku khusus untuk memantau pergerakan uang tunai (Kas) yang dipegang BUM Desa setiap harinya.
          Semua tercatat urut berdasarkan tanggal terjadinya.
        </p>
      ),
    },
    {
      icon: '📈',
      title: 'Saldo yang Berjalan Sendiri',
      content: (
        <p>
          Lupakan kalkulator Anda. Di setiap baris, kolom paling kanan akan menunjukkan <HelpLink target="saldo-kas">Saldo Sisa</HelpLink>.
          Angka ini dihitung secara otomatis oleh sistem setiap kali ada uang yang masuk atau keluar,
          sehingga Anda selalu tahu persis berapa jumlah uang di laci hari ini.
        </p>
      ),
    },
    {
      icon: '📅',
      title: 'Mencari Riwayat Bulan Lalu',
      content: (
        <p>
          Ingin melihat catatan bulan lalu? Gunakan pilihan <HelpLink target="filter-periode">Bulan &amp; Tahun</HelpLink> di bagian atas tabel.
          Laporan akan otomatis menyesuaikan dengan periode yang Anda pilih.
        </p>
      ),
    },
    {
      icon: '➕',
      title: 'Menambahkan Catatan Kasir',
      content: (
        <p>
          Untuk mencatat uang masuk atau keluar, klik tombol <HelpLink target="btn-tambah-kas">+ Tambah Catatan</HelpLink>.
          Cukup tentukan tanggalnya, tuliskan keterangannya, lalu masukkan nominalnya di kolom Pemasukan ATAU Pengeluaran.
        </p>
      ),
    },
  ],
};
