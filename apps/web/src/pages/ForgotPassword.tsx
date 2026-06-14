import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TurnstileWidget } from './TurnstileWidget';
import BackBar from './BackBar';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  const [captchaEnabled] = useState(false); // CAPTCHA disabled

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, captchaToken }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setCaptchaToken(''); setCaptchaKey(k => k + 1); return; }
      setSuccess(true);
    } catch { setError('Terjadi kesalahan'); } finally { setLoading(false); }
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <BackBar />
      <div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 56px)' }}>
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
                <h1 className="text-2xl font-bold tracking-tight">Lupa Password</h1>
                <p className="text-sm text-cyan-50/90 mt-1">Masukkan email untuk reset password</p>
              </div>
            </div>

            {/* DESKTOP — form header */}
            <div className="hidden md:block mb-6 text-center md:text-left">
              <Link to="/" className="inline-block mb-6">
                <img src="/logo.png" alt="SILABU DIGI" className="h-12 w-auto" />
              </Link>
              <div className="mx-auto md:mx-0 mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50">
                <svg className="h-7 w-7 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Lupa Password</h1>
              <p className="text-sm text-slate-500 mt-1">Masukkan email untuk terima link reset password</p>
            </div>

            {success ? (
              <div className="py-4">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-sm text-slate-600 mb-4">Link reset password sudah dikirim ke <strong>{email}</strong>. Cek email Anda.</p>
                <Link to="/login/email" viewTransition className="inline-block rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-lg hover:shadow-cyan-500/25 transition-all">
                  Kembali ke Login
                </Link>
              </div>
            ) : (
              <>
                {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition" placeholder="Email yang terdaftar" />
                  </div>
                  {captchaEnabled && <TurnstileWidget key={captchaKey} onVerify={t => setCaptchaToken(t)} className="flex justify-center" />}
                  <button type="submit" disabled={loading}
                    className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-lg hover:shadow-cyan-500/25 hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:translate-y-0">
                    {loading ? 'Mengirim...' : 'Kirim Link Reset'}
                  </button>
                </form>
                <p className="mt-6 text-center text-sm text-slate-500">
                  Ingat password? <Link to="/login/email" viewTransition className="font-semibold text-cyan-600 hover:underline">Masuk</Link>
                </p>
              </>
            )}
          </div>

          {/* RIGHT — branded gradient panel */}
          <div className="relative hidden md:block overflow-hidden animate-slide-in-right stagger-1"
            style={{background: 'linear-gradient(to bottom right, #059669, #0891b2, #0e7490)'}}>
            {/* subtle dark overlay for text contrast */}
            <div className="absolute inset-0 bg-slate-900/20" aria-hidden="true" />
            {/* wavy SVG divider */}
            <svg className="absolute -left-[1px] top-0 z-10 h-full w-[48px] overflow-visible text-slate-50"
              preserveAspectRatio="none" viewBox="0 0 48 100" fill="currentColor" aria-hidden="true">
              <path d="M48 0 C 24 15, 0 35, 24 50 C 48 65, 24 85, 48 100 L 0 100 L 0 0 Z" />
            </svg>
            {/* decorative blobs */}
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
            <div className="absolute -bottom-20 left-4 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" aria-hidden="true" />
            {/* bottom wave */}
            <svg className="absolute bottom-0 left-0 w-full text-white/10" viewBox="0 0 400 120" fill="currentColor" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 60 C 100 20, 200 100, 400 50 L 400 120 L 0 120 Z" />
            </svg>

            <div className="relative z-10 flex h-full flex-col items-center justify-center p-12 text-center text-white">
              <img src="/logo.png" alt="" className="h-20 w-auto mb-8 brightness-0 invert opacity-95 drop-shadow-lg" aria-hidden="true" />
              <h2 className="text-3xl font-bold tracking-tight">Tenang, Kami Bantu</h2>
              <p className="mt-3 max-w-xs text-sm text-cyan-50/90 leading-relaxed">
                Reset password Anda dengan aman. Link pemulihan akan dikirim ke email terdaftar.
              </p>
              <div className="mt-8 flex items-center gap-2 text-xs text-cyan-50/80">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>Proses aman & terenkripsi</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
