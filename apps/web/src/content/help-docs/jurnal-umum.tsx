import React from 'react';
import { HelpLink } from '../../pages/HelpContext';
import type { HelpDoc } from './types';

export const jurnalUmumHelp: HelpDoc = {
  title: '📘 Buku Saku: Jurnal Umum',
  sections: [
    {
      icon: '📖',
      title: 'Apa Itu Jurnal Umum?',
      content: (
        <p>
          Ibarat buku harian keuangan BUM Desa, ini adalah tempat utama Anda mencatat setiap uang yang bergerak.
          Ada pemasukan atau pengeluaran? Catat di sini. Cukup masukkan angkanya, dan biarkan sistem pintar kami
          yang merangkumnya menjadi Laporan Keuangan secara otomatis.
        </p>
      ),
    },
    {
      icon: '📝',
      title: 'Informasi Dasar Transaksi (Bagian Atas)',
      content: (
        <>
          <p className="mb-2">Sebelum memasukkan angka, beri tahu sistem tentang transaksi ini:</p>
          <ul className="space-y-1.5 ml-1">
            <li><HelpLink target="header-tanggal">Tanggal</HelpLink>: Kapan transaksi terjadi? (Otomatis terisi hari ini).</li>
            <li><HelpLink target="header-no_bukti">Nomor Bukti</HelpLink>: Catat nomor dari nota/kwitansi Anda. Malas mengetik? Klik tombol ✨ di sebelahnya untuk membuat nomor urut otomatis.</li>
            <li><HelpLink target="header-keterangan">Keterangan</HelpLink>: Tulis intinya saja, misalnya &quot;Terima Dana Desa&quot; atau &quot;Beli Kertas HVS&quot;.</li>
          </ul>
        </>
      ),
    },
    {
      icon: '📊',
      title: 'Tabel Rincian Angka (Bagian Bawah)',
      content: (
        <>
          <p className="mb-2">Di sinilah Anda membagi angka transaksi:</p>
          <ul className="space-y-1.5 ml-1">
            <li><HelpLink target="line-akun">Akun</HelpLink>: Pilih laci keuangannya (contoh: Kas, Beban Gaji, atau Pendapatan).</li>
            <li><HelpLink target="line-debit">Debit</HelpLink>: Kolom untuk nilai yang masuk ke akun tersebut.</li>
            <li><HelpLink target="line-kredit">Kredit</HelpLink>: Kolom untuk nilai yang keluar dari akun tersebut.</li>
          </ul>
          <p className="mt-2">
            Butuh baris tambahan? Klik tombol <HelpLink target="btn-tambah-baris">+ Tambah Baris</HelpLink>.
            Kalau salah, cukup klik ikon 🗑️ untuk menghapus baris.
          </p>
        </>
      ),
    },
    {
      icon: '✨',
      title: 'Fitur Anti-Ribet: Angka Otomatis',
      content: (
        <p>
          Anda tidak perlu mengetik nominal dua kali! Jika Anda sudah mengetik angka di kolom Debit pada baris pertama,
          cukup tambahkan baris baru, lalu sistem akan langsung menyalin angka tersebut ke sisi Kredit di baris bawahnya.
          Anda tinggal fokus memilih nama Akun-nya saja.
        </p>
      ),
    },
    {
      icon: '📋',
      title: 'Tampilan Tabel Besar (Mode Batch)',
      content: (
        <p>
          Terbiasa dengan tampilan layar penuh ala Microsoft Excel? Klik tombol <HelpLink target="mode-toggle">Mode Batch</HelpLink> di pojok kanan atas.
          Tampilan akan berubah menjadi tabel luas yang sangat cocok jika Anda sedang mengebut memasukkan belasan transaksi sekaligus.
        </p>
      ),
    },
    {
      icon: '📋',
      title: 'Pola Siap Pakai (Template Jurnal)',
      content: (
        <p>
          Bingung menentukan Debit/Kredit? Jangan khawatir! Klik tombol <HelpLink target="btn-template">Template 📋</HelpLink> dan pilih jenis transaksi Anda
          (misal: &quot;Bayar Listrik&quot; atau &quot;Terima Bantuan&quot;). Sistem akan otomatis mengaturkan posisi Akun untuk Anda,
          sisanya Anda tinggal memasukkan nominal uangnya.
        </p>
      ),
    },
    {
      icon: '⚡',
      title: 'Tombol Sakti Penyeimbang (Auto-Balance)',
      content: (
        <p>
          Pusing mencari selisih angka Rp 500 perak antara Debit dan Kredit? Klik saja ikon Petir <HelpLink target="btn-auto-balance">⚡</HelpLink> di baris paling bawah!
          Sistem akan menghitung dan menambal selisihnya seketika agar jurnal Anda seimbang.
        </p>
      ),
    },
    {
      icon: '✅',
      title: 'Syarat Menyimpan Data',
      content: (
        <>
          <p className="mb-2">Perhatikan ringkasan angka di bagian paling bawah. Tombol <HelpLink target="btn-simpan">Simpan Jurnal</HelpLink> hanya akan menyala hijau jika:</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Total angka Debit dan Kredit sudah sama (Seimbang/Balance).</li>
            <li>Anda tidak memilih tanggal yang bulan laporannya sudah ditutup rapat.</li>
          </ul>
        </>
      ),
    },
    {
      icon: '💾',
      title: 'Penyelamat Data Otomatis',
      content: (
        <p>
          Lampu balai desa tiba-tiba mati atau browser tidak sengaja tertutup? Tenang saja, sistem diam-diam menyimpan
          ketikan Anda setiap beberapa detik. Saat Anda membuka halaman ini lagi, aplikasi akan menawarkan untuk
          memulihkan draf yang belum sempat tersimpan.
        </p>
      ),
    },
  ],
};
