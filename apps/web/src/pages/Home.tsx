import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src="/logo.png" alt="SILABU DIGI" className="h-10" />
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-semibold text-slate-700 hover:text-cyan-600">Masuk</Link>
            <Link to="/register" className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition">Daftar Gratis</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold text-slate-900 mb-6 leading-tight">
          Kelola Keuangan <span className="bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">BUM Desa</span> dengan Mudah
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
          Platform digital untuk laporan keuangan BUM Desa se-Indonesia. Sesuai Kepmendesa 136/2022. Trial 14 hari gratis.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/register" className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl text-lg font-semibold hover:shadow-xl transition">
            Daftar & Mulai Trial 14 Hari
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Buku Kas & Jurnal</h3>
            <p className="text-slate-600 text-sm">Input pemasukan & pengeluaran. Jurnal otomatis double-entry.</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Laporan Keuangan</h3>
            <p className="text-slate-600 text-sm">Neraca, Laba Rugi, Perubahan Modal, Arus Kas — sesuai standar.</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Aman & Terenkripsi</h3>
            <p className="text-slate-600 text-sm">Data BUM Desa tersimpan aman. Backup otomatis. Multi-tenant terisolasi.</p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">Harga Transparan</h2>
        <div className="max-w-sm mx-auto bg-white rounded-2xl p-8 shadow-md border border-slate-100">
          <p className="text-sm text-slate-600 mb-2">Langganan Tahunan</p>
          <p className="text-4xl font-bold text-slate-900 mb-2">Rp 1.000.000<span className="text-lg text-slate-500">/tahun</span></p>
          <p className="text-sm text-slate-500 mb-6">Trial 14 hari gratis. Tanpa kartu kredit.</p>
          <Link to="/register" className="block px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition">
            Mulai Trial Gratis
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 text-center">
        <div className="flex items-center justify-center gap-3 text-slate-500 text-sm">
          <img src="/logo.png" alt="SILABU DIGI" className="h-6" />
          <span>© 2026 SILABU DIGI — Sistem Laporan BUM Desa Digital</span>
        </div>
      </footer>
    </div>
  );
}
