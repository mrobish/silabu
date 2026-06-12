import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export default function Home() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="SILABU DIGI Home">
            <img src="/logo.png" alt="SILABU DIGI" className="h-9 w-auto sm:h-10" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-3">
            <Link to="/faq" className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors">
              FAQ
            </Link>
            <Link to="/login" className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors">
              Masuk
            </Link>
            <Link to="/register" viewTransition className="rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:shadow-lg hover:shadow-cyan-500/25 transition-all">
              Daftar
            </Link>
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setOpen(!open)} aria-label="Menu" className="sm:hidden -mr-2 p-2 text-slate-600 transition-colors hover:text-slate-900">
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile nav */}
        {open && (
          <div className="mobile-menu-enter sm:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
            <Link to="/faq" onClick={() => setOpen(false)} className="block text-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all">
              FAQ
            </Link>
            <Link to="/login" onClick={() => setOpen(false)} className="block text-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:border-cyan-300 hover:text-cyan-700 hover:bg-cyan-50/50 transition-all">
              Masuk
            </Link>
            <Link to="/register" onClick={() => setOpen(false)} className="block text-center rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all">
              Daftar
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-24">
        <div className="grid md:grid-cols-2 gap-10 md:gap-12 items-center">
          {/* Left — text */}
          <div className="text-center md:text-left">
            <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 mb-6 text-xs sm:text-sm font-medium text-emerald-700">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Sesuai Kepmendes 136/2022
            </div>
            <h1 className="animate-fade-up stagger-1 text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-[1.15] mb-5 sm:mb-6">
              Laporan Keuangan{' '}
              <span className="bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                BUM Desa
              </span>
              <br /> Jadi Mudah
            </h1>
            <p className="animate-fade-up stagger-2 text-base sm:text-lg text-slate-500 max-w-md mx-auto md:mx-0 mb-8 sm:mb-10 leading-relaxed">
              Catat transaksi, jurnal otomatis, dan cetak laporan keuangan resmi — semua dalam satu aplikasi.
            </p>
            <Link
              to="/register"
              viewTransition
              className="animate-fade-up stagger-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-8 py-4 text-base sm:text-lg font-semibold text-white shadow-lg hover:shadow-xl hover:shadow-cyan-500/30 hover:translate-y-[-1px] transition-all"
            >
              Mulai Sekarang
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
          </div>

          {/* Right — hero image */}
          <div className="animate-fade-up stagger-2 relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-emerald-200/30 to-cyan-200/30 rounded-3xl blur-2xl" aria-hidden="true" />
            <img
              src="/hero-accounting.jpg"
              alt="Workspace akuntansi — kalkulator dan keyboard untuk mengelola keuangan"
              className="relative rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 w-full h-auto object-cover aspect-[4/3]"
              loading="eager"
            />
            {/* Floating badge */}
            <div className="absolute -bottom-3 -left-3 sm:-bottom-4 sm:-left-4 bg-white rounded-xl shadow-lg border border-slate-100 px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Jurnal Otomatis</p>
                <p className="text-xs text-slate-500">Double-entry sekali input</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features — 3 inti */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
          {[
            {
              icon: (
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              ),
              bg: 'bg-emerald-50',
              title: 'Catat & Jurnal Otomatis',
              desc: 'Input transaksi sekali, jurnal double-entry tersusun otomatis sesuai standar akuntansi.'
            },
            {
              icon: (
                <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              ),
              bg: 'bg-cyan-50',
              title: 'Laporan Keuangan',
              desc: 'Neraca, Laba Rugi, Perubahan Modal, dan Arus Kas — cetak PDF kapan saja.'
            },
            {
              icon: (
                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              ),
              bg: 'bg-teal-50',
              title: 'Sesuai Regulasi',
              desc: 'Mengacu Kepmendes 136 Tahun 2022 tentang Panduan Penyusunan Laporan Keuangan BUM Desa.'
            },
          ].map((f, i) => (
            <div key={i} className={`animate-fade-up stagger-${i+1} rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all`}>
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${f.bg}`}>
                {f.icon}
              </div>
              <h3 className="mb-1.5 text-base sm:text-lg font-bold text-slate-900">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section className="border-t border-slate-100">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16 sm:py-20 text-center">
          <h2 className="animate-fade-up text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
            Siap merapikan keuangan BUM Desa Anda?
          </h2>
          <p className="animate-fade-up stagger-1 text-sm sm:text-base text-slate-500 mb-8 max-w-md mx-auto">
            Bergabung dan kelola laporan keuangan dengan rapi, transparan, dan sesuai standar.
          </p>
          <Link
            to="/register"
            viewTransition
            className="animate-fade-up stagger-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-8 py-4 text-base font-semibold text-white shadow-lg hover:shadow-xl hover:shadow-cyan-500/30 hover:translate-y-[-1px] transition-all"
          >
            Daftar Sekarang
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 sm:py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="SILABU DIGI" className="h-7 w-auto" />
            <span className="text-xs sm:text-sm text-slate-400">SILABU DIGI</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/faq" className="text-xs sm:text-sm text-slate-400 hover:text-emerald-600 transition-colors">FAQ</Link>
            <p className="text-xs sm:text-sm text-slate-400 text-center">© {new Date().getFullYear()} SILABU DIGI</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
