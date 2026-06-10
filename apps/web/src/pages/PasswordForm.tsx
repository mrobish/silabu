import { useState } from 'react';

export default function PasswordForm() {
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
    if (!oldPassword || !newPassword || !confirmPassword) { setError('Semua field wajib diisi'); return; }
    if (newPassword.length < 8) { setError('Password baru minimal 8 karakter'); return; }
    if (newPassword !== confirmPassword) { setError('Konfirmasi password tidak cocok'); return; }
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
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch { setError('Gagal mengubah password'); }
    finally { setLoading(false); }
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

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-lg font-bold text-slate-900">Ubah Password</h1>
      <p className="mt-1 text-sm text-slate-500">Masukkan password lama dan password baru</p>
      {error && <p className="mt-3 text-sm font-medium text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {success && <p className="mt-3 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-xl px-4 py-3">{success}</p>}
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password Lama</label>
          <div className="relative">
            <input type={showOld ? 'text' : 'password'} value={oldPassword} onChange={e => setOldPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition" placeholder="Password lama" />
            <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
              <Eye open={showOld} />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password Baru</label>
          <div className="relative">
            <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition" placeholder="Minimal 8 karakter" />
            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
              <Eye open={showNew} />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Konfirmasi Password Baru</label>
          <div className="relative">
            <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition" placeholder="Ulangi password baru" />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
              <Eye open={showConfirm} />
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-sm font-semibold text-white hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 transition">
          {loading ? 'Menyimpan...' : 'Simpan Password'}
        </button>
      </form>
    </div>
  );
}
