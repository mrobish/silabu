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
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-white">
      <BackBar />
      <div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 56px)' }}>
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-50">
              <svg className="h-7 w-7 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Lupa Password</h1>
            <p className="text-sm text-slate-500 mt-1">Masukkan email untuk terima link reset password</p>
          </div>

          {success ? (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-sm text-slate-600 mb-4">Link reset password sudah dikirim ke <strong>{email}</strong>. Cek email Anda.</p>
              <Link to="/login/email" className="inline-block rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all">
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
                <TurnstileWidget key={captchaKey} onVerify={t => setCaptchaToken(t)} className="flex justify-center" />
                <button type="submit" disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-md hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:translate-y-0">
                  {loading ? 'Mengirim...' : 'Kirim Link Reset'}
                </button>
              </form>
              <p className="mt-6 text-center text-sm text-slate-500">
                Ingat password? <Link to="/login/email" className="font-semibold text-cyan-600 hover:underline">Masuk</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
