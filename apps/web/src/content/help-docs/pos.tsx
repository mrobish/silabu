import React from 'react';
import { HelpLink } from '../../pages/HelpContext';
import type { HelpDoc } from './types';

export const posHelp: HelpDoc = {
  title: '📘 Buku Saku: Mini POS (Kasir BUM Desa)',
  sections: [
    {
      icon: '🛒',
      title: 'Kasir Pintar BUM Desa',
      content: (
        <p>
          Halaman ini dirancang khusus untuk melayani pembeli layaknya mesin kasir minimarket.
          Anda cukup memilih barang, dan biarkan sistem yang otomatis memotong stok barang serta
          membuatkan catatan keuangannya ke Jurnal Umum!
        </p>
      ),
    },
    {
      icon: '🔍',
      title: 'Cara Mulai Melayani Pembeli',
      content: (
        <ol className="list-decimal list-inside space-y-1.5 ml-1">
          <li>Ketik nama barang di <HelpLink target="pos-search">Kolom Pencarian</HelpLink>, atau langsung klik gambar produk di daftar bawah.</li>
          <li>Barang akan otomatis masuk ke keranjang belanja di sebelah kanan.</li>
          <li>Sesuaikan jumlah yang dibeli pembeli menggunakan tombol <HelpLink target="pos-qty">+</HelpLink> atau <HelpLink target="pos-qty">-</HelpLink>.</li>
        </ol>
      ),
    },
    {
      icon: '💳',
      title: 'Menyelesaikan Pembayaran',
      content: (
        <>
          <p className="mb-2">Setelah rincian harga sesuai, klik tombol <HelpLink target="btn-bayar">Bayar</HelpLink>. Hebatnya, dalam satu kali klik ini, sistem melakukan 3 hal sekaligus untuk Anda:</p>
          <ol className="list-decimal list-inside space-y-1 ml-1">
            <li>Mengurangi jumlah stok barang di gudang.</li>
            <li>Mencatat uang masuk secara otomatis di buku akuntansi.</li>
            <li>Menyiapkan struk belanja yang siap dicetak.</li>
          </ol>
        </>
      ),
    },
    {
      icon: '⚠️',
      title: 'Stok Habis, Tapi Barang Aslinya Ada?',
      content: (
        <p>
          Jika stok di aplikasi terlihat angka 0 (atau merah), Anda tetap bisa melayani penjualan dan menekan tombol Bayar.
          Kami paham bahwa di lapangan, kadang fisik barangnya ada namun belum sempat dicatat ke dalam sistem penerimaan.
          Layani pembelinya dulu, rapikan stoknya nanti!
        </p>
      ),
    },
  ],
};
