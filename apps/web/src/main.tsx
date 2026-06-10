import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Building2, Mail, Lock, KeyRound, ShieldCheck, CheckCircle2,
  Eye, EyeOff, ArrowLeft, Sparkles, LogOut, FileText, Users, BarChart3,
  ArrowRight, Menu, X
} from 'lucide-react';
import './style.css';

const API = '/api';
type Page = 'home' | 'login' | 'register' | 'verify' | 'forgot' | 'reset' | 'dashboard';

async function api(path: string, body: any) {
  const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request gagal');
  return d;
}

function saveAuth(d: any) {
  if (d.accessToken) localStorage.setItem('accessToken', d.accessToken);
  if (d.refreshToken) localStorage.setItem('refreshToken', d.refreshToken);
  if (d.user) localStorage.setItem('user', JSON.stringify(d.user));
}

function pageToPath(p: Page): string {
  if (p === 'home') return '/';
  if (p === 'verify') return '/verify-email';
  if (p === 'forgot') return '/forgot-password';
  if (p === 'reset') return '/reset-password';
  return '/' + p;
}

function pathToPage(path: string): Page {
  if (path.includes('login')) return 'login';
  if (path.includes('register')) return 'register';
  if (path.includes('verify')) return 'verify';
  if (path.includes('forgot')) return 'forgot';
  if (path.includes('reset')) return 'reset';
  if (path.includes('dashboard')) return 'dashboard';
  return 'home';
}

// ─── Page transition wrapper ───
function FadeIn({ children, pageKey }: { children: React.ReactNode; pageKey: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => { setShow(false); const t = requestAnimationFrame(() => setShow(true)); return () => cancelAnimationFrame(t); }, [pageKey]);
  return <div className={`fade-page ${show ? 'fade-in' : 'fade-out'}`}>{children}</div>;
}

// ─── Back button ───
function BackBtn({ go, target }: { go: (p: Page) => void; target?: Page }) {
  return (
    <button className="back-btn" onClick={() => go(target || 'home')} aria-label="Kembali">
      <ArrowLeft size={20} /> Kembali
    </button>
  );
}

// ─── Shell for auth pages ───
function AuthShell({ title, subtitle, backTarget, go, children }: {
  title: string; subtitle: string; backTarget?: Page; go: (p: Page) => void; children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <div className="auth-container">
        <BackBtn go={go} target={backTarget} />
        <section className="auth-card">
          <div className="brand-logo"><Building2 size={28} /></div>
          <h1>{title}</h1>
          <p className="auth-sub">{subtitle}</p>
          {children}
        </section>
      </div>
    </main>
  );
}

// ─── Password input with toggle ───
function PasswordInput({ value, onChange, placeholder = 'Masukkan password' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <Lock size={18} className="field-icon" />
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete="new-password" />
      <button type="button" className="toggle-btn" onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
    </div>
  );
}

// ─── Navbar ───
function Navbar({ go, loggedIn }: { go: (p: Page) => void; loggedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="nav-brand" onClick={() => go('home')}>
          <div className="nav-logo-icon"><Building2 size={20} /></div>
          <span>SILABU DIGI</span>
        </div>
        <div className={`nav-links ${open ? 'open' : ''}`}>
          {loggedIn ? (
            <button className="btn-outline" onClick={() => { localStorage.clear(); go('login'); }}>
              <LogOut size={16} /> Keluar
            </button>
          ) : (
            <>
              <button className="btn-outline" onClick={() => { setOpen(false); go('login'); }}>Masuk</button>
              <button className="btn-primary" onClick={() => { setOpen(false); go('register'); }}>Daftar Gratis</button>
            </>
          )}
        </div>
        <button className="hamburger" onClick={() => setOpen(!open)}>{open ? <X size={24} /> : <Menu size={24} />}</button>
      </div>
    </nav>
  );
}

// ─── HOME ───
function Home({ go }: { go: (p: Page) => void }) {
  return (
    <main className="home-page">
      <Navbar go={go} />
      <section className="hero-section">
        <div className="hero-glow"></div>
        <div className="hero-content">
          <div className="hero-badge"><Sparkles size={14} /> Platform Baru — Arsitektur Modern</div>
          <h1 className="hero-title">
            Sistem Laporan<br /><span className="gradient-text">BUM Desa Digital</span>
          </h1>
          <p className="hero-desc">
            Kelola keuangan BUM Desa Anda secara profesional. Dengan verifikasi email aman,
            audit trail lengkap, dan laporan sesuai standar pemerintahan.
          </p>
          <div className="hero-cta">
            <button className="btn-primary btn-lg" onClick={() => go('register')}>
              Mulai Sekarang <ArrowRight size={18} />
            </button>
            <button className="btn-ghost btn-lg" onClick={() => go('login')}>
              Sudah punya akun? Masuk
            </button>
          </div>
        </div>
      </section>

      <section className="features-section">
        <h2 className="section-title">Fitur Keamanan</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon cyan"><ShieldCheck size={24} /></div>
            <h3>Email Terverifikasi</h3>
            <p>OTP + magic link untuk verifikasi email sebelum membuat akun tenant.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon blue"><KeyRound size={24} /></div>
            <h3>Session Rotation</h3>
            <p>Refresh token otomatis diganti setiap penggunaan. Session lama dicabut.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon green"><CheckCircle2 size={24} /></div>
            <h3>Audit Log Lengkap</h3>
            <p>Setiap register, login, reset, dan logout tercatat dengan IP & user agent.</p>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="nav-logo-icon"><Building2 size={16} /></div>
        <span>© 2026 SILABU DIGI — Sistem Laporan BUM Desa Digital</span>
      </footer>
    </main>
  );
}

// ─── REGISTER ───
function Register({ go }: { go: (p: Page) => void }) {
  const [email, setEmail] = useState('');
  const [nama, setNama] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Konfirmasi password tidak sama');
    try {
      setLoading(true);
      await api('/auth/register', { email, password, namaLengkap: nama });
      localStorage.setItem('pendingEmail', email);
      go('verify');
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  }

  return (
    <AuthShell title="Daftar Akun Baru" subtitle="Verifikasi email dulu, baru isi Data BUM Desa." backTarget="home" go={go}>
      <form onSubmit={submit} className="form">
        <div className="field"><Mail size={18} className="field-icon" /><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Masukkan email aktif" required /></div>
        <div className="field"><Building2 size={18} className="field-icon" /><input value={nama} onChange={e => setNama(e.target.value)} placeholder="Masukkan nama lengkap" required /></div>
        <PasswordInput value={password} onChange={setPassword} />
        <PasswordInput value={confirm} onChange={setConfirm} placeholder="Ulangi password" />
        {error && <div className="alert alert-error">{error}</div>}
        <button className="btn-primary btn-full" disabled={loading}>{loading ? 'Mengirim...' : 'Daftar & Kirim OTP'}</button>
      </form>
      <p className="form-switch">Sudah punya akun? <a onClick={() => go('login')}>Masuk</a></p>
    </AuthShell>
  );
}

// ─── VERIFY ───
function Verify({ go }: { go: (p: Page) => void }) {
  const q = new URLSearchParams(location.search);
  const token = q.get('token');
  const [email, setEmail] = useState(q.get('email') || localStorage.getItem('pendingEmail') || '');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(''); setMessage(''); setLoading(true);
    try {
      const data = await api('/auth/verify-email', token ? { token, email } : { email, otp });
      saveAuth(data);
      setMessage('✓ Email berhasil diverifikasi!');
      setTimeout(() => go('dashboard'), 800);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  }

  return (
    <AuthShell title="Verifikasi Email" subtitle="Masukkan kode OTP 6 digit dari email Anda." backTarget="register" go={go}>
      <form onSubmit={submit} className="form">
        <div className="field"><Mail size={18} className="field-icon" /><input value={email} onChange={e => setEmail(e.target.value)} placeholder="Masukkan email" type="email" required /></div>
        {!token && <div className="field"><KeyRound size={18} className="field-icon" /><input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Masukkan OTP 6 digit" inputMode="numeric" required /></div>}
        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}
        <button className="btn-primary btn-full" disabled={loading}>{loading ? 'Memverifikasi...' : token ? 'Verifikasi Magic Link' : 'Verifikasi Email'}</button>
      </form>
      <p className="form-switch"><a onClick={() => go('login')}>Kembali ke login</a></p>
    </AuthShell>
  );
}

// ─── LOGIN ───
function Login({ go }: { go: (p: Page) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const data = await api('/auth/login', { email, password });
      saveAuth(data); go('dashboard');
    } catch (err: any) {
      if (err.message.includes('belum diverifikasi')) { localStorage.setItem('pendingEmail', email); go('verify'); }
      else setError(err.message);
    } finally { setLoading(false); }
  }

  return (
    <AuthShell title="Masuk SILABU DIGI" subtitle="Login dengan email yang sudah terverifikasi." backTarget="home" go={go}>
      <form onSubmit={submit} className="form">
        <div className="field"><Mail size={18} className="field-icon" /><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Masukkan email" autoComplete="email" required /></div>
        <PasswordInput value={password} onChange={setPassword} />
        {error && <div className="alert alert-error">{error}</div>}
        <button className="btn-primary btn-full" disabled={loading}>{loading ? 'Masuk...' : 'Masuk'}</button>
      </form>
      <div className="form-links">
        <a onClick={() => go('forgot')}>Lupa password?</a>
        <span className="divider">·</span>
        <a onClick={() => go('register')}>Daftar akun baru</a>
      </div>
    </AuthShell>
  );
}

// ─── FORGOT ───
function Forgot({ go }: { go: (p: Page) => void }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setMessage('');
    try {
      await api('/auth/forgot-password', { email });
      localStorage.setItem('resetEmail', email);
      setMessage('✓ Jika email terdaftar, link reset sudah dikirim.');
    } catch (err: any) { setError(err.message); }
  }

  return (
    <AuthShell title="Lupa Password" subtitle="Kirim OTP/link reset ke email Anda." backTarget="login" go={go}>
      <form onSubmit={submit} className="form">
        <div className="field"><Mail size={18} className="field-icon" /><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Masukkan email aktif" required /></div>
        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}
        <button className="btn-primary btn-full">Kirim Link Reset</button>
      </form>
      <div className="form-links">
        <a onClick={() => go('reset')}>Sudah punya OTP reset?</a>
        <span className="divider">·</span>
        <a onClick={() => go('login')}>Kembali ke login</a>
      </div>
    </AuthShell>
  );
}

// ─── RESET ───
function Reset({ go }: { go: (p: Page) => void }) {
  const q = new URLSearchParams(location.search);
  const token = q.get('token');
  const [email, setEmail] = useState(q.get('email') || localStorage.getItem('resetEmail') || '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setMessage('');
    try {
      await api('/auth/reset-password', token ? { token, email, password } : { email, otp, password });
      setMessage('✓ Password berhasil diubah.');
      setTimeout(() => go('login'), 1200);
    } catch (err: any) { setError(err.message); }
  }

  return (
    <AuthShell title="Reset Password" subtitle="Masukkan OTP atau gunakan magic link dari email." backTarget="forgot" go={go}>
      <form onSubmit={submit} className="form">
        <div className="field"><Mail size={18} className="field-icon" /><input value={email} onChange={e => setEmail(e.target.value)} placeholder="Masukkan email" type="email" required /></div>
        {!token && <div className="field"><KeyRound size={18} className="field-icon" /><input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Masukkan OTP reset" required /></div>}
        <PasswordInput value={password} onChange={setPassword} placeholder="Password baru" />
        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}
        <button className="btn-primary btn-full">Ubah Password</button>
      </form>
    </AuthShell>
  );
}

// ─── DASHBOARD ───
function Dashboard({ go }: { go: (p: Page) => void }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return (
    <main className="dash-page">
      <Navbar go={go} loggedIn />
      <section className="dash-hero">
        <div className="dash-welcome">
          <div className="dash-avatar">{(user.email || 'U')[0].toUpperCase()}</div>
          <div>
            <h1>Selamat Datang</h1>
            <p>{user.email || '-'} · <span className="role-badge">{user.role || '-'}</span></p>
          </div>
        </div>
      </section>
      <section className="dash-grid">
        <div className="dash-card">
          <FileText size={32} className="dash-card-icon" />
          <h3>Profil BUM Desa</h3>
          <p className="dash-card-desc">Isi data tenant & pelaksana operasional</p>
          <span className="dash-card-status">Segera</span>
        </div>
        <div className="dash-card">
          <BarChart3 size={32} className="dash-card-icon" />
          <h3>Laporan Keuangan</h3>
          <p className="dash-card-desc">Buku Kas, Neraca, Laba Rugi, Arus Kas</p>
          <span className="dash-card-status">Segera</span>
        </div>
        <div className="dash-card">
          <Users size={32} className="dash-card-icon" />
          <h3>Pengguna</h3>
          <p className="dash-card-desc">Kelola akun karyawan & akses</p>
          <span className="dash-card-status">Segera</span>
        </div>
      </section>
      <div className="dash-notice">
        <CheckCircle2 size={20} /> <span>Auth aktif — pondasi siap. Fitur tenant sedang dibangun.</span>
      </div>
    </main>
  );
}

// ─── APP ROUTER ───
function App() {
  const [page, setPageRaw] = useState<Page>(pathToPage(location.pathname));
  const go = (p: Page) => {
    setPageRaw(p);
    history.pushState({ page: p }, '', pageToPath(p));
  };

  useEffect(() => {
    function onPop(e: PopStateEvent) {
      setPageRaw(e.state?.page || pathToPage(location.pathname));
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const render = () => {
    switch (page) {
      case 'login': return <Login go={go} />;
      case 'register': return <Register go={go} />;
      case 'verify': return <Verify go={go} />;
      case 'forgot': return <Forgot go={go} />;
      case 'reset': return <Reset go={go} />;
      case 'dashboard': return <Dashboard go={go} />;
      default: return <Home go={go} />;
    }
  };

  return <FadeIn pageKey={page}>{render()}</FadeIn>;
}

createRoot(document.getElementById('root')!).render(<App />);
