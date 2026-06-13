import React from 'react';
import { HelpLink } from '../../pages/HelpContext';
import type { HelpDoc } from './types';

export const jurnalUmumHelp: HelpDoc = {
  title: '📖 Panduan Jurnal Umum',
  sections: [
    {
      icon: '🎯',
      title: 'Mode Master-Detail',
      content: (
        <>
          <p className="mb-2">Mode <strong>Master-Detail</strong> memisahkan header jurnal (tanggal, no. bukti, keterangan) dari baris detail (akun, debit, kredit).</p>
          <p className="mb-2">Isi <HelpLink target="header-tanggal">Tanggal</HelpLink>, <HelpLink target="header-no_bukti">No. Bukti</HelpLink> (klik ✨ untuk auto-generate), dan <HelpLink target="header-keterangan">Keterangan</HelpLink> di bagian atas.</p>
          <p className="mb-2">Lalu tambahkan baris detail: <HelpLink target="line-akun">Akun</HelpLink>, <HelpLink target="line-debit">Debit</HelpLink>, dan <HelpLink target="line-kredit">Kredit</HelpLink>.</p>
          <p className="text-emerald-600 font-medium mt-3 text-xs">✔ Klik teks hijau di atas untuk melihat lokasinya di form!</p>
        </>
      ),
    },
    {
      icon: '⚡',
      title: 'Smart Autofill',
      content: (
        <>
          <p className="mb-2">Ketik di <HelpLink target="line-debit">Debit</HelpLink> maka <HelpLink target="line-kredit">Kredit</HelpLink> otomatis 0, dan sebaliknya.</p>
          <p>Tidak perlu hapus manual — cukup ketik di satu sisi saja.</p>
        </>
      ),
    },
    {
      icon: '📊',
      title: 'Mode Batch',
      content: (
        <>
          <p className="mb-2">Klik <HelpLink target="mode-toggle">Mode Batch</HelpLink> untuk beralih ke tampilan tabel lama.</p>
          <p>Cocok untuk bendahara yang terbiasa input banyak baris sekaligus dalam satu layar.</p>
        </>
      ),
    },
    {
      icon: '📋',
      title: 'Template Jurnal',
      content: (
        <>
          <p className="mb-2">Klik <HelpLink target="btn-template">📋 Template</HelpLink> untuk memilih jurnal siap pakai.</p>
          <p>Template mengisi keterangan dan baris detail otomatis. Contoh: “Terima Dana Desa” → Kas (Debit) + Pendapatan (Kredit).</p>
        </>
      ),
    },
    {
      icon: '✅',
      title: 'Validasi & Penyimpanan',
      content: (
        <>
          <p className="mb-2">Sistem akan <strong>menolak</strong> penyimpanan jika:</p>
          <ul className="list-disc list-inside mb-2 space-y-1">
            <li>Total Debit ≠ Total Kredit (selisih Rp 1 pun ditolak!)</li>
            <li>Kolom wajib kosong (tanggal, akun, nominal)</li>
            <li>Tanggal berada di periode terkunci</li>
          </ul>
          <p>Klik <HelpLink target="btn-simpan">💾 Simpan</HelpLink> untuk menyimpan jurnal.</p>
          <p className="text-amber-600 text-xs mt-2">⚠️ Double submit dicegah otomatis — tombol nonaktif saat proses simpan.</p>
        </>
      ),
    },
    {
      icon: '⚡',
      title: 'Tombol Kilat',
      content: (
        <>
          <p className="mb-1"><HelpLink target="btn-tambah-baris">+ Tambah Baris</HelpLink> — tambah baris detail baru</p>
          <p className="mb-1">✨ di samping No. Bukti — generate otomatis</p>
          <p>🗑️ di setiap baris — hapus baris detail</p>
        </>
      ),
    },
    {
      icon: '⌨️',
      title: 'Shortcut Keyboard',
      content: (
        <ul className="list-disc list-inside space-y-1">
          <li><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">Tab</kbd> — pindah ke kolom berikutnya</li>
          <li><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">Shift+Enter</kbd> — simpan jurnal</li>
          <li><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">Esc</kbd> — tutup dialog/drawer</li>
        </ul>
      ),
    },
    {
      icon: '💡',
      title: 'Tips',
      content: (
        <ul className="list-disc list-inside space-y-1">
          <li>Draft otomatis tersimpan — refresh halaman tidak menghapus data</li>
          <li>Sistem akan menawarkan pemulihan draft jika ada draft tersimpan</li>
          <li>Akun yang sering dipakai bersama muncul di atas dropdown (Smart Partnering)</li>
          <li>Gunakan template untuk transaksi berulang (Dana Desa, Belanja, dll)</li>
        </ul>
      ),
    },
  ],
};
