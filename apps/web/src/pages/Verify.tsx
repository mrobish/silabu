import React,{useState,useEffect}from'react';
import type { Page } from "./shared";
import { Navbar, AuthShell, api, saveAuth } from "./shared";
export default function Verify({go}:{go:(p:Page)=>void}){
  const params=new URLSearchParams(window.location.search);
  const magicToken=params.get('token')||'';
  const[email,setEmail]=useState(params.get('email')||localStorage.getItem('pendingEmail')||'');
  const[otp,setOtp]=useState('');
  const[error,setError]=useState('');
  const[success,setSuccess]=useState('');
  const[loading,setLoading]=useState(false);

  useEffect(()=>{
    if(magicToken){
      (async()=>{
        setLoading(true);
        try{
          const d=await api('/auth/verify-email',{token:magicToken});
          saveAuth(d);setSuccess('Email terverifikasi! Mengalihkan...');
          setTimeout(()=>go('dashboard'),800);
        }catch(err:any){setError(err.message||'Verifikasi gagal');}
        finally{setLoading(false)}
      })();
    }
  },[]);

  async function handleSubmit(e:React.FormEvent){
    e.preventDefault();setError('');setLoading(true);
    try{
      const d=await api('/auth/verify-email',{email,otp});
      saveAuth(d);setSuccess('Email terverifikasi! Mengalihkan...');
      setTimeout(()=>go('dashboard'),800);
    }catch(err:any){setError(err.message||'Verifikasi gagal');}
    finally{setLoading(false)}
  }

  return<>
    <Navbar go={go}/>
    <AuthShell title="Verifikasi Email" subtitle="Masukkan kode OTP yang dikirim ke email Anda" go={go}>
      {error&&<div className="alert alert-error">{error}</div>}
      {success&&<div className="alert alert-success">{success}</div>}
      {!magicToken&&<form className="form" onSubmit={handleSubmit}>
        <input className="otp-input" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="Kode OTP 6 digit" maxLength={6} inputMode="numeric" required/>
        <button className="btn-primary btn-full" type="submit" disabled={loading}>{loading?'Memproses...':'Verifikasi'}</button>
      </form>}
      {magicToken&&loading&&<p>Memverifikasi...</p>}
      <div className="form-links">
        <button className="link-btn" onClick={()=>go('login')}>Kembali ke Masuk</button>
      </div>
    </AuthShell>
  </>;
}
