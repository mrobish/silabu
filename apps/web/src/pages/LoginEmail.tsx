import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TurnstileWidget } from './TurnstileWidget';
import BackBar from './BackBar';

export default function LoginEmail() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  const [captchaEnabled, setCaptchaEnabled] = useState(true);

  useEffect(() => {
    fetch('/api/auth/captcha-config').then(r => r.json()).then(d => {
      setCaptchaEnabled(!!d.enabled);
    }).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (captchaEnabled && !captchaToken) { setError('Verifikasi CAPTCHA dulu'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, captchaToken }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setCaptchaToken('');       // clear old token
        setCaptchaKey(k => k + 1); // force re-render Turnstile widget
        return;
      }
      // OTP required — redirect to verify page
      if (data.requires_otp) {
        navigate(`/verify-otp?token=${data.tempToken}`);
        return;
      }
      const store = rememberMe ? localStorage : sessionStorage;
      store.setItem('accessToken', data.accessToken);
      store.setItem('user', JSON.stringify(data.user));
      navigate(data.user.role === 'super_admin' ? '/super-admin' : '/app');
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
                <h1 className="text-2xl font-bold tracking-tight">Masuk</h1>
                <p className="text-sm text-cyan-50/90 mt-1">Masuk ke akun BUM Desa Anda</p>
              </div>
            </div>

            {/* DESKTOP — form header */}
            <div className="hidden md:block mb-6 text-center md:text-left">
              <Link to="/" className="inline-block mb-6">
                <img src="/logo.png" alt="SILABU DIGI" className="h-12 w-auto" />
              </Link>
              <h1 className="text-2xl font-bold text-slate-900">Masuk</h1>
              <p className="text-sm text-slate-500 mt-1">Masuk ke akun BUM Desa Anda</p>
            </div>

            {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition" placeholder="nama@contoh.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition" placeholder="Password Anda" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500/30" />
                  <span className="text-sm text-slate-600">Ingat saya</span>
                </label>
                <Link to="/forgot-password" className="text-sm font-medium text-cyan-600 hover:underline">Lupa password?</Link>
              </div>

              <TurnstileWidget key={captchaKey} onVerify={t => setCaptchaToken(t)} className="flex justify-center" />

              <button type="submit" disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-lg hover:shadow-cyan-500/25 hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:translate-y-0">
                {loading ? 'Memproses...' : 'Masuk'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Belum punya akun? <Link to="/register" className="font-semibold text-cyan-600 hover:underline">Daftar gratis</Link>
            </p>
          </div>

          {/* RIGHT — branded gradient panel */}
          <div className="relative hidden md:block overflow-hidden" style={{background:'linear-gradient(to bottom right, #059669, #0891b2, #0e7490)'}}>
            {/* wavy SVG divider — sits at the seam between left & right panels */}
            <svg className="absolute -left-[1px] top-0 z-10 h-full w-[48px] overflow-visible text-slate-50"
              preserveAspectRatio="none" viewBox="0 0 48 100" fill="currentColor" aria-hidden="true">
              <path d="M48 0 C 24 15, 0 35, 24 50 C 48 65, 24 85, 48 100 L 0 100 L 0 0 Z" />
            </svg>
                        {/* subtle dark overlay for text contrast */}
            <div className="absolute inset-0 bg-slate-900/20" aria-hidden="true" />
            {/* subtle decorative blobs */}
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
            <div className="absolute -bottom-20 left-4 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" aria-hidden="true" />
            {/* soft wave shapes at bottom */}
            <svg className="absolute bottom-0 left-0 w-full text-white/10" viewBox="0 0 400 120" fill="currentColor" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 60 C 100 20, 200 100, 400 50 L 400 120 L 0 120 Z" />
            </svg>

            <div className="relative z-10 flex h-full flex-col items-center justify-center p-12 text-center text-white">
              <img src="/logo.png" alt="" className="h-20 w-auto mb-8 brightness-0 invert opacity-95 drop-shadow-lg" aria-hidden="true" />
              <h2 className="text-3xl font-bold tracking-tight">Selamat Datang Kembali</h2>
              <p className="mt-3 max-w-xs text-sm text-cyan-50/90 leading-relaxed">
                Kelola keuangan BUM Desa Anda dengan rapi, transparan, dan sesuai standar akuntansi desa.
              </p>
              <div className="mt-8 flex items-center gap-2 text-xs text-cyan-50/80">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>Data aman & terenkripsi</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
