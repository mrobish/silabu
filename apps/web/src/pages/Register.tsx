import React,{useState}from'react';
import type { Page } from "./shared";
import { Navbar, AuthShell, api, MailField, NameField, PasswordInput } from "./shared";
export default function Register({go}:{go:(p:Page)=>void}){
  const[email,setEmail]=useState('');
  const[nama,setNama]=useState('');
  const[password,setPassword]=useState('');
  const[confirm,setConfirm]=useState('');
  const[error,setError]=useState('');
  const[loading,setLoading]=useState(false);

  async function handleSubmit(e:React.FormEvent){
    e.preventDefault();setError('');
    if(password!==confirm){setError('Password tidak cocok');return;}
    setLoading(true);
    try{
      await api('/auth/register',{email,nama,password});
      localStorage.setItem('pendingEmail',email);go('verify');
    }catch(err:any){setError(err.message||'Registrasi gagal');}
    finally{setLoading(false)}
  }

  return<>
    <Navbar go={go}/>
    <AuthShell title="Daftar" subtitle="Buat akun baru" go={go}>
      {error&&<div className="alert alert-error">{error}</div>}
      <form className="form" onSubmit={handleSubmit}>
        <MailField value={email} set={setEmail}/>
        <NameField value={nama} set={setNama}/>
        <PasswordInput value={password} onChange={setPassword}/>
        <PasswordInput value={confirm} onChange={setConfirm} placeholder="Ulangi password"/>
        <button className="btn-primary btn-full" type="submit" disabled={loading}>{loading?'Memproses...':'Daftar'}</button>
      </form>
      <div className="form-links">
        <span>Sudah punya akun? <button className="link-btn" onClick={()=>go('login')}>Masuk</button></span>
      </div>
    </AuthShell>
  </>;
}
