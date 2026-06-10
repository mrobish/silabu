import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
    <div className="min-h-dvh flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md">
        <button onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-cyan-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Kembali
        </button>
        <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-sm border border-slate-100">
          <h1 className="text-xl font-bold text-slate-900 text-center">Ubah Password</h1>
          <p className="mt-1 text-sm text-slate-500 text-center">Masukkan password lama dan password baru</p>
          {error && <p className="mt-4 text-sm font-medium text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
          {success && <p className="mt-4 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-xl px-4 py-3">{success}</p>}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
              className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-sm font-semibold text-white hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 transition">
              {loading ? 'Menyimpan...' : 'Simpan Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
