import { useState, useEffect } from 'react';

const ICONS = {
  tag: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  save: 'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  percent: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
};

function Icon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition';

type PricingConfig = {
  monthly: number;
  yearly: number;
  trialDays: number;
  discountPercent: number;
  currency: string;
  note: string;
};

const DEFAULT_CONFIG: PricingConfig = {
  monthly: 100000,
  yearly: 1000000,
  trialDays: 30,
  discountPercent: 17,
  currency: 'IDR',
  note: '',
};

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

export default function PriceSettingsPage() {
  const [config, setConfig] = useState<PricingConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<{ date: string; oldPrice: number; newPrice: number; by: string }[]>([
    { date: '2026-06-13 11:00', oldPrice: 150000, newPrice: 100000, by: 'admin@silabu.ondesa.id' },
  ]);

  useEffect(() => {
    const saved = localStorage.getItem('pricing_config');
    if (saved) setConfig(JSON.parse(saved));
  }, []);

  const effectiveYearly = Math.round(config.monthly * 12 * (1 - config.discountPercent / 100));
  const savings = config.monthly * 12 - effectiveYearly;

  const handleSave = () => {
    setSaving(true);
    const oldConfig = localStorage.getItem('pricing_config');
    const oldPrice = oldConfig ? JSON.parse(oldConfig).monthly : DEFAULT_CONFIG.monthly;

    setTimeout(() => {
      localStorage.setItem('pricing_config', JSON.stringify(config));

      if (oldPrice !== config.monthly) {
        setHistory(prev => [{
          date: new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          oldPrice,
          newPrice: config.monthly,
          by: 'admin@silabu.ondesa.id',
        }, ...prev]);
      }

      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 800);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md">
          <Icon d={ICONS.tag} className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Atur Harga Langganan</h2>
          <p className="text-sm text-slate-500">Konfigurasi pricing BUM Desa — perubahan langsung terlihat di halaman langganan user</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 flex items-start gap-3">
        <Icon d={ICONS.info} className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 leading-relaxed">
          <strong>Perhatian:</strong> Harga yang diatur di sini akan langsung tampil di halaman Langganan user.
          Perubahan harga tidak mempengaruhi langganan yang sudah aktif — hanya berlaku untuk perpanjangan dan langganan baru.
        </div>
      </div>

      {/* Pricing Form */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Icon d={ICONS.tag} className="w-4 h-4 text-emerald-600" />
            Konfigurasi Harga
          </h3>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Currency */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Mata Uang</label>
            <select value={config.currency} onChange={e => setConfig(p => ({ ...p, currency: e.target.value }))}
              className={inputCls}>
              <option value="IDR">IDR — Rupiah Indonesia</option>
              <option value="USD">USD — US Dollar</option>
            </select>
          </div>

          {/* Monthly */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              Harga Bulanan
              <span className="font-normal text-slate-400 ml-2">per BUM Desa per bulan</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">Rp</span>
              <input type="number" value={config.monthly}
                onChange={e => {
                  const m = Number(e.target.value);
                  setConfig(p => ({ ...p, monthly: m, yearly: Math.round(m * 12 * (1 - p.discountPercent / 100)) }));
                }}
                className={inputCls + ' pl-10'}
                min={0} step={10000} />
            </div>
            <p className="text-xs text-slate-400 mt-1">{fmt(config.monthly)} / bulan</p>
          </div>

          {/* Trial Days */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5 flex items-center gap-2">
              <Icon d={ICONS.clock} className="w-4 h-4 text-slate-400" />
              Durasi Trial
              <span className="font-normal text-slate-400 ml-1">hari</span>
            </label>
            <input type="number" value={config.trialDays}
              onChange={e => setConfig(p => ({ ...p, trialDays: Number(e.target.value) }))}
              className={inputCls}
              min={0} max={365} step={1} />
          </div>

          {/* Yearly Discount */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5 flex items-center gap-2">
              <Icon d={ICONS.percent} className="w-4 h-4 text-slate-400" />
              Diskon Tahunan
              <span className="font-normal text-slate-400 ml-1">%</span>
            </label>
            <input type="number" value={config.discountPercent}
              onChange={e => {
                const d = Number(e.target.value);
                setConfig(p => ({ ...p, discountPercent: d, yearly: Math.round(p.monthly * 12 * (1 - d / 100)) }));
              }}
              className={inputCls}
              min={0} max={50} step={1} />
          </div>

          {/* Note */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Catatan (opsional)</label>
            <textarea value={config.note}
              onChange={e => setConfig(p => ({ ...p, note: e.target.value }))}
              className={inputCls + ' resize-none'}
              rows={2}
              placeholder="Contoh: Promo peluncuran, harga khusus wilayah tertentu..." />
          </div>
        </div>
      </div>

      {/* Live Preview */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200 p-5 sm:p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          👁️ Preview Harga (yang dilihat user)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
            <p className="text-sm font-semibold text-slate-500 mb-2">Trial</p>
            <p className="text-3xl font-extrabold text-slate-900">Gratis</p>
            <p className="text-sm text-slate-500 mt-1">{config.trialDays} hari</p>
          </div>
          <div className="bg-white rounded-xl border-2 border-emerald-500 p-5 text-center shadow-md relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full">POPULER</span>
            <p className="text-sm font-semibold text-slate-500 mb-2">Langganan</p>
            <p className="text-3xl font-extrabold text-slate-900">{fmt(config.monthly)}</p>
            <p className="text-sm text-slate-500 mt-1">/bulan</p>
            <p className="text-xs text-emerald-600 font-semibold mt-2">
              Atau {fmt(effectiveYearly)}/tahun (hemat {fmt(savings)})
            </p>
          </div>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Icon d={ICONS.clock} className="w-4 h-4 text-slate-400" />
              Riwayat Perubahan Harga
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {history.map((h, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-4 text-sm">
                <span className="text-slate-400 w-36 shrink-0">{h.date}</span>
                <span className="text-slate-500 line-through">{fmt(h.oldPrice)}</span>
                <span className="text-emerald-600 font-bold">{fmt(h.newPrice)}</span>
                <span className="text-slate-300 ml-auto text-xs">{h.by}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
            saved ? 'bg-emerald-100 text-emerald-700' : 'bg-gradient-to-r from-emerald-500 to-cyan-600 text-white hover:shadow-lg disabled:opacity-50'
          }`}>
          {saved ? <><Icon d={ICONS.check} className="w-4 h-4" /> Tersimpan!</> : saving ? 'Menyimpan...' : <><Icon d={ICONS.save} className="w-4 h-4" /> Simpan Harga</>}
        </button>
        <span className="text-xs text-slate-400">Perubahan langsung terlihat di halaman user</span>
      </div>

      <p className="text-[11px] text-slate-400 text-center pt-2">Atur Harga · SILABU DIGI Super Admin</p>
    </div>
  );
}
