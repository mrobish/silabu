import { Fragment, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PasswordForm from './PasswordForm';
import RincianSaldoPage from './RincianSaldoPage';
import BukuBesarPage from './BukuBesarPage';
import DatePicker from './DatePicker';
import LabaRugiPage from './LabaRugiPage';
import NeracaPage from './NeracaPage';
import NeracaSaldoPage from './NeracaSaldoPage';
import ArusKasPage from './ArusKasPage';
import AsetTetapPage from './AsetTetapPage';
import TutupBukuPage from './TutupBukuPage';
import CalkPage from './CalkPage';
import PerubahanModalPage from './PerubahanModalPage';
import RekapJurnalPage from './RekapJurnalPage';
import JurnalPenyesuaianPage from './JurnalPenyesuaianPage';

type Page = 'dashboard' | 'password' | 'langganan' | 'profil' | 'coa' | 'saldo-awal' | 'jurnal' | 'rekap-jurnal' | 'penyesuaian' | 'rincian-saldo' | 'buku-besar' | 'laba-rugi' | 'neraca' | 'neraca-saldo' | 'arus-kas' | 'perubahan-modal' | 'aset-tetap' | 'tutup-buku' | 'calk';

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

const financeMenus: { label: string; page: string; icon: string; soon?: boolean }[] = [
  { label: 'Rekap Jurnal', page: 'rekap-jurnal', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 8h3m-3 4h3m-6-4h.01M9 16h.01' },
  { label: 'Laba Rugi', page: 'laba-rugi', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { label: 'Neraca', page: 'neraca', icon: 'M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25' },
  { label: 'Neraca Saldo', page: 'neraca-saldo', icon: 'M10 3H3v18h7v-8h3v8h7V3h-7v6h-3z' },
  { label: 'Arus Kas', page: 'arus-kas', icon: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10l6 4 M9 14l6-4' },
  { label: 'Perubahan Modal', page: 'perubahan-modal', icon: 'M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7h16M4 7l2-3h12l2 3m-6 4v6m-2-3h4' },
  { label: 'Aset & Inventaris', page: 'aset-tetap', icon: 'M12 2l9 4.5v11L12 22l-9-4.5v-11L12 2z M12 6v6.5 M7.5 9l9 4.5' },
  { label: 'CALK', page: 'calk', icon: 'M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z M10 3v4h4V3' },
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

// Shared currency input helpers (SaldoAwal + JurnalUmum)
function formatCurrencyDisplay(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseCurrencyInput(displayVal: string): number {
  const digits = displayVal.replace(/\D/g, '');
  return parseFloat(digits) || 0;
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
              <thead className="text-xs uppercase tracking-wide text-slate-400"><tr><th className="py-3">Reference</th><th>Amount</th><th>Status</th><th>Date</th><th></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p, i) => <tr key={i} className="text-slate-600"><td className="py-3 font-mono text-xs">{p.reference || '-'}</td><td>{formatRupiah(p.amount)}</td><td><span className={'rounded-full px-2 py-1 text-xs font-semibold ' + (p.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')}>{p.status || '-'}</span></td><td>{formatDate(p.paid_at || p.created_at || p.date)}</td><td>{p.status === 'PAID' && p.id && <a href={'/invoice/' + p.id} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Bukti Bayar</a>}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfilPage({ setPage }: { setPage: (p: Page) => void }) {
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

      {/* Reset Data Info Box */}
      <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50/50 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Icon d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 text-sm">Perlu Memulai Pembukuan dari Awal?</h3>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              Fasilitas <b>Reset Data</b> memerlukan verifikasi administratif untuk mencegah kehilangan data yang tidak disengaja. Silakan hubungi Tim Support dengan melampirkan surat permohonan resmi.
            </p>
            <a href={`https://wa.me/6287777942737?text=${encodeURIComponent(`Halo Admin SILABU, kami dari BUM Desa ${form.nama_bumdes || '...'} ingin mengajukan permohonan Reset Data transaksi...`)}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 hover:shadow-md transition-all">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Hubungi Support via WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

type CoAAccount = { id: number; kode: string; nama: string; jenis_akun?: string; jenisAkun?: string; saldo_normal?: string; saldoNormal?: string; is_postable?: boolean; isPostable?: boolean; parentId?: number | null; parent_id?: number | null; isSeeded?: boolean; is_seeded?: boolean; isSystemDefault?: boolean; is_system_default?: boolean; level?: number; isActive?: boolean; kelompok?: string };
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
  const [addModal, setAddModal] = useState<boolean>(false);
  const [addParentId, setAddParentId] = useState('');
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
    if (!addParentId || !addNama.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      const res = await fetch('/api/accounting/coa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
        body: JSON.stringify({ parent_id: addParentId, nama: addNama.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah sub-akun');
      setAddModal(false);
      setAddParentId('');
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
    return !!(a.isSystemDefault ?? a.is_system_default ?? a.isSeeded ?? a.is_seeded ?? true);
  }

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

      {/* Add Custom Account Modal */}
      {addModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => { setAddModal(false); setAddParentId(''); setAddNama(''); setAddError(''); }}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-5 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Tambah Akun Custom</h3>
              <button onClick={() => { setAddModal(false); setAddParentId(''); setAddNama(''); setAddError(''); }} className="text-slate-400 hover:text-slate-600 transition"><Icon d={closeIconPath} className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              {/* Field 1: Induk Akun */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Induk Akun <span className="text-red-500">*</span></label>
                <select
                  value={addParentId}
                  onChange={e => { setAddParentId(e.target.value); setAddError(''); }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20strokeWidth%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10"
                >
                  <option value="">Pilih induk akun...</option>
                  {accounts.filter(a => a.level === 3 && a.isActive).map(a => (
                    <option key={a.id} value={a.id}>{a.kode} — {a.nama}</option>
                  ))}
                </select>
              </div>

              {/* Field 2: Nama Akun */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nama Akun <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={addNama}
                  onChange={e => { setAddNama(e.target.value); setAddError(''); }}
                  placeholder="Contoh: Bank Jago, Bank BJB Desa, Kas Toko"
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  onKeyDown={e => { if (e.key === 'Enter') handleAddSubAccount(); }}
                />
              </div>

              {/* Field 3: Kode Akun (disabled) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Kode Akun</label>
                <input
                  type="text"
                  value=""
                  disabled
                  placeholder="Dibuat otomatis oleh sistem"
                  className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-400 placeholder-slate-300 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-slate-400">Kode akun akan dibuat otomatis berdasarkan induk yang dipilih.</p>
              </div>

              {addError && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{addError}</div>}
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => { setAddModal(false); setAddParentId(''); setAddNama(''); setAddError(''); }} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">Batal</button>
              <button onClick={handleAddSubAccount} disabled={adding || !addParentId || !addNama.trim()}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:shadow-xl disabled:opacity-50">
                {adding ? 'Menambahkan...' : 'Simpan'}
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bagan Akun (CoA)</h1>
          <p className="mt-1 text-sm text-slate-500">Daftar seluruh akun akuntansi BUM Desa.</p>
        </div>
        {accounts.length > 0 && (
          <button
            onClick={() => { setAddModal(true); setAddParentId(''); setAddNama(''); setAddError(''); }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:shadow-xl"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Tambah Akun Custom
          </button>
        )}
      </div>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}

      {accounts.length === 0 ? (
        <div className="rounded-3xl border border-white/70 bg-white/80 p-12 shadow-sm backdrop-blur-xl flex flex-col items-center gap-3">
          <Icon d={coaIcon} className="w-14 h-14 text-slate-300" />
          <p className="text-sm text-slate-500 text-center">Menyiapkan bagan akun...</p>
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
                            {/* Hapus button for user-created Level 4 accounts */}
                            {isLvl4 && !seeded && (
                              <button
                                onClick={() => setDeleteModal(a)}
                                title="Hapus Akun"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-500 hover:bg-red-100 active:bg-red-200 transition-colors"
                              >
                                <Icon d={trashIconPath} className="w-4 h-4" />
                              </button>
                            )}
                            {/* Lock badge for system master accounts */}
                            {isLvl4 && seeded && (
                              <span title="Akun bawaan sistem — tidak dapat diubah/dihapus" className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Sistem
                              </span>
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


function SaldoAwalPage() {
  const [accounts, setAccounts] = useState<{ id: string; kode: string; nama: string; jenisAkun: string; kelompok: string; saldoNormal: string; level: number }[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [isSetup, setIsSetup] = useState(false);
  const [entry, setEntry] = useState<any>(null);
  const [showSuccess, setShowSuccess] = useState('');
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  function getToken() {
    return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
  }

  // Draft key per tenant (from JWT)
  function getDraftKey(): string {
    try {
      const token = getToken();
      const payload = JSON.parse(atob(token.split('.')[1]));
      return 'saldo-awal-draft-' + (payload.tenantId || 'unknown');
    } catch { return 'saldo-awal-draft-unknown'; }
  }

  // Save draft helper (synchronous, no debounce)
  function saveDraft(currentAmounts: Record<string, string>, currentTanggal: string) {
    try {
      const key = getDraftKey();
      const hasAnyValue = Object.values(currentAmounts).some(v => v);
      if (!hasAnyValue && !draftSavedAt) return; // never saved, all empty → skip
      localStorage.setItem(key, JSON.stringify({ amounts: currentAmounts, tanggal: currentTanggal, savedAt: new Date().toISOString() }));
      setDraftSavedAt(new Date().toISOString());
    } catch {}
  }

  // Auto-save draft to localStorage on amounts change (debounced 1s + cleanup save)
  useEffect(() => {
    if (loading || isSetup) return;
    const timer = setTimeout(() => saveDraft(amounts, tanggal), 1000);
    return () => {
      clearTimeout(timer);
      // FIX: save immediately on unmount (race condition protection)
      saveDraft(amounts, tanggal);
    };
  }, [amounts, tanggal, loading, isSetup]);

  function clearDraft() {
    try {
      localStorage.removeItem(getDraftKey());
      setDraftSavedAt(null);
      setAmounts({});
    } catch {}
  }

  useEffect(() => {
    const t = getToken();
    fetch('/api/accounting/saldo-awal', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setAccounts(data.accounts || []);
        setIsSetup(data.isSetup);
        setEntry(data.entry);
        const existing: Record<string, string> = {};
        // If API has existing lines (already submitted OB-001), use those
        if (data.isSetup && data.existingLines) {
          for (const a of (data.accounts || [])) {
            const line = data.existingLines[a.id];
            const debit = line?.debit && line.debit !== '0' ? line.debit : '';
            const kredit = line?.kredit && line.kredit !== '0' ? line.kredit : '';
            existing[a.id] = formatNumberString(debit || kredit);
          }
        } else if (!data.isSetup) {
          // Not submitted yet — try loading draft from localStorage
          try {
            const key = 'saldo-awal-draft-' + (JSON.parse(atob(t.split('.')[1])).tenantId || 'unknown');
            const draft = localStorage.getItem(key);
            if (draft) {
              const parsed = JSON.parse(draft);
              if (parsed.amounts) Object.assign(existing, parsed.amounts);
              if (parsed.tanggal) setTanggal(parsed.tanggal);
              setDraftSavedAt(parsed.savedAt || null);
            }
          } catch {}
        }
        setAmounts(existing);
      })
      .catch(e => setError(e.message || 'Gagal memuat data'))
      .finally(() => setLoading(false));
  }, []);

  // Currency formatting helpers
  function formatNumberString(raw: string): string {
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function parseFormatted(val: string): string {
    const digits = val.replace(/\D/g, '');
    return digits || '0';
  }

  function handleAmountChange(id: string, displayVal: string) {
    const formatted = formatNumberString(displayVal);
    setAmounts(prev => ({ ...prev, [id]: formatted }));
  }

  // Build debit/kredit rows from amounts + saldoNormal auto-mapping
  function buildRows(): Record<string, { debit: string; kredit: string }> {
    const rows: Record<string, { debit: string; kredit: string }> = {};
    for (const a of accounts) {
      const raw = parseFormatted(amounts[a.id] || '');
      const num = parseFloat(raw) || 0;
      if (num <= 0) continue;
      if (a.saldoNormal === 'D') {
        rows[a.id] = { debit: raw, kredit: '0' };
      } else {
        rows[a.id] = { debit: '0', kredit: raw };
      }
    }
    return rows;
  }

  const rows = buildRows();
  const cleanRows = Object.entries(rows).filter(([, v]) => (parseFloat(v.debit) || 0) > 0 || (parseFloat(v.kredit) || 0) > 0);
  const totalDebit = cleanRows.reduce((s, [, v]) => s + (parseFloat(v.debit) || 0), 0);
  const totalKredit = cleanRows.reduce((s, [, v]) => s + (parseFloat(v.kredit) || 0), 0);
  const selisih = totalDebit - totalKredit;
  const isBalanced = Math.abs(selisih) < 0.01 && cleanRows.length > 0;

  const grouped: Record<string, typeof accounts> = {};
  for (const a of accounts) {
    const gol = a.kode.charAt(0);
    (grouped[gol] ??= []).push(a);
  }
  const golLabels: Record<string, string> = { '1': 'Aset (Golongan 1)', '2': 'Kewajiban (Golongan 2)', '3': 'Ekuitas (Golongan 3)' };

  async function handleSubmit() {
    if (!isBalanced || submitting) return;
    setSubmitting(true);
    setError('');
    setShowSuccess('');
    try {
      const lines = cleanRows.map(([akun_id, v]) => ({ akun_id, debit: v.debit || '0', kredit: v.kredit || '0' }));
      const res = await fetch('/api/accounting/saldo-awal', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ tanggal, lines }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan saldo awal');
      setShowSuccess(data.message || 'Saldo awal berhasil disimpan!');
      setIsSetup(true);
      setEntry({ noJurnal: data.noJurnal, tanggal });
      clearDraft();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/accounting/saldo-awal', { method: 'DELETE', headers: { Authorization: 'Bearer ' + getToken() } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal reset saldo awal');
      setIsSetup(false);
      setEntry(null);
      setAmounts({});
      setShowSuccess('Saldo awal berhasil direset. Silakan input ulang.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-500"><span className="w-5 h-5 mr-2 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> Memuat...</div>;

  const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">Masukkan sisa saldo akun riil dari kepengurusan sebelumnya. Cukup ketik nominal, sistem otomatis menempatkan di kolom Debit atau Kredit sesuai Saldo Normal akun.</p>
        <div className="flex items-center gap-2 flex-wrap">
          {draftSavedAt && !isSetup && (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Draft tersimpan
            </span>
          )}
          {draftSavedAt && !isSetup && (
            <button onClick={clearDraft} className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition">Hapus Draft</button>
          )}
        </div>
        {isSetup && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              Tersimpan - {entry?.noJurnal || 'OB-001'}
            </span>
            <button onClick={handleReset} disabled={submitting} className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">Reset</button>
          </div>
        )}
      </div>

      {showSuccess && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">{showSuccess}</div>}
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

      <label className="block max-w-xs">
        <span className="text-xs font-medium text-slate-600 mb-1 block">Tanggal Cutoff</span>
        <DatePicker value={tanggal} onChange={setTanggal} disabled={isSetup} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed" />
      </label>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-28">Kode</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 min-w-60">Nama Akun</th>
                <th className="text-center px-2 py-3 font-semibold text-slate-600 w-16">Normal</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 w-48">Nominal (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([gol, akuns]) => (
                <Fragment key={gol}>
                  <tr className="bg-slate-100/70"><td colSpan={4} className="px-4 py-2 font-bold text-slate-700 text-xs uppercase tracking-wide">{golLabels[gol] || `Golongan ${gol}`}</td></tr>
                  {akuns.map((a, idx) => {
                    const displayVal = amounts[a.id] || '';
                    return (
                      <tr key={a.id} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-emerald-50/30 transition-colors`}>
                        <td className="px-4 py-2 font-mono text-xs text-slate-500 whitespace-nowrap">{a.kode}</td>
                        <td className="px-4 py-2 text-slate-800">{a.nama}</td>
                        <td className="px-2 py-2 text-center"><span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${a.saldoNormal === 'D' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>{a.saldoNormal === 'D' ? 'Debit' : 'Kredit'}</span></td>
                        <td className="px-3 py-1.5"><input type="text" inputMode="numeric" placeholder="0" value={displayVal} disabled={isSetup} onChange={e => handleAmountChange(a.id, e.target.value)} onBlur={() => saveDraft(amounts, tanggal)} className="w-full text-right rounded-lg border border-transparent px-2 py-1.5 text-sm tabular-nums focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300 outline-none bg-transparent hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed" /></td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t-2 border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-6 text-sm">
              <div><span className="text-slate-500">Total Debit:</span> <span className="font-bold text-slate-800 tabular-nums">{fmt(totalDebit)}</span></div>
              <div><span className="text-slate-500">Total Kredit:</span> <span className="font-bold text-slate-800 tabular-nums">{fmt(totalKredit)}</span></div>
              <div><span className="text-slate-500">Selisih:</span> <span className={`font-bold tabular-nums ${Math.abs(selisih) < 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(Math.abs(selisih))}</span></div>
            </div>
            {!isSetup && <button onClick={handleSubmit} disabled={!isBalanced || submitting} className={'px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ' + (isBalanced && !submitting ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md active:scale-[0.97]' : 'bg-slate-200 text-slate-400 cursor-not-allowed')}>{submitting ? 'Menyimpan...' : 'Simpan Saldo Awal'}</button>}
          </div>
          {!isBalanced && !isSetup && cleanRows.length > 0 && <p className="mt-3 text-xs text-red-600 font-medium">Jurnal tidak balance! Periksa kembali nominal yang dimasukkan.</p>}
          {!isBalanced && !isSetup && cleanRows.length === 0 && <p className="mt-3 text-xs text-slate-400 font-medium">Isi minimal satu akun dengan nominal untuk mengaktifkan tombol Simpan.</p>}
        </div>
      </div>

      <div className="p-4 bg-cyan-50 border border-cyan-200/60 rounded-xl text-sm text-cyan-800">
        <p className="font-semibold mb-2">Aturan Saldo Awal</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Hanya akun riil (Golongan 1 Aset, 2 Kewajiban, 3 Ekuitas) yang bisa diisi.</li>
          <li>Akun nominal (Pendapatan dan Beban) tidak ditampilkan karena mulai dari nol.</li>
          <li>Sistem otomatis menempatkan nominal ke kolom Debit atau Kredit sesuai Saldo Normal akun.</li>
          <li>Kode awal 1.x (Aset) = Debit, kecuali Akumulasi Penyusutan (1.3.x) = Kredit.</li>
          <li>Kode awal 2.x (Kewajiban), 3.x (Ekuitas) = Kredit, kecuali Prive = Debit.</li>
          <li>Total Debit harus sama persis dengan Total Kredit.</li>
          <li>Saldo awal disimpan sebagai jurnal khusus <code className="bg-cyan-100 px-1 rounded text-xs">OB-001</code>.</li>
        </ul>
      </div>
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
  const [referensi, setReferensi] = useState('');
  const [lines, setLines] = useState<{ akun_id: string; debit: string; kredit: string; keterangan: string; searchTerm?: string }[]>([
    { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' },
    { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' },
  ]);
  const [showSuccess, setShowSuccess] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<JournalEntry | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [quickAction, setQuickAction] = useState<'penerimaan' | 'pengeluaran' | null>(null);

  function applyQuickAction(type: 'penerimaan' | 'pengeluaran') {
    // Check that Kas & Bank accounts exist in CoA
    const kasBank = coaAccounts.filter(a => a.kode?.startsWith('1.1.01') || a.kode?.startsWith('1.1.02'));
    if (kasBank.length === 0) { setError('Akun Kas/Bank (1.1.01/1.1.02) tidak ditemukan di CoA'); return; }
    setEditingId(null);
    setError('');
    setShowSuccess('');
    setKeterangan('');
    setReferensi('');
    setTanggal(new Date().toISOString().slice(0, 10));
    setLines([
      { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' },
      { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' },
    ]);
    setQuickAction(type);
  }

  function cancelQuickAction() {
    setQuickAction(null);
    setLines([
      { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' },
      { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' },
    ]);
  }

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
        const all: CoAAccount[] = (Array.isArray(coaData) ? coaData : coaData.coa || coaData.accounts || []);
        setCoaAccounts(all.filter((a: CoAAccount) => a.isPostable ?? a.is_postable));
        setEntries(Array.isArray(jurnalData) ? jurnalData : jurnalData.entries || jurnalData.data || []);
      })
      .catch(e => setError(e.message || 'Gagal memuat data'))
      .finally(() => setLoading(false));
  }, []);

  function updateLine(i: number, field: string, val: string) {
    setLines(prev => {
      let next = prev.map((l, idx) => {
        if (idx !== i) return l;
        // Format debit/kredit as currency display (titik separator)
        let storeVal = val;
        if (field === 'debit' || field === 'kredit') {
          storeVal = formatCurrencyDisplay(val);
        }
        const updated = { ...l, [field]: storeVal };
        // Single-side rule: filling debit clears kredit, and vice versa
        if (field === 'debit' && parseCurrencyInput(val) > 0) updated.kredit = '';
        if (field === 'kredit' && parseCurrencyInput(val) > 0) updated.debit = '';
        return updated;
      });
      // Auto-add an empty row when the LAST row starts getting filled
      const last = next[next.length - 1];
      const lastTouched = last.akun_id || last.debit || last.kredit || last.searchTerm;
      if (i === next.length - 1 && lastTouched) {
        next = [...next, { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' }];
      }
      return next;
    });
  }

  function addLine() {
    setLines(prev => [...prev, { akun_id: '', debit: '', kredit: '', keterangan: '' }]);
  }

  function removeLine(i: number) {
    setLines(prev => prev.filter((_, idx) => idx !== i));
  }

  const totalDebit = lines.reduce((s, l) => s + parseCurrencyInput(l.debit), 0);
  const totalKredit = lines.reduce((s, l) => s + parseCurrencyInput(l.kredit), 0);
  const isBalanced = Math.abs(totalDebit - totalKredit) < 0.01;
  const validLines = lines.filter(l => l.akun_id && (parseCurrencyInput(l.debit) > 0 || parseCurrencyInput(l.kredit) > 0));
  const canSubmit = isBalanced && validLines.length >= 2 && !!tanggal && !!keterangan.trim() && !submitting;

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
        referensi: referensi.trim() || undefined,
        lines: validLines.map(l => ({
          akun_id: l.akun_id,
          debit: parseCurrencyInput(l.debit),
          kredit: parseCurrencyInput(l.kredit),
          keterangan: l.keterangan,
        })),
      };
      const res = await fetch(editingId ? '/api/accounting/jurnal-umum/' + editingId : '/api/accounting/jurnal-umum', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (data.message ? data.error + ' — ' + data.message : 'Gagal menyimpan jurnal'));
      const no = data.no_jurnal || data.entry?.no_jurnal || data.jurnal?.no_jurnal || '';
      setShowSuccess(editingId ? ('Jurnal berhasil diperbarui' + (no ? ': ' + no : '')) : (no ? 'Jurnal berhasil disimpan: ' + no : 'Jurnal berhasil disimpan'));
      setEditingId(null);
      setQuickAction(null);
      setKeterangan('');
      setReferensi('');
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

  async function startEdit(entryId: number | string) {
    setError('');
    setShowSuccess('');
    try {
      const res = await fetch('/api/accounting/jurnal-umum/' + entryId, { headers: { Authorization: 'Bearer ' + getToken() } });
      const data = await res.json();
      const j = data.jurnal || data;
      if (!j || j.error) throw new Error(j?.error || 'Gagal memuat jurnal');
      // Pagar UI: hanya GENERAL dan ADJUSTMENT yang bisa diedit (backend juga menolak, ini hanya UX)
      if (j.tipeTransaksi && !['GENERAL', 'ADJUSTMENT'].includes(j.tipeTransaksi)) {
        setError('Jurnal ini (' + j.tipeTransaksi + ') hanya bisa diubah dari modul terkait.');
        return;
      }
      setEditingId(String(entryId));
      setTanggal((j.tanggal || '').slice(0, 10));
      setKeterangan(j.keterangan || '');
      setReferensi(j.referensi || '');
      const loadedLines = (j.lines || []).map((l: any) => ({
        akun_id: l.akunId || l.akun_id || '',
        debit: Number(l.debit) > 0 ? formatCurrencyDisplay(String(Number(l.debit))) : '',
        kredit: Number(l.kredit) > 0 ? formatCurrencyDisplay(String(Number(l.kredit))) : '',
        keterangan: l.keterangan || '',
        searchTerm: '',
      }));
      // Pastikan minimal 2 baris + 1 baris kosong untuk tambah
      while (loadedLines.length < 2) loadedLines.push({ akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' });
      loadedLines.push({ akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' });
      setLines(loadedLines);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setError(e.message || 'Gagal memuat jurnal untuk diedit');
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setQuickAction(null);
    setError('');
    setKeterangan('');
    setReferensi('');
    setTanggal(new Date().toISOString().slice(0, 10));
    setLines([{ akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' }, { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' }]);
  }

  async function handleDelete() {
    if (!deleteModal) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/accounting/jurnal-umum/' + deleteModal.id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + getToken() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (data.message || 'Gagal menghapus jurnal'));
      setShowSuccess('Jurnal ' + deleteModal.no_jurnal + ' berhasil dihapus');
      setDeleteModal(null);
      setConfirmText('');
      if (editingId === String(deleteModal.id)) cancelEdit();
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

      {/* Quick Action Buttons */}
      {!editingId && (
        <div className="flex flex-wrap gap-3">
          {!quickAction ? (
            <>
              <button type="button" onClick={() => applyQuickAction('penerimaan')}
                className="group flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200 px-5 py-3 text-sm font-bold text-emerald-700 transition hover:from-emerald-100 hover:to-cyan-100 hover:border-emerald-300 hover:shadow-md active:scale-[0.97]">
                <svg className="w-5 h-5 text-emerald-600 transition group-hover:scale-110" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Penerimaan Kas
              </button>
              <button type="button" onClick={() => applyQuickAction('pengeluaran')}
                className="group flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 px-5 py-3 text-sm font-bold text-rose-700 transition hover:from-rose-100 hover:to-orange-100 hover:border-rose-300 hover:shadow-md active:scale-[0.97]">
                <svg className="w-5 h-5 text-rose-600 transition group-hover:scale-110" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>
                Pengeluaran Kas
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold ${quickAction === 'penerimaan' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d={quickAction === 'penerimaan' ? 'M12 4.5v15m7.5-7.5h-15' : 'M19.5 12h-15'} /></svg>
                {quickAction === 'penerimaan' ? 'Penerimaan Kas — Debit: Kas/Bank' : 'Pengeluaran Kas — Kredit: Kas/Bank'}
              </span>
              <button type="button" onClick={cancelQuickAction}
                className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                ✕ Batal
              </button>
            </div>
          )}
        </div>
      )}

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
      {showSuccess && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{showSuccess}</div>}

      <form onSubmit={handleSubmit} className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-xl space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Icon d={jurnalIcon} className={'w-5 h-5 ' + (editingId ? 'text-amber-600' : 'text-emerald-600')} />
          <h2 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Jurnal' : 'Form Jurnal Baru'}</h2>
          {editingId && <span className="ml-auto inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Mode Edit</span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal</label>
            <DatePicker value={tanggal} onChange={setTanggal} className={inputCls} required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Keterangan <span className="text-red-400">*</span></label>
            <input type="text" value={keterangan} onChange={e => setKeterangan(e.target.value)} placeholder="Deskripsi transaksi..." className={inputCls} required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">No. Referensi <span className="text-slate-400 font-normal">(opsional)</span></label>
            <input type="text" value={referensi} onChange={e => setReferensi(e.target.value)} placeholder="No. kwitansi/nota" className={inputCls} />
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
                {/* Account picker: searchable dropdown */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder={quickAction && i === 0 ? 'Pilih Kas/Bank...' : 'Cari akun...'}
                    value={line.searchTerm || ''}
                    onChange={e => {
                      const val = e.target.value;
                      updateLine(i, 'searchTerm', val);
                      // If account was selected, clear selection when user edits text
                      if (line.akun_id) {
                        const selected = coaAccounts.find(a => String(a.id) === line.akun_id);
                        const selectedText = selected ? (selected.kode + ' — ' + selected.nama) : '';
                        if (val !== selectedText) { updateLine(i, 'akun_id', ''); }
                      } else {
                        // auto-select if exact match by kode
                        const match = coaAccounts.find(a => a.kode === val || a.nama.toLowerCase() === val.toLowerCase());
                        if (match) { updateLine(i, 'akun_id', String(match.id)); }
                      }
                    }}
                    className={selectCls}
                  />
                  {/* Show dropdown: when typing (normal), or when quickAction row 0 hasn't picked yet */}
                  {((line.searchTerm && line.searchTerm.length > 0 && !line.akun_id) || (quickAction && i === 0 && !line.akun_id)) && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto">
                      {(() => {
                        const q = (line.searchTerm || '').toLowerCase();
                        // Quick Action row 0: filter to Kas & Bank only (1.1.01 / 1.1.02)
                        const pool = quickAction && i === 0
                          ? coaAccounts.filter(a => a.kode?.startsWith('1.1.01') || a.kode?.startsWith('1.1.02'))
                          : coaAccounts;
                        const matches = q ? pool.filter(a => a.kode.includes(q) || a.nama.toLowerCase().includes(q)) : pool;
                        if (matches.length === 0) {
                          return <p className="px-3 py-2 text-sm text-slate-400 italic">{quickAction && i === 0 ? 'Akun Kas/Bank tidak ditemukan' : 'Akun tidak ditemukan'}</p>;
                        }
                        return matches.map(a => (
                          <button
                            key={a.id}
                            type="button"
                            className={'w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition ' + (String(a.id) === line.akun_id ? 'bg-emerald-50 font-medium text-emerald-700' : 'text-slate-700')}
                            onClick={() => {
                              updateLine(i, 'searchTerm', a.kode + ' — ' + a.nama);
                              updateLine(i, 'akun_id', String(a.id));
                            }}
                          >
                            <span className="font-mono text-xs text-slate-400">{a.kode}</span>
                            <span className="ml-2">{a.nama}</span>
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>
              <div className="col-span-3">
                <input type="text" inputMode="numeric" placeholder="0" value={line.debit} disabled={!!(quickAction === 'pengeluaran' && i === 0)} onChange={e => updateLine(i, 'debit', e.target.value)} className={inputCls + (quickAction === 'pengeluaran' && i === 0 ? ' bg-slate-100 text-slate-400 cursor-not-allowed' : '')} />
              </div>
              <div className="col-span-3">
                <input type="text" inputMode="numeric" placeholder="0" value={line.kredit} disabled={!!(quickAction === 'penerimaan' && i === 0)} onChange={e => updateLine(i, 'kredit', e.target.value)} className={inputCls + (quickAction === 'penerimaan' && i === 0 ? ' bg-slate-100 text-slate-400 cursor-not-allowed' : '')} />
              </div>
              <div className="col-span-2 flex gap-1">
                {lines.length > 2 && !(quickAction && i === 0) && (
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
          <div className="flex gap-3 flex-wrap">
            <button type="submit" disabled={!canSubmit}
              className="rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed">
              {submitting ? 'Menyimpan...' : editingId ? 'Perbarui Jurnal' : 'Simpan Jurnal'}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:border-slate-400">
                Batal
              </button>
            )}
          </div>
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
                    <th className="px-5 py-3.5 font-semibold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map(e => {
                    const noJurnal = e.no_jurnal || (e as any).noJurnal || '';
                    const rowTotal = Number((e as any).total) || ((e as any).lines || []).reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
                    const isOpening = noJurnal.startsWith('OB') || (e as any).tipeTransaksi === 'OPENING_BALANCE';
                    return (
                    <tr key={e.id} className={'transition ' + (editingId === String(e.id) ? 'bg-amber-50/60' : 'hover:bg-slate-50/50')}>
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-emerald-700">{noJurnal}</td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(e.tanggal)}</td>
                      <td className="px-5 py-3 text-slate-900">{e.keterangan || '-'}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatRupiah(rowTotal)}</td>
                      <td className="px-5 py-3">
                        {isOpening ? (
                          <span className="block text-center text-xs text-slate-400 italic" title="Saldo Awal hanya bisa diubah dari modul Saldo Awal">Saldo Awal</span>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <button type="button" onClick={() => startEdit(e.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition" title="Edit jurnal">
                              <Icon d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => { setDeleteModal(e); setConfirmText(''); }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition" title="Hapus jurnal">
                              <Icon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setDeleteModal(null); setConfirmText(''); }}>
          <div className="mx-4 w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-2xl backdrop-blur-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <Icon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Hapus Jurnal</h3>
                <p className="text-sm text-slate-500">Hapus jurnal <span className="font-mono font-bold text-red-600">{deleteModal.no_jurnal}</span> — {deleteModal.keterangan?.slice(0, 50) || '-'}</p>
              </div>
            </div>
            <p className="mb-2 text-sm text-slate-700">Ketik <strong className="text-red-600">HAPUS</strong> untuk konfirmasi:</p>
            <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="Ketik HAPUS" autoFocus
              className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-red-400 focus:ring-2 focus:ring-red-500/20 focus:outline-none mb-4" />
            <div className="flex gap-3">
              <button type="button" onClick={() => { setDeleteModal(null); setConfirmText(''); }}
                className="flex-1 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                Batal
              </button>
              <button type="button" disabled={confirmText !== 'HAPUS' || submitting} onClick={handleDelete}
                className="flex-1 rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting ? 'Menghapus...' : 'Hapus Jurnal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppDashboard() {
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPageRaw] = useState<Page>(() => {
    const saved = localStorage.getItem('activePage');
    const valid: Page[] = ['dashboard', 'password', 'langganan', 'profil', 'coa', 'saldo-awal', 'jurnal', 'rincian-saldo', 'buku-besar', 'laba-rugi', 'neraca', 'neraca-saldo', 'arus-kas', 'perubahan-modal', 'aset-tetap', 'tutup-buku', 'calk'];
    return (saved && valid.includes(saved as Page)) ? (saved as Page) : 'dashboard';
  });
  const setPage = (p: Page) => { localStorage.setItem('activePage', p); setPageRaw(p); };
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [dashData, setDashData] = useState<{ totalPemasukan: number; totalPengeluaran: number; saldoKas: number; labaBersih: number; transaksiBulanIni: number; monthly: Array<{ month: string; pemasukan: number; pengeluaran: number }> } | null>(null);

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

  // Fetch dashboard summary when page is dashboard
  useEffect(() => {
    if (page !== 'dashboard' || !user) return;
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    fetch('/api/accounting/dashboard-summary', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { if (!d.error) setDashData(d); })
      .catch(() => {});
  }, [page, user]);

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Memuat...</p>
      </div>
    </div>
  );

  function logout() { localStorage.removeItem('activePage'); localStorage.clear(); sessionStorage.clear(); navigate('/login'); }

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
          <button onClick={() => { setPage('saldo-awal'); setSidebarOpen(false); }}
            className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ' + (page === 'saldo-awal' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800') + (collapsed ? ' justify-center px-0' : '')}>
            <span className="relative">
              <Icon d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
              {page === 'saldo-awal' && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-full" />}
            </span>
            {!collapsed && <span>Saldo Awal</span>}
          </button>
          <button onClick={() => { setPage('jurnal'); setSidebarOpen(false); }}
            className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ' + (page === 'jurnal' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800') + (collapsed ? ' justify-center px-0' : '')}>
            <span className="relative">
              <Icon d={jurnalIcon} />
              {page === 'jurnal' && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-full" />}
            </span>
            {!collapsed && <span>Jurnal Umum</span>}
          </button>
          <button onClick={() => { setPage('rincian-saldo'); setSidebarOpen(false); }}
            className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ' + (page === 'rincian-saldo' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800') + (collapsed ? ' justify-center px-0' : '')}>
            <span className="relative">
              <Icon d="M4 6h16M4 10h16M4 14h10M4 18h10" />
              {page === 'rincian-saldo' && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-full" />}
            </span>
            {!collapsed && <span>Rincian Saldo</span>}
          </button>
          <button onClick={() => { setPage('buku-besar'); setSidebarOpen(false); }}
            className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ' + (page === 'buku-besar' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800') + (collapsed ? ' justify-center px-0' : '')}>
            <span className="relative">
              <Icon d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              {page === 'buku-besar' && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-full" />}
            </span>
            {!collapsed && <span>Buku Besar</span>}
          </button>
          <button onClick={() => { setPage('penyesuaian'); setSidebarOpen(false); }}
            className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ' + (page === 'penyesuaian' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800') + (collapsed ? ' justify-center px-0' : '')}>
            <span className="relative">
              <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9h6m-3-3v6" />
              {page === 'penyesuaian' && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-full" />}
            </span>
            {!collapsed && <span>Jurnal Penyesuaian</span>}
          </button>
          {financeMenus.map((m, i) => (
            m.soon ? (
            <span key={i} className={'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 cursor-not-allowed ' + (collapsed ? 'justify-center px-0' : '')}>
              <Icon d={m.icon} className="w-5 h-5 text-slate-300 shrink-0" />
              {!collapsed && <span className="flex-1">{m.label}</span>}
              {!collapsed && <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-medium">Segera</span>}
            </span>
            ) : (
            <button key={i} onClick={() => { setPage(m.page as Page); setSidebarOpen(false); }}
              className={'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ' + (page === m.page ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800') + (collapsed ? ' justify-center px-0' : '')}>
              {page === m.page && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-full" />}
              <Icon d={m.icon} className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{m.label}</span>}
            </button>
            )
          ))}

          {/* Separator + Tutup Buku */}
          <div className="my-2 border-t border-slate-200/60" />
          {!collapsed && <p className="px-2.5 pb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pengaturan</p>}
          <button onClick={() => { setPage('tutup-buku'); setSidebarOpen(false); }}
            className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ' + (page === 'tutup-buku' ? 'bg-violet-50 text-violet-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800') + (collapsed ? ' justify-center px-0' : '')}>
            <span className="relative">
              <Icon d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              {page === 'tutup-buku' && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-violet-500 rounded-full" />}
            </span>
            {!collapsed && <span>Tutup Buku</span>}
          </button>
        </nav>


      </aside>

      {/* Main */}
      <main className={MAIN_ML + ' min-h-screen transition-all duration-300 ease-in-out'}>
        {/* Header */}
        <header className="sticky top-0 z-50 h-16 bg-white/80 backdrop-blur-md border-b border-slate-100/60 flex items-center gap-3 px-4 sm:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition" aria-label="Buka menu">
            <Icon d="M4 6h16M4 12h16M4 18h16" className="w-6 h-6" />
          </button>
          <h2 className="text-lg font-bold text-slate-900">{page === 'password' ? 'Ubah Password' : page === 'langganan' ? 'Langganan' : page === 'profil' ? 'Profil BUM Desa' : page === 'coa' ? 'Bagan Akun (CoA)' : page === 'saldo-awal' ? 'Setup Saldo Awal' : page === 'jurnal' ? 'Jurnal Umum' : page === 'rekap-jurnal' ? 'Rekap Transaksi Jurnal' : page === 'penyesuaian' ? 'Jurnal Penyesuaian' : page === 'rincian-saldo' ? 'Rincian Saldo' : page === 'buku-besar' ? 'Buku Besar' : page === 'laba-rugi' ? 'Laba Rugi' : page === 'neraca' ? 'Neraca' : page === 'neraca-saldo' ? 'Neraca Saldo' : page === 'arus-kas' ? 'Arus Kas' : page === 'aset-tetap' ? 'Aset & Inventaris' : page === 'tutup-buku' ? 'Tutup Buku Tahunan' : page === 'calk' ? 'CALK' : 'Dashboard'}</h2>
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
          {page === 'password' ? <PasswordForm /> : page === 'langganan' ? <LanggananPage /> : page === 'profil' ? <ProfilPage setPage={setPage} /> : page === 'coa' ? <CoAPage /> : page === 'saldo-awal' ? <SaldoAwalPage /> : page === 'jurnal' ? <JurnalUmumPage /> : page === 'rekap-jurnal' ? <RekapJurnalPage /> : page === 'penyesuaian' ? <JurnalPenyesuaianPage /> : page === 'rincian-saldo' ? <RincianSaldoPage /> : page === 'buku-besar' ? <BukuBesarPage /> : page === 'laba-rugi' ? <LabaRugiPage /> : page === 'neraca' ? <NeracaPage /> : page === 'neraca-saldo' ? <NeracaSaldoPage /> : page === 'arus-kas' ? <ArusKasPage /> : page === 'perubahan-modal' ? <PerubahanModalPage /> : page === 'aset-tetap' ? <AsetTetapPage /> : page === 'tutup-buku' ? <TutupBukuPage /> : page === 'calk' ? <CalkPage /> : (
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
                  { label: 'Total Pemasukan', value: formatRupiah(dashData?.totalPemasukan || 0), trend: 0, d: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', page: 'laba-rugi' as Page },
                  { label: 'Total Pengeluaran', value: formatRupiah(dashData?.totalPengeluaran || 0), trend: 0, d: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6', page: 'laba-rugi' as Page },
                  { label: 'Saldo Kas', value: formatRupiah(dashData?.saldoKas || 0), trend: 0, d: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', page: 'neraca' as Page },
                ].map((s, i) => (
                  <button key={i} onClick={() => setPage(s.page)}
                    className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group text-left cursor-pointer">
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
                    <p className="text-3xl font-semibold text-slate-900 tabular-nums">{s.value}</p>
                    <p className="text-sm font-medium text-slate-500 mt-1">{s.label}</p>
                  </button>
                ))}
              </div>

              {/* Chart — Pemasukan vs Pengeluaran per bulan */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900">Grafik Keuangan</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Ringkasan pemasukan {'\u0026'} pengeluaran {new Date().getFullYear()}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" /> Pemasukan</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded-full bg-gradient-to-r from-red-400 to-rose-500" /> Pengeluaran</span>
                  </div>
                </div>
                {dashData && dashData.monthly.some(m => m.pemasukan > 0 || m.pengeluaran > 0) ? (
                  <div className="h-48 sm:h-56 flex items-end gap-1 sm:gap-2 px-2">
                    {dashData.monthly.map((m, i) => {
                      const maxVal = Math.max(...dashData.monthly.map(x => Math.max(x.pemasukan, x.pengeluaran)), 1);
                      const pH = (m.pemasukan / maxVal) * 100;
                      const eH = (m.pengeluaran / maxVal) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group">
                          <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: '180px' }}>
                            <div className="flex-1 max-w-[12px] rounded-t-sm bg-gradient-to-t from-emerald-500 to-cyan-400 opacity-80 group-hover:opacity-100 transition-opacity" style={{ height: `${Math.max(pH, m.pemasukan > 0 ? 4 : 0)}%` }}
                              title={`Pemasukan: ${formatRupiah(m.pemasukan)}`} />
                            <div className="flex-1 max-w-[12px] rounded-t-sm bg-gradient-to-t from-red-400 to-rose-500 opacity-80 group-hover:opacity-100 transition-opacity" style={{ height: `${Math.max(eH, m.pengeluaran > 0 ? 4 : 0)}%` }}
                              title={`Pengeluaran: ${formatRupiah(m.pengeluaran)}`} />
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">{m.month}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-48 sm:h-56 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2 text-slate-300">
                      <Icon d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" className="w-8 h-8" />
                      <p className="text-sm">Grafik akan tersedia setelah ada data transaksi</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Laba Bersih + Quick Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <button onClick={() => setPage('laba-rugi')}
                  className="bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 text-left cursor-pointer">
                  <p className="text-sm font-medium text-white/70">Laba Bersih Tahun Ini</p>
                  <p className="text-3xl font-bold mt-2 tabular-nums">{formatRupiah(dashData?.labaBersih || 0)}</p>
                  <p className="text-xs text-white/60 mt-2">Klik untuk lihat Laporan Laba Rugi →</p>
                </button>
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">Transaksi Bulan Ini</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">{dashData?.transaksiBulanIni || 0}</p>
                  <button onClick={() => setPage('jurnal')}
                    className="text-xs text-emerald-600 font-semibold mt-2 hover:underline">Input Jurnal →</button>
                </div>
              </div>

              {/* Recent activity — link ke menu utama */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4">Menu Cepat</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Jurnal Umum', page: 'jurnal' as Page, d: jurnalIcon },
                    { label: 'Buku Besar', page: 'buku-besar' as Page, d: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
                    { label: 'Neraca Saldo', page: 'neraca-saldo' as Page, d: 'M10 3H3v18h7v-8h3v8h7V3h-7v6h-3z' },
                    { label: 'Aset Tetap', page: 'aset-tetap' as Page, d: 'M12 2l9 4.5v11L12 22l-9-4.5v-11L12 2z M12 6v6.5 M7.5 9l9 4.5' },
                  ].map((m, i) => (
                    <button key={i} onClick={() => setPage(m.page)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 transition-all duration-200 text-slate-600 cursor-pointer">
                      <Icon d={m.d} className="w-6 h-6" />
                      <span className="text-xs font-semibold text-center">{m.label}</span>
                    </button>
                  ))}
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
