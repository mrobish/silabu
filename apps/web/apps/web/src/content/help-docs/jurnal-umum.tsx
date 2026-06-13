import React from 'react';
import { HelpLink } from '../../help';
import type { HelpDoc } from './types';

export const jurnalUmumHelp: HelpDoc = {
  title: '\u{1F4D6} Panduan Jurnal Umum',
  sections: [
    {
      icon: '\u{1F3AF}',
      title: 'Mode Master-Detail',
      content: (
        <>
          <p className="mb-2">Mode <strong>Master-Detail</strong> memisahkan header jurnal (tanggal, no. bukti, keterangan) dari baris detail (akun, debit, kredit).</p>
          <p className="mb-2">Isi <HelpLink target="header-tanggal">Tanggal</HelpLink>, <HelpLink target="header-no_bukti">No. Bukti</HelpLink> (klik \u2728 untuk auto-generate), dan <HelpLink target="header-keterangan">Keterangan</HelpLink> di bagian atas.</p>
          <p className="mb-2">Lalu tambahkan baris detail: <HelpLink target="line-akun">Akun</HelpLink>, <HelpLink target="line-debit">Debit</HelpLink>, dan <HelpLink target="line-kredit">Kredit</HelpLink>.</p>
          <p className="text-emerald-600 font-medium mt-3 text-xs">\u2714 Klik teks hijau di atas untuk melihat lokasinya di form!</p>
        </>
      ),
    },
    {
      icon: '\u26A1',
      title: 'Smart Autofill',
      content: (
        <>
          <p className="mb-2">Ketik di <HelpLink target="line-debit">Debit</HelpLink> maka <HelpLink target="line-kredit">Kredit</HelpLink> otomatis 0, dan sebaliknya.</p>
          <p>Tidak perlu hapus manual \u2014 cukup ketik di satu sisi saja.</p>
        </>
      ),
    },
    {
      icon: '\u{1F4CA}',
      title: 'Mode Batch',
      content: (
        <>
          <p className="mb-2">Klik <HelpLink target="mode-toggle">Mode Batch</HelpLink> untuk beralih ke tampilan tabel lama.</p>
          <p>Cocok untuk bendahara yang terbiasa input banyak baris sekaligus dalam satu layar.</p>
        </>
      ),
    },
    {
      icon: '\u{1F4CB}',
      title: 'Template Jurnal',
      content: (
        <>
          <p className="mb-2">Klik <HelpLink target="btn-template">\u{1F4CB} Template</HelpLink> untuk memilih jurnal siap pakai.</p>
          <p>Template mengisi keterangan dan baris detail otomatis. Contoh: \u201CTerima Dana Desa\u201D \u2192 Kas (Debit) + Pendapatan (Kredit).</p>
        </>
      ),
    },
    {
      icon: '\u2705',
      title: 'Validasi & Penyimpanan',
      content: (
        <>
          <p className="mb-2">Sistem akan <strong>menolak</strong> penyimpanan jika:</p>
          <ul className="list-disc list-inside mb-2 space-y-1">
            <li>Total Debit \u2260 Total Kredit (selisih Rp 1 pun ditolak!)</li>
            <li>Kolom wajib kosong (tanggal, akun, nominal)</li>
            <li>Tanggal berada di periode terkunci</li>
          </ul>
          <p>Klik <HelpLink target="btn-simpan">\u{1F4BE} Simpan</HelpLink> untuk menyimpan jurnal.</p>
          <p className="text-amber-600 text-xs mt-2">\u26A0\uFE0F Double submit dicegah otomatis \u2014 tombol nonaktif saat proses simpan.</p>
        </>
      ),
    },
    {
      icon: '\u26A1',
      title: 'Tombol Kilat',
      content: (
        <>
          <p className="mb-1"><HelpLink target="btn-tambah-baris">+ Tambah Baris</HelpLink> \u2014 tambah baris detail baru</p>
          <p className="mb-1">\u2728 di samping No. Bukti \u2014 generate otomatis</p>
          <p>\u{1F5D1}\uFE0F di setiap baris \u2014 hapus baris detail</p>
        </>
      ),
    },
    {
      icon: '\u2328\uFE0F',
      title: 'Shortcut Keyboard',
      content: (
        <ul className="list-disc list-inside space-y-1">
          <li><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">Tab</kbd> \u2014 pindah ke kolom berikutnya</li>
          <li><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">Shift+Enter</kbd> \u2014 simpan jurnal</li>
          <li><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">Esc</kbd> \u2014 tutup dialog/drawer</li>
        </ul>
      ),
    },
    {
      icon: '\u{1F4A1}',
      title: 'Tips',
      content: (
        <ul className="list-disc list-inside space-y-1">
          <li>Draft otomatis tersimpan \u2014 refresh halaman tidak menghapus data</li>
          <li>Sistem akan menawarkan pemulihan draft jika ada draft tersimpan</li>
          <li>Akun yang sering dipakai bersama muncul di atas dropdown (Smart Partnering)</li>
          <li>Gunakan template untuk transaksi berulang (Dana Desa, Belanja, dll)</li>
        </ul>
      ),
    },
  ],
};
