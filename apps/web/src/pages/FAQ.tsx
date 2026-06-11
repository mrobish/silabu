import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ChevronDown, Search } from 'lucide-react';

/**
 * FAQ — dokumentasi & tanya-jawab untuk client.
 *
 * CARA MENAMBAH (tiap selesai 1 phase):
 *   1. Tambahkan objek baru ke array `FAQ_DATA` di bawah.
 *   2. Setiap kategori punya: { category, items: [{ q, a }] }.
 *   3. Jawaban (`a`) mendukung baris baru dengan \n (dirender jadi paragraf).
 *   4. Cukup edit file ini — tidak perlu ubah komponen.
 *
 * Konvensi: bahasa Indonesia, "BUM Desa" (pakai spasi), to-the-point.
 */
const FAQ_DATA: { category: string; items: { q: string; a: string }[] }[] = [
  {
    category: 'Umum',
    items: [
      {
        q: 'Apa itu SILABU DIGI?',
        a: 'SILABU DIGI adalah aplikasi pencatatan dan pelaporan keuangan digital khusus untuk BUM Desa. Anda mencatat transaksi sekali, lalu jurnal dan laporan keuangan tersusun otomatis sesuai standar akuntansi.',
      },
      {
        q: 'Siapa yang cocok memakai SILABU DIGI?',
        a: 'Pengurus BUM Desa — khususnya bendahara, direktur, dan sekretaris — yang bertanggung jawab atas pencatatan keuangan dan penyusunan laporan resmi.',
      },
      {
        q: 'Apakah perlu latar belakang akuntansi untuk memakainya?',
        a: 'Tidak. Anda cukup mencatat transaksi sehari-hari (pemasukan dan pengeluaran). Sistem yang menyusun jurnal double-entry dan laporan keuangannya secara otomatis.',
      },
    ],
  },
  {
    category: 'Regulasi & Standar',
    items: [
      {
        q: 'Apakah laporan SILABU DIGI sesuai regulasi?',
        a: 'Ya. Penyusunan laporan keuangan mengacu pada Keputusan Menteri Desa, PDT, dan Transmigrasi Nomor 136 Tahun 2022 tentang Panduan Penyusunan Laporan Keuangan Badan Usaha Milik Desa (BUM Desa).',
      },
      {
        q: 'Laporan apa saja yang dihasilkan?',
        a: 'Neraca, Laporan Laba Rugi, Laporan Perubahan Modal, dan Laporan Arus Kas. Semuanya dapat dicetak dalam format PDF.',
      },
      {
        q: 'Apakah Bagan Akun (CoA) sudah tersedia?',
        a: 'Ya. Sistem menyediakan Bagan Akun (Chart of Accounts) standar desa yang mengacu pada Kepmendes 136/2022, sehingga Anda tidak perlu menyusun daftar akun dari nol.',
      },
    ],
  },
  {
    category: 'Cara Memakai',
    items: [
      {
        q: 'Bagaimana cara mulai menggunakan SILABU DIGI?',
        a: '1. Daftar akun melalui menu Daftar.\n2. Lengkapi data BUM Desa Anda.\n3. Isi Saldo Awal (jika sudah berjalan sebelumnya).\n4. Mulai catat transaksi harian di menu Jurnal Umum.\n5. Lihat dan cetak laporan kapan saja.',
      },
      {
        q: 'Apa itu Saldo Awal dan kapan diisi?',
        a: 'Saldo Awal adalah posisi keuangan BUM Desa saat pertama kali mulai menggunakan aplikasi — meliputi kas, bank, persediaan, piutang, utang, modal, dan aset tetap. Diisi sekali di awal agar laporan akurat. Jika BUM Desa baru berdiri, saldo awal bisa nol.',
      },
      {
        q: 'Bagaimana mencatat transaksi harian?',
        a: 'Buka menu Jurnal Umum, lalu input transaksi pemasukan atau pengeluaran. Pilih akun yang sesuai, masukkan jumlah, dan simpan. Jurnal double-entry akan tersusun otomatis.',
      },
      {
        q: 'Apa itu menu Rincian Saldo?',
        a: 'Rincian Saldo adalah modul buku pembantu yang memecah total global Saldo Awal menjadi detail barang, kontak, dan aset. Terdiri dari 3 kategori:\n• Persediaan — daftar barang beserta jumlah dan harga\n• Hutang/Piutang — nama supplier dan pelanggan dengan sisa saldo\n• Aset Tetap — aset seperti kendaraan atau bangunan beserta penyusutan\nSistem akan otomatis membandingkan total rincian dengan angka di Buku Besar dan menampilkan badge hijau (cocok) atau merah (selisih).',
      },
      {
        q: 'Apa bedanya Saldo Awal dan Rincian Saldo?',
        a: 'Saldo Awal adalah total global per akun (misal: Persediaan = Rp10.000.000). Rincian Saldo adalah rincian di balik total itu (misal: Indomie Rp3.000.000 + Beras Rp7.000.000 = Rp10.000.000). Isi Saldo Awal dulu, baru masukkan rinciannya di menu Rincian Saldo.',
      },
    ],
  },
  {
    category: 'Akun & Keamanan',
    items: [
      {
        q: 'Bagaimana cara masuk ke akun saya?',
        a: 'Gunakan menu Masuk. Anda dapat masuk dengan email dan password, atau dengan akun Google yang terdaftar.',
      },
      {
        q: 'Saya lupa password, bagaimana?',
        a: 'Klik "Lupa password?" di halaman Masuk. Masukkan email Anda, lalu ikuti tautan reset password yang dikirim ke email tersebut.',
      },
      {
        q: 'Apakah data keuangan saya aman?',
        a: 'Ya. Data tiap BUM Desa terisolasi (multi-tenant), kredensial sensitif dienkripsi di database, dan akses dilindungi verifikasi keamanan.',
      },
    ],
  },
];

export default function FAQ() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = FAQ_DATA.map((group) => ({
    ...group,
    items: q
      ? group.items.filter(
          (it) => it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q),
        )
      : group.items,
  })).filter((group) => group.items.length > 0);

  return (
    <div className="min-h-dvh bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="SILABU DIGI Home">
            <img src="/logo.png" alt="SILABU DIGI" className="h-9 w-auto sm:h-10" />
          </Link>
          <div className="hidden sm:flex items-center gap-3">
            <Link to="/login" className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors">
              Masuk
            </Link>
            <Link to="/register" viewTransition className="rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:shadow-lg hover:shadow-cyan-500/25 transition-all">
              Daftar
            </Link>
          </div>
          <button onClick={() => setOpen(!open)} aria-label="Menu" className="sm:hidden -mr-2 p-2 text-slate-600 transition-colors hover:text-slate-900">
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {open && (
          <div className="mobile-menu-enter sm:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
            <Link to="/login" onClick={() => setOpen(false)} className="block text-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:border-cyan-300 hover:text-cyan-700 hover:bg-cyan-50/50 transition-all">
              Masuk
            </Link>
            <Link to="/register" onClick={() => setOpen(false)} className="block text-center rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all">
              Daftar
            </Link>
          </div>
        )}
      </nav>

      {/* Header */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 pt-14 sm:pt-20 pb-8 text-center">
        <h1 className="animate-fade-up text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
          Pertanyaan{' '}
          <span className="bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">Umum</span>
        </h1>
        <p className="animate-fade-up stagger-1 text-base text-slate-500 max-w-lg mx-auto">
          Panduan dan jawaban atas pertanyaan yang sering diajukan seputar SILABU DIGI.
        </p>

        {/* Search */}
        <div className="animate-fade-up stagger-2 relative mt-8 max-w-md mx-auto">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari pertanyaan..."
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 transition-all"
          />
        </div>
      </section>

      {/* FAQ list */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 pb-20">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-12">
            Tidak ada hasil untuk "{query}". Coba kata kunci lain.
          </p>
        ) : (
          filtered.map((group) => (
            <div key={group.category} className="mb-8">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-emerald-600">
                {group.category}
              </h2>
              <div className="space-y-2.5">
                {group.items.map((item) => {
                  const id = item.q;
                  const isOpen = active === id;
                  return (
                    <div key={id} className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden transition-all hover:border-slate-200">
                      <button
                        onClick={() => setActive(isOpen ? null : id)}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                        aria-expanded={isOpen}
                      >
                        <span className="text-sm sm:text-base font-semibold text-slate-800">{item.q}</span>
                        <ChevronDown
                          size={18}
                          className={`shrink-0 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      <div className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                          <div className="px-5 pb-4 text-sm text-slate-500 leading-relaxed space-y-2">
                            {item.a.split('\n').map((line, i) => (
                              <p key={i}>{line}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* Still need help */}
        <div className="mt-12 rounded-2xl border border-slate-100 bg-slate-50/80 p-6 sm:p-8 text-center">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5">Masih ada pertanyaan?</h3>
          <p className="text-sm text-slate-500 mb-5">
            Tim kami siap membantu Anda memulai dan menjawab kebutuhan spesifik BUM Desa Anda.
          </p>
          <Link
            to="/register"
            viewTransition
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
          >
            Mulai Sekarang
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 sm:py-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="SILABU DIGI" className="h-7 w-auto" />
            <span className="text-xs sm:text-sm text-slate-400">SILABU DIGI</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 text-center">© {new Date().getFullYear()} SILABU DIGI — Sistem Laporan BUM Desa Digital</p>
        </div>
      </footer>
    </div>
  );
}
