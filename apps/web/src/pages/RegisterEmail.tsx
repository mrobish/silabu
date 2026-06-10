import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TurnstileWidget } from './TurnstileWidget';
import BackBar from './BackBar';

export default function RegisterEmail() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [namaLengkap, setNamaLengkap] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!captchaToken) { setError('Verifikasi CAPTCHA dulu'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nama_lengkap: namaLengkap, password, confirmPassword, captchaToken }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setCaptchaToken('');
        setCaptchaKey(k => k + 1);
        return;
      }
      navigate(`/register/verify-otp?email=${encodeURIComponent(email)}&flow=email`);
    } catch { setError('Terjadi kesalahan'); } finally { setLoading(false); }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-white">
      <BackBar />
      <div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 56px)' }}>
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-50">
              <svg className="h-7 w-7 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Daftar dengan Email</h1>
            <p className="text-sm text-slate-500 mt-1">Isi data akun Anda</p>
          </div>

          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition" placeholder="nama@contoh.com" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Nama Lengkap PIC <span className="text-red-500">*</span></label>
              <input type="text" value={namaLengkap} onChange={e => setNamaLengkap(e.target.value)} required autoComplete="off"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition" placeholder="Nama lengkap PIC" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Password <span className="text-red-500">*</span></label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" minLength={8}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition" placeholder="Minimal 8 karakter" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Konfirmasi Password <span className="text-red-500">*</span></label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" minLength={8}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition" placeholder="Ulangi password" />
            </div>

            <TurnstileWidget key={captchaKey} onVerify={t => setCaptchaToken(t)} className="flex justify-center" />

            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-md hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:translate-y-0">
              {loading ? 'Mendaftar...' : 'Daftar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Sudah punya akun? <Link to="/login" className="font-semibold text-cyan-600 hover:underline">Masuk</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
