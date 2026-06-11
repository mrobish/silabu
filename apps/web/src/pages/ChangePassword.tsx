import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function ChangePassword() {
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('Semua field wajib diisi');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password baru minimal 8 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
      });
      const d = await res.json();
      if (d.error) { setError(d.error); return; }
      setSuccess(d.message || 'Password berhasil diubah');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch { setError('Gagal mengubah password'); }
    finally { setLoading(false); }
  }

  function toggle(which: string) {
    if (which === 'old') setShowOld(!showOld);
    if (which === 'new') setShowNew(!showNew);
    if (which === 'confirm') setShowConfirm(!showConfirm);
  }

  const Eye = ({ open }: { open: boolean }) => (
    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {open ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
      )}
    </svg>
  );

  const input = (val: string, set: any, placeholder: string, show: boolean, toggler: string) => (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={val} onChange={e => set(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition"
        placeholder={placeholder} />
      <button type="button" onClick={() => toggle(toggler)}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:opacity-80 rounded-md transition">
        <Eye open={show} />
      </button>
    </div>
  );

  if (!token) { navigate('/login'); return null; }

  return (
    <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 md:grid-cols-2 animate-scale-in">

        {/* LEFT — form */}
        <div className="relative z-10 p-6 sm:p-10 md:p-12">

          {/* MOBILE — gradient header banner */}
          <div className="md:hidden -mx-6 sm:-mx-10 -mt-6 sm:-mt-10 mb-8 px-6 py-9 text-center text-white relative overflow-hidden"
            style={{background: 'linear-gradient(to bottom right, #059669, #0891b2, #0e7490)'}}>
            <div className="absolute inset-0 bg-slate-900/15" aria-hidden="true" />
            <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
            <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-emerald-300/20 blur-2xl" aria-hidden="true" />
            <div className="relative z-10">
              <img src="/logo.png" alt="SILABU DIGI" className="h-14 w-auto mx-auto mb-4 brightness-0 invert drop-shadow-lg" />
              <h1 className="text-2xl font-bold tracking-tight">Ubah Password</h1>
              <p className="text-sm text-cyan-50/90 mt-1">Perbarui password akun Anda</p>
            </div>
          </div>

          {/* DESKTOP — form header */}
          <div className="hidden md:block mb-6">
            <button onClick={() => navigate(-1)}
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-cyan-600 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Kembali
            </button>
            <h1 className="text-2xl font-bold text-slate-900">Ubah Password</h1>
            <p className="mt-1 text-sm text-slate-500">Masukkan password lama dan password baru</p>
          </div>

          {error && <p className="mb-4 text-sm font-medium text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
          {success && <p className="mb-4 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-xl px-4 py-3">{success}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password Lama</label>
              {input(oldPassword, setOldPassword, 'Password lama', showOld, 'old')}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password Baru</label>
              {input(newPassword, setNewPassword, 'Minimal 8 karakter', showNew, 'new')}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Konfirmasi Password Baru</label>
              {input(confirmPassword, setConfirmPassword, 'Ulangi password baru', showConfirm, 'confirm')}
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-md hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:translate-y-0">
              {loading ? 'Menyimpan...' : 'Simpan Password'}
            </button>
          </form>

          <p className="mt-6 text-center md:text-left text-sm text-slate-500 md:hidden">
            <button onClick={() => navigate(-1)} className="font-semibold text-cyan-600 hover:underline">Kembali</button>
          </p>
        </div>

        {/* RIGHT — branded gradient panel (desktop) */}
        <div className="relative hidden md:flex flex-col overflow-hidden" style={{background: 'linear-gradient(to bottom right, #059669, #0891b2, #0e7490)'}}>
          <div className="absolute inset-0 bg-slate-900/20" aria-hidden="true" />
          <svg className="absolute -left-[1px] top-0 z-10 h-full w-[48px] overflow-visible text-white" preserveAspectRatio="none" viewBox="0 0 48 100" fill="currentColor" aria-hidden="true">
            <path d="M48 0 C 24 15, 0 35, 24 50 C 48 65, 24 85, 48 100 L 0 100 L 0 0 Z" />
          </svg>
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
          <div className="absolute -bottom-20 left-4 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" aria-hidden="true" />
          <div className="relative z-10 flex h-full flex-col items-center justify-center p-12 text-center text-white">
            <img src="/logo.png" alt="" className="h-20 w-auto mb-8 brightness-0 invert opacity-95 drop-shadow-lg" aria-hidden="true" />
            <h2 className="text-3xl font-bold tracking-tight">Jaga Keamanan</h2>
            <p className="mt-3 max-w-xs text-sm text-cyan-50/90 leading-relaxed">
              Ganti password secara berkala untuk menjaga keamanan akun BUM Desa Anda.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
