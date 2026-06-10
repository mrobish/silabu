import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import LogoutButton from './LogoutButton';

type Settings = { smtp: any; oauth: any; tripay: any; security: any };
type TabKey = 'smtp' | 'oauth' | 'tripay' | 'security';

export default function SuperAdmin() {
  const [tab, setTab] = useState<TabKey>('smtp');
  const [settings, setSettings] = useState<Settings>({ smtp:{}, oauth:{}, tripay:{}, security:{} });
  const [msg, setMsg] = useState<{t:'ok'|'err';m:string}|null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetch('/api/admin/settings', { headers:{Authorization:`Bearer ${token}`} })
      .then(r=>r.json())
      .then(d => { if(!d.error) setSettings({ smtp:{}, oauth:{}, tripay:{}, security:{}, ...d }); })
      .catch(()=>{});
  }, [token, navigate]);

  function logout() { localStorage.clear(); sessionStorage.clear(); navigate('/login'); }

  async function save(key:string, value:any) {
    setMsg(null); setLoading(true);
    try {
      const r = await fetch(`/api/admin/settings/${key}`, {
        method:'PUT', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body: JSON.stringify(value),
      });
      const d = await r.json();
      setMsg({t: d.success?'ok':'err', m: d.success?'Berhasil disimpan':d.error||'Gagal'});
    } catch { setMsg({t:'err',m:'Error'}); } finally { setLoading(false); }
  }

  const update = (section:string, field:string, value:string|boolean) => {
    setSettings(prev => ({ ...prev, [section]: { ...prev[section as keyof Settings], [field]: value } }));
  };

  const Sidebar = () => (
    <>
      {/* Overlay background — mobile only */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-100">
          <img src="/logo.png" alt="SILABU DIGI" className="h-8" />
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600" aria-label="Tutup menu">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wide">Super Admin</div>
          <Link to="/super-admin" onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            Dashboard
          </Link>
          <Link to="/super-admin/settings" onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Pengaturan Sistem
          </Link>
        </nav>
        <div className="p-3 border-t border-slate-100 space-y-2">
          <Link to="/change-password" onClick={() => setSidebarOpen(false)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Ubah Password
          </Link>
          <LogoutButton onLogout={logout} />
        </div>
      </aside>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />

      <main className="lg:ml-64 min-h-screen">
        {/* Mobile header with hamburger */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-100 flex items-center gap-3 px-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600 hover:text-slate-900" aria-label="Buka menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h2 className="text-base font-bold text-slate-900 truncate">Pengaturan Sistem</h2>
        </header>

        <div className="p-4 sm:p-6 max-w-3xl">
          {msg && <div className={`mb-4 p-3 rounded-xl text-sm ${msg.t==='ok'?'bg-green-50 border-green-200 text-green-700':'bg-red-50 border-red-200 text-red-700'} border`}>{msg.m}</div>}

          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-1 px-1">
            {(['smtp','oauth','tripay','security'] as const).map(t => (
              <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${tab===t?'bg-cyan-600 text-white shadow-sm':'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'} transition`}>
                {t==='smtp'?'SMTP Email':t==='oauth'?'Google OAuth':t==='tripay'?'Tripay':'Keamanan'}
              </button>
            ))}
          </div>

          {tab === 'smtp' && (
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border space-y-4">
              <h3 className="text-lg font-bold text-slate-900">SMTP Email</h3>
              <p className="text-sm text-slate-600">Konfigurasi pengiriman email verifikasi & notifikasi.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="text-sm font-semibold text-slate-700">Host</label><input value={settings.smtp.host||''} onChange={e=>update('smtp','host',e.target.value)} className="w-full mt-1 px-3 py-2.5 border rounded-xl text-sm" placeholder="smtp.gmail.com" /></div>
                <div><label className="text-sm font-semibold text-slate-700">Port</label><input type="number" value={settings.smtp.port||587} onChange={e=>update('smtp','port',Number(e.target.value) as any)} className="w-full mt-1 px-3 py-2.5 border rounded-xl text-sm" /></div>
              </div>
              <div><label className="text-sm font-semibold text-slate-700">Username</label><input value={settings.smtp.user||''} onChange={e=>update('smtp','user',e.target.value)} className="w-full mt-1 px-3 py-2.5 border rounded-xl text-sm" placeholder="noreply@domain.com" /></div>
              <div><label className="text-sm font-semibold text-slate-700">Password</label><input type="password" value={settings.smtp.pass||''} onChange={e=>update('smtp','pass',e.target.value)} className="w-full mt-1 px-3 py-2.5 border rounded-xl text-sm" /></div>
              <div><label className="text-sm font-semibold text-slate-700">From</label><input value={settings.smtp.from||''} onChange={e=>update('smtp','from',e.target.value)} className="w-full mt-1 px-3 py-2.5 border rounded-xl text-sm" placeholder="SILABU DIGI <noreply@domain.com>" /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.smtp.secure||false} onChange={e=>update('smtp','secure',e.target.checked)} /> Secure SSL/TLS (port 465)</label>
              <button onClick={()=>save('smtp',settings.smtp)} disabled={loading} className="w-full px-4 py-2.5 bg-cyan-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">Simpan SMTP</button>
            </div>
          )}

          {tab === 'oauth' && (
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Google OAuth</h3>
              <p className="text-sm text-slate-600">Redirect URI: <code className="bg-slate-100 px-2 py-0.5 rounded text-xs break-all">https://silabu.ondesa.id/api/auth/google/callback</code></p>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.oauth.googleEnabled||false} onChange={e=>update('oauth','googleEnabled',e.target.checked)} /> Enable Google Login</label>
              <div><label className="text-sm font-semibold text-slate-700">Client ID</label><input value={settings.oauth.googleClientId||''} onChange={e=>update('oauth','googleClientId',e.target.value)} className="w-full mt-1 px-3 py-2.5 border rounded-xl text-sm" /></div>
              <div><label className="text-sm font-semibold text-slate-700">Client Secret</label><input type="password" value={settings.oauth.googleClientSecret||''} onChange={e=>update('oauth','googleClientSecret',e.target.value)} className="w-full mt-1 px-3 py-2.5 border rounded-xl text-sm" /></div>
              <button onClick={()=>save('oauth',settings.oauth)} disabled={loading} className="w-full px-4 py-2.5 bg-cyan-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">Simpan OAuth</button>
            </div>
          )}

          {tab === 'tripay' && (
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Tripay Payment Gateway</h3>
              <p className="text-sm text-slate-600">QRIS, Virtual Account, E-wallet via Tripay.</p>
              <div><label className="text-sm font-semibold text-slate-700">Merchant ID</label><input value={settings.tripay.merchantId||''} onChange={e=>update('tripay','merchantId',e.target.value)} className="w-full mt-1 px-3 py-2.5 border rounded-xl text-sm" /></div>
              <div><label className="text-sm font-semibold text-slate-700">API Key</label><input type="password" value={settings.tripay.apiKey||''} onChange={e=>update('tripay','apiKey',e.target.value)} className="w-full mt-1 px-3 py-2.5 border rounded-xl text-sm" /></div>
              <div><label className="text-sm font-semibold text-slate-700">Secret Key</label><input type="password" value={settings.tripay.secretKey||''} onChange={e=>update('tripay','secretKey',e.target.value)} className="w-full mt-1 px-3 py-2.5 border rounded-xl text-sm" /></div>
              <button onClick={()=>save('tripay',settings.tripay)} disabled={loading} className="w-full px-4 py-2.5 bg-cyan-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">Simpan Tripay</button>
            </div>
          )}

          {tab === 'security' && (
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Keamanan — Cloudflare Turnstile</h3>
              <p className="text-sm text-slate-600">CAPTCHA anti-bot di halaman Login, Register, dan Lupa Password. Ambil key di Cloudflare Dashboard → Turnstile. Kosongkan untuk menonaktifkan CAPTCHA.</p>
              <div><label className="text-sm font-semibold text-slate-700">Site Key</label><input value={settings.security.turnstile_site_key||''} onChange={e=>update('security','turnstile_site_key',e.target.value)} className="w-full mt-1 px-3 py-2.5 border rounded-xl text-sm" placeholder="0x4AAAAAAA..." /></div>
              <div><label className="text-sm font-semibold text-slate-700">Secret Key</label><input type="password" value={settings.security.turnstile_secret_key||''} onChange={e=>update('security','turnstile_secret_key',e.target.value)} className="w-full mt-1 px-3 py-2.5 border rounded-xl text-sm" placeholder="0x4AAAAAAA..." /></div>
              <button onClick={()=>save('security',settings.security)} disabled={loading} className="w-full px-4 py-2.5 bg-cyan-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">Simpan Keamanan</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
