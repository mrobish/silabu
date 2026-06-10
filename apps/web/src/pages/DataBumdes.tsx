import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';

const REQ = <span className="text-red-500">*</span>;

export default function DataBumdes() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const email = params.get('email') || '';
  const [f, setF] = useState({
    nama_bumdes: '', provinsi: '', kabupaten: '', kecamatan: '', desa: '', tahun_berdiri: '',
    nama_penasihat: '', nama_direktur: '', nama_sekretaris: '', nama_bendahara: '', nama_pengawas_1: '', nama_pengawas_2: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const u = (k: string, v: string) => setF(prev => ({ ...prev, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/complete-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...f }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch { setError('Terjadi kesalahan'); } finally { setLoading(false); }
  }

  const field = (label: string, key: keyof typeof f, req = true, placeholder = '') => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label} {req && REQ}</label>
      <input type="text" value={f[key]} onChange={e => u(key, e.target.value)} required={req} autoComplete="off"
        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition" placeholder={placeholder} />
    </div>
  );

  if (success) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Registrasi Berhasil!</h1>
          <p className="text-sm text-slate-500 mt-2">Akun BUM Desa Anda sudah aktif dengan trial 14 hari. Mengalihkan ke halaman login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-white py-8 sm:py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Data BUM Desa</h1>
          <p className="text-sm text-slate-500 mt-1">Lengkapi data BUM Desa dan pelaksana operasional</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-3">Informasi BUM Desa</h2>
              <div className="space-y-4">
                {field('Nama BUM Desa', 'nama_bumdes', true, 'Contoh: BUM Desa Maju Bersama')}
                <div className="grid sm:grid-cols-2 gap-4">
                  {field('Provinsi', 'provinsi', true, 'Contoh: Jawa Barat')}
                  {field('Kabupaten/Kota', 'kabupaten', true, 'Contoh: Tasikmalaya')}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {field('Kecamatan', 'kecamatan', true, 'Nama kecamatan')}
                  {field('Desa', 'desa', true, 'Nama desa')}
                </div>
                {field('Tahun Berdiri', 'tahun_berdiri', true, 'Contoh: 2020')}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Pelaksana Operasional</h2>
              <p className="text-xs text-slate-500 mb-3">Penasihat biasanya = Kepala Desa</p>
              <div className="space-y-4">
                {field('Penasihat (Kepala Desa)', 'nama_penasihat', true, 'Contoh: H. Ahmad Suhendra')}
                {field('Direktur', 'nama_direktur', true, 'Nama direktur')}
                {field('Sekretaris', 'nama_sekretaris', true, 'Nama sekretaris')}
                {field('Bendahara', 'nama_bendahara', true, 'Nama bendahara')}
                {field('Pengawas 1', 'nama_pengawas_1', true, 'Nama pengawas pertama')}
                {field('Pengawas 2 (opsional)', 'nama_pengawas_2', false, 'Nama pengawas kedua')}
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-md hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:translate-y-0">
              {loading ? 'Menyimpan...' : 'Selesaikan Registrasi'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Butuh bantuan? <Link to="/" className="font-semibold text-cyan-600 hover:underline">Hubungi kami</Link>
        </p>
      </div>
    </div>
  );
}
