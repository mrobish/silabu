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
      // Auto-login: store token and go to dashboard
      if (data.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      setSuccess(true);
      setTimeout(() => navigate('/app'), 1500);
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
      <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl text-center animate-scale-in">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Registrasi Berhasil!</h1>
          <p className="text-sm text-slate-500 mt-2">Akun BUM Desa Anda sudah aktif. Mengalihkan ke dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 flex items-start md:items-center justify-center p-4 md:p-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 md:grid-cols-[1fr_380px] animate-scale-in">

        {/* LEFT — form (scrollable) */}
        <div className="relative z-10 p-6 sm:p-10 md:p-12 md:max-h-[90vh] md:overflow-y-auto">

          {/* MOBILE — gradient header banner */}
          <div className="md:hidden -mx-6 sm:-mx-10 -mt-6 sm:-mt-10 mb-8 px-6 py-9 text-center text-white relative overflow-hidden"
            style={{background: 'linear-gradient(to bottom right, #059669, #0891b2, #0e7490)'}}>
            <div className="absolute inset-0 bg-slate-900/15" aria-hidden="true" />
            <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
            <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-emerald-300/20 blur-2xl" aria-hidden="true" />
            <div className="relative z-10">
              <Link to="/" className="inline-block mb-4">
                <img src="/logo.png" alt="SILABU DIGI" className="h-14 w-auto mx-auto brightness-0 invert drop-shadow-lg" />
              </Link>
              <h1 className="text-2xl font-bold tracking-tight">Data BUM Desa</h1>
              <p className="text-sm text-cyan-50/90 mt-1">Lengkapi data BUM Desa Anda</p>
            </div>
          </div>

          {/* DESKTOP — form header */}
          <div className="hidden md:block mb-6">
            <Link to="/register/email" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-cyan-600 transition-colors mb-4">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Kembali
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Data BUM Desa</h1>
            <p className="text-sm text-slate-500 mt-1">Lengkapi data BUM Desa dan pelaksana operasional</p>
          </div>

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
              className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-md hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:translate-y-0">
              {loading ? 'Menyimpan...' : 'Selesaikan Registrasi'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Butuh bantuan? <Link to="/" className="font-semibold text-cyan-600 hover:underline">Hubungi kami</Link>
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
          <div className="relative z-10 flex h-full flex-col items-center justify-center p-10 text-center text-white">
            <img src="/logo.png" alt="" className="h-20 w-auto mb-8 brightness-0 invert opacity-95 drop-shadow-lg" aria-hidden="true" />
            <h2 className="text-2xl font-bold tracking-tight">Satu Langkah Lagi</h2>
            <p className="mt-3 max-w-xs text-sm text-cyan-50/90 leading-relaxed">
              Lengkapi data BUM Desa dan pelaksana operasional untuk menyelesaikan pendaftaran.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
