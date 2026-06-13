import { useState } from 'react';

// ── Icons ───────────────────────────────────────────────────────────────────
const I = {
  refresh: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  alert: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  globe: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
  zap: 'M13 10V3L4 14h7v7l9-11h-7z',
  shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  creditCard: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  x: 'M6 18L18 6M6 6l12 12',
  eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  eyeOff: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21',
};

function Icon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

// ── Types ───────────────────────────────────────────────────────────────────
type GatewayStatus = 'active' | 'inactive' | 'unconfigured';

type Gateway = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  priority: number;
  status: GatewayStatus;
  envVars: { key: string; label: string; type: 'text' | 'password'; placeholder: string }[];
  docsUrl: string;
  docsLabel: string;
};

// ── Mock Data ───────────────────────────────────────────────────────────────
const INITIAL_GATEWAYS: Gateway[] = [
  {
    id: 'tripay', name: 'Tripay',
    description: 'Payment gateway Indonesia dengan support VA, E-Wallet, QRIS, dan gerai retail.',
    icon: I.zap, color: 'from-blue-500 to-indigo-600', priority: 1, status: 'active',
    envVars: [
      { key: 'TRIPAY_API_KEY', label: 'API Key', type: 'password', placeholder: 'Isi dari dashboard Tripay' },
      { key: 'TRIPAY_PRIVATE_KEY', label: 'Private Key', type: 'password', placeholder: 'Isi dari dashboard Tripay' },
      { key: 'TRIPAY_MERCHANT_CODE', label: 'Merchant Code', type: 'text', placeholder: 'contoh: T1234' },
    ],
    docsUrl: 'https://tripay.co.id/developer', docsLabel: 'Tripay Developer',
  },
  {
    id: 'midtrans', name: 'Midtrans',
    description: 'Payment gateway dari GoTo Financial. Support SNAP, VA, Credit Card, E-Wallet, QRIS.',
    icon: I.globe, color: 'from-emerald-500 to-teal-600', priority: 2, status: 'inactive',
    envVars: [
      { key: 'MIDTRANS_SERVER_KEY', label: 'Server Key', type: 'password', placeholder: 'Isi dari dashboard Midtrans' },
      { key: 'MIDTRANS_CLIENT_KEY', label: 'Client Key', type: 'text', placeholder: 'Isi dari dashboard Midtrans' },
      { key: 'MIDTRANS_MERCHANT_ID', label: 'Merchant ID', type: 'text', placeholder: 'contoh: G123456789' },
    ],
    docsUrl: 'https://dashboard.sandbox.midtrans.com/settings/config', docsLabel: 'Midtrans Dashboard',
  },
  {
    id: 'xendit', name: 'Xendit',
    description: 'Payment infrastructure untuk Indonesia & Asia Tenggara. VA, E-Wallet, QRIS.',
    icon: I.creditCard, color: 'from-violet-500 to-purple-600', priority: 3, status: 'unconfigured',
    envVars: [
      { key: 'XENDIT_SECRET_KEY', label: 'Secret Key', type: 'password', placeholder: 'Isi dari Xendit Dashboard' },
      { key: 'XENDIT_CALLBACK_URL', label: 'Callback URL', type: 'text', placeholder: 'https://silabu.ondesa.id/api/payment/callback' },
    ],
    docsUrl: 'https://dashboard.xendit.co/settings/developers', docsLabel: 'Xendit Dashboard',
  },
  {
    id: 'doku', name: 'DOKU',
    description: 'Payment gateway lokal Indonesia. VA, kartu kredit, gerai retail, virtual account.',
    icon: I.shield, color: 'from-orange-500 to-amber-600', priority: 4, status: 'unconfigured',
    envVars: [
      { key: 'DOKU_CLIENT_ID', label: 'Client ID', type: 'text', placeholder: 'Isi dari DOKU Dashboard' },
      { key: 'DOKU_SECRET_KEY', label: 'Secret Key', type: 'password', placeholder: 'Isi dari DOKU Dashboard' },
    ],
    docsUrl: 'https://dashboard.doku.com', docsLabel: 'DOKU Dashboard',
  },
  {
    id: 'orderkuota', name: 'Orderkuota',
    description: 'Payment gateway untuk produk digital & tagihan. Pulsa, listrik, BPJS, multi-payment.',
    icon: I.settings, color: 'from-rose-500 to-pink-600', priority: 5, status: 'unconfigured',
    envVars: [
      { key: 'ORDERKUOTA_API_KEY', label: 'API Key', type: 'password', placeholder: 'Isi dari Orderkuota' },
      { key: 'ORDERKUOTA_SECRET', label: 'Secret', type: 'password', placeholder: 'Isi dari Orderkuota' },
    ],
    docsUrl: 'https://orderkuota.com', docsLabel: 'Orderkuota',
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition placeholder:text-slate-300';

// ── Status Badge ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: GatewayStatus }) {
  const c = {
    active: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Aktif' },
    inactive: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Tidak Aktif' },
    unconfigured: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Belum Dikonfigurasi' },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${status === 'active' ? 'animate-pulse' : ''}`} />
      {c.label}
    </span>
  );
}

// ── Config Modal ────────────────────────────────────────────────────────────
function ConfigModal({ gw, onClose, onSave }: { gw: Gateway; onClose: () => void; onSave: (id: string, vals: Record<string, string>) => void }) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    // Pre-fill from localStorage if available
    const saved = localStorage.getItem(`gw_env_${gw.id}`);
    return saved ? JSON.parse(saved) : Object.fromEntries(gw.envVars.map(v => [v.key, '']));
  });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const filledCount = gw.envVars.filter(v => vals[v.key]?.trim()).length;
  const allFilled = filledCount === gw.envVars.length;

  const handleSave = () => {
    localStorage.setItem(`gw_env_${gw.id}`, JSON.stringify(vals));
    onSave(gw.id, vals);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl animate-scale-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-slate-100">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gw.color} text-white flex items-center justify-center shadow-md`}>
            <Icon d={gw.icon} className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900">Konfigurasi {gw.name}</h3>
            <p className="text-xs text-slate-500">Isi environment variables untuk mengaktifkan</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition text-slate-400 hover:text-slate-600">
            <Icon d={I.x} className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${allFilled ? 'bg-emerald-500' : 'bg-amber-400'}`}
                style={{ width: `${(filledCount / gw.envVars.length) * 100}%` }} />
            </div>
            <span className="text-xs font-semibold text-slate-500">{filledCount}/{gw.envVars.length}</span>
          </div>

          {/* Input fields */}
          {gw.envVars.map(v => (
            <div key={v.key}>
              <label className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-slate-700">{v.label}</span>
                <code className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{v.key}</code>
              </label>
              <div className="relative">
                <input
                  type={v.type === 'password' ? (showKeys[v.key] ? 'text' : 'password') : 'text'}
                  value={vals[v.key] || ''}
                  onChange={e => setVals(prev => ({ ...prev, [v.key]: e.target.value }))}
                  placeholder={v.placeholder}
                  className={inputCls + (v.type === 'password' ? ' pr-10' : '')}
                />
                {v.type === 'password' && (
                  <button type="button" onClick={() => setShowKeys(p => ({ ...p, [v.key]: !p[v.key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                    <Icon d={showKeys[v.key] ? I.eyeOff : I.eye} className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200/60 rounded-xl p-3 flex items-start gap-2.5">
            <Icon d={I.alert} className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Variabel ini akan disimpan di <code className="bg-blue-100 px-1 rounded">.env</code> server.
              Pastikan mengisi semua field sebelum mengaktifkan gateway.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-slate-100">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
            Batal
          </button>
          <a href={gw.docsUrl} target="_blank" rel="noopener noreferrer"
            className="px-4 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center gap-2">
            <Icon d={I.globe} className="w-4 h-4" />
            Docs
          </a>
          <button onClick={handleSave} disabled={!allFilled}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${allFilled
              ? 'bg-gradient-to-r from-emerald-500 to-cyan-600 text-white hover:shadow-lg'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
            Simpan & Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Gateway Card ────────────────────────────────────────────────────────────
function GatewayCard({ gw, onToggle, onConfigure, anyActive }: {
  gw: Gateway; onToggle: (id: string) => void; onConfigure: (gw: Gateway) => void; anyActive: boolean;
}) {
  const isActive = gw.status === 'active';
  const isDisabled = gw.status === 'unconfigured';
  const canActivate = !isActive && !isDisabled && !anyActive;

  return (
    <div className={`relative bg-white rounded-2xl border transition-all duration-300 hover:shadow-lg ${isActive ? 'border-emerald-300 shadow-md ring-1 ring-emerald-200' : 'border-slate-100 shadow-sm'}`}>
      <div className="absolute -top-2 -left-2 w-7 h-7 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-[11px] font-bold shadow-md">
        #{gw.priority}
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${gw.color} text-white flex items-center justify-center shadow-lg`}>
            <Icon d={gw.icon} className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900">{gw.name}</h3>
              <StatusBadge status={gw.status} />
            </div>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">{gw.description}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {gw.envVars.map(v => (
            <code key={v.key} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">{v.key}</code>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          {isActive ? (
            <button onClick={() => onToggle(gw.id)}
              className="flex-1 sm:flex-none px-5 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all duration-200">
              ⏻ Nonaktifkan
            </button>
          ) : (
            <button onClick={() => onToggle(gw.id)} disabled={!canActivate}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${canActivate ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
              title={isDisabled ? 'Konfigurasi environment variables terlebih dahulu' : anyActive ? 'Nonaktifkan gateway aktif terlebih dahulu' : ''}>
              ✓ Aktifkan
            </button>
          )}

          <a href={gw.docsUrl} target="_blank" rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition border border-transparent hover:border-slate-200"
            title="Dokumentasi">
            <Icon d={I.globe} className="w-4 h-4" />
          </a>

          <button onClick={() => onConfigure(gw)}
            className="px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition border border-transparent hover:border-emerald-200"
            title="Konfigurasi Environment Variables">
            <Icon d={I.settings} className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function PaymentGatewaysPage() {
  const [gateways, setGateways] = useState<Gateway[]>(() => {
    // Restore configured status from localStorage
    return INITIAL_GATEWAYS.map(g => {
      const saved = localStorage.getItem(`gw_env_${g.id}`);
      if (saved) {
        const vals = JSON.parse(saved);
        const allFilled = g.envVars.every(v => vals[v.key]?.trim());
        if (allFilled && g.status === 'unconfigured') return { ...g, status: 'inactive' };
      }
      return g;
    });
  });
  const [configuring, setConfiguring] = useState<Gateway | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const activeGateway = gateways.find(g => g.status === 'active');
  const anyActive = !!activeGateway;

  const handleToggle = (id: string) => {
    setGateways(prev => prev.map(g => {
      if (g.id === id) return { ...g, status: g.status === 'active' ? 'inactive' : 'active' };
      if (g.status === 'active') return { ...g, status: 'inactive' };
      return g;
    }));
  };

  const handleSaveConfig = (id: string, _vals: Record<string, string>) => {
    // After saving, update status from unconfigured to inactive if all filled
    setGateways(prev => prev.map(g => {
      if (g.id === id && g.status === 'unconfigured') return { ...g, status: 'inactive' };
      return g;
    }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center shadow-md">
              <Icon d={I.creditCard} className="w-5 h-5" />
            </div>
            Payment Gateways
          </h2>
          <p className="text-sm text-slate-500 mt-1 ml-[46px]">Kelola jalur pembayaran invoice langganan BUM Desa</p>
        </div>
        <div className="flex gap-2 ml-[46px] sm:ml-0">
          <button onClick={() => { setInitializing(true); setTimeout(() => setInitializing(false), 1500); }}
            disabled={initializing}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:shadow-sm transition-all duration-200 flex items-center gap-2">
            <Icon d={I.settings} className={`w-4 h-4 ${initializing ? 'animate-spin' : ''}`} />
            {initializing ? 'Initializing...' : 'Initialize'}
          </button>
          <button onClick={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); }}
            disabled={refreshing}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:shadow-sm transition-all duration-200 flex items-center gap-2">
            <Icon d={I.refresh} className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200/60 rounded-2xl p-4 flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 mt-0.5">
          <Icon d={I.alert} className="w-5 h-5" />
        </div>
        <div className="flex-1 text-sm text-blue-800 leading-relaxed">
          <strong className="font-bold">Informasi Penting:</strong> Hanya satu payment gateway yang dapat aktif pada satu waktu.
          Konfigurasi dilakukan melalui tombol <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white rounded border border-slate-200 text-slate-600"><Icon d={I.settings} className="w-3 h-3" /> Konfigurasi</span> pada setiap gateway.
          {activeGateway && (
            <span className="block mt-2 font-semibold text-emerald-700">✅ Gateway aktif: {activeGateway.name} (Priority #{activeGateway.priority})</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 p-3.5 text-center shadow-sm">
          <p className="text-2xl font-bold text-slate-900">{gateways.length}</p>
          <p className="text-[11px] font-medium text-slate-500 mt-0.5">Total Gateway</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-100 p-3.5 text-center shadow-sm">
          <p className="text-2xl font-bold text-emerald-600">{gateways.filter(g => g.status === 'active').length}</p>
          <p className="text-[11px] font-medium text-slate-500 mt-0.5">Aktif</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-100 p-3.5 text-center shadow-sm">
          <p className="text-2xl font-bold text-amber-600">{gateways.filter(g => g.status === 'unconfigured').length}</p>
          <p className="text-[11px] font-medium text-slate-500 mt-0.5">Belum Siap</p>
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {gateways.sort((a, b) => a.priority - b.priority).map(gw => (
          <GatewayCard key={gw.id} gw={gw} onToggle={handleToggle} onConfigure={setConfiguring} anyActive={anyActive && activeGateway?.id !== gw.id} />
        ))}
      </div>

      {/* Config Modal */}
      {configuring && (
        <ConfigModal gw={configuring} onClose={() => setConfiguring(null)} onSave={handleSaveConfig} />
      )}

      <p className="text-[11px] text-slate-400 text-center pt-2">Payment Gateway · SILABU DIGI</p>
    </div>
  );
}
