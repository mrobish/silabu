import { useState, useEffect } from 'react';
import { Scale, ChevronDown, ChevronRight, Calendar, CheckCircle, AlertTriangle, TrendingUp, Building2, PiggyBank } from 'lucide-react';

type Akun = { kode: string; nama: string; saldoNormal: string; saldo: number };
type AsetTetap = {
  bruto: { akun: Akun[]; subtotal: number };
  akumulasi: { akun: Akun[]; subtotal: number };
  nilaiBuku: number;
};
type NeracaData = {
  asOf: string;
  aktiva: { asetLancar: { detail: Akun[]; subtotal: number }; asetTetap: AsetTetap; asetLainnya: { detail: Akun[]; subtotal: number }; totalAset: number };
  passiva: { kewajiban: { jangkaPendek: { detail: Akun[]; subtotal: number }; jangkaPanjang: { detail: Akun[]; subtotal: number }; subtotal: number }; ekuitas: { detail: Akun[]; labaBerjalan: number; subtotal: number }; totalPassiva: number };
  isBalanced: boolean;
  selisih: number;
};

const fmt = (v: number) => 'Rp ' + v.toLocaleString('id-ID');
const rupiah = fmt;

function CategoryCard({ icon, title, open, onToggle, children }: { icon: React.ReactNode; title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden transition-all duration-200 shadow-sm">
      <button onClick={onToggle} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors">
        <span className="text-emerald-600">{icon}</span>
        <span className="font-semibold text-slate-800 text-sm flex-1">{title}</span>
        {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-2">{children}</div>}
    </div>
  );
}

function AkunRow({ a }: { a: Akun }) {
  return (
    <div className="flex justify-between items-center py-1 text-sm">
      <span className="text-slate-600"><span className="text-slate-400 text-xs">{a.kode}</span> {a.nama}</span>
      <span className={`tabular-nums font-medium ${a.saldo < 0 ? 'text-red-500' : 'text-slate-700'}`}>{rupiah(a.saldo)}</span>
    </div>
  );
}

function SubTotal({ label, value, className = '' }: { label: string; value: number; className?: string }) {
  return (
    <div className={`flex justify-between items-center py-1.5 border-t border-slate-200 mt-1 ${className}`}>
      <span className="text-xs font-semibold text-slate-600 uppercase">{label}</span>
      <span className="text-sm font-bold tabular-nums text-slate-800">{rupiah(value)}</span>
    </div>
  );
}

function BalanceBanner({ isBalanced, totalAset, totalPassiva, selisih }: { isBalanced: boolean; totalAset: number; totalPassiva: number; selisih: number }) {
  if (isBalanced) {
    return (
      <div className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-3 flex items-center gap-3 shadow-lg shadow-emerald-500/20">
        <CheckCircle size={24} className="shrink-0" />
        <div className="flex-1">
          <p className="font-bold text-base">NERACA SEIMBANG ✓</p>
          <p className="text-xs text-emerald-100">Aktiva {rupiah(totalAset)} = Passiva {rupiah(totalPassiva)}</p>
        </div>
        <Scale size={28} className="opacity-40" />
      </div>
    );
  }
  return (
    <div className="rounded-2xl border-2 border-red-400 bg-gradient-to-r from-red-500 to-rose-600 text-white px-6 py-3 flex items-center gap-3 shadow-lg shadow-red-500/20">
      <AlertTriangle size={24} className="shrink-0" />
      <div className="flex-1">
        <p className="font-bold text-base">TIDAK SEIMBANG ✗</p>
        <p className="text-xs text-red-100">Selisih {rupiah(Math.abs(selisih))} — Aktiva {rupiah(totalAset)} ≠ Passiva {rupiah(totalPassiva)}</p>
      </div>
      <Scale size={28} className="opacity-40" />
    </div>
  );
}

export default function NeracaPage() {
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<NeracaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ lancar: true, tetap: true, lain: true, kewajiban: true, ekuitas: true });

  const token = () => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';

  const fetchData = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/accounting/neraca?end_date=' + endDate, { headers: { Authorization: 'Bearer ' + token() } });
      if (!r.ok) return;
      setData(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const toggle = (k: string) => setExpanded(p => ({ ...p, [k]: !p[k] }));
  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-600">
          <Scale size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Neraca</h2>
          <p className="text-xs text-slate-500">Balance Sheet — Snapshot per tanggal</p>
        </div>
      </div>

      {/* Filter: End date only */}
      <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tanggal Tutup Buku (As of Date)</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls + ' max-w-xs'} />
          </div>
          <div>
            <button type="button" onClick={fetchData} disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:shadow-xl transition disabled:opacity-40 whitespace-nowrap">
              {loading ? 'Memuat...' : 'Tampilkan'}
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <svg className="animate-spin h-8 w-8 mr-3 text-emerald-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          Memuat neraca...
        </div>
      )}

      {!data && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-300 relative z-0">
          <Scale size={64} strokeWidth={1} />
          <p className="mt-4 text-sm text-slate-400">Pilih tanggal dan klik <strong>Tampilkan</strong> untuk melihat neraca.</p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          {/* Balance Banner */}
          <BalanceBanner isBalanced={data.isBalanced} totalAset={data.aktiva.totalAset} totalPassiva={data.passiva.totalPassiva} selisih={data.selisih} />

          {/* Split View: Left (Aktiva) | Right (Passiva) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ── KOLOM KIRI: AKTIVA ── */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 px-1"><Building2 size={16} className="text-emerald-600" /> AKTIVA</h3>

              <CategoryCard icon={<TrendingUp size={16} />} title="Aset Lancar" open={expanded.lancar} onToggle={() => toggle('lancar')}>
                {data.aktiva.asetLancar.detail.filter(a => a.saldo !== 0).length === 0 && <p className="text-xs text-slate-400 italic py-1">Tidak ada aset lancar</p>}
                {data.aktiva.asetLancar.detail.filter(a => a.saldo !== 0).map(a => <AkunRow key={a.kode} a={a} />)}
                <SubTotal label="Subtotal Aset Lancar" value={data.aktiva.asetLancar.subtotal} />
              </CategoryCard>

              <CategoryCard icon={<TrendingUp size={16} />} title="Aset Tetap" open={expanded.tetap} onToggle={() => toggle('tetap')}>
                {data.aktiva.asetTetap.bruto.akun.filter(a => a.saldo !== 0).length === 0 && data.aktiva.asetTetap.akumulasi.akun.filter(a => a.saldo !== 0).length === 0 && <p className="text-xs text-slate-400 italic py-1">Tidak ada aset tetap</p>}
                {/* Bruto (harga perolehan) */}
                {data.aktiva.asetTetap.bruto.akun.filter(a => a.saldo !== 0).map(a => <AkunRow key={a.kode} a={a} />)}
                {data.aktiva.asetTetap.bruto.akun.filter(a => a.saldo !== 0).length > 0 && (
                  <div className="flex justify-between items-center py-1 text-xs text-slate-500 border-t border-dashed border-slate-150 mt-0.5">
                    <span className="italic">Total Harga Perolehan</span>
                    <span className="tabular-nums font-medium">{rupiah(data.aktiva.asetTetap.bruto.subtotal)}</span>
                  </div>
                )}
                {/* Akumulasi Penyusutan — teks merah dalam kurung (pengurang) */}
                {data.aktiva.asetTetap.akumulasi.akun.filter(a => a.saldo !== 0).map(a => (
                  <div key={a.kode} className="flex justify-between items-center py-1 text-sm">
                    <span className="text-red-600"><span className="text-red-300 text-xs">{a.kode}</span> {a.nama}</span>
                    <span className="tabular-nums font-medium text-red-600">({rupiah(Math.abs(a.saldo))})</span>
                  </div>
                ))}
                {/* Nilai Buku = bruto - akumulasi */}
                <SubTotal label="Nilai Buku Aset Tetap" value={data.aktiva.asetTetap.nilaiBuku} />
              </CategoryCard>

              <CategoryCard icon={<TrendingUp size={16} />} title="Aset Lainnya" open={expanded.lain} onToggle={() => toggle('lain')}>
                {data.aktiva.asetLainnya.detail.filter(a => a.saldo !== 0).length === 0 && <p className="text-xs text-slate-400 italic py-1">Tidak ada aset lainnya</p>}
                {data.aktiva.asetLainnya.detail.filter(a => a.saldo !== 0).map(a => <AkunRow key={a.kode} a={a} />)}
                <SubTotal label="Subtotal Aset Lainnya" value={data.aktiva.asetLainnya.subtotal} />
              </CategoryCard>

              <div className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-5 py-3 shadow-md">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm">TOTAL AKTIVA</span>
                  <span className="font-bold text-base tabular-nums">{rupiah(data.aktiva.totalAset)}</span>
                </div>
              </div>
            </div>

            {/* ── KOLOM KANAN: PASSIVA ── */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 px-1"><PiggyBank size={16} className="text-cyan-600" /> PASSIVA</h3>

              <CategoryCard icon={<ChevronDown size={16} />} title="Kewajiban Jangka Pendek" open={expanded.kewajiban} onToggle={() => toggle('kewajiban')}>
                {data.passiva.kewajiban.jangkaPendek.detail.filter(a => a.saldo !== 0).length === 0 && <p className="text-xs text-slate-400 italic py-1">Tidak ada kewajiban pendek</p>}
                {data.passiva.kewajiban.jangkaPendek.detail.filter(a => a.saldo !== 0).map(a => <AkunRow key={a.kode} a={a} />)}
                <SubTotal label="Subtotal Kewajiban Pendek" value={data.passiva.kewajiban.jangkaPendek.subtotal} />
              </CategoryCard>

              <CategoryCard icon={<ChevronDown size={16} />} title="Kewajiban Jangka Panjang" open={expanded.kewajiban} onToggle={() => toggle('kewajiban')}>
                {data.passiva.kewajiban.jangkaPanjang.detail.filter(a => a.saldo !== 0).length === 0 && <p className="text-xs text-slate-400 italic py-1">Tidak ada kewajiban panjang</p>}
                {data.passiva.kewajiban.jangkaPanjang.detail.filter(a => a.saldo !== 0).map(a => <AkunRow key={a.kode} a={a} />)}
                <SubTotal label="Subtotal Kewajiban Panjang" value={data.passiva.kewajiban.jangkaPanjang.subtotal} />
              </CategoryCard>

              {/* Ekuitas + Laba Berjalan */}
              <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
                <div className="flex items-center gap-2.5 px-4 py-2.5">
                  <span className="text-cyan-600"><Building2 size={16} /></span>
                  <span className="font-semibold text-slate-800 text-sm">Ekuitas</span>
                </div>
                <div className="px-4 pb-2">
                  {data.passiva.ekuitas.detail.filter(a => a.saldo !== 0).map(a => <AkunRow key={a.kode} a={a} />)}
                  {/* Laba Berjalan — virtual row dengan highlight */}
                  <div className="flex justify-between items-center py-1.5 bg-blue-50/60 rounded-lg px-2 -mx-2 mt-1">
                    <span className="text-sm font-semibold text-blue-700 flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-blue-500" /> Laba Tahun Berjalan
                    </span>
                    <span className="text-sm font-bold tabular-nums text-blue-700">{rupiah(data.passiva.ekuitas.labaBerjalan)}</span>
                  </div>
                  <SubTotal label="Total Ekuitas" value={data.passiva.ekuitas.subtotal} className="!border-t-2" />
                </div>
              </div>

              <div className="rounded-2xl border-2 border-cyan-400 bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-5 py-3 shadow-md">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm">TOTAL PASSIVA</span>
                  <span className="font-bold text-base tabular-nums">{rupiah(data.passiva.totalPassiva)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Date info */}
          <p className="text-center text-xs text-slate-400 py-2">
            <Calendar size={12} className="inline mr-1" />
            Neraca per tanggal {new Date(data.asOf).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      )}
    </div>
  );
}
