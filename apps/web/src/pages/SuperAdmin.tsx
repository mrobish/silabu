import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PasswordForm from './PasswordForm';

type Settings = { smtp: any; oauth: any; tripay: any; security: any };
type TabKey = 'smtp' | 'oauth' | 'tripay' | 'security';
type Page = 'dashboard' | 'users' | 'settings' | 'password';
type ModalAction = 'delete' | 'clear' | 'toggle' | 'reset' | null;

type AdminUser = {
  id: string;
  email: string;
  nama_lengkap?: string;
  role?: string;
  auth_provider?: string;
  is_active?: boolean;
  last_login_at?: string | null;
  created_at?: string | null;
  tenant_id?: string | null;
  nama_bumdes?: string | null;
  subscription_status?: 'trial' | 'active' | 'expired' | string | null;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
};

type AdminStats = {
  total_users?: number;
  bumdes_users?: number;
  active_7d?: number;
  new_7d?: number;
  trial_tenants?: number;
  active_tenants?: number;
  expired_tenants?: number;
  revenue?: number;
  recent_users?: AdminUser[];
};

function Icon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}><path d={d} /></svg>;
}

const menu = [
  { page: 'dashboard' as Page, label: 'Dashboard', icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' },
  { page: 'users' as Page, label: 'Management User', icon: 'M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m0-4a4 4 0 100-8 4 4 0 000 8zm8 0a4 4 0 100-8 4 4 0 000 8z' },
  { page: 'settings' as Page, label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
];

export default function SuperAdmin() {
  const [tab, setTab] = useState<TabKey>('smtp');
  const [settings, setSettings] = useState<Settings>({ smtp: {}, oauth: {}, tripay: {}, security: {} });
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [stats, setStats] = useState<AdminStats>({});
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [actionUser, setActionUser] = useState<AdminUser | null>(null);
  const [modalAction, setModalAction] = useState<ModalAction>(null);
  const [confirmText, setConfirmText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    loadSettings();
    loadStats();
    loadUsers(false);
  }, [token, navigate]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    setConfirmText('');
  }, [modalAction, actionUser?.id]);

  async function loadSettings() {
    try {
      const r = await fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!d.error) setSettings({ smtp: {}, oauth: {}, tripay: {}, security: {}, ...d });
    } catch { /* noop */ }
  }

  async function loadStats() {
    setDashboardLoading(true);
    try {
      const r = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!d.error) setStats(d);
    } catch { /* noop */ } finally { setDashboardLoading(false); }
  }

  async function loadUsers(showLoading = true) {
    if (showLoading) setUsersLoading(true);
    try {
      const r = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!d.error) setUsers(d.users || []);
    } catch { /* noop */ } finally { setUsersLoading(false); }
  }

  function logout() { localStorage.clear(); sessionStorage.clear(); navigate('/login'); }

  async function save(key: string, value: any) {
    setMsg(null); setLoading(true);
    try {
      const r = await fetch(`/api/admin/settings/${key}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(value) });
      const d = await r.json();
      setMsg({ t: d.success ? 'ok' : 'err', m: d.success ? 'Berhasil disimpan' : d.error || 'Gagal' });
    } catch { setMsg({ t: 'err', m: 'Error' }); } finally { setLoading(false); }
  }

  async function runAction() {
    if (!actionUser || !modalAction) return;
    setActionLoading(true);
    setMsg(null);
    try {
      let url: string;
      let method = 'POST';
      let body: string | undefined;
      if (modalAction === 'delete') {
        url = `/api/admin/users/${actionUser.id}`;
        method = 'DELETE';
      } else if (modalAction === 'reset') {
        url = `/api/admin/tenants/${actionUser.tenant_id}/reset-transactions`;
      } else {
        url = `/api/admin/users/${actionUser.id}/${modalAction === 'clear' ? 'clear-data' : 'deactivate'}`;
        body = modalAction === 'toggle' ? JSON.stringify({ active: !actionUser.is_active }) : undefined;
      }
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (body) headers['Content-Type'] = 'application/json';
      const r = await fetch(url, { method, headers, body });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setMsg({ t: 'ok', m: modalAction === 'delete' ? 'Akun berhasil dihapus' : modalAction === 'reset' ? (d.message || 'Data transaksi berhasil di-reset') : modalAction === 'clear' ? (d.message || 'Data berhasil dibersihkan') : 'Status user berhasil diubah' });
      setModalAction(null); setActionUser(null); setConfirmText('');
      await Promise.all([loadUsers(false), loadStats()]);
    } catch (e: any) {
      setMsg({ t: 'err', m: e?.message || 'Aksi gagal' });
    } finally { setActionLoading(false); }
  }

  const update = (section: string, field: string, value: any) => setSettings(prev => ({ ...prev, [section]: { ...prev[section as keyof Settings], [field]: value } }));
  const W = collapsed ? 'w-20' : 'w-64';
  const ML = collapsed ? 'lg:ml-20' : 'lg:ml-64';
  const input = 'w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition';

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u => [u.nama_lengkap, u.email, u.nama_bumdes, u.role, u.auth_provider, u.subscription_status].some(v => String(v || '').toLowerCase().includes(q)));
  }, [users, search]);

  const pageTitle = page === 'password' ? 'Ubah Password' : page === 'dashboard' ? 'Dashboard' : page === 'users' ? 'Management User' : 'Settings';
  const formatDate = (v?: string | null) => v ? new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const money = (n?: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
  const statusClass = (s?: string | null) => s === 'active' ? 'bg-cyan-50 text-cyan-700 ring-cyan-100' : s === 'expired' ? 'bg-amber-50 text-amber-700 ring-amber-100' : 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  const providerClass = (p?: string | null) => p === 'google' ? 'bg-blue-50 text-blue-700 ring-blue-100' : 'bg-slate-50 text-slate-600 ring-slate-100';

  const statsCards = [
    { label: 'Total Pengguna', value: stats.total_users || 0, trend: stats.new_7d || 0, suffix: 'baru 7 hari', icon: 'M15 19a6 6 0 00-12 0m12 0h6m-6 0H3m12-8a4 4 0 11-8 0 4 4 0 018 0zm6 2v6m3-3h-6' },
    { label: 'BUM Desa Aktif', value: stats.active_tenants || 0, trend: stats.active_7d || 0, suffix: 'aktif 7 hari', icon: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9h1m-1 4h1m-1 4h1m6-4h1m-1 4h1' },
    { label: 'Trial Aktif', value: stats.trial_tenants || 0, trend: stats.expired_tenants || 0, suffix: 'expired', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Pendapatan', value: money(stats.revenue), trend: 0, suffix: 'Phase 2', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  return <div className="min-h-screen bg-slate-50">
    {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}
    <aside className={'fixed inset-y-0 left-0 z-50 ' + W + ' bg-white flex flex-col transition-all duration-300 ease-in-out transform ' + (sidebarOpen ? 'translate-x-0' : '-translate-x-full') + ' lg:translate-x-0'}>
      <div className={'h-16 flex items-center border-b border-slate-100 ' + (collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
        <img src="/logo.png" alt="SILABU DIGI" className={'shrink-0 ' + (collapsed ? 'w-10 h-10 rounded-xl object-cover' : 'h-9')} />
        <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition" title={collapsed ? 'Perluas sidebar' : 'Sembunyikan sidebar'}>
          <Icon d={collapsed ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7M19 19l-7-7 7-7'} className="w-4 h-4" />
        </button>
        {!collapsed && <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"><Icon d="M6 18L18 6M6 6l12 12" /></button>}
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className={'px-2.5 pb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider ' + (collapsed ? 'text-center' : '')}>{collapsed ? 'SA' : 'Super Admin'}</p>
        {menu.map(m => <button key={m.page} onClick={() => { setPage(m.page); setSidebarOpen(false); }} className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ' + (page === m.page ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800') + (collapsed ? ' justify-center px-0' : '')}>
          <span className="relative"><Icon d={m.icon} />{page === m.page && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-full" />}</span>
          {!collapsed && <span>{m.label}</span>}
        </button>)}
      </nav>
    </aside>

    <main className={ML + ' min-h-screen transition-all duration-300 ease-in-out'}>
      <header className="sticky top-0 z-50 h-16 bg-white/80 backdrop-blur-md border-b border-slate-100/60 flex items-center gap-3 px-4 sm:px-6">
        <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition"><Icon d="M4 6h16M4 12h16M4 18h16" className="w-6 h-6" /></button>
        <h2 className="text-lg font-bold text-slate-900 truncate">{pageTitle}</h2><div className="flex-1" />
        <div ref={profileRef} className="relative"><button onClick={() => setProfileOpen(!profileOpen)} className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-white font-bold text-xs shadow-sm hover:shadow-md hover:scale-105 transition-all">SA</button>
          {profileOpen && <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 animate-scale-in z-50 origin-top-right"><div className="px-4 py-3 border-b border-slate-100"><p className="text-sm font-bold text-slate-900 truncate">Super Admin</p><p className="text-xs text-slate-400 truncate">admin@silabu.ondesa.id</p></div><button onClick={() => { setPage('password'); setProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"><Icon d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" className="w-4 h-4 text-slate-400" />Ubah Password</button><button onClick={() => { setConfirmLogout(true); setProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"><Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" className="w-4 h-4 text-red-400" />Keluar</button></div>}
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8">
        {msg && <div className={`mb-6 p-3 rounded-xl text-sm border animate-fade-in ${msg.t === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{msg.m}</div>}
        {page === 'password' && <div className="max-w-3xl animate-fade-in"><PasswordForm /></div>}

        {page === 'dashboard' && <div className="space-y-8 animate-fade-in">
          {dashboardLoading ? <div className="min-h-[320px] flex items-center justify-center"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div> : <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">{statsCards.map((s, i) => <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"><div className="flex items-center justify-between mb-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-50 to-cyan-50 flex items-center justify-center group-hover:scale-110 transition-transform"><Icon d={s.icon} className="w-5 h-5 text-emerald-600" /></div><span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><Icon d={s.trend >= 0 ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} className="w-3 h-3" />{s.trend} {s.suffix}</span></div><p className="text-3xl font-semibold text-slate-900">{s.value}</p><p className="text-sm text-slate-500 mt-1">{s.label}</p></div>)}</div>
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"><div className="flex items-center justify-between mb-4"><div><h3 className="font-bold text-slate-900">Pengguna Terbaru</h3><p className="text-sm text-slate-500">5 akun terakhir yang terdaftar</p></div><button onClick={() => setPage('users')} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">Lihat semua</button></div><UsersTable users={stats.recent_users || []} compact formatDate={formatDate} statusClass={statusClass} providerClass={providerClass} /></div>
          </>}
        </div>}

        {page === 'users' && <div className="space-y-8 animate-fade-in">
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"><div className="flex flex-col sm:flex-row sm:items-center gap-4"><div className="flex-1"><h3 className="font-bold text-slate-900">Management User</h3><p className="text-sm text-slate-500">Kelola akun BUM Desa, status, dan data tenant.</p></div><div className="relative sm:w-80"><Icon d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama, email, BUM Desa..." className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition" /></div></div></div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">{usersLoading ? <div className="h-64 flex items-center justify-center"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div> : <UsersTable users={filteredUsers} formatDate={formatDate} statusClass={statusClass} providerClass={providerClass} onAction={(u, a) => { setActionUser(u); setModalAction(a); }} />}</div>
        </div>}

        {page === 'settings' && <div className="max-w-3xl animate-fade-in">
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2 -mx-1 px-1">{(['smtp', 'oauth', 'tripay', 'security'] as const).map(t => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${tab === t ? 'bg-gradient-to-r from-emerald-500 to-cyan-600 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}>{t === 'smtp' ? 'SMTP Email' : t === 'oauth' ? 'Google OAuth' : t === 'tripay' ? 'Tripay' : 'Keamanan'}</button>)}</div>
          {tab === 'smtp' && <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100 space-y-4"><h3 className="text-lg font-bold text-slate-900">SMTP Email</h3><p className="text-sm text-slate-500">Konfigurasi pengiriman email verifikasi & notifikasi.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="text-sm font-semibold text-slate-700">Host</label><input value={settings.smtp.host || ''} onChange={e => update('smtp', 'host', e.target.value)} className={input} /></div><div><label className="text-sm font-semibold text-slate-700">Port</label><input type="number" value={settings.smtp.port || 587} onChange={e => update('smtp', 'port', Number(e.target.value))} className={input} /></div></div><div><label className="text-sm font-semibold text-slate-700">Username</label><input value={settings.smtp.user || ''} onChange={e => update('smtp', 'user', e.target.value)} className={input} /></div><div><label className="text-sm font-semibold text-slate-700">Password</label><input type="password" value={settings.smtp.pass || ''} onChange={e => update('smtp', 'pass', e.target.value)} className={input} /></div><div><label className="text-sm font-semibold text-slate-700">From</label><input value={settings.smtp.from || ''} onChange={e => update('smtp', 'from', e.target.value)} className={input} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.smtp.secure || false} onChange={e => update('smtp', 'secure', e.target.checked)} /> Secure SSL/TLS (port 465)</label><button onClick={() => save('smtp', settings.smtp)} disabled={loading} className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">Simpan SMTP</button></div>}
          {tab === 'oauth' && <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100 space-y-4"><h3 className="text-lg font-bold text-slate-900">Google OAuth</h3><p className="text-sm text-slate-500">Redirect URI: <code className="bg-slate-100 px-2 py-0.5 rounded text-xs break-all">https://silabu.ondesa.id/api/auth/google/callback</code></p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.oauth.googleEnabled || false} onChange={e => update('oauth', 'googleEnabled', e.target.checked)} /> Enable Google Login</label><div><label className="text-sm font-semibold text-slate-700">Client ID</label><input value={settings.oauth.googleClientId || ''} onChange={e => update('oauth', 'googleClientId', e.target.value)} className={input} /></div><div><label className="text-sm font-semibold text-slate-700">Client Secret</label><input type="password" value={settings.oauth.googleClientSecret || ''} onChange={e => update('oauth', 'googleClientSecret', e.target.value)} className={input} /></div><button onClick={() => save('oauth', settings.oauth)} disabled={loading} className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">Simpan OAuth</button></div>}
          {tab === 'tripay' && <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100 space-y-4"><h3 className="text-lg font-bold text-slate-900">Tripay Payment Gateway</h3><p className="text-sm text-slate-500">QRIS, Virtual Account, E-wallet via Tripay.</p>{['merchantId', 'apiKey', 'secretKey'].map(f => <div key={f}><label className="text-sm font-semibold text-slate-700">{f}</label><input type={f === 'merchantId' ? 'text' : 'password'} value={settings.tripay[f] || ''} onChange={e => update('tripay', f, e.target.value)} className={input} /></div>)}<button onClick={() => save('tripay', settings.tripay)} disabled={loading} className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">Simpan Tripay</button></div>}
          {tab === 'security' && <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100 space-y-4"><h3 className="text-lg font-bold text-slate-900">Keamanan — Cloudflare Turnstile</h3><p className="text-sm text-slate-500">CAPTCHA anti-bot di halaman Login, Register, dan Lupa Password.</p><div><label className="text-sm font-semibold text-slate-700">Site Key</label><input value={settings.security.turnstile_site_key || ''} onChange={e => update('security', 'turnstile_site_key', e.target.value)} className={input} /></div><div><label className="text-sm font-semibold text-slate-700">Secret Key</label><input type="password" value={settings.security.turnstile_secret_key || ''} onChange={e => update('security', 'turnstile_secret_key', e.target.value)} className={input} /></div><button onClick={() => save('security', settings.security)} disabled={loading} className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">Simpan Keamanan</button></div>}
        </div>}
      </div>
    </main>

    {modalAction && actionUser && <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !actionLoading && setModalAction(null)} /><div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl animate-scale-in"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50"><Icon d={modalAction === 'delete' ? 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h12' : modalAction === 'reset' ? 'M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7M4 7h16M4 7l2-3h12l2 3m-6 4v6' : modalAction === 'clear' ? 'M4 7h16M10 11v6m4-6v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4h6v3' : 'M5 13l4 4L19 7'} className="h-6 w-6 text-amber-600" /></div><h3 className="text-center text-lg font-bold text-slate-900">{modalAction === 'delete' ? 'Hapus akun?' : modalAction === 'reset' ? 'Reset Data Transaksi?' : modalAction === 'clear' ? 'Clear data user?' : actionUser.is_active ? 'Nonaktifkan user?' : 'Aktifkan user?'}</h3><p className="mt-1 text-center text-sm text-slate-500">{actionUser.nama_bumdes || actionUser.email}</p>{modalAction === 'delete' && <div className="mt-5 rounded-xl bg-red-50 border border-red-100 p-3"><p className="text-xs text-red-700 leading-relaxed">Tindakan ini <b>permanen</b>. Akun, data BUM Desa, dan seluruh transaksi milik tenant ini akan dihapus dan <b>tidak dapat dipulihkan</b>.</p><p className="mt-3 text-xs font-medium text-slate-600">Ketik <span className="font-bold text-red-700 select-none">SAYA YAKIN MENGHAPUS PERMANEN</span> untuk melanjutkan:</p><input value={confirmText} onChange={e => setConfirmText(e.target.value)} autoFocus placeholder="SAYA YAKIN MENGHAPUS PERMANEN" className="mt-2 w-full rounded-lg border border-red-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition" /></div>}{modalAction === 'reset' && <div className="mt-5 rounded-xl bg-red-50 border border-red-100 p-3"><p className="text-xs text-red-700 leading-relaxed">Semua <b>data transaksi</b> (Jurnal, Saldo Awal, Aset, Periode) akan <b>di-hapus permanen</b>.</p><p className="text-xs text-emerald-700 mt-1.5 leading-relaxed">Data yang <b>aman</b>: CoA (304 akun), Profil BUM Desa, Akun User, Langganan.</p><p className="mt-3 text-xs font-medium text-slate-600">Ketik <span className="font-bold text-red-700 select-none">RESET {(actionUser.nama_bumdes || '').toUpperCase()}</span> untuk melanjutkan:</p><input value={confirmText} onChange={e => setConfirmText(e.target.value)} autoFocus placeholder={`RESET ${(actionUser.nama_bumdes || '').toUpperCase()}`} className="mt-2 w-full rounded-lg border border-red-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition font-mono" /></div>}<div className="mt-6 flex gap-3"><button onClick={() => { setModalAction(null); setConfirmText(''); }} disabled={actionLoading} className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50">Batal</button><button onClick={runAction} disabled={actionLoading || (modalAction === 'delete' && confirmText.trim() !== 'SAYA YAKIN MENGHAPUS PERMANEN') || (modalAction === 'reset' && confirmText.trim() !== `RESET ${(actionUser.nama_bumdes || '').toUpperCase()}`)} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed">{actionLoading ? 'Memproses...' : modalAction === 'delete' ? 'Hapus Permanen' : modalAction === 'reset' ? 'Ya, Reset Data' : 'Ya, Lanjutkan'}</button></div></div></div>}

    {confirmLogout && <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmLogout(false)} /><div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl animate-scale-in"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50"><svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></div><h3 className="text-center text-lg font-bold text-slate-900">Yakin ingin keluar?</h3><p className="mt-1 text-center text-sm text-slate-500">Anda harus login kembali untuk mengakses akun.</p><div className="mt-6 flex gap-3"><button onClick={() => setConfirmLogout(false)} className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Batal</button><button onClick={() => { setConfirmLogout(false); logout(); }} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition">Ya, Keluar</button></div></div></div>}
  </div>;
}

function UsersTable({ users, compact, formatDate, statusClass, providerClass, onAction }: { users: AdminUser[]; compact?: boolean; formatDate: (v?: string | null) => string; statusClass: (s?: string | null) => string; providerClass: (p?: string | null) => string; onAction?: (u: AdminUser, a: ModalAction) => void; }) {
  if (!users.length) return <div className="p-8 text-center text-sm text-slate-500">Belum ada data user.</div>;
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-bold uppercase tracking-wider text-slate-400"><th className="px-5 py-3">Nama</th><th className="px-5 py-3">Email</th>{!compact && <th className="px-5 py-3">BUM Desa</th>}<th className="px-5 py-3">Status</th><th className="px-5 py-3">Provider</th>{!compact && <th className="px-5 py-3">Last Login</th>}<th className="px-5 py-3">Dibuat</th>{!compact && <th className="px-5 py-3 text-right">Aksi</th>}</tr></thead><tbody className="divide-y divide-slate-100">{users.map(u => <tr key={u.id} className="hover:bg-slate-50/70 transition"><td className="px-5 py-4 font-semibold text-slate-800 whitespace-nowrap">{u.nama_lengkap || '-'}</td><td className="px-5 py-4 text-slate-600 whitespace-nowrap">{u.email}</td>{!compact && <td className="px-5 py-4 text-slate-600 whitespace-nowrap">{u.nama_bumdes || '-'}</td>}<td className="px-5 py-4"><span className={'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ' + statusClass(u.subscription_status)}>{u.subscription_status || 'trial'}</span></td><td className="px-5 py-4"><span className={'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ' + providerClass(u.auth_provider)}>{u.auth_provider || 'email'}</span></td>{!compact && <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{formatDate(u.last_login_at)}</td>}<td className="px-5 py-4 text-slate-500 whitespace-nowrap">{formatDate(u.created_at)}</td>{!compact && <td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => onAction?.(u, 'toggle')} className={(u.is_active ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100') + ' px-3 py-1.5 rounded-lg text-xs font-semibold transition'}>{u.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button><button onClick={() => onAction?.(u, 'clear')} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 transition">Clear data</button>{u.tenant_id && <button onClick={() => onAction?.(u, 'reset')} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 transition">Reset Data</button>}<button onClick={() => onAction?.(u, 'delete')} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 transition">Hapus</button></div></td>}</tr>)}</tbody></table></div>;
}
