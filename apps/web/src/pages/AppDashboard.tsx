import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PasswordForm from './PasswordForm';

type Page = 'dashboard' | 'password' | 'langganan' | 'profil' | 'coa' | 'jurnal';

const officeIcon = 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m6-14h.01M9 11h.01M9 15h.01M15 7h.01M15 11h.01M15 15h.01M12 21v-4a1 1 0 011-1h-2a1 1 0 011 1v4z';

type SubscriptionStatus = {
  status?: 'trial' | 'active' | 'expired' | string;
  active?: boolean;
  daysLeft?: number;
  price?: number;
  payments?: Array<{ reference?: string; amount?: number; status?: string; created_at?: string; paid_at?: string; date?: string }>;
  trial_ends_at?: string;
  subscription_ends_at?: string;
};

const financeMenus = [
  { label: 'Buku Kas', soon: true, icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { label: 'Laporan', soon: true, icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
];

function Icon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
      <path d={d} />
    </svg>
  );
}

const creditCardIcon = 'M3 10h18M7 15h1m4 0h3M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z';
const coaIcon = 'M4 6.5A2.5 2.5 0 016.5 4H20v14H6.5A2.5 2.5 0 014 15.5v-9zM8 8h8M8 12h8M8 16h5';
const jurnalIcon = 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h6m-6 4h6';

function formatRupiah(value?: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
}

function LanggananPage() {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    setLoading(true);
    fetch('/api/subscription/status', { headers: { Authorization: 'Bearer ' + token } })
      .then(async r => {
        const data = await r.json();
        if (!r.ok || data.error) throw new Error(data.error || 'Gagal memuat status langganan');
        setSubscription(data);
      })
      .catch(e => setError(e.message || 'Gagal memuat status langganan'))
      .finally(() => setLoading(false));
  }, []);

  async function checkout() {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    setCheckoutLoading(true);
    setError('');
    try {
      const res = await fetch('/api/subscription/checkout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Checkout gagal');
      if (data.checkout_url) window.location.href = data.checkout_url;
      else throw new Error('Checkout URL tidak tersedia');
    } catch (e: any) {
      setError(e.message || 'Checkout gagal');
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (loading) return <div className="rounded-2xl border border-slate-100 bg-white p-8 text-sm text-slate-500 shadow-sm">Memuat status langganan...</div>;

  const status = subscription?.status || 'trial';
  const isActive = status === 'active' || subscription?.active;
  const isExpired = status === 'expired';
  const daysLeft = Math.max(0, subscription?.daysLeft ?? 0);
  const price = subscription?.price || 1000000;
  const progress = status === 'trial' ? Math.max(0, Math.min(100, (daysLeft / 14) * 100)) : isActive ? 100 : 0;
  const payments = subscription?.payments || [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Langganan</h1>
        <p className="mt-1 text-sm text-slate-500">Kelola masa trial, paket tahunan, checkout, dan riwayat pembayaran SILABU DIGI.</p>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className={'inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ' + (isActive ? 'bg-cyan-50 text-cyan-700' : isExpired ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700')}>
                {isActive ? 'Active' : isExpired ? 'Expired' : 'Trial'}
              </span>
              <h2 className="mt-4 text-xl font-bold text-slate-900">Status Langganan</h2>
              <p className="mt-1 text-sm text-slate-500">Harga paket: <span className="font-semibold text-slate-700">{formatRupiah(price)}/tahun</span></p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 px-6 py-5 text-white shadow-lg shadow-emerald-500/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Hari tersisa</p>
              <p className="mt-1 text-5xl font-black">{isActive ? '-' : daysLeft}</p>
            </div>
          </div>
          <div className="mt-7">
            <div className="mb-2 flex justify-between text-xs font-semibold text-slate-500"><span>Progress trial</span><span>{Math.round(progress)}%</span></div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all" style={{ width: progress + '%' }} /></div>
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/70 p-6 shadow-sm">
          <Icon d={creditCardIcon} className="w-10 h-10 text-emerald-600" />
          <h3 className="mt-4 text-lg font-bold text-slate-900">{isActive ? 'Langganan Aktif' : 'Perpanjang Langganan'}</h3>
          <p className="mt-2 text-sm text-slate-500">{isActive ? 'Langganan aktif sampai ' + formatDate(subscription?.subscription_ends_at) : 'Bayar paket tahunan agar akses tetap aktif setelah trial selesai.'}</p>
          {!isActive && status === 'trial' && <p className="mt-3 text-xs text-emerald-700">Trial berakhir {formatDate(subscription?.trial_ends_at)}. Setelah itu akses butuh langganan aktif.</p>}
          {!isActive && <button onClick={checkout} disabled={checkoutLoading} className="mt-6 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:shadow-xl disabled:opacity-60">{checkoutLoading ? 'Memproses...' : 'Bayar Sekarang — Rp1.000.000'}</button>}
        </div>
      </div>

      {payments.length > 0 && (
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="font-bold text-slate-900">Riwayat Pembayaran</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400"><tr><th className="py-3">Reference</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p, i) => <tr key={i} className="text-slate-600"><td className="py-3 font-mono text-xs">{p.reference || '-'}</td><td>{formatRupiah(p.amount)}</td><td><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{p.status || '-'}</span></td><td>{formatDate(p.paid_at || p.created_at || p.date)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfilPage() {
  const [form, setForm] = useState({
    nama_bumdes: '',
    npwp: '',
    nomor_sertifikat_badan_hukum: '',
    nomor_perdes_pendirian: '',
    tahun_berdiri: '',
    telepon: '',
    provinsi: '',
    kabupaten: '',
    kecamatan: '',
    desa: '',
    penasihat: '',
    direktur: '',
    sekretaris: '',
    bendahara: '',
    pengawas1: '',
    pengawas2: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [accessExpired, setAccessExpired] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    setLoading(true);
    fetch('/api/tenant/profile', { headers: { Authorization: 'Bearer ' + token } })
      .then(async r => {
        const data = await r.json();
        if (!r.ok || data.error) throw new Error(data.error || 'Gagal memuat profil');
        const p = data.profile || data;
        setForm(prev => ({
          ...prev,
          nama_bumdes: p.nama_bumdes || '',
          npwp: p.npwp || '',
          nomor_sertifikat_badan_hukum: p.nomor_sertifikat || '',
          nomor_perdes_pendirian: p.nomor_perdes || '',
          tahun_berdiri: p.tahun_berdiri || '',
          telepon: p.telpon || '',
          provinsi: p.provinsi || '',
          kabupaten: p.kabupaten || '',
          kecamatan: p.kecamatan || '',
          desa: p.desa || '',
          penasihat: p.nama_penasihat || '',
          direktur: p.nama_direktur || '',
          sekretaris: p.nama_sekretaris || '',
          bendahara: p.nama_bendahara || '',
          pengawas1: p.nama_pengawas_1 || '',
          pengawas2: p.nama_pengawas_2 || '',
        }));
        if (p.logo_url) setLogoPreview(p.logo_url);
      })
      .catch(e => setMessage({ type: 'error', text: e.message || 'Gagal memuat profil' }))
      .finally(() => setLoading(false));

    fetch('/api/subscription/status', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { if (d && d.active === false) setAccessExpired(true); })
      .catch(() => {});
  }, []);

  function handleChange(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleLogoDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    validateAndSetLogo(file);
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) validateAndSetLogo(file);
  }

  function validateAndSetLogo(file: File) {
    setLogoError('');
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      setLogoError('Format file harus PNG, JPG, WEBP, atau SVG');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Ukuran file maksimal 2MB');
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function handleUploadLogo() {
    if (!logoFile) return;
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    setUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', logoFile);
      const res = await fetch('/api/tenant/logo', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Gagal upload logo');
      setLogoFile(null);
      setMessage({ type: 'success', text: 'Logo berhasil diupload' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Gagal upload logo' });
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        nama_bumdes: form.nama_bumdes,
        npwp: form.npwp,
        nomor_sertifikat: form.nomor_sertifikat_badan_hukum,
        nomor_perdes: form.nomor_perdes_pendirian,
        tahun_berdiri: form.tahun_berdiri,
        telpon: form.telepon,
        provinsi: form.provinsi,
        kabupaten: form.kabupaten,
        kecamatan: form.kecamatan,
        desa: form.desa,
        nama_penasihat: form.penasihat,
        nama_direktur: form.direktur,
        nama_sekretaris: form.sekretaris,
        nama_bendahara: form.bendahara,
        nama_pengawas_1: form.pengawas1,
        nama_pengawas_2: form.pengawas2,
      };
      const res = await fetch('/api/tenant/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Gagal menyimpan profil');
      setMessage({ type: 'success', text: 'Profil berhasil disimpan' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Gagal menyimpan profil' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="rounded-2xl border border-slate-100 bg-white p-8 text-sm text-slate-500 shadow-sm">Memuat profil...</div>;

  const sectionStyle = 'rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-xl';
  const labelStyle = 'block text-sm font-semibold text-slate-700 mb-1.5';
  const inputStyle = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none';
  const gridCols = 'grid grid-cols-1 sm:grid-cols-2 gap-5';

  const required = (label: string) => (
    <span>{label} <span className="text-red-500">*</span></span>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profil BUM Desa</h1>
        <p className="mt-1 text-sm text-slate-500">Kelola informasi BUM Desa dan pelaksana operasional.</p>
      </div>

      {message && (
        <div className={'rounded-2xl border p-4 text-sm font-medium ' + (message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700')}>
          {message.text}
        </div>
      )}
      {accessExpired && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 flex items-center justify-between">
          <span>Masa trial/langganan telah berakhir. Perpanjang untuk mengedit profil.</span>
          <button onClick={() => setPage('langganan')} className="rounded-xl bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition">Perpanjang</button>
        </div>
      )}

      <form onSubmit={handleSave} className={accessExpired ? 'pointer-events-none opacity-60 select-none' : ''}>
        {/* Section 1: Info BUM Desa */}
        <div className={sectionStyle + ' mb-6'}>
          <div className="flex items-center gap-2 mb-5">
            <Icon d={officeIcon} className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">Info BUM Desa</h2>
          </div>

          <div className="space-y-5">
            {/* Logo */}
            <div>
              <label className={labelStyle}>{required('Logo BUM Desa')}</label>
              {logoError && <p className="mb-2 text-xs text-red-500">{logoError}</p>}
              {logoPreview && (
                <div className="mb-3">
                  <img src={logoPreview} alt="Logo preview" className="h-24 w-24 rounded-xl border border-slate-200 object-cover shadow-sm" />
                </div>
              )}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleLogoDrop}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-6 text-center transition hover:border-emerald-400 hover:bg-emerald-50/30 cursor-pointer"
                onClick={() => document.getElementById('logo-input')?.click()}
              >
                <Icon d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" className="w-8 h-8 text-slate-400" />
                <p className="text-sm font-medium text-slate-500">Seret logo ke sini atau klik untuk upload</p>
                <p className="text-[11px] text-slate-400">PNG, JPG, WEBP, SVG — maks 2MB</p>
                <input id="logo-input" type="file" accept=".png,.jpg,.jpeg,.webp,.svg" className="hidden" onChange={handleLogoSelect} />
              </div>
              {logoFile && (
                <button type="button" onClick={handleUploadLogo} disabled={uploading}
                  className="mt-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:shadow-lg transition disabled:opacity-60">
                  {uploading ? 'Mengupload...' : 'Upload Logo'}
                </button>
              )}
            </div>

            <div className={gridCols}>
              <div className="sm:col-span-2">
                <label className={labelStyle}>{required('Nama BUM Desa')}</label>
                <input type="text" className={inputStyle} placeholder="Contoh: BUM Desa Makmur Jaya"
                  value={form.nama_bumdes} onChange={e => handleChange('nama_bumdes', e.target.value)} required />
              </div>
              <div>
                <label className={labelStyle}>NPWP</label>
                <input type="text" className={inputStyle} placeholder="00.000.000.0-000.000"
                  value={form.npwp} onChange={e => handleChange('npwp', e.target.value)} />
              </div>
              <div>
                <label className={labelStyle}>Nomor Sertifikat Badan Hukum</label>
                <input type="text" className={inputStyle} placeholder="AHU-000000.AA.00.00"
                  value={form.nomor_sertifikat_badan_hukum} onChange={e => handleChange('nomor_sertifikat_badan_hukum', e.target.value)} />
              </div>
              <div>
                <label className={labelStyle}>Nomor Perdes Pendirian</label>
                <input type="text" className={inputStyle} placeholder="Contoh: 01/Perdes/2023"
                  value={form.nomor_perdes_pendirian} onChange={e => handleChange('nomor_perdes_pendirian', e.target.value)} />
              </div>
              <div>
                <label className={labelStyle}>{required('Tahun Berdiri')}</label>
                <input type="number" className={inputStyle} placeholder="2020"
                  value={form.tahun_berdiri} onChange={e => handleChange('tahun_berdiri', e.target.value)} required />
              </div>
              <div>
                <label className={labelStyle}>Telepon BUM Desa</label>
                <input type="tel" className={inputStyle} placeholder="0812-3456-7890"
                  value={form.telepon} onChange={e => handleChange('telepon', e.target.value)} />
              </div>
            </div>

            {/* Wilayah */}
            <h3 className="text-sm font-bold text-slate-800 mt-2">Wilayah</h3>
            <div className={gridCols}>
              <div>
                <label className={labelStyle}>{required('Provinsi')}</label>
                <input type="text" className={inputStyle} placeholder="Contoh: Jawa Barat"
                  value={form.provinsi} onChange={e => handleChange('provinsi', e.target.value)} required />
              </div>
              <div>
                <label className={labelStyle}>{required('Kabupaten')}</label>
                <input type="text" className={inputStyle} placeholder="Contoh: Kabupaten Garut"
                  value={form.kabupaten} onChange={e => handleChange('kabupaten', e.target.value)} required />
              </div>
              <div>
                <label className={labelStyle}>{required('Kecamatan')}</label>
                <input type="text" className={inputStyle} placeholder="Contoh: Kecamatan Cilawu"
                  value={form.kecamatan} onChange={e => handleChange('kecamatan', e.target.value)} required />
              </div>
              <div>
                <label className={labelStyle}>{required('Desa')}</label>
                <input type="text" className={inputStyle} placeholder="Contoh: Desa Mekarjaya"
                  value={form.desa} onChange={e => handleChange('desa', e.target.value)} required />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Pelaksana Operasional */}
        <div className={sectionStyle}>
          <div className="flex items-center gap-2 mb-5">
            <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">Pelaksana Operasional</h2>
          </div>

          <div className={gridCols}>
            <div>
              <label className={labelStyle}>{required('Penasihat (Kepala Desa)')}</label>
              <input type="text" className={inputStyle} placeholder="Nama lengkap penasihat"
                value={form.penasihat} onChange={e => handleChange('penasihat', e.target.value)} required />
            </div>
            <div>
              <label className={labelStyle}>{required('Direktur')}</label>
              <input type="text" className={inputStyle} placeholder="Nama lengkap direktur"
                value={form.direktur} onChange={e => handleChange('direktur', e.target.value)} required />
            </div>
            <div>
              <label className={labelStyle}>{required('Sekretaris')}</label>
              <input type="text" className={inputStyle} placeholder="Nama lengkap sekretaris"
                value={form.sekretaris} onChange={e => handleChange('sekretaris', e.target.value)} required />
            </div>
            <div>
              <label className={labelStyle}>{required('Bendahara')}</label>
              <input type="text" className={inputStyle} placeholder="Nama lengkap bendahara"
                value={form.bendahara} onChange={e => handleChange('bendahara', e.target.value)} required />
            </div>
            <div>
              <label className={labelStyle}>{required('Pengawas 1')}</label>
              <input type="text" className={inputStyle} placeholder="Nama lengkap pengawas 1"
                value={form.pengawas1} onChange={e => handleChange('pengawas1', e.target.value)} required />
            </div>
            <div>
              <label className={labelStyle}>Pengawas 2</label>
              <input type="text" className={inputStyle} placeholder="Nama lengkap pengawas 2 (opsional)"
                value={form.pengawas2} onChange={e => handleChange('pengawas2', e.target.value)} />
              <p className="mt-1 text-[11px] text-slate-400">Opsional, diisi jika ada pengawas kedua</p>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="mt-8 flex justify-end">
          <button type="submit" disabled={saving}
            className="rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:shadow-xl disabled:opacity-60">
            {saving ? 'Menyimpan...' : 'Simpan Profil'}
          </button>
        </div>
      </form>
    </div>
  );
}

type CoAAccount = { id: number; kode: string; nama: string; jenis_akun?: string; jenisAkun?: string; saldo_normal?: string; saldoNormal?: string; is_postable?: boolean; isPostable?: boolean; parentId?: number | null; parent_id?: number | null; isSeeded?: boolean; is_seeded?: boolean; level?: number; isActive?: boolean; kelompok?: string };
type JournalLine = { akun_id: number; debit: number; kredit: number; keterangan: string };
type JournalEntry = { id: number; no_jurnal: string; tanggal: string; keterangan: string; total: number; lines?: JournalLine[] };

function CoAPage() {
  const [accounts, setAccounts] = useState<CoAAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [addModal, setAddModal] = useState<{ parent: CoAAccount } | null>(null);
  const [addNama, setAddNama] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [deleteModal, setDeleteModal] = useState<CoAAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  function getToken() {
    return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
  }

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  }

  async function fetchCoA() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/accounting/coa', { headers: { Authorization: 'Bearer ' + getToken() } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat CoA');
      setAccounts(Array.isArray(data) ? data : data.coa || data.accounts || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCoA(); }, []);

  async function seedCoA() {
    setSeeding(true);
    setError('');
    try {
      const res = await fetch('/api/accounting/coa/seed', { headers: { Authorization: 'Bearer ' + getToken() } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat CoA default');
      await fetchCoA();
      showToast('success', 'CoA default berhasil dimuat');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSeeding(false);
    }
  }

  async function handleAddSubAccount() {
    if (!addModal || !addNama.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      const res = await fetch('/api/accounting/coa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
        body: JSON.stringify({ parent_id: addModal.parent.id, nama: addNama.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah sub-akun');
      setAddModal(null);
      setAddNama('');
      showToast('success', `Sub-akun "${addNama.trim()}" berhasil ditambahkan`);
      await fetchCoA();
    } catch (e: any) {
      setAddError(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteAccount() {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/accounting/coa/${deleteModal.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + getToken() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus akun');
      setDeleteModal(null);
      showToast('success', `Akun "${deleteModal.kode} — ${deleteModal.nama}" berhasil dihapus`);
      await fetchCoA();
    } catch (e: any) {
      setDeleteModal(null);
      showToast('error', e.message);
    } finally {
      setDeleting(false);
    }
  }

  const filtered = accounts
    .filter(a => {
      const jenis = a.jenisAkun || a.jenis_akun || '';
      if (filterJenis && jenis !== filterJenis) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!a.kode.toLowerCase().includes(q) && !a.nama.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => a.kode.localeCompare(b.kode, undefined, { numeric: true }));

  const jenisList = Array.from(new Set(accounts.map(a => a.jenisAkun || a.jenis_akun || '').filter(Boolean)));

  function getLevel(a: CoAAccount): number {
    if (a.level != null) return a.level;
    return (a.kode.match(/\./g) || []).length + 1;
  }

  function isAccountSeeded(a: CoAAccount): boolean {
    return !!(a.isSeeded ?? a.is_seeded ?? true);
  }

  const plusIconPath = 'M12 4v16m8-8H4';
  const trashIconPath = 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16';
  const closeIconPath = 'M6 18L18 6M6 6l12 12';

  if (loading) return <div className="rounded-2xl border border-slate-100 bg-white p-8 text-sm text-slate-500 shadow-sm">Memuat Bagan Akun...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] flex items-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-semibold shadow-xl backdrop-blur-xl transition-all ${toast.type === 'success' ? 'bg-emerald-50/90 text-emerald-800 border border-emerald-200' : 'bg-red-50/90 text-red-800 border border-red-200'}`}>
          {toast.type === 'success' ? (
            <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          )}
          <span>{toast.text}</span>
          <button onClick={() => setToast(null)} className="ml-1 opacity-50 hover:opacity-100 transition"><Icon d={closeIconPath} className="w-4 h-4" /></button>
        </div>
      )}

      {/* Add Sub-Akun Modal */}
      {addModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => { setAddModal(null); setAddNama(''); setAddError(''); }}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-5 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Tambah Sub-Akun</h3>
              <button onClick={() => { setAddModal(null); setAddNama(''); setAddError(''); }} className="text-slate-400 hover:text-slate-600 transition"><Icon d={closeIconPath} className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl bg-slate-50 px-4 py-3 border border-slate-100">
                <p className="text-xs text-slate-400 font-medium">Induk</p>
                <p className="text-sm font-semibold text-slate-800 font-mono">{addModal.parent.kode} — {addModal.parent.nama}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nama Akun Baru</label>
                <input
                  type="text"
                  value={addNama}
                  onChange={e => { setAddNama(e.target.value); setAddError(''); }}
                  placeholder="Masukkan nama akun..."
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  onKeyDown={e => { if (e.key === 'Enter') handleAddSubAccount(); }}
                />
              </div>
              {addError && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{addError}</div>}
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => { setAddModal(null); setAddNama(''); setAddError(''); }} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">Batal</button>
              <button onClick={handleAddSubAccount} disabled={adding || !addNama.trim()}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:shadow-xl disabled:opacity-50">
                {adding ? 'Menambahkan...' : 'Tambah'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setDeleteModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-5 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Hapus Akun</h3>
              <button onClick={() => setDeleteModal(null)} className="text-slate-400 hover:text-slate-600 transition"><Icon d={closeIconPath} className="w-5 h-5" /></button>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-4">
              <p className="text-sm text-red-800">
                Hapus akun <span className="font-mono font-bold">{deleteModal.kode}</span> — <span className="font-bold">{deleteModal.nama}</span>?
              </p>
              <p className="text-xs text-red-500 mt-2">Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setDeleteModal(null)} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">Batal</button>
              <button onClick={handleDeleteAccount} disabled={deleting}
                className="rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition hover:shadow-xl disabled:opacity-50">
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bagan Akun (CoA)</h1>
        <p className="mt-1 text-sm text-slate-500">Daftar seluruh akun akuntansi BUM Desa.</p>
      </div>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}

      {accounts.length === 0 ? (
        <div className="rounded-3xl border border-white/70 bg-white/80 p-12 shadow-sm backdrop-blur-xl flex flex-col items-center gap-4">
          <Icon d={coaIcon} className="w-14 h-14 text-slate-300" />
          <p className="text-sm text-slate-500 text-center">Belum ada akun. Muat Bagan Akun standar untuk memulai.</p>
          <button onClick={seedCoA} disabled={seeding}
            className="rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:shadow-xl disabled:opacity-60">
            {seeding ? 'Memuat...' : 'Muat CoA Default'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" placeholder="Cari kode atau nama akun..." value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none" />
            <select value={filterJenis} onChange={e => setFilterJenis(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none">
              <option value="">Semua Jenis</option>
              {jenisList.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div className="rounded-3xl border border-white/70 bg-white/80 shadow-sm backdrop-blur-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold w-[45%]">Kode / Nama Akun</th>
                    <th className="px-5 py-3.5 font-semibold">Jenis</th>
                    <th className="px-5 py-3.5 font-semibold">Saldo Normal</th>
                    <th className="px-5 py-3.5 font-semibold">Posting</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Tidak ada akun ditemukan</td></tr>
                  ) : filtered.map(a => {
                    const lv = getLevel(a);
                    const seeded = isAccountSeeded(a);
                    const indentPx = Math.max(0, (lv - 1) * 24);
                    const isLvl1 = lv === 1;
                    const isLvl2 = lv === 2;
                    const isLvl3 = lv === 3;
                    const isLvl4 = lv >= 4;

                    return (
                      <tr key={a.id} className="hover:bg-slate-50/50 transition group">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2" style={{ paddingLeft: indentPx }}>
                            {/* Tree connector lines */}
                            {lv > 1 && (
                              <span className="flex-shrink-0 w-4 h-px bg-slate-200" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`font-mono text-xs whitespace-nowrap ${
                                  isLvl1 ? 'font-bold text-slate-900' : isLvl2 ? 'font-bold text-slate-800' : isLvl3 ? 'font-semibold text-slate-700' : 'text-slate-500'
                                }`}>{a.kode}</span>
                                <span className={`truncate ${
                                  isLvl1 ? 'font-bold text-slate-900 text-[15px] uppercase tracking-wide' : isLvl2 ? 'font-semibold text-slate-800' : isLvl3 ? 'font-medium text-slate-700' : 'text-slate-600'
                                }`}>{a.nama}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex rounded-full bg-cyan-50 px-2.5 py-0.5 text-[11px] font-bold text-cyan-700">{a.jenisAkun || a.jenis_akun || '—'}</span>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{a.saldoNormal || a.saldo_normal || '—'}</td>
                        <td className="px-5 py-3">
                          {(a.isPostable ?? a.is_postable)
                            ? <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">Ya</span>
                            : <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-500">Induk</span>
                          }
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Tambah Sub-Akun button for Level 3 */}
                            {isLvl3 && (
                              <button
                                onClick={() => { setAddModal({ parent: a }); setAddNama(''); setAddError(''); }}
                                title="Tambah Sub-Akun"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-emerald-600 hover:bg-emerald-50 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Icon d={plusIconPath} className="w-4 h-4" />
                              </button>
                            )}
                            {/* Hapus button for user-created Level 4 accounts */}
                            {isLvl4 && !seeded && (
                              <button
                                onClick={() => setDeleteModal(a)}
                                title="Hapus Akun"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Icon d={trashIconPath} className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-slate-400">{filtered.length} dari {accounts.length} akun</p>
        </div>
      )}
    </div>
  );
}

function JurnalUmumPage() {
  const [coaAccounts, setCoaAccounts] = useState<CoAAccount[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [keterangan, setKeterangan] = useState('');
  const [lines, setLines] = useState<{ akun_id: string; debit: string; kredit: string; keterangan: string }[]>([
    { akun_id: '', debit: '', kredit: '', keterangan: '' },
    { akun_id: '', debit: '', kredit: '', keterangan: '' },
  ]);
  const [showSuccess, setShowSuccess] = useState('');

  function getToken() {
    return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
  }

  useEffect(() => {
    const t = getToken();
    Promise.all([
      fetch('/api/accounting/coa', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      fetch('/api/accounting/jurnal-umum?limit=20', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
    ])
      .then(([coaData, jurnalData]) => {
        const all: CoAAccount[] = Array.isArray(coaData) ? coaData : coaData.accounts || [];
        setCoaAccounts(all.filter((a: CoAAccount) => a.isPostable ?? a.is_postable));
        setEntries(Array.isArray(jurnalData) ? jurnalData : jurnalData.entries || jurnalData.data || []);
      })
      .catch(e => setError(e.message || 'Gagal memuat data'))
      .finally(() => setLoading(false));
  }, []);

  function updateLine(i: number, field: string, val: string) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  }

  function addLine() {
    setLines(prev => [...prev, { akun_id: '', debit: '', kredit: '', keterangan: '' }]);
  }

  function removeLine(i: number) {
    setLines(prev => prev.filter((_, idx) => idx !== i));
  }

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalKredit = lines.reduce((s, l) => s + (parseFloat(l.kredit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalKredit) < 0.01;
  const validLines = lines.filter(l => l.akun_id && (parseFloat(l.debit) > 0 || parseFloat(l.kredit) > 0));
  const canSubmit = isBalanced && validLines.length >= 2 && !!tanggal && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    setShowSuccess('');
    try {
      const payload = {
        tanggal,
        keterangan,
        lines: validLines.map(l => ({
          akun_id: Number(l.akun_id),
          debit: parseFloat(l.debit) || 0,
          kredit: parseFloat(l.kredit) || 0,
          keterangan: l.keterangan,
        })),
      };
      const res = await fetch('/api/accounting/jurnal-umum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan jurnal');
      const no = data.no_jurnal || data.entry?.no_jurnal || '';
      setShowSuccess(no ? 'Jurnal berhasil disimpan: ' + no : 'Jurnal berhasil disimpan');
      setKeterangan('');
      setLines([{ akun_id: '', debit: '', kredit: '', keterangan: '' }, { akun_id: '', debit: '', kredit: '', keterangan: '' }]);
      const refreshed = await fetch('/api/accounting/jurnal-umum?limit=20', { headers: { Authorization: 'Bearer ' + getToken() } });
      const rd = await refreshed.json();
      setEntries(Array.isArray(rd) ? rd : rd.entries || rd.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="rounded-2xl border border-slate-100 bg-white p-8 text-sm text-slate-500 shadow-sm">Memuat Jurnal Umum...</div>;

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none';
  const selectCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none';

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Jurnal Umum</h1>
        <p className="mt-1 text-sm text-slate-500">Catat transaksi jurnal umum BUM Desa.</p>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
      {showSuccess && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{showSuccess}</div>}

      <form onSubmit={handleSubmit} className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-xl space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Icon d={jurnalIcon} className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-900">Form Jurnal Baru</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal</label>
            <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Keterangan</label>
            <input type="text" value={keterangan} onChange={e => setKeterangan(e.target.value)} placeholder="Keterangan jurnal" className={inputCls} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide px-1">
            <div className="col-span-4">Akun</div>
            <div className="col-span-3">Debit</div>
            <div className="col-span-3">Kredit</div>
            <div className="col-span-2">Aksi</div>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-4">
                <select value={line.akun_id} onChange={e => updateLine(i, 'akun_id', e.target.value)} className={selectCls}>
                  <option value="">Pilih akun</option>
                  {coaAccounts.map(a => <option key={a.id} value={a.id}>{a.kode} — {a.nama}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <input type="number" step="0.01" min="0" placeholder="0" value={line.debit} onChange={e => updateLine(i, 'debit', e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-3">
                <input type="number" step="0.01" min="0" placeholder="0" value={line.kredit} onChange={e => updateLine(i, 'kredit', e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2 flex gap-1">
                {lines.length > 2 && (
                  <button type="button" onClick={() => removeLine(i)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition text-sm font-bold" title="Hapus baris">
                    <Icon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="w-4 h-4" />
                  </button>
                )}
                {i === lines.length - 1 && (
                  <button type="button" onClick={addLine}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition text-sm font-bold" title="Tambah baris">
                    <Icon d="M12 4v16m8-8H4" className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex gap-6 text-sm">
            <span>Total Debit: <strong className="text-slate-900">{formatRupiah(totalDebit)}</strong></span>
            <span>Total Kredit: <strong className="text-slate-900">{formatRupiah(totalKredit)}</strong></span>
            <span className={isBalanced ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
              {isBalanced ? 'Seimbang' : 'Belum Seimbang'}
            </span>
          </div>
          <button type="submit" disabled={!canSubmit}
            className="rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed">
            {submitting ? 'Menyimpan...' : 'Simpan Jurnal'}
          </button>
        </div>
      </form>

      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Riwayat Jurnal</h3>
        {entries.length === 0 ? (
          <div className="rounded-3xl border border-white/70 bg-white/80 p-8 text-center shadow-sm backdrop-blur-xl">
            <Icon d={jurnalIcon} className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="mt-3 text-sm text-slate-400">Belum ada jurnal tercatat</p>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/70 bg-white/80 shadow-sm backdrop-blur-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">No. Jurnal</th>
                    <th className="px-5 py-3.5 font-semibold">Tanggal</th>
                    <th className="px-5 py-3.5 font-semibold">Keterangan</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-emerald-700">{e.no_jurnal}</td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(e.tanggal)}</td>
                      <td className="px-5 py-3 text-slate-900">{e.keterangan || '-'}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatRupiah(e.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AppDashboard() {
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    if (!stored || !token) { navigate('/login'); return; }
    fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => {
        if (d.error) { navigate('/login'); return; }
        if (!d.user.tenant_id) { navigate('/register'); return; }
        setUser(d.user);
      })
      .catch(() => navigate('/login'));
  }, [navigate]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Memuat...</p>
      </div>
    </div>
  );

  function logout() { localStorage.clear(); sessionStorage.clear(); navigate('/login'); }

  const trialEnds = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
  const now = new Date();
  const isTrialExpired = trialEnds && now > trialEnds;
  const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - now.getTime()) / 86400000)) : 0;

  const SIDEBAR_W = collapsed ? 'w-20' : 'w-64';
  const MAIN_ML = collapsed ? 'lg:ml-20' : 'lg:ml-64';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={'fixed inset-y-0 left-0 z-50 ' + SIDEBAR_W + ' bg-white flex flex-col transition-all duration-300 ease-in-out transform ' + (sidebarOpen ? 'translate-x-0' : '-translate-x-full') + ' lg:translate-x-0'}>
        {/* Logo */}
        <div className={'h-16 flex items-center border-b border-slate-100 ' + (collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img src="/logo.png" alt="SILABU DIGI" className={'shrink-0 ' + (collapsed ? 'w-10 h-10 rounded-xl object-cover' : 'h-9')} />
          </div>
          <button onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            title={collapsed ? 'Perluas sidebar' : 'Sembunyikan sidebar'}>
            <Icon d={collapsed ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7M19 19l-7-7 7-7'} className="w-4 h-4" />
          </button>
          {!collapsed && (
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition">
              <Icon d="M6 18L18 6M6 6l12 12" className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className={'px-2.5 pb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider ' + (collapsed ? 'text-center' : '')}>{collapsed ? 'M' : 'Menu'}</p>

          <button onClick={() => { setPage('dashboard'); setSidebarOpen(false); }}
            className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ' + (page === 'dashboard' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800') + (collapsed ? ' justify-center px-0' : '')}>
            <span className="relative">
              <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              {page === 'dashboard' && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-full" />}
            </span>
            {!collapsed && <span>Dashboard</span>}
          </button>

          <button onClick={() => { setPage('langganan'); setSidebarOpen(false); }}
            className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ' + (page === 'langganan' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800') + (collapsed ? ' justify-center px-0' : '')}>
            <span className="relative">
              <Icon d={creditCardIcon} />
              {page === 'langganan' && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-full" />}
            </span>
            {!collapsed && <span>Langganan</span>}
          </button>

          <button onClick={() => { setPage('profil'); setSidebarOpen(false); }}
            className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ' + (page === 'profil' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800') + (collapsed ? ' justify-center px-0' : '')}>
            <span className="relative">
              <Icon d={officeIcon} />
              {page === 'profil' && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-full" />}
            </span>
            {!collapsed && <span>Profil BUM Desa</span>}
          </button>

          {!collapsed && <p className="px-2.5 pt-4 pb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Keuangan</p>}
          <button onClick={() => { setPage('coa'); setSidebarOpen(false); }}
            className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ' + (page === 'coa' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800') + (collapsed ? ' justify-center px-0' : '')}>
            <span className="relative">
              <Icon d={coaIcon} />
              {page === 'coa' && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-full" />}
            </span>
            {!collapsed && <span>CoA</span>}
          </button>
          <button onClick={() => { setPage('jurnal'); setSidebarOpen(false); }}
            className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ' + (page === 'jurnal' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800') + (collapsed ? ' justify-center px-0' : '')}>
            <span className="relative">
              <Icon d={jurnalIcon} />
              {page === 'jurnal' && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-full" />}
            </span>
            {!collapsed && <span>Jurnal Umum</span>}
          </button>
          {financeMenus.map((m, i) => (
            <span key={i} className={'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 cursor-not-allowed ' + (collapsed ? 'justify-center px-0' : '')}>
              <Icon d={m.icon} className="w-5 h-5 text-slate-300 shrink-0" />
              {!collapsed && <span className="flex-1">{m.label}</span>}
              {!collapsed && <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-medium">Segera</span>}
            </span>
          ))}
        </nav>


      </aside>

      {/* Main */}
      <main className={MAIN_ML + ' min-h-screen transition-all duration-300 ease-in-out'}>
        {/* Header */}
        <header className="sticky top-0 z-50 h-16 bg-white/80 backdrop-blur-md border-b border-slate-100/60 flex items-center gap-3 px-4 sm:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition" aria-label="Buka menu">
            <Icon d="M4 6h16M4 12h16M4 18h16" className="w-6 h-6" />
          </button>
          <h2 className="text-lg font-bold text-slate-900">{page === 'password' ? 'Ubah Password' : page === 'langganan' ? 'Langganan' : page === 'profil' ? 'Profil BUM Desa' : page === 'coa' ? 'Bagan Akun (CoA)' : page === 'jurnal' ? 'Jurnal Umum' : 'Dashboard'}</h2>
          <div className="flex-1" />
          {/* Profile dropdown */}
          <div ref={profileRef} className="relative">
            <button onClick={() => setProfileOpen(!profileOpen)}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-white font-bold text-sm shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200">
              {(user.nama_lengkap || user.email)[0].toUpperCase()}
            </button>
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 animate-scale-in z-50 origin-top-right">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-bold text-slate-900 truncate">{user.nama_lengkap}</p>
                  <p className="text-xs text-slate-400 truncate">{user.email}</p>
                </div>
                <button onClick={() => { setPage('password'); setProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition">
                  <Icon d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" className="w-4 h-4 text-slate-400" />
                  Ubah Password
                </button>
                <button onClick={() => { setConfirmLogout(true); setProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition">
                  <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" className="w-4 h-4 text-red-400" />
                  Keluar
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="p-4 sm:p-6 lg:p-8">
          {page === 'password' ? <PasswordForm /> : page === 'langganan' ? <LanggananPage /> : page === 'profil' ? <ProfilPage /> : page === 'coa' ? <CoAPage /> : page === 'jurnal' ? <JurnalUmumPage /> : (
            <div className="space-y-8 animate-fade-in">
              {/* Trial banner */}
              {trialEnds && !isTrialExpired && (
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200/60 rounded-2xl text-emerald-800 text-sm flex items-start gap-3 animate-slide-down">
                  <Icon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <strong>Trial {daysLeft} hari lagi.</strong> Setelah habis, data tetap aman.{' '}
                    <button onClick={() => setPage('langganan')} className="font-semibold underline underline-offset-2 decoration-emerald-400">Perpanjang Sekarang</button>
                  </div>
                </div>
              )}
              {isTrialExpired && (
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl text-amber-800 text-sm flex items-start gap-3 animate-slide-down">
                  <Icon d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <strong>Masa percobaan telah berakhir.</strong> Data tetap aman.{' '}
                    <button onClick={() => setPage('langganan')} className="font-semibold underline underline-offset-2 decoration-amber-400">Perpanjang Sekarang</button>
                  </div>
                </div>
              )}

              {/* Welcome */}
              <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl p-6 sm:p-8 border border-slate-100 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-900">Selamat datang kembali, {user.nama_lengkap.split(' ')[0]}</h2>
                <p className="mt-1.5 text-sm text-slate-500">
                  {user.nama_bumdes} {'\u00B7'}{' '}
                  <span className={'inline-flex items-center gap-1.5 font-semibold ' + (user.subscription_status === 'trial' ? 'text-emerald-600' : 'text-cyan-600')}>
                    <span className={'w-1.5 h-1.5 rounded-full animate-pulse ' + (user.subscription_status === 'trial' ? 'bg-emerald-500' : 'bg-cyan-500')} />
                    {user.subscription_status === 'trial' ? 'Masa Trial' : 'Aktif'}
                  </span>
                </p>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { label: 'Total Pemasukan', value: 'Rp0', trend: 0, d: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
                  { label: 'Total Pengeluaran', value: 'Rp0', trend: 0, d: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6' },
                  { label: 'Saldo Kas', value: 'Rp0', trend: 0, d: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-50 to-cyan-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                        <Icon d={s.d} className="w-5 h-5 text-emerald-600" />
                      </div>
                      {s.trend !== 0 && (
                        <span className={'inline-flex items-center gap-1 text-xs font-semibold ' + (s.trend > 0 ? 'text-emerald-600' : 'text-red-500')}>
                          <Icon d={s.trend > 0 ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} className="w-3 h-3" />
                          {Math.abs(s.trend)}%
                        </span>
                      )}
                    </div>
                    <p className="text-3xl font-semibold text-slate-900">{s.value}</p>
                    <p className="text-sm font-medium text-slate-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Chart placeholder */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900">Grafik Keuangan</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Ringkasan pemasukan {'\u0026'} pengeluaran</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" /> Pemasukan</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" /> Pengeluaran</span>
                  </div>
                </div>
                <div className="h-48 sm:h-56 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-slate-300">
                    <Icon d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" className="w-8 h-8" />
                    <p className="text-sm">Grafik akan tersedia setelah ada data transaksi</p>
                  </div>
                </div>
              </div>

              {/* Recent activity */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4">Aktivitas Terakhir</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                      <Icon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">Akun BUM Desa berhasil dibuat</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Saat registrasi</p>
                    </div>
                  </div>
                  <div className="text-center pt-2">
                    <p className="text-xs text-slate-400">Fitur lainnya segera hadir</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      {/* Logout confirm modal */}
      {confirmLogout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmLogout(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </div>
            <h3 className="text-center text-lg font-bold text-slate-900">Yakin ingin keluar?</h3>
            <p className="mt-1 text-center text-sm text-slate-500">Anda harus login kembali untuk mengakses akun.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setConfirmLogout(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Batal</button>
              <button onClick={() => { setConfirmLogout(false); logout(); }}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition">Ya, Keluar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
