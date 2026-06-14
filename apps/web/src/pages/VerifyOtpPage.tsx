import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const API = '/api';
const inputCls = 'w-full h-14 text-center text-2xl font-bold rounded-xl border border-slate-200 bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition tabular-nums';

export default function VerifyOtpPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tempToken = params.get('token') || '';
  const flow = params.get('flow') || '';

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [via, setVia] = useState('');
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if no temp token
  useEffect(() => {
    if (!tempToken) navigate('/login', { replace: true });
  }, [tempToken, navigate]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // Auto-submit when all 6 digits filled
  const handleChange = useCallback((index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    setError('');

    // Auto-advance
    if (value && index < 5) {
      refs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (newDigits.every(d => d) && newDigits.join('').length === 6) {
      verify(newDigits.join(''));
    }
  }, [digits]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }, [digits]);

  // Paste support
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newDigits = pasted.split('');
      setDigits(newDigits);
      refs.current[5]?.focus();
      verify(pasted);
    }
  }, []);

  async function verify(code: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/auth/verify-login-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setDigits(['', '', '', '', '', '']);
        refs.current[0]?.focus();
        if (data.max_attempts) {
          setTimeout(() => navigate('/login', { replace: true }), 2000);
        }
        return;
      }

      if (data.accessToken) {
        const store = localStorage.getItem('accessToken') ? localStorage : sessionStorage;
        store.setItem('accessToken', data.accessToken);
        store.setItem('user', JSON.stringify(data.user));
        setSuccess('✓ Terverifikasi! Mengalihkan...');
        setTimeout(() => {
          navigate(data.user.role === 'super_admin' ? '/super-admin' : '/app', { replace: true });
        }, 800);
      }
    } catch {
      setError('Koneksi gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError('');
    try {
      const res = await fetch(`${API}/auth/resend-login-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken }),
      });
      const data = await res.json();
      if (data.error) {
        if (data.cooldown) setCooldown(data.cooldown);
        setError(data.error);
        return;
      }
      setCooldown(60);
      if (data.via) setVia(data.via);
      setSuccess(`✓ ${data.message || 'OTP baru dikirim!'}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Gagal mengirim ulang');
    }
  }

  if (!tempToken) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-cyan-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Back button */}
        <button onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6 transition">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 8H1M1 8l5-5M1 8l5 5"/></svg>
          Kembali ke Login
        </button>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/30">
            <svg width="28" height="28" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>

          <h1 className="text-xl font-bold text-slate-900 text-center mb-2">Verifikasi Keamanan</h1>
          <p className="text-sm text-slate-500 text-center mb-6">
            Masukkan 6 digit kode yang baru saja kami kirimkan ke {via === 'whatsapp' ? 'WhatsApp' : 'Email'} Anda.
          </p>

          {/* OTP Input */}
          <div className="flex gap-3 justify-center mb-4" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { refs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className={inputCls + ' w-12 sm:w-14'}
                disabled={loading || !!success}
                autoFocus={i === 0}
              />
            ))}
          </div>

          {/* Error / Success */}
          {error && (
            <p className="text-sm text-red-600 text-center mb-4 flex items-center justify-center gap-1">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7" cy="7" r="6"/><path d="M7 4v4M7 10h.01"/></svg>
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-emerald-600 text-center mb-4 font-medium">{success}</p>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex justify-center mb-4">
              <div className="w-6 h-6 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
            </div>
          )}

          {/* Resend */}
          <div className="text-center mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-2">Tidak menerima kode?</p>
            <button
              onClick={handleResend}
              disabled={cooldown > 0 || loading}
              className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 disabled:text-slate-300 disabled:cursor-not-allowed transition"
            >
              {cooldown > 0 ? `Kirim ulang dalam ${cooldown} detik` : 'Kirim Ulang OTP'}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 text-center mt-4">
          Kode berlaku selama 5 menit. Maksimal 3× percobaan.
        </p>
      </div>
    </div>
  );
}
