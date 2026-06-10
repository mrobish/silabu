import { useState, useRef, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';

export default function VerifyOTP() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const email = params.get('email') || '';
  const flow = params.get('flow') || 'email'; // 'email' or 'google'
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) navigate('/register');
    // Focus first input
    inputRefs.current[0]?.focus();
  }, [email, navigate]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return; // only digits
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1); // only last digit
    setDigits(newDigits);
    setError('');
    // Auto-advance
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    // Auto-submit when all filled
    if (value && index === 5) {
      const code = newDigits.join('');
      if (code.length === 6) {
        verifyOTP(code);
      }
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setDigits(newDigits);
    // Focus next empty or last
    const nextEmpty = newDigits.findIndex(d => !d);
    inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
    // Auto-submit if complete
    if (pasted.length === 6) {
      verifyOTP(pasted);
    }
  }

  async function verifyOTP(code: string) {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      // Success — navigate based on flow
      if (flow === 'google') {
        navigate(`/register/set-password?email=${encodeURIComponent(email)}`);
      } else {
        navigate(`/register/data-bumdes?email=${encodeURIComponent(email)}`);
      }
    } catch { setError('Terjadi kesalahan'); } finally { setLoading(false); }
  }

  async function handleResend() {
    if (!canResend) return;
    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setCountdown(60);
      setCanResend(false);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch { setError('Terjadi kesalahan'); }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="text-center mb-8">
          <Link to={flow === 'google' ? '/register' : '/register/email'} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-cyan-600 transition-colors mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Kembali
          </Link>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-50">
            <svg className="h-7 w-7 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Verifikasi OTP</h1>
          <p className="text-sm text-slate-500 mt-2">
            Masukkan 6 digit kode yang dikirim ke
          </p>
          <p className="text-sm font-semibold text-cyan-600 mt-1">{email}</p>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="flex justify-center gap-2 sm:gap-3 mb-6">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              disabled={loading}
              className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-xl border-2 border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition disabled:opacity-50"
            />
          ))}
        </div>

        {loading && <p className="text-center text-sm text-slate-500 mb-4">Memverifikasi...</p>}

        <div className="text-center">
          {canResend ? (
            <button onClick={handleResend} className="text-sm font-semibold text-cyan-600 hover:underline">
              Kirim Ulang Kode
            </button>
          ) : (
            <p className="text-sm text-slate-400">
              Kirim ulang dalam <span className="font-semibold text-slate-600">{countdown}s</span>
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Kode berlaku 5 menit. Jangan bagikan kode ini.
        </p>
      </div>
    </div>
  );
}
