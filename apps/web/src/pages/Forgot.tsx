import React,{useState}from'react';
import type { Page } from "./shared";
import { Navbar, AuthShell, api, MailField } from "./shared";
export default function Forgot({go}:{go:(p:Page)=>void}){
  const[email,setEmail]=useState('');
  const[error,setError]=useState('');
  const[success,setSuccess]=useState('');
  const[loading,setLoading]=useState(false);

  async function handleSubmit(e:React.FormEvent){
    e.preventDefault();setError('');setSuccess('');setLoading(true);
    try{
      await api('/auth/forgot-password',{email});
      setSuccess('Link reset password telah dikirim ke email Anda.');
    }catch(err:any){setError(err.message||'Gagal mengirim email');}
    finally{setLoading(false)}
  }

  return<>
    <Navbar go={go}/>
    <AuthShell title="Lupa Password" subtitle="Masukkan email untuk menerima link reset" go={go}>
      {error&&<div className="alert alert-error">{error}</div>}
      {success&&<div className="alert alert-success">{success}</div>}
      <form className="form" onSubmit={handleSubmit}>
        <MailField value={email} set={setEmail}/>
        <button className="btn-primary btn-full" type="submit" disabled={loading}>{loading?'Mengirim...':'Kirim Link Reset'}</button>
      </form>
      <div className="form-links">
        <button className="link-btn" onClick={()=>go('reset')}>Sudah punya kode? Reset</button>
        <button className="link-btn" onClick={()=>go('login')}>Kembali ke Masuk</button>
      </div>
    </AuthShell>
  </>;
}
