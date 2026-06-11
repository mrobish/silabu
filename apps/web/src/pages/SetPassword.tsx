import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';

export default function SetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const email = params.get('email') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, confirmPassword }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      navigate(`/register/data-bumdes?email=${encodeURIComponent(email)}`);
    } catch { setError('Terjadi kesalahan'); } finally { setLoading(false); }
  }

  return (
    <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 md:grid-cols-2 animate-scale-in">

        {/* LEFT — form */}
        <div className="relative z-10 p-6 sm:p-10 md:p-12">

          {/* MOBILE — gradient header banner */}
          <div className="md:hidden -mx-6 sm:-mx-10 -mt-6 sm:-mt-10 mb-8 px-6 py-9 text-center text-white relative overflow-hidden"
            style={{background: 'linear-gradient(to bottom right, #059669, #0891b2, #0e7490)'}}>
            <div className="absolute inset-0 bg-slate-900/15" aria-hidden="true" />
            <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
            <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-emerald-300/20 blur-2xl" aria-hidden="true" />
            <div className="relative z-10">
              <Link to="/" className="inline-block mb-4">
                <img src="/logo.png" alt="SILABU DIGI" className="h-14 w-auto mx-auto brightness-0 invert drop-shadow-lg" />
              </Link>
              <h1 className="text-2xl font-bold tracking-tight">Buat Password</h1>
              <p className="text-sm text-cyan-50/90 mt-1">Aman dan mudah diingat</p>
            </div>
          </div>

          {/* DESKTOP — form header */}
          <div className="hidden md:block mb-6 text-center md:text-left">
            <Link to="/register/email" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-cyan-600 transition-colors mb-4">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Kembali
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Buat Password</h1>
            <p className="text-sm text-slate-500 mt-1">Buat password untuk akun Anda</p>
          </div>

          <p className="text-sm font-semibold text-cyan-600 mb-6 text-center md:text-left break-all">Email Google: {email}</p>

          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Password Baru <span className="text-red-500">*</span></label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" minLength={8}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition" placeholder="Minimal 8 karakter" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Konfirmasi Password Baru <span className="text-red-500">*</span></label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" minLength={8}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition" placeholder="Ulangi password" />
            </div>

            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-md hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:translate-y-0">
              {loading ? 'Menyimpan...' : 'Lanjut Isi Data BUM Desa'}
            </button>
          </form>

          <p className="mt-6 text-center md:text-left text-sm text-slate-500">
            Bukan email Anda? <Link to="/register" className="font-semibold text-cyan-600 hover:underline">Ulangi daftar</Link>
          </p>
        </div>

        {/* RIGHT — branded gradient panel (desktop) */}
        <div className="relative hidden md:flex flex-col overflow-hidden" style={{background: 'linear-gradient(to bottom right, #059669, #0891b2, #0e7490)'}}>
          <div className="absolute inset-0 bg-slate-900/20" aria-hidden="true" />
          <svg className="absolute -left-[1px] top-0 z-10 h-full w-[48px] overflow-visible text-white" preserveAspectRatio="none" viewBox="0 0 48 100" fill="currentColor" aria-hidden="true">
            <path d="M48 0 C 24 15, 0 35, 24 50 C 48 65, 24 85, 48 100 L 0 100 L 0 0 Z" />
          </svg>
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
          <div className="absolute -bottom-20 left-4 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" aria-hidden="true" />
          <div className="relative z-10 flex h-full flex-col items-center justify-center p-12 text-center text-white">
            <img src="/logo.png" alt="" className="h-20 w-auto mb-8 brightness-0 invert opacity-95 drop-shadow-lg" aria-hidden="true" />
            <h2 className="text-3xl font-bold tracking-tight">Amankan Akun</h2>
            <p className="mt-3 max-w-xs text-sm text-cyan-50/90 leading-relaxed">
              Buat password minimal 8 karakter. Pastikan password mudah Anda ingat tapi sulit ditebak orang lain.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
