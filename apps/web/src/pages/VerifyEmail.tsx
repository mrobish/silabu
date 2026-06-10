import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'loading'|'success'|'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setStatus('error'); setMessage('Token tidak valid'); return; }
    fetch(`/api/auth/verify-email?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setStatus('success');
        else { setStatus('error'); setMessage(d.error || 'Verifikasi gagal'); }
      })
      .catch(() => { setStatus('error'); setMessage('Terjadi kesalahan'); });
  }, [params]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 text-center shadow-sm">
        {status === 'loading' && (
          <div className="py-8">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-cyan-200 border-t-cyan-600" />
            <p className="text-sm text-slate-500">Memverifikasi email...</p>
          </div>
        )}
        {status === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Email Terverifikasi!</h2>
            <p className="text-sm text-slate-500 mb-6">Akun Anda sudah aktif. Silakan login untuk mulai menggunakan SILABU DIGI.</p>
            <Link to="/login" className="inline-block rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all">
              Masuk
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Verifikasi Gagal</h2>
            <p className="text-sm text-slate-500 mb-6">{message}</p>
            <Link to="/register" className="text-sm font-semibold text-cyan-600 hover:underline">Daftar ulang</Link>
          </>
        )}
      </div>
    </div>
  );
}
