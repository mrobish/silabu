import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

type Settings = { smtp:any; oauth:any; tripay:any };

export default function SuperAdmin() {
  const [tab, setTab] = useState<'smtp'|'oauth'|'tripay'>('smtp');
  const [settings, setSettings] = useState<Settings>({ smtp:{}, oauth:{}, tripay:{} });
  const [msg, setMsg] = useState<{t:'ok'|'err';m:string}|null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetch('/api/admin/settings', { headers:{Authorization:`Bearer ${token}`} })
      .then(r=>r.json())
      .then(d => { if(!d.error) setSettings(d); })
      .catch(()=>{});
  }, [token, navigate]);

  function logout() { localStorage.clear(); navigate('/login'); }

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

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <img src="/logo.png" alt="SILABU DIGI" className="h-10" />
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase">Super Admin</div>
          <Link to="/super-admin" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold bg-cyan-50 text-cyan-700">Dashboard</Link>
          <Link to="/super-admin/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold bg-cyan-50 text-cyan-700">Pengaturan Sistem</Link>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button onClick={logout} className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50">Logout</button>
        </div>
      </aside>

      <main className="ml-64 min-h-screen">
        <header className="h-16 bg-white border-b border-slate-100 flex items-center px-6">
          <h2 className="text-lg font-bold text-slate-900">Pengaturan Sistem</h2>
        </header>
        <div className="p-6 max-w-3xl">
          {msg && <div className={`mb-4 p-3 rounded-xl text-sm ${msg.t==='ok'?'bg-green-50 border-green-200 text-green-700':'bg-red-50 border-red-200 text-red-700'} border`}>{msg.m}</div>}

          <div className="flex gap-2 mb-6">
            {(['smtp','oauth','tripay'] as const).map(t => (
              <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab===t?'bg-cyan-600 text-white':'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'} transition`}>
                {t==='smtp'?'SMTP Email':t==='oauth'?'Google OAuth':'Tripay'}
              </button>
            ))}
          </div>

          {tab === 'smtp' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border space-y-4">
              <h3 className="text-lg font-bold text-slate-900">SMTP Email</h3>
              <p className="text-sm text-slate-600">Konfigurasi pengiriman email verifikasi & notifikasi.</p>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-semibold text-slate-700">Host</label><input value={settings.smtp.host||''} onChange={e=>update('smtp','host',e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg" placeholder="smtp.gmail.com" /></div>
                <div><label className="text-sm font-semibold text-slate-700">Port</label><input type="number" value={settings.smtp.port||587} onChange={e=>update('smtp','port',Number(e.target.value))} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
              </div>
              <div><label className="text-sm font-semibold text-slate-700">Username</label><input value={settings.smtp.user||''} onChange={e=>update('smtp','user',e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg" placeholder="noreply@domain.com" /></div>
              <div><label className="text-sm font-semibold text-slate-700">Password</label><input type="password" value={settings.smtp.pass||''} onChange={e=>update('smtp','pass',e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
              <div><label className="text-sm font-semibold text-slate-700">From</label><input value={settings.smtp.from||''} onChange={e=>update('smtp','from',e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg" placeholder="SILABU DIGI <noreply@domain.com>" /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.smtp.secure||false} onChange={e=>update('smtp','secure',e.target.checked)} /> Secure SSL/TLS (port 465)</label>
              <button onClick={()=>save('smtp',settings.smtp)} disabled={loading} className="px-4 py-2 bg-cyan-600 text-white rounded-lg font-semibold disabled:opacity-50">Simpan SMTP</button>
            </div>
          )}

          {tab === 'oauth' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Google OAuth</h3>
              <p className="text-sm text-slate-600">Redirect URI: <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">https://silabu.ondesa.id/api/auth/google/callback</code></p>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.oauth.googleEnabled||false} onChange={e=>update('oauth','googleEnabled',e.target.checked)} /> Enable Google Login</label>
              <div><label className="text-sm font-semibold text-slate-700">Client ID</label><input value={settings.oauth.googleClientId||''} onChange={e=>update('oauth','googleClientId',e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
              <div><label className="text-sm font-semibold text-slate-700">Client Secret</label><input type="password" value={settings.oauth.googleClientSecret||''} onChange={e=>update('oauth','googleClientSecret',e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
              <button onClick={()=>save('oauth',settings.oauth)} disabled={loading} className="px-4 py-2 bg-cyan-600 text-white rounded-lg font-semibold disabled:opacity-50">Simpan OAuth</button>
            </div>
          )}

          {tab === 'tripay' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Tripay Payment Gateway</h3>
              <p className="text-sm text-slate-600">QRIS, Virtual Account, E-wallet via Tripay.</p>
              <div><label className="text-sm font-semibold text-slate-700">Merchant ID</label><input value={settings.tripay.merchantId||''} onChange={e=>update('tripay','merchantId',e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
              <div><label className="text-sm font-semibold text-slate-700">API Key</label><input type="password" value={settings.tripay.apiKey||''} onChange={e=>update('tripay','apiKey',e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
              <div><label className="text-sm font-semibold text-slate-700">Secret Key</label><input type="password" value={settings.tripay.secretKey||''} onChange={e=>update('tripay','secretKey',e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
              <button onClick={()=>save('tripay',settings.tripay)} disabled={loading} className="px-4 py-2 bg-cyan-600 text-white rounded-lg font-semibold disabled:opacity-50">Simpan Tripay</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
