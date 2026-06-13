import { useState } from 'react';

// ── Icons (inline SVG paths) ────────────────────────────────────────────────
const ICONS = {
  refresh: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  x: 'M6 18L18 6M6 6l12 12',
  alert: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  globe: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
  zap: 'M13 10V3L4 14h7v7l9-11h-7z',
  shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  creditCard: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
};

// ── Icon Component ──────────────────────────────────────────────────────────
function Icon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// ── Types ───────────────────────────────────────────────────────────────────
type GatewayStatus = 'active' | 'inactive' | 'unconfigured';

type Gateway = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bgGradient: string;
  priority: number;
  status: GatewayStatus;
  envVars: string[];
  docsUrl: string;
};

// ── Mock Data ───────────────────────────────────────────────────────────────
const INITIAL_GATEWAYS: Gateway[] = [
  {
    id: 'tripay',
    name: 'Tripay',
    description: 'Payment gateway Indonesia dengan support VA, E-Wallet, QRIS, dan gerai retail. Cocok untuk transaksi BUM Desa.',
    icon: ICONS.zap,
    color: 'from-blue-500 to-indigo-600',
    bgGradient: 'from-blue-50 to-indigo-50',
    priority: 1,
    status: 'active',
    envVars: ['TRIPAY_API_KEY', 'TRIPAY_PRIVATE_KEY', 'TRIPAY_MERCHANT_CODE'],
    docsUrl: 'https://tripay.co.id',
  },
  {
    id: 'midtrans',
    name: 'Midtrans',
    description: 'Payment gateway dari GoTo Financial. Support SNAP, VA, Credit Card, E-Wallet, dan QRIS.',
    icon: ICONS.globe,
    color: 'from-emerald-500 to-teal-600',
    bgGradient: 'from-emerald-50 to-teal-50',
    priority: 2,
    status: 'inactive',
    envVars: ['MIDTRANS_SERVER_KEY', 'MIDTRANS_CLIENT_KEY', 'MIDTRANS_MERCHANT_ID'],
    docsUrl: 'https://midtrans.com',
  },
  {
    id: 'xendit',
    name: 'Xendit',
    description: 'Payment infrastructure untuk Indonesia dan Asia Tenggara. Support VA, E-Wallet, QRIS, dan retail outlet.',
    icon: ICONS.creditCard,
    color: 'from-violet-500 to-purple-600',
    bgGradient: 'from-violet-50 to-purple-50',
    priority: 3,
    status: 'unconfigured',
    envVars: ['XENDIT_SECRET_KEY', 'XENDIT_CALLBACK_URL'],
    docsUrl: 'https://xendit.co',
  },
  {
    id: 'doku',
    name: 'DOKU',
    description: 'Payment gateway lokal Indonesia. Layanan VA, kartu kredit, gerai retail, dan virtual account.',
    icon: ICONS.shield,
    color: 'from-orange-500 to-amber-600',
    bgGradient: 'from-orange-50 to-amber-50',
    priority: 4,
    status: 'unconfigured',
    envVars: ['DOKU_CLIENT_ID', 'DOKU_SECRET_KEY'],
    docsUrl: 'https://doku.com',
  },
  {
    id: 'orderkuota',
    name: 'Orderkuota',
    description: 'Payment gateway untuk produk digital dan tagihan. Support pulsa, listrik, BPJS, dan multi-payment.',
    icon: ICONS.settings,
    color: 'from-rose-500 to-pink-600',
    bgGradient: 'from-rose-50 to-pink-50',
    priority: 5,
    status: 'unconfigured',
    envVars: ['ORDERKUOTA_API_KEY', 'ORDERKUOTA_SECRET'],
    docsUrl: 'https://orderkuota.com',
  },
];

// ── Status Badge ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: GatewayStatus }) {
  const config = {
    active: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Aktif' },
    inactive: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Tidak Aktif' },
    unconfigured: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Belum Dikonfigurasi' },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${status === 'active' ? 'animate-pulse' : ''}`} />
      {config.label}
    </span>
  );
}

// ── Gateway Card ────────────────────────────────────────────────────────────
function GatewayCard({
  gw,
  onToggle,
  anyActive,
}: {
  gw: Gateway;
  onToggle: (id: string) => void;
  anyActive: boolean;
}) {
  const isActive = gw.status === 'active';
  const isDisabled = gw.status === 'unconfigured';
  const canDeactivate = isActive; // can always deactivate an active one
  const canActivate = !isActive && !isDisabled && !anyActive; // only if no other is active and this is configured

  return (
    <div className={`relative bg-white rounded-2xl border transition-all duration-300 hover:shadow-lg ${isActive ? 'border-emerald-300 shadow-md ring-1 ring-emerald-200' : 'border-slate-100 shadow-sm'}`}>
      {/* Priority badge */}
      <div className="absolute -top-2 -left-2 w-7 h-7 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-[11px] font-bold shadow-md">
        #{gw.priority}
      </div>

      <div className="p-5 sm:p-6">
        {/* Top row: icon + info + status */}
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${gw.color} text-white flex items-center justify-center shadow-lg`}>
            <Icon d={gw.icon} className="w-6 h-6" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900">{gw.name}</h3>
              <StatusBadge status={gw.status} />
            </div>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">{gw.description}</p>
          </div>
        </div>

        {/* Env vars hint */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {gw.envVars.map(v => (
            <code key={v} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
              {v}
            </code>
          ))}
        </div>

        {/* Action row */}
        <div className="mt-4 flex items-center gap-3">
          {isActive ? (
            <button
              onClick={() => onToggle(gw.id)}
              className="flex-1 sm:flex-none px-5 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all duration-200"
            >
              ⏻ Nonaktifkan
            </button>
          ) : (
            <button
              onClick={() => onToggle(gw.id)}
              disabled={!canActivate}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                canActivate
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
              title={isDisabled ? 'Konfigurasi environment variables terlebih dahulu' : anyActive ? 'Nonaktifkan gateway aktif terlebih dahulu' : ''}
            >
              ✓ Aktifkan
            </button>
          )}

          <a
            href={gw.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition border border-transparent hover:border-slate-200"
            title="Dokumentasi"
          >
            <Icon d={ICONS.globe} className="w-4 h-4" />
          </a>

          <button
            className="px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition border border-transparent hover:border-slate-200"
            title="Pengaturan"
          >
            <Icon d={ICONS.settings} className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function PaymentGatewaysPage() {
  const [gateways, setGateways] = useState<Gateway[]>(INITIAL_GATEWAYS);
  const [initializing, setInitializing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const activeGateway = gateways.find(g => g.status === 'active');
  const anyActive = !!activeGateway;

  const handleToggle = (id: string) => {
    setGateways(prev =>
      prev.map(g => {
        if (g.id === id) {
          // Toggle this one
          return { ...g, status: g.status === 'active' ? 'inactive' : 'active' };
        }
        // Deactivate all others if activating this one
        if (g.status === 'active') {
          return { ...g, status: 'inactive' };
        }
        return g;
      })
    );
  };

  const handleInitialize = () => {
    setInitializing(true);
    setTimeout(() => setInitializing(false), 1500);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center shadow-md">
              <Icon d={ICONS.creditCard} className="w-5 h-5" />
            </div>
            Payment Gateways
          </h2>
          <p className="text-sm text-slate-500 mt-1 ml-[46px]">
            Kelola jalur pembayaran invoice langganan BUM Desa
          </p>
        </div>
        <div className="flex gap-2 ml-[46px] sm:ml-0">
          <button
            onClick={handleInitialize}
            disabled={initializing}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:shadow-sm transition-all duration-200 flex items-center gap-2"
          >
            <Icon d={ICONS.settings} className={`w-4 h-4 ${initializing ? 'animate-spin' : ''}`} />
            {initializing ? 'Initializing...' : 'Initialize'}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:shadow-sm transition-all duration-200 flex items-center gap-2"
          >
            <Icon d={ICONS.refresh} className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Info Banner ────────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200/60 rounded-2xl p-4 flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 mt-0.5">
          <Icon d={ICONS.alert} className="w-5 h-5" />
        </div>
        <div className="flex-1 text-sm text-blue-800 leading-relaxed">
          <strong className="font-bold">Informasi Penting:</strong> Hanya satu payment gateway yang dapat aktif pada satu waktu.
          Konfigurasi payment gateway dilakukan melalui Environment Variables (.env). Pastikan variabel sudah terisi sebelum mengaktifkan.
          {activeGateway && (
            <span className="block mt-2 font-semibold text-emerald-700">
              ✅ Gateway aktif: {activeGateway.name} (Priority #{activeGateway.priority})
            </span>
          )}
        </div>
      </div>

      {/* ── Summary Stats ──────────────────────────────────────────── */}
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

      {/* ── Gateway Cards ──────────────────────────────────────────── */}
      <div className="space-y-4">
        {gateways
          .sort((a, b) => a.priority - b.priority)
          .map(gw => (
            <GatewayCard
              key={gw.id}
              gw={gw}
              onToggle={handleToggle}
              anyActive={anyActive && activeGateway?.id !== gw.id}
            />
          ))}
      </div>

      {/* ── Footer hint ────────────────────────────────────────────── */}
      <p className="text-[11px] text-slate-400 text-center pt-2">
        Payment Gateway · SILABU DIGI · Konfigurasi melalui .env
      </p>
    </div>
  );
}
