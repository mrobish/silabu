import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PasswordForm from './PasswordForm';

type Page = 'dashboard' | 'password' | 'langganan';

type SubscriptionStatus = {
  status?: 'trial' | 'active' | 'expired' | string;
  active?: boolean;
  daysLeft?: number;
  price?: number;
  payments?: Array<{ reference?: string; amount?: number; status?: string; created_at?: string; paid_at?: string; date?: string }>;
  trial_ends_at?: string;
  subscription_ends_at?: string;
};

const financeMenus = [
  { label: 'Buku Kas', soon: true, icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { label: 'Jurnal Umum', soon: true, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { label: 'Laporan', soon: true, icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
];

function Icon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
      <path d={d} />
    </svg>
  );
}

const creditCardIcon = 'M3 10h18M7 15h1m4 0h3M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z';

function formatRupiah(value?: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
}

function LanggananPage() {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    setLoading(true);
    fetch('/api/subscription/status', { headers: { Authorization: 'Bearer ' + token } })
      .then(async r => {
        const data = await r.json();
        if (!r.ok || data.error) throw new Error(data.error || 'Gagal memuat status langganan');
        setSubscription(data);
      })
      .catch(e => setError(e.message || 'Gagal memuat status langganan'))
      .finally(() => setLoading(false));
  }, []);

  async function checkout() {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    setCheckoutLoading(true);
    setError('');
    try {
      const res = await fetch('/api/subscription/checkout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Checkout gagal');
      if (data.checkout_url) window.location.href = data.checkout_url;
      else throw new Error('Checkout URL tidak tersedia');
    } catch (e: any) {
      setError(e.message || 'Checkout gagal');
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (loading) return <div className="rounded-2xl border border-slate-100 bg-white p-8 text-sm text-slate-500 shadow-sm">Memuat status langganan...</div>;

  const status = subscription?.status || 'trial';
  const isActive = status === 'active' || subscription?.active;
  const isExpired = status === 'expired';
  const daysLeft = Math.max(0, subscription?.daysLeft ?? 0);
  const price = subscription?.price || 1000000;
  const progress = status === 'trial' ? Math.max(0, Math.min(100, (daysLeft / 14) * 100)) : isActive ? 100 : 0;
  const payments = subscription?.payments || [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Langganan</h1>
        <p className="mt-1 text-sm text-slate-500">Kelola masa trial, paket tahunan, checkout, dan riwayat pembayaran SILABU DIGI.</p>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className={'inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ' + (isActive ? 'bg-cyan-50 text-cyan-700' : isExpired ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700')}>
                {isActive ? 'Active' : isExpired ? 'Expired' : 'Trial'}
              </span>
              <h2 className="mt-4 text-xl font-bold text-slate-900">Status Langganan</h2>
              <p className="mt-1 text-sm text-slate-500">Harga paket: <span className="font-semibold text-slate-700">{formatRupiah(price)}/tahun</span></p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 px-6 py-5 text-white shadow-lg shadow-emerald-500/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Hari tersisa</p>
              <p className="mt-1 text-5xl font-black">{isActive ? '-' : daysLeft}</p>
            </div>
          </div>
          <div className="mt-7">
            <div className="mb-2 flex justify-between text-xs font-semibold text-slate-500"><span>Progress trial</span><span>{Math.round(progress)}%</span></div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all" style={{ width: progress + '%' }} /></div>
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/70 p-6 shadow-sm">
          <Icon d={creditCardIcon} className="w-10 h-10 text-emerald-600" />
          <h3 className="mt-4 text-lg font-bold text-slate-900">{isActive ? 'Langganan Aktif' : 'Perpanjang Langganan'}</h3>
          <p className="mt-2 text-sm text-slate-500">{isActive ? 'Langganan aktif sampai ' + formatDate(subscription?.subscription_ends_at) : 'Bayar paket tahunan agar akses tetap aktif setelah trial selesai.'}</p>
          {!isActive && status === 'trial' && <p className="mt-3 text-xs text-emerald-700">Trial berakhir {formatDate(subscription?.trial_ends_at)}. Setelah itu akses butuh langganan aktif.</p>}
          {!isActive && <button onClick={checkout} disabled={checkoutLoading} className="mt-6 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:shadow-xl disabled:opacity-60">{checkoutLoading ? 'Memproses...' : 'Bayar Sekarang — Rp1.000.000'}</button>}
        </div>
      </div>

      {payments.length > 0 && (
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="font-bold text-slate-900">Riwayat Pembayaran</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400"><tr><th className="py-3">Reference</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p, i) => <tr key={i} className="text-slate-600"><td className="py-3 font-mono text-xs">{p.reference || '-'}</td><td>{formatRupiah(p.amount)}</td><td><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{p.status || '-'}</span></td><td>{formatDate(p.paid_at || p.created_at || p.date)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppDashboard() {
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    if (!stored || !token) { navigate('/login'); return; }
    fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => {
        if (d.error) { navigate('/login'); return; }
        if (!d.user.tenant_id) { navigate('/register'); return; }
        setUser(d.user);
      })
      .catch(() => navigate('/login'));
  }, [navigate]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Memuat...</p>
      </div>
    </div>
  );

  function logout() { localStorage.clear(); sessionStorage.clear(); navigate('/login'); }

  const trialEnds = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
  const now = new Date();
  const isTrialExpired = trialEnds && now > trialEnds;
  const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - now.getTime()) / 86400000)) : 0;

  const SIDEBAR_W = collapsed ? 'w-20' : 'w-64';
  const MAIN_ML = collapsed ? 'lg:ml-20' : 'lg:ml-64';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={'fixed inset-y-0 left-0 z-50 ' + SIDEBAR_W + ' bg-white flex flex-col transition-all duration-300 ease-in-out transform ' + (sidebarOpen ? 'translate-x-0' : '-translate-x-full') + ' lg:translate-x-0'}>
        {/* Logo */}
        <div className={'h-16 flex items-center border-b border-slate-100 ' + (collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img src="/logo.png" alt="SILABU DIGI" className={'shrink-0 ' + (collapsed ? 'w-10 h-10 rounded-xl object-cover' : 'h-9')} />
          </div>
          <button onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            title={collapsed ? 'Perluas sidebar' : 'Sembunyikan sidebar'}>
            <Icon d={collapsed ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7M19 19l-7-7 7-7'} className="w-4 h-4" />
          </button>
          {!collapsed && (
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition">
              <Icon d="M6 18L18 6M6 6l12 12" className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className={'px-2.5 pb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider ' + (collapsed ? 'text-center' : '')}>{collapsed ? 'M' : 'Menu'}</p>

          <button onClick={() => { setPage('dashboard'); setSidebarOpen(false); }}
            className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ' + (page === 'dashboard' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800') + (collapsed ? ' justify-center px-0' : '')}>
            <span className="relative">
              <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              {page === 'dashboard' && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-full" />}
            </span>
            {!collapsed && <span>Dashboard</span>}
          </button>

          <button onClick={() => { setPage('langganan'); setSidebarOpen(false); }}
            className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ' + (page === 'langganan' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800') + (collapsed ? ' justify-center px-0' : '')}>
            <span className="relative">
              <Icon d={creditCardIcon} />
              {page === 'langganan' && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-full" />}
            </span>
            {!collapsed && <span>Langganan</span>}
          </button>

          {!collapsed && <p className="px-2.5 pt-4 pb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Keuangan</p>}
          {financeMenus.map((m, i) => (
            <span key={i} className={'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 cursor-not-allowed ' + (collapsed ? 'justify-center px-0' : '')}>
              <Icon d={m.icon} className="w-5 h-5 text-slate-300 shrink-0" />
              {!collapsed && <span className="flex-1">{m.label}</span>}
              {!collapsed && <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-medium">Segera</span>}
            </span>
          ))}
        </nav>


      </aside>

      {/* Main */}
      <main className={MAIN_ML + ' min-h-screen transition-all duration-300 ease-in-out'}>
        {/* Header */}
        <header className="sticky top-0 z-50 h-16 bg-white/80 backdrop-blur-md border-b border-slate-100/60 flex items-center gap-3 px-4 sm:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition" aria-label="Buka menu">
            <Icon d="M4 6h16M4 12h16M4 18h16" className="w-6 h-6" />
          </button>
          <h2 className="text-lg font-bold text-slate-900">{page === 'password' ? 'Ubah Password' : page === 'langganan' ? 'Langganan' : 'Dashboard'}</h2>
          <div className="flex-1" />
          {/* Profile dropdown */}
          <div ref={profileRef} className="relative">
            <button onClick={() => setProfileOpen(!profileOpen)}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-white font-bold text-sm shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200">
              {(user.nama_lengkap || user.email)[0].toUpperCase()}
            </button>
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 animate-scale-in z-50 origin-top-right">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-bold text-slate-900 truncate">{user.nama_lengkap}</p>
                  <p className="text-xs text-slate-400 truncate">{user.email}</p>
                </div>
                <button onClick={() => { setPage('password'); setProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition">
                  <Icon d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" className="w-4 h-4 text-slate-400" />
                  Ubah Password
                </button>
                <button onClick={() => { setConfirmLogout(true); setProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition">
                  <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" className="w-4 h-4 text-red-400" />
                  Keluar
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="p-4 sm:p-6 lg:p-8">
          {page === 'password' ? <PasswordForm /> : page === 'langganan' ? <LanggananPage /> : (
            <div className="space-y-8 animate-fade-in">
              {/* Trial banner */}
              {trialEnds && !isTrialExpired && (
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200/60 rounded-2xl text-emerald-800 text-sm flex items-start gap-3 animate-slide-down">
                  <Icon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <strong>Trial {daysLeft} hari lagi.</strong> Setelah habis, data tetap aman.{' '}
                    <button onClick={() => setPage('langganan')} className="font-semibold underline underline-offset-2 decoration-emerald-400">Perpanjang Sekarang</button>
                  </div>
                </div>
              )}
              {isTrialExpired && (
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl text-amber-800 text-sm flex items-start gap-3 animate-slide-down">
                  <Icon d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <strong>Masa percobaan telah berakhir.</strong> Data tetap aman.{' '}
                    <button onClick={() => setPage('langganan')} className="font-semibold underline underline-offset-2 decoration-amber-400">Perpanjang Sekarang</button>
                  </div>
                </div>
              )}

              {/* Welcome */}
              <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl p-6 sm:p-8 border border-slate-100 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-900">Selamat datang kembali, {user.nama_lengkap.split(' ')[0]}</h2>
                <p className="mt-1.5 text-sm text-slate-500">
                  {user.nama_bumdes} {'\u00B7'}{' '}
                  <span className={'inline-flex items-center gap-1.5 font-semibold ' + (user.subscription_status === 'trial' ? 'text-emerald-600' : 'text-cyan-600')}>
                    <span className={'w-1.5 h-1.5 rounded-full animate-pulse ' + (user.subscription_status === 'trial' ? 'bg-emerald-500' : 'bg-cyan-500')} />
                    {user.subscription_status === 'trial' ? 'Masa Trial' : 'Aktif'}
                  </span>
                </p>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { label: 'Total Pemasukan', value: 'Rp0', trend: 0, d: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
                  { label: 'Total Pengeluaran', value: 'Rp0', trend: 0, d: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6' },
                  { label: 'Saldo Kas', value: 'Rp0', trend: 0, d: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-50 to-cyan-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                        <Icon d={s.d} className="w-5 h-5 text-emerald-600" />
                      </div>
                      {s.trend !== 0 && (
                        <span className={'inline-flex items-center gap-1 text-xs font-semibold ' + (s.trend > 0 ? 'text-emerald-600' : 'text-red-500')}>
                          <Icon d={s.trend > 0 ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} className="w-3 h-3" />
                          {Math.abs(s.trend)}%
                        </span>
                      )}
                    </div>
                    <p className="text-3xl font-semibold text-slate-900">{s.value}</p>
                    <p className="text-sm font-medium text-slate-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Chart placeholder */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900">Grafik Keuangan</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Ringkasan pemasukan {'\u0026'} pengeluaran</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" /> Pemasukan</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" /> Pengeluaran</span>
                  </div>
                </div>
                <div className="h-48 sm:h-56 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-slate-300">
                    <Icon d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" className="w-8 h-8" />
                    <p className="text-sm">Grafik akan tersedia setelah ada data transaksi</p>
                  </div>
                </div>
              </div>

              {/* Recent activity */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4">Aktivitas Terakhir</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                      <Icon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">Akun BUM Desa berhasil dibuat</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Saat registrasi</p>
                    </div>
                  </div>
                  <div className="text-center pt-2">
                    <p className="text-xs text-slate-400">Fitur lainnya segera hadir</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      {/* Logout confirm modal */}
      {confirmLogout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmLogout(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </div>
            <h3 className="text-center text-lg font-bold text-slate-900">Yakin ingin keluar?</h3>
            <p className="mt-1 text-center text-sm text-slate-500">Anda harus login kembali untuk mengakses akun.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setConfirmLogout(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Batal</button>
              <button onClick={() => { setConfirmLogout(false); logout(); }}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition">Ya, Keluar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
