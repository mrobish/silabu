import React,{useState}from'react';
import type { Page } from "./shared";
import { Navbar, AuthShell, api, saveAuth, MailField, PasswordInput } from "./shared";
export default function Login({go}:{go:(p:Page)=>void}){
  const[email,setEmail]=useState('');
  const[password,setPassword]=useState('');
  const[error,setError]=useState('');
  const[loading,setLoading]=useState(false);

  async function handleSubmit(e:React.FormEvent){
    e.preventDefault();setError('');setLoading(true);
    try{
      const d=await api('/auth/login',{email,password});
      saveAuth(d);go('dashboard');
    }catch(err:any){
      const msg=err.message||'Login gagal';
      if(msg.toLowerCase().includes('belum diverifikasi')){
        localStorage.setItem('pendingEmail',email);go('verify');return;
      }
      setError(msg);
    }finally{setLoading(false)}
  }

  return<>
    <Navbar go={go}/>
    <AuthShell title="Masuk" subtitle="Silakan masuk ke akun Anda" go={go}>
      {error&&<div className="alert alert-error">{error}</div>}
      <form className="form" onSubmit={handleSubmit}>
        <MailField value={email} set={setEmail}/>
        <PasswordInput value={password} onChange={setPassword}/>
        <button className="btn-primary btn-full" type="submit" disabled={loading}>{loading?'Memproses...':'Masuk'}</button>
      </form>
      <div className="form-links">
        <button className="link-btn" onClick={()=>go('forgot')}>Lupa password?</button>
        <span>Belum punya akun? <button className="link-btn" onClick={()=>go('register')}>Daftar</button></span>
      </div>
    </AuthShell>
  </>;
}
