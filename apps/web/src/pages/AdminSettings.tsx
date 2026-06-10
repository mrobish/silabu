import React, { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout';
import type { AdminPage } from './AdminLayout';
import { Save, Mail, KeyRound, Send, CheckCircle2, AlertCircle } from 'lucide-react';

type SMTP = { host:string; port:number; user:string; pass:string; from:string; secure:boolean };
type OAuth = { googleEnabled:boolean; googleClientId:string; googleClientSecret:string; redirectUri:string };

export default function AdminSettings({ current, onNavigate, onLogout }: {
  current: AdminPage;
  onNavigate: (p: AdminPage) => void;
  onLogout: () => void;
}) {
  const [smtp,setSmtp]=useState<SMTP>({host:'',port:587,user:'',pass:'',from:'',secure:false});
  const [oauth,setOauth]=useState<OAuth>({googleEnabled:false,googleClientId:'',googleClientSecret:'',redirectUri:'https://silabu.ondesa.id/api/auth/google/callback'});
  const [testTo,setTestTo]=useState('');
  const [msg,setMsg]=useState<{type:'success'|'error';text:string}|null>(null);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{ fetch('/api/admin/settings').then(r=>r.json()).then(d=>{ if(d.smtp) setSmtp(s=>({...s,...d.smtp,pass:d.smtp.pass||''})); if(d.oauth) setOauth(o=>({...o,...d.oauth})); }).catch(()=>{}); },[]);

  async function saveSMTP(){ setLoading(true); setMsg(null); try{ const r=await fetch('/api/admin/settings/smtp',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(smtp)}); const d=await r.json(); if(!r.ok||d.error) throw new Error(d.error||'Gagal simpan SMTP'); setMsg({type:'success',text:'SMTP berhasil disimpan'}); }catch(e:any){setMsg({type:'error',text:e.message});}finally{setLoading(false);} }
  async function saveOAuth(){ setLoading(true); setMsg(null); try{ const r=await fetch('/api/admin/settings/oauth',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(oauth)}); const d=await r.json(); if(!r.ok||d.error) throw new Error(d.error||'Gagal simpan OAuth'); setMsg({type:'success',text:'OAuth berhasil disimpan'}); }catch(e:any){setMsg({type:'error',text:e.message});}finally{setLoading(false);} }
  async function testSMTP(){ setLoading(true); setMsg(null); try{ const r=await fetch('/api/admin/settings/test-smtp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:testTo,smtp})}); const d=await r.json(); if(!r.ok||d.error) throw new Error(d.error||'Test SMTP gagal'); setMsg({type:'success',text:d.message||'Test email terkirim'}); }catch(e:any){setMsg({type:'error',text:e.message});}finally{setLoading(false);} }

  return (
    <AdminLayout current={current} onNavigate={onNavigate} onLogout={onLogout}>
      <div className="admin-page">
        <h1 className="admin-title">Settings</h1>
        <p className="admin-subtitle">Konfigurasi SMTP email dan Google OAuth</p>
        {msg&&<div className={`settings-alert ${msg.type}`}><>{msg.type==='success'?<CheckCircle2 size={18}/>:<AlertCircle size={18}/>}</><span>{msg.text}</span></div>}

        <div className="admin-card">
          <h2><Mail size={22}/> SMTP Email</h2>
          <p className="settings-help">Dipakai untuk OTP, magic link, dan reset password. Jika kosong, email tetap dilog ke server.</p>
          <div className="admin-form settings-grid">
            <div className="form-group"><label>SMTP Host</label><input className="admin-input" value={smtp.host} onChange={e=>setSmtp({...smtp,host:e.target.value})} placeholder="smtp.gmail.com / mail.domain.com"/></div>
            <div className="form-group"><label>Port</label><input className="admin-input" type="number" value={smtp.port} onChange={e=>setSmtp({...smtp,port:Number(e.target.value)})}/></div>
            <div className="form-group"><label>Username</label><input className="admin-input" value={smtp.user} onChange={e=>setSmtp({...smtp,user:e.target.value})} placeholder="noreply@domain.com"/></div>
            <div className="form-group"><label>Password / App Password</label><input className="admin-input" type="password" value={smtp.pass} onChange={e=>setSmtp({...smtp,pass:e.target.value})}/></div>
            <div className="form-group"><label>From Email</label><input className="admin-input" value={smtp.from} onChange={e=>setSmtp({...smtp,from:e.target.value})} placeholder="SILABU DIGI <noreply@domain.com>"/></div>
            <label className="check-row"><input type="checkbox" checked={smtp.secure} onChange={e=>setSmtp({...smtp,secure:e.target.checked})}/> Secure SSL/TLS (port 465)</label>
          </div>
          <div className="settings-actions"><button className="admin-btn primary" disabled={loading} onClick={saveSMTP}><Save size={18}/>Simpan SMTP</button></div>
          <div className="test-row"><input className="admin-input" value={testTo} onChange={e=>setTestTo(e.target.value)} placeholder="email tujuan test"/><button className="admin-btn" disabled={loading||!testTo} onClick={testSMTP}><Send size={18}/>Kirim Test</button></div>
        </div>

        <div className="admin-card">
          <h2><KeyRound size={22}/> Google OAuth</h2>
          <p className="settings-help">Redirect URI wajib sama di Google Cloud Console.</p>
          <div className="admin-form settings-grid">
            <label className="check-row"><input type="checkbox" checked={oauth.googleEnabled} onChange={e=>setOauth({...oauth,googleEnabled:e.target.checked})}/> Enable Google Login</label>
            <div className="form-group"><label>Google Client ID</label><input className="admin-input" value={oauth.googleClientId} onChange={e=>setOauth({...oauth,googleClientId:e.target.value})}/></div>
            <div className="form-group"><label>Google Client Secret</label><input className="admin-input" type="password" value={oauth.googleClientSecret} onChange={e=>setOauth({...oauth,googleClientSecret:e.target.value})}/></div>
            <div className="form-group"><label>Redirect URI</label><input className="admin-input" value={oauth.redirectUri} onChange={e=>setOauth({...oauth,redirectUri:e.target.value})}/></div>
          </div>
          <div className="oauth-box"><strong>Google Console:</strong><br/>Authorized redirect URI: <code>{oauth.redirectUri}</code></div>
          <div className="settings-actions"><button className="admin-btn primary" disabled={loading} onClick={saveOAuth}><Save size={18}/>Simpan OAuth</button></div>
        </div>
      </div>
    </AdminLayout>
  );
}
