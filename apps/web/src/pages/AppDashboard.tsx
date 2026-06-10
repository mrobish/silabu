import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function AppDashboard() {
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('accessToken');
    if (!stored || !token) { navigate('/login'); return; }
    const u = JSON.parse(stored);

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.error) { navigate('/login'); return; }
        if (!d.user.tenant_id) { navigate('/register'); return; }
        setUser(d.user);
      })
      .catch(() => navigate('/login'));
  }, [navigate]);

  if (!user) return <div className="min-h-screen flex items-center justify-center"><p>Memuat...</p></div>;

  function logout() {
    localStorage.clear();
    navigate('/login');
  }

  const trialEnds = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
  const now = new Date();
  const isTrialExpired = trialEnds && now > trialEnds;
  const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - now.getTime()) / 86400000)) : 0;

  const Sidebar = () => (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-100">
          <img src="/logo.png" alt="SILABU DIGI" className="h-8" />
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wide">Menu</div>
          <Link to="/app" onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            Dashboard
          </Link>
          <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wide mt-4">Keuangan</div>
          <span className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 cursor-not-allowed">
            Buku Kas <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">Segera</span>
          </span>
          <span className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 cursor-not-allowed">
            Jurnal Umum <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">Segera</span>
          </span>
          <span className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 cursor-not-allowed">
            Laporan <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">Segera</span>
          </span>
        </nav>
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {(user.nama_lengkap || user.email)[0].toUpperCase()}
            </div>
            <div className="text-sm min-w-0">
              <div className="font-semibold text-slate-900 truncate">{user.nama_lengkap}</div>
              <div className="text-xs text-slate-500 truncate">{user.email}</div>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Logout
          </button>
        </div>
      </aside>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />

      <main className="lg:ml-64 min-h-screen">
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-100 flex items-center gap-3 px-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600 hover:text-slate-900" aria-label="Buka menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h2 className="text-base font-bold text-slate-900 truncate">Dashboard</h2>
        </header>

        <div className="p-4 sm:p-6">
          {trialEnds && !isTrialExpired && (
            <div className="mb-4 p-4 bg-cyan-50 border border-cyan-200 rounded-xl text-cyan-800 text-sm">
              <strong>Trial {daysLeft} hari lagi.</strong> Setelah habis, data tetap aman tapi input diblokir.{' '}
              <Link to="/app/langganan" className="underline font-semibold">Berlangganan sekarang</Link>
            </div>
          )}
          {isTrialExpired && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
              <strong>Trial telah berakhir.</strong> Data tetap aman. Silakan berlangganan untuk input data baru.{' '}
              <Link to="/app/langganan" className="underline font-semibold">Berlangganan</Link>
            </div>
          )}

          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100 mb-4">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Selamat datang, {user.nama_lengkap} 👋</h3>
            <p className="text-sm text-slate-600">
              BUM Desa: <strong>{user.nama_bumdes}</strong> · Status: <span className={`font-semibold ${user.subscription_status === 'trial' ? 'text-cyan-600' : 'text-green-600'}`}>{user.subscription_status === 'trial' ? 'Trial' : 'Aktif'}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 text-center">
              <p className="text-2xl font-bold text-slate-900">—</p>
              <p className="text-sm text-slate-500 mt-1">Total Pemasukan</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 text-center">
              <p className="text-2xl font-bold text-slate-900">—</p>
              <p className="text-sm text-slate-500 mt-1">Total Pengeluaran</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 text-center">
              <p className="text-2xl font-bold text-slate-900">—</p>
              <p className="text-sm text-slate-500 mt-1">Saldo Kas</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 text-center text-slate-400 text-sm">
            Fitur Buku Kas, Jurnal, dan Laporan segera hadir.
          </div>
        </div>
      </main>
    </div>
  );
}
