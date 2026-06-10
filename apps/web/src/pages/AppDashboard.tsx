import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function AppDashboard() {
  const [user, setUser] = useState<any>(null);
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <img src="/logo.png" alt="SILABU DIGI" className="h-10" />
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase">Menu</div>
          <Link to="/app" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold bg-cyan-50 text-cyan-700">
            Dashboard
          </Link>
          <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase mt-4">Keuangan</div>
          <span className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 cursor-not-allowed">
            Buku Kas <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">Segera</span>
          </span>
          <span className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 cursor-not-allowed">
            Jurnal Umum <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">Segera</span>
          </span>
          <span className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 cursor-not-allowed">
            Laporan <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">Segera</span>
          </span>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
              {(user.nama_lengkap || user.email)[0].toUpperCase()}
            </div>
            <div className="text-sm">
              <div className="font-semibold text-slate-900">{user.nama_lengkap}</div>
              <div className="text-xs text-slate-500">{user.email}</div>
            </div>
          </div>
          <button onClick={logout} className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition">
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-64 min-h-screen">
        <header className="h-16 bg-white border-b border-slate-100 flex items-center px-6">
          <h2 className="text-lg font-bold text-slate-900">Dashboard</h2>
        </header>

        <div className="p-6">
          {/* Trial banner */}
          {trialEnds && !isTrialExpired && (
            <div className="mb-6 p-4 bg-cyan-50 border border-cyan-200 rounded-xl text-cyan-800 text-sm">
              <strong>Trial {daysLeft} hari lagi.</strong> Setelah habis, data tetap aman tapi input diblokir.{' '}
              <Link to="/app/langganan" className="underline font-semibold">Berlangganan sekarang</Link>
            </div>
          )}
          {isTrialExpired && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
              <strong>Trial telah berakhir.</strong> Data tetap aman. Silakan berlangganan untuk input data baru.{' '}
              <Link to="/app/langganan" className="underline font-semibold">Berlangganan</Link>
            </div>
          )}

          {/* Welcome card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Selamat datang, {user.nama_lengkap} 👋</h3>
            <p className="text-slate-600">
              BUM Desa: <strong>{user.nama_bumdes}</strong> · Status: <span className={`font-semibold ${user.subscription_status === 'trial' ? 'text-cyan-600' : 'text-green-600'}`}>{user.subscription_status === 'trial' ? 'Trial' : 'Aktif'}</span>
            </p>
          </div>

          {/* Quick stats placeholder */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 text-center">
              <p className="text-2xl font-bold text-slate-900">—</p>
              <p className="text-sm text-slate-500">Total Pemasukan</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 text-center">
              <p className="text-2xl font-bold text-slate-900">—</p>
              <p className="text-sm text-slate-500">Total Pengeluaran</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 text-center">
              <p className="text-2xl font-bold text-slate-900">—</p>
              <p className="text-sm text-slate-500">Saldo Kas</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-center text-slate-400">
            <p>Fitur Buku Kas, Jurnal, dan Laporan segera hadir.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
