import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PasswordForm from './PasswordForm';

type Settings = { smtp: any; oauth: any; tripay: any; security: any };
type TabKey = 'smtp' | 'oauth' | 'tripay' | 'security';

function Icon({ d, className='w-5 h-5' }: { d:string; className?:string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}><path d={d}/></svg>;
}

export default function SuperAdmin() {
  const [tab, setTab] = useState<TabKey>('smtp');
  const [settings, setSettings] = useState<Settings>({ smtp:{}, oauth:{}, tripay:{}, security:{} });
  const [msg, setMsg] = useState<{t:'ok'|'err';m:string}|null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPage] = useState<'settings'|'password'>('settings');
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetch('/api/admin/settings', { headers:{Authorization:`Bearer ${token}`} })
      .then(r=>r.json()).then(d => { if(!d.error) setSettings({ smtp:{}, oauth:{}, tripay:{}, security:{}, ...d }); }).catch(()=>{});
  }, [token, navigate]);

  useEffect(() => {
    function out(e: MouseEvent) { if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false); }
    if (profileOpen) document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, [profileOpen]);

  function logout() { localStorage.clear(); sessionStorage.clear(); navigate('/login'); }

  async function save(key:string, value:any) {
    setMsg(null); setLoading(true);
    try {
      const r = await fetch(`/api/admin/settings/${key}`, { method:'PUT', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify(value) });
      const d = await r.json();
      setMsg({t: d.success?'ok':'err', m: d.success?'Berhasil disimpan':d.error||'Gagal'});
    } catch { setMsg({t:'err',m:'Error'}); } finally { setLoading(false); }
  }
  const update = (section:string, field:string, value:any) => setSettings(prev => ({ ...prev, [section]: { ...prev[section as keyof Settings], [field]: value } }));
  const W = collapsed ? 'w-20' : 'w-64';
  const ML = collapsed ? 'lg:ml-20' : 'lg:ml-64';
  const input = 'w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition';

  return <div className="min-h-screen bg-slate-50">
    {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={()=>setSidebarOpen(false)} />}
    <aside className={'fixed inset-y-0 left-0 z-50 '+W+' bg-white flex flex-col transition-all duration-300 ease-in-out transform '+(sidebarOpen?'translate-x-0':'-translate-x-full')+' lg:translate-x-0'}>
      <div className={'h-16 flex items-center border-b border-slate-100 '+(collapsed?'justify-center px-2':'justify-between px-4')}>
        <img src="/logo.png" alt="SILABU DIGI" className={'shrink-0 '+(collapsed?'w-10 h-10 rounded-xl object-cover':'h-9')} />
        <button onClick={()=>setCollapsed(!collapsed)} className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition" title={collapsed?'Perluas sidebar':'Sembunyikan sidebar'}>
          <Icon d={collapsed?'M13 5l7 7-7 7M5 5l7 7-7 7':'M11 19l-7-7 7-7M19 19l-7-7 7-7'} className="w-4 h-4" />
        </button>
        {!collapsed && <button onClick={()=>setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"><Icon d="M6 18L18 6M6 6l12 12" /></button>}
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className={'px-2.5 pb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider '+(collapsed?'text-center':'')}>{collapsed?'A':'Super Admin'}</p>
        <button onClick={()=>{setPage('settings');setSidebarOpen(false)}} className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 '+(page==='settings'?'bg-emerald-50 text-emerald-700 shadow-sm':'text-slate-600 hover:bg-slate-50 hover:text-slate-800')+(collapsed?' justify-center px-0':'')}>
          <span className="relative"><Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />{page==='settings'&&<span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-full"/>}</span>
          {!collapsed && <span>Pengaturan Sistem</span>}
        </button>
      </nav>
    </aside>

    <main className={ML+' min-h-screen transition-all duration-300 ease-in-out'}>
      <header className="sticky top-0 z-50 h-16 bg-white/80 backdrop-blur-md border-b border-slate-100/60 flex items-center gap-3 px-4 sm:px-6">
        <button onClick={()=>setSidebarOpen(true)} className="lg:hidden text-slate-600 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition"><Icon d="M4 6h16M4 12h16M4 18h16" className="w-6 h-6" /></button>
        <h2 className="text-lg font-bold text-slate-900 truncate">{page==='password'?'Ubah Password':'Pengaturan Sistem'}</h2><div className="flex-1" />
        <div ref={profileRef} className="relative"><button onClick={()=>setProfileOpen(!profileOpen)} className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-white font-bold text-xs shadow-sm hover:shadow-md hover:scale-105 transition-all">SA</button>
        {profileOpen && <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 animate-scale-in z-50 origin-top-right"><div className="px-4 py-3 border-b border-slate-100"><p className="text-sm font-bold text-slate-900 truncate">Super Admin</p><p className="text-xs text-slate-400 truncate">admin@silabu.ondesa.id</p></div><button onClick={()=>{setPage('password');setProfileOpen(false)}} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"><Icon d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" className="w-4 h-4 text-slate-400"/>Ubah Password</button><button onClick={()=>{setConfirmLogout(true);setProfileOpen(false)}} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"><Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" className="w-4 h-4 text-red-400"/>Keluar</button></div>}
        </div>
      </header>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
        {page==='password'?<PasswordForm/>:<>
          {msg && <div className={`mb-6 p-3 rounded-xl text-sm border ${msg.t==='ok'?'bg-green-50 border-green-200 text-green-700':'bg-red-50 border-red-200 text-red-700'}`}>{msg.m}</div>}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2 -mx-1 px-1">{(['smtp','oauth','tripay','security'] as const).map(t=><button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${tab===t?'bg-gradient-to-r from-emerald-500 to-cyan-600 text-white shadow-sm':'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}>{t==='smtp'?'SMTP Email':t==='oauth'?'Google OAuth':t==='tripay'?'Tripay':'Keamanan'}</button>)}</div>
          {tab==='smtp'&&<div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100 space-y-4"><h3 className="text-lg font-bold text-slate-900">SMTP Email</h3><p className="text-sm text-slate-500">Konfigurasi pengiriman email verifikasi & notifikasi.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="text-sm font-semibold text-slate-700">Host</label><input value={settings.smtp.host||''} onChange={e=>update('smtp','host',e.target.value)} className={input}/></div><div><label className="text-sm font-semibold text-slate-700">Port</label><input type="number" value={settings.smtp.port||587} onChange={e=>update('smtp','port',Number(e.target.value))} className={input}/></div></div><div><label className="text-sm font-semibold text-slate-700">Username</label><input value={settings.smtp.user||''} onChange={e=>update('smtp','user',e.target.value)} className={input}/></div><div><label className="text-sm font-semibold text-slate-700">Password</label><input type="password" value={settings.smtp.pass||''} onChange={e=>update('smtp','pass',e.target.value)} className={input}/></div><div><label className="text-sm font-semibold text-slate-700">From</label><input value={settings.smtp.from||''} onChange={e=>update('smtp','from',e.target.value)} className={input}/></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.smtp.secure||false} onChange={e=>update('smtp','secure',e.target.checked)}/> Secure SSL/TLS (port 465)</label><button onClick={()=>save('smtp',settings.smtp)} disabled={loading} className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">Simpan SMTP</button></div>}
          {tab==='oauth'&&<div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100 space-y-4"><h3 className="text-lg font-bold text-slate-900">Google OAuth</h3><p className="text-sm text-slate-500">Redirect URI: <code className="bg-slate-100 px-2 py-0.5 rounded text-xs break-all">https://silabu.ondesa.id/api/auth/google/callback</code></p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.oauth.googleEnabled||false} onChange={e=>update('oauth','googleEnabled',e.target.checked)}/> Enable Google Login</label><div><label className="text-sm font-semibold text-slate-700">Client ID</label><input value={settings.oauth.googleClientId||''} onChange={e=>update('oauth','googleClientId',e.target.value)} className={input}/></div><div><label className="text-sm font-semibold text-slate-700">Client Secret</label><input type="password" value={settings.oauth.googleClientSecret||''} onChange={e=>update('oauth','googleClientSecret',e.target.value)} className={input}/></div><button onClick={()=>save('oauth',settings.oauth)} disabled={loading} className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">Simpan OAuth</button></div>}
          {tab==='tripay'&&<div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100 space-y-4"><h3 className="text-lg font-bold text-slate-900">Tripay Payment Gateway</h3><p className="text-sm text-slate-500">QRIS, Virtual Account, E-wallet via Tripay.</p>{['merchantId','apiKey','secretKey'].map(f=><div key={f}><label className="text-sm font-semibold text-slate-700">{f}</label><input type={f==='merchantId'?'text':'password'} value={settings.tripay[f]||''} onChange={e=>update('tripay',f,e.target.value)} className={input}/></div>)}<button onClick={()=>save('tripay',settings.tripay)} disabled={loading} className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">Simpan Tripay</button></div>}
          {tab==='security'&&<div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100 space-y-4"><h3 className="text-lg font-bold text-slate-900">Keamanan — Cloudflare Turnstile</h3><p className="text-sm text-slate-500">CAPTCHA anti-bot di halaman Login, Register, dan Lupa Password.</p><div><label className="text-sm font-semibold text-slate-700">Site Key</label><input value={settings.security.turnstile_site_key||''} onChange={e=>update('security','turnstile_site_key',e.target.value)} className={input}/></div><div><label className="text-sm font-semibold text-slate-700">Secret Key</label><input type="password" value={settings.security.turnstile_secret_key||''} onChange={e=>update('security','turnstile_secret_key',e.target.value)} className={input}/></div><button onClick={()=>save('security',settings.security)} disabled={loading} className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">Simpan Keamanan</button></div>}
        </>}
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

  </div>;
}
