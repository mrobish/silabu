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
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-white">
      <BackBar />
      <div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 56px)' }}>
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="text-center mb-8">
            <Link to="/" className="block mb-4">
              <img src="/logo.png" alt="SILABU DIGI" className="mx-auto h-14 w-auto" />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Daftar Akun</h1>
            <p className="text-sm text-slate-500 mt-1">Pilih metode pendaftaran</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              {loading ? 'Mengalihkan...' : 'Daftar dengan Google'}
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">atau</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <Link
              to="/register/email"
              className="w-full flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:shadow-md hover:translate-y-[-1px] transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              Daftar dengan Email
            </Link>
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            Sudah punya akun?{' '}
            <Link to="/login" className="font-semibold text-cyan-600 hover:underline">Masuk</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
