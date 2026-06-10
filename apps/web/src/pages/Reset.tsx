import React,{useState}from'react';
import type { Page } from "./shared";
import { Navbar, AuthShell, api, PasswordInput } from "./shared";
export default function Reset({go}:{go:(p:Page)=>void}){
  const params=new URLSearchParams(window.location.search);
  const urlToken=params.get('token')||'';
  const[email,setEmail]=useState(params.get('email')||'');
  const[token,setToken]=useState(urlToken);
  const[password,setPassword]=useState('');
  const[error,setError]=useState('');
  const[success,setSuccess]=useState('');
  const[loading,setLoading]=useState(false);

  async function handleSubmit(e:React.FormEvent){
    e.preventDefault();setError('');setSuccess('');setLoading(true);
    try{
      await api('/auth/reset-password',{email,token,password});
      setSuccess('Password berhasil direset! Mengalihkan...');
      setTimeout(()=>go('login'),1200);
    }catch(err:any){setError(err.message||'Reset gagal');}
    finally{setLoading(false)}
  }

  return<>
    <Navbar go={go}/>
    <AuthShell title="Reset Password" subtitle="Masukkan kode reset dan password baru" go={go}>
      {error&&<div className="alert alert-error">{error}</div>}
      {success&&<div className="alert alert-success">{success}</div>}
      <form className="form" onSubmit={handleSubmit}>
        {!urlToken&&<div className="field"><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" required/></div>}
        {!urlToken&&<div className="field"><input value={token} onChange={e=>setToken(e.target.value)} placeholder="Kode reset (OTP)" required/></div>}
        <PasswordInput value={password} onChange={setPassword} placeholder="Password baru"/>
        <button className="btn-primary btn-full" type="submit" disabled={loading}>{loading?'Memproses...':'Reset Password'}</button>
      </form>
      <div className="form-links">
        <button className="link-btn" onClick={()=>go('login')}>Kembali ke Masuk</button>
      </div>
    </AuthShell>
  </>;
}
