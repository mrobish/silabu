import { useState } from 'react';
import { Link } from 'react-router-dom';
import BackBar from './BackBar';

export default function RegisterChoice() {
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/google');
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || 'Google OAuth belum dikonfigurasi');
    } catch { alert('Terjadi kesalahan'); } finally { setLoading(false); }
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <BackBar />
      <div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 56px)' }}>
        <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 md:grid-cols-2 animate-scale-in">

          {/* LEFT — branded gradient panel */}
          <div className="relative hidden md:flex flex-col overflow-hidden animate-slide-in-left"
            style={{background: 'linear-gradient(to bottom right, #059669, #0891b2, #0e7490)'}}>
            {/* subtle dark overlay for text contrast */}
            <div className="absolute inset-0 bg-slate-900/20" aria-hidden="true" />
            {/* wavy SVG divider */}
            <svg className="absolute -right-[1px] top-0 z-10 h-full w-[48px] overflow-visible text-slate-50"
              preserveAspectRatio="none" viewBox="0 0 48 100" fill="currentColor" aria-hidden="true">
              <path d="M0 0 C 24 15, 48 35, 24 50 C 0 65, 24 85, 0 100 L 48 100 L 48 0 Z" />
            </svg>
            {/* decorative blobs */}
            <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
            <div className="absolute -bottom-20 right-4 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" aria-hidden="true" />
            {/* bottom wave */}
            <svg className="absolute bottom-0 left-0 w-full text-white/10" viewBox="0 0 400 120" fill="currentColor" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 60 C 100 20, 200 100, 400 50 L 400 120 L 0 120 Z" />
            </svg>

            <div className="relative z-10 flex h-full flex-col items-center justify-center p-12 text-center text-white">
              <img src="/logo.png" alt="" className="h-20 w-auto mb-8 brightness-0 invert opacity-95 drop-shadow-lg" aria-hidden="true" />
              <h2 className="text-3xl font-bold tracking-tight">SILABU DIGI</h2>
              <p className="mt-3 max-w-xs text-sm text-cyan-50/90 leading-relaxed">
                Aplikasi keuangan digital untuk BUM Desa — rapi, transparan, dan sesuai standar.
              </p>
              <div className="mt-8 space-y-3 text-left w-full max-w-xs">
                {['CoA lengkap 304 akun standar desa', 'Jurnal umum + laporan otomatis', 'Data aman & terenkripsi'].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-cyan-50/80">
                    <svg className="h-4 w-4 shrink-0 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — form */}
          <div className="relative z-10 p-6 sm:p-10 md:p-12 animate-slide-in-right stagger-1">
            <div className="mb-8">
              <Link to="/" className="inline-block mb-6">
                <img src="/logo.png" alt="SILABU DIGI" className="h-12 w-auto" />
              </Link>
              <h1 className="text-2xl font-bold text-slate-900">Daftar Akun</h1>
              <p className="text-sm text-slate-500 mt-1">Pilih metode pendaftaran</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all disabled:opacity-50 stagger-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                {loading ? 'Mengalihkan...' : 'Daftar dengan Google'}
              </button>

              <div className="flex items-center gap-3 my-4 stagger-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">atau</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <Link
                to="/register/email"
                viewTransition
                className="w-full flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:shadow-lg hover:shadow-cyan-500/25 hover:translate-y-[-1px] transition-all stagger-4"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                Daftar dengan Email
              </Link>
            </div>

            <p className="mt-8 text-center text-sm text-slate-500">
              Sudah punya akun?{' '}
              <Link to="/login" viewTransition className="font-semibold text-cyan-600 hover:underline">Masuk</Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
