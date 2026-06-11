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
    inputRefs.current[0]?.focus();
  }, [email, navigate]);

  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    setError('');
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
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
    const nextEmpty = newDigits.findIndex(d => !d);
    inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
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
              <h1 className="text-2xl font-bold tracking-tight">Verifikasi OTP</h1>
              <p className="text-sm text-cyan-50/90 mt-1">Kode dikirim ke email Anda</p>
            </div>
          </div>

          {/* DESKTOP — form header */}
          <div className="hidden md:block mb-6 text-center md:text-left">
            <Link to={flow === 'google' ? '/register' : '/register/email'} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-cyan-600 transition-colors mb-4">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Kembali
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Verifikasi OTP</h1>
            <p className="text-sm text-slate-500 mt-1">Masukkan 6 digit kode yang dikirim ke email Anda</p>
          </div>

          <p className="text-sm font-semibold text-cyan-600 mb-6 text-center md:text-left break-all">{email}</p>

          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="flex justify-center md:justify-start gap-2 sm:gap-3 mb-6">
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

          {loading && <p className="text-center md:text-left text-sm text-slate-500 mb-4">Memverifikasi...</p>}

          <div className="text-center md:text-left">
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

          <p className="mt-6 text-center md:text-left text-xs text-slate-400">
            Kode berlaku 5 menit. Jangan bagikan kode ini.
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
            <h2 className="text-3xl font-bold tracking-tight">Cek Email Anda</h2>
            <p className="mt-3 max-w-xs text-sm text-cyan-50/90 leading-relaxed">
              Kami mengirim 6 digit kode verifikasi ke email Anda. Masukkan kode untuk melanjutkan pendaftaran.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
