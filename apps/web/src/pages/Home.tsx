import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export default function Home() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="SILABU DIGI Home">
            <img src="/logo.png" alt="SILABU DIGI" className="h-9 w-auto sm:h-10" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-3">
            <Link to="/login" className="nav-link rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100">
              Masuk
            </Link>
            <Link to="/register" className="btn-primary rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm">
              Daftar Gratis
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
            <Link to="/login" onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              Masuk
            </Link>
            <Link to="/register" onClick={() => setOpen(false)} className="block text-center rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm">
              Daftar Gratis
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-16 text-center">
        <h1 className="animate-fade-up text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.15] mb-4 sm:mb-6">
          Kelola Keuangan{' '}
          <span className="bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
            BUM Desa
          </span>
          <br className="hidden sm:block" /> dengan Mudah
        </h1>
        <p className="animate-fade-up stagger-1 text-base sm:text-lg text-slate-500 max-w-xl mx-auto mb-8 sm:mb-10 leading-relaxed">
          Platform digital untuk laporan keuangan BUM Desa se-Indonesia. Sesuai Kepmendesa 136/2022. Trial 14 hari gratis.
        </p>
        <Link
          to="/register"
          className="btn-primary animate-fade-up stagger-2 inline-flex items-center rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 sm:px-8 py-3.5 sm:py-4 text-base sm:text-lg font-semibold text-white shadow-lg"
        >
          Daftar & Mulai Trial 14 Hari
        </Link>
        <p className="animate-fade-up stagger-3 mt-4 text-sm text-slate-400">Tanpa kartu kredit. Batal kapan saja.</p>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16 sm:pb-24">
        <h2 className="animate-fade-up text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-2">Fitur Unggulan</h2>
        <p className="animate-fade-up stagger-1 text-sm sm:text-base text-slate-500 text-center mb-10 sm:mb-12">Semua yang BUM Desa butuhkan untuk kelola keuangan.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {[
            {
              icon: (
                <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              ),
              bg: 'bg-cyan-50',
              title: 'Buku Kas & Jurnal',
              desc: 'Input pemasukan & pengeluaran. Jurnal otomatis double-entry sesuai standar akuntansi.'
            },
            {
              icon: (
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              ),
              bg: 'bg-blue-50',
              title: 'Laporan Keuangan',
              desc: 'Neraca, Laba Rugi, Perubahan Modal, Arus Kas — cetak PDF siap audit.'
            },
            {
              icon: (
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              ),
              bg: 'bg-emerald-50',
              title: 'Aman & Multi-tenant',
              desc: 'Data tiap BUM Desa terisolasi. Backup otomatis. Enkripsi kredensial di database.'
            },
            {
              icon: (
                <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              ),
              bg: 'bg-violet-50',
              title: 'Multi-pengurus',
              desc: 'Data Penasihat, Direktur, Sekretaris, Bendahara, Pengawas — untuk kop laporan resmi.'
            },
            {
              icon: (
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              ),
              bg: 'bg-amber-50',
              title: 'Sesuai Regulasi',
              desc: 'Mengacu Kepmendesa 136/2022 tentang Pedoman BUM Desa. Siap diaudit.'
            },
            {
              icon: (
                <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
              ),
              bg: 'bg-rose-50',
              title: 'Pembayaran Digital',
              desc: 'Berlangganan via QRIS, Virtual Account, atau E-wallet. Transparan tanpa potongan.'
            },
          ].map((f, i) => (
            <div key={i} className={`animate-fade-up stagger-${i+1} card-hover rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm`}>
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${f.bg}`}>
                {f.icon}
              </div>
              <h3 className="mb-1.5 text-base sm:text-lg font-bold text-slate-900">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-slate-100 bg-slate-50/80">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 text-center">
          <h2 className="animate-fade-up text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Harga Sederhana</h2>
          <p className="animate-fade-up stagger-1 text-sm sm:text-base text-slate-500 mb-10 sm:mb-12">Satu harga untuk semua fitur. Tanpa biaya tersembunyi.</p>
          <div className="animate-scale-in mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Langganan Tahunan</p>
            <p className="mb-1">
              <span className="text-4xl sm:text-5xl font-bold text-slate-900">Rp1jt</span>
              <span className="text-base text-slate-400">/tahun</span>
            </p>
            <p className="text-sm text-slate-500 mb-6">Trial 14 hari gratis. Tanpa kartu kredit.</p>
            <Link
              to="/register"
              className="btn-primary block rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm"
            >
              Mulai Trial Gratis
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 sm:py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
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
