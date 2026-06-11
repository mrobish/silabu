import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function LoginCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Mengalihkan...');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const token = params.get('token');
      const role = params.get('role') || 'bumdes';

      if (!token) {
        setError('Token login tidak ditemukan. Silakan login ulang.');
        setTimeout(() => navigate('/login', { replace: true }), 1800);
        return;
      }

      try {
        localStorage.setItem('accessToken', token);
        setMessage('Memvalidasi sesi login...');

        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (!res.ok || data.error || !data.user) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          setError(data.error || 'Sesi login tidak valid. Silakan login ulang.');
          setTimeout(() => navigate('/login', { replace: true }), 1800);
          return;
        }

        localStorage.setItem('user', JSON.stringify(data.user));
        setMessage('Login berhasil. Membuka aplikasi...');

        const userRole = data.user.role || role;
        if (userRole === 'super_admin') {
          navigate('/super-admin', { replace: true });
        } else {
          navigate('/app', { replace: true });
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'Gagal memproses callback login. Silakan login ulang.');
        setTimeout(() => navigate('/login', { replace: true }), 1800);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [params, navigate]);

  return (
    <div className="min-h-dvh bg-gradient-to-br from-emerald-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/90 p-8 text-center shadow-xl shadow-emerald-500/10 backdrop-blur-xl">
        {!error ? (
          <>
            <div className="mx-auto h-10 w-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            <h1 className="mt-5 text-lg font-bold text-slate-900">Memproses Login</h1>
            <p className="mt-2 text-sm text-slate-500">{message}</p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h1 className="mt-5 text-lg font-bold text-slate-900">Login Gagal</h1>
            <p className="mt-2 text-sm text-red-600">{error}</p>
            <p className="mt-3 text-xs text-slate-400">Dialihkan ke halaman login...</p>
          </>
        )}
      </div>
    </div>
  );
}
