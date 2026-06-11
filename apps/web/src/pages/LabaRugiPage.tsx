import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ChevronDown, ChevronRight, DollarSign, Calendar, BarChart4, Receipt, Printer } from 'lucide-react';
import ReportPrintLayout from './ReportPrintLayout';

type AkunSaldo = { kode: string; nama: string; saldoNormal: string; saldo: number };
type LabaRugiData = {
  periode: { startDate: string | null; endDate: string | null };
  pendapatanOperasional: { jasa: AkunSaldo[]; dagang: AkunSaldo[]; subtotal: number };
  hpp: { detail: AkunSaldo[]; subtotal: number };
  labaKotor: number;
  bebanOperasional: { detail: AkunSaldo[]; subtotal: number };
  labaOperasional: number;
  nonOperasional: { pendapatanLain: { detail: AkunSaldo[]; subtotal: number }; bebanLain: { detail: AkunSaldo[]; subtotal: number } };
  labaSebelumPajak: number;
  pajak: { detail: AkunSaldo[]; subtotal: number };
  labaBersih: number;
};

const fmt = (v: number) => 'Rp ' + Math.abs(v).toLocaleString('id-ID');
const sectionCls = 'rounded-2xl border border-slate-100 bg-white overflow-hidden transition-all duration-200';

function CollapseSection({ icon, title, open, onToggle, children }: { icon: React.ReactNode; title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className={sectionCls}>
      <button onClick={onToggle} className="flex items-center gap-2.5 w-full px-5 py-3 text-left hover:bg-slate-50 transition-colors">
        <span className="text-emerald-600">{icon}</span>
        <span className="font-semibold text-slate-800 flex-1">{title}</span>
        {open ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
      </button>
      {open && <div className="px-5 pb-3">{children}</div>}
    </div>
  );
}

function SubTotalRow({ label, value, className = '' }: { label: string; value: number; className?: string }) {
  return (
    <div className={`flex justify-between items-center py-2 border-t border-slate-200 ${className}`}>
      <span className="font-semibold text-slate-700">{label}</span>
      <span className={`font-semibold tabular-nums ${value < 0 ? 'text-red-600' : 'text-slate-800'}`}>
        {value < 0 ? '(' + fmt(value) + ')' : fmt(value)}
      </span>
    </div>
  );
}

function AkunRow({ a, indent = false }: { a: AkunSaldo; indent?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-1.5 text-sm ${indent ? 'ml-4' : ''}`}>
      <span className="text-slate-600"><span className="text-slate-400 text-xs">{a.kode}</span> {a.nama}</span>
      <span className={`tabular-nums font-medium ${a.saldo < 0 ? 'text-red-500' : 'text-slate-700'}`}>
        {a.saldo !== 0 ? fmt(a.saldo) : '-'
        }</span>
    </div>
  );
}

export default function LabaRugiPage() {
  const now = new Date();
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [data, setData] = useState<LabaRugiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    pendapatan: true, hpp: true, beban: true, nonop: true, pajak: true,
  });
  const [printOpen, setPrintOpen] = useState(false);

  const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const fmtIdDate = (d: string) => { const p = d.split('-'); return `${parseInt(p[2])} ${MONTHS_ID[parseInt(p[1]) - 1]} ${p[0]}`; };
  const isFullYear = startDate.endsWith('-01-01') && endDate.endsWith('-12-31');
  const periodLabel = isFullYear
    ? `Untuk Tahun yang Berakhir Pada ${fmtIdDate(endDate)}`
    : `Periode: ${fmtIdDate(startDate)} s/d ${fmtIdDate(endDate)}`;

  const fetchData = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const t = localStorage.getItem('accessToken') || '';
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const qs = params.toString();
      const r = await fetch('/api/accounting/laba-rugi' + (qs ? '?' + qs : ''), { headers: { Authorization: 'Bearer ' + t } });
      if (!r.ok) return;
      const j = await r.json();
      setData(j);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggle = (k: string) => setExpanded(prev => ({ ...prev, [k]: !prev[k] }));

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-600">
          <BarChart4 size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Laporan Laba Rugi</h2>
          <p className="text-xs text-slate-500">Multi-step format standar Kepmendes 136/2022</p>
        </div>
      </div>

      {/* Filter */}
      <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Dari Tanggal</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Sampai Tanggal</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <button type="button" onClick={fetchData} disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:shadow-xl transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
              {loading ? 'Memuat...' : 'Tampilkan'}
            </button>
          </div>
          <div>
            <button type="button" onClick={() => setPrintOpen(true)} disabled={!data}
              className="w-full rounded-2xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:border-emerald-300 hover:bg-emerald-50 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-2">
              <Printer size={16} />
              Cetak
            </button>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!data && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-300">
          <Receipt size={64} strokeWidth={1} />
          <p className="mt-4 text-sm text-slate-400">Pilih periode dan klik <strong>Tampilkan</strong> untuk melihat laporan.</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <svg className="animate-spin h-8 w-8 mr-3 text-emerald-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          Memuat laporan...
        </div>
      )}

      {data && !loading && (
        <div className="space-y-3">
          {/* A. PENDAPATAN OPERASIONAL */}
          <CollapseSection icon={<TrendingUp size={18} />} title="A. Pendapatan Operasional" open={expanded.pendapatan} onToggle={() => toggle('pendapatan')}>
            {data.pendapatanOperasional.jasa.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Pendapatan Jasa</p>
                {data.pendapatanOperasional.jasa.filter(a => a.saldo !== 0).map(a => <AkunRow key={a.kode} a={a} indent />)}
              </div>
            )}
            {data.pendapatanOperasional.dagang.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Pendapatan Penjualan</p>
                {data.pendapatanOperasional.dagang.filter(a => a.saldo !== 0).map(a => <AkunRow key={a.kode} a={a} indent />)}
              </div>
            )}
            <SubTotalRow label="Subtotal Pendapatan Operasional" value={data.pendapatanOperasional.subtotal} />
          </CollapseSection>

          {/* B. HPP */}
          <CollapseSection icon={<TrendingDown size={18} />} title="B. Harga Pokok Penjualan" open={expanded.hpp} onToggle={() => toggle('hpp')}>
            {data.hpp.detail.filter(a => a.saldo !== 0).map(a => <AkunRow key={a.kode} a={a} />)}
            {data.hpp.detail.filter(a => a.saldo !== 0).length === 0 && <p className="text-sm text-slate-400 italic">Tidak ada transaksi HPP</p>}
            <SubTotalRow label="Subtotal HPP" value={data.hpp.subtotal} />
          </CollapseSection>

          {/* C. LABA KOTOR */}
          <div className={`${sectionCls} border-emerald-200 bg-emerald-50/40`}>
            <div className="flex justify-between items-center px-5 py-3">
              <span className="font-bold text-emerald-800">C. Laba Kotor Operasional</span>
              <span className="font-bold text-lg tabular-nums text-emerald-700">{fmt(data.labaKotor)}</span>
            </div>
          </div>

          {/* D. BEBAN OPERASIONAL */}
          <CollapseSection icon={<TrendingDown size={18} />} title="D. Beban Operasional" open={expanded.beban} onToggle={() => toggle('beban')}>
            {data.bebanOperasional.detail.filter(a => a.saldo !== 0).length === 0 && (
              <p className="text-sm text-slate-400 italic">Tidak ada beban operasional</p>
            )}
            {data.bebanOperasional.detail.filter(a => a.saldo !== 0).map(a => <AkunRow key={a.kode} a={a} />)}
            <SubTotalRow label="Subtotal Beban Operasional" value={data.bebanOperasional.subtotal} />
          </CollapseSection>

          {/* E. LABA OPERASIONAL */}
          <div className={`${sectionCls} border-cyan-200 bg-cyan-50/40`}>
            <div className="flex justify-between items-center px-5 py-3">
              <span className="font-bold text-cyan-800">E. Laba Operasional</span>
              <span className="font-bold text-lg tabular-nums text-cyan-700">{fmt(data.labaOperasional)}</span>
            </div>
          </div>

          {/* F. NON-OPERASIONAL */}
          <CollapseSection icon={<DollarSign size={18} />} title="F. Pendapatan & Beban Non-Operasional" open={expanded.nonop} onToggle={() => toggle('nonop')}>
            <div className="mb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Pendapatan Lain-lain</p>
              {data.nonOperasional.pendapatanLain.detail.filter(a => a.saldo !== 0).length === 0
                ? <p className="text-sm text-slate-400 italic ml-4">Tidak ada pendapatan lain</p>
                : data.nonOperasional.pendapatanLain.detail.filter(a => a.saldo !== 0).map(a => <AkunRow key={a.kode} a={a} indent />)}
              <SubTotalRow label="Subtotal Pendapatan Lain" value={data.nonOperasional.pendapatanLain.subtotal} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Beban Lain-lain</p>
              {data.nonOperasional.bebanLain.detail.filter(a => a.saldo !== 0).length === 0
                ? <p className="text-sm text-slate-400 italic ml-4">Tidak ada beban lain</p>
                : data.nonOperasional.bebanLain.detail.filter(a => a.saldo !== 0).map(a => <AkunRow key={a.kode} a={a} indent />)}
              <SubTotalRow label="Subtotal Beban Lain" value={data.nonOperasional.bebanLain.subtotal} />
            </div>
          </CollapseSection>

          {/* G. LABA SEBELUM PAJAK */}
          <div className={`${sectionCls} border-blue-200 bg-blue-50/40`}>
            <div className="flex justify-between items-center px-5 py-3">
              <span className="font-bold text-blue-800">G. Laba / Rugi Sebelum Pajak</span>
              <span className={`font-bold text-lg tabular-nums ${data.labaSebelumPajak < 0 ? 'text-red-600' : 'text-blue-700'}`}>
                {fmt(data.labaSebelumPajak)}
              </span>
            </div>
          </div>

          {/* H. PAJAK */}
          <CollapseSection icon={<TrendingDown size={18} />} title="H. Beban Pajak" open={expanded.pajak} onToggle={() => toggle('pajak')}>
            {data.pajak.detail.filter(a => a.saldo !== 0).length === 0
              ? <p className="text-sm text-slate-400 italic">Tidak ada beban pajak</p>
              : data.pajak.detail.filter(a => a.saldo !== 0).map(a => <AkunRow key={a.kode} a={a} />)}
            <SubTotalRow label="Subtotal Pajak" value={data.pajak.subtotal} />
          </CollapseSection>

          {/* GRAND TOTAL: LABA BERSIH */}
          <div className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-lg">
            <div className="flex justify-between items-center px-6 py-4">
              <div className="flex items-center gap-2">
                <BarChart4 size={22} />
                <span className="font-bold text-base">LABA BERSIH SETELAH PAJAK</span>
              </div>
              <span className="font-bold text-xl tabular-nums">{fmt(data.labaBersih)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      <ReportPrintLayout title="LAPORAN LABA RUGI" isOpen={printOpen} onClose={() => setPrintOpen(false)} periodLabel={periodLabel}>
        {data && <div className="space-y-0">
          {/* Header label baris */}
          <div className="flex justify-between border-b border-slate-800 pb-1 mb-3 font-bold text-[11px]">
            <span>Akun</span>
            <span>Jumlah (Rp)</span>
          </div>

          {/* A. PENDAPATAN */}
          <p className="font-bold text-[11px] mt-2 mb-0.5">A. Pendapatan Operasional</p>
          {data.pendapatanOperasional.jasa.filter(a => a.saldo !== 0).map(a => (
            <div key={a.kode} className="flex justify-between text-[11px] py-0.5">
              <span className="text-slate-700 ml-3"><span className="text-slate-400">{a.kode}</span> {a.nama}</span>
              <span className="tabular-nums">{fmt(a.saldo)}</span>
            </div>
          ))}
          {data.pendapatanOperasional.dagang.filter(a => a.saldo !== 0).map(a => (
            <div key={a.kode} className="flex justify-between text-[11px] py-0.5">
              <span className="text-slate-700 ml-3"><span className="text-slate-400">{a.kode}</span> {a.nama}</span>
              <span className="tabular-nums">{fmt(a.saldo)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-[11px] border-t border-slate-400 py-0.5 mt-0.5">
            <span>Subtotal Pendapatan Operasional</span>
            <span className="tabular-nums">{fmt(data.pendapatanOperasional.subtotal)}</span>
          </div>

          {/* B. HPP */}
          <p className="font-bold text-[11px] mt-2 mb-0.5">B. Harga Pokok Penjualan</p>
          {data.hpp.detail.filter(a => a.saldo !== 0).map(a => (
            <div key={a.kode} className="flex justify-between text-[11px] py-0.5">
              <span className="text-slate-700 ml-3"><span className="text-slate-400">{a.kode}</span> {a.nama}</span>
              <span className="tabular-nums">{fmt(a.saldo)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-[11px] border-t border-slate-400 py-0.5">
            <span>Subtotal HPP</span>
            <span className="tabular-nums">{fmt(data.hpp.subtotal)}</span>
          </div>

          {/* C. LABA KOTOR */}
          <div className="flex justify-between font-bold text-[11px] border-t-2 border-slate-800 mt-1 py-0.5">
            <span>C. Laba Kotor Operasional</span>
            <span className="tabular-nums">{fmt(data.labaKotor)}</span>
          </div>

          {/* D. BEBAN OPERASIONAL */}
          <p className="font-bold text-[11px] mt-2 mb-0.5">D. Beban Operasional</p>
          {data.bebanOperasional.detail.filter(a => a.saldo !== 0).map(a => (
            <div key={a.kode} className="flex justify-between text-[11px] py-0.5">
              <span className="text-slate-700 ml-3"><span className="text-slate-400">{a.kode}</span> {a.nama}</span>
              <span className="tabular-nums">{fmt(a.saldo)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-[11px] border-t border-slate-400 py-0.5">
            <span>Subtotal Beban Operasional</span>
            <span className="tabular-nums">{fmt(data.bebanOperasional.subtotal)}</span>
          </div>

          {/* E. LABA OPERASIONAL */}
          <div className="flex justify-between font-bold text-[11px] border-t-2 border-slate-800 mt-1 py-0.5">
            <span>E. Laba Operasional</span>
            <span className="tabular-nums">{fmt(data.labaOperasional)}</span>
          </div>

          {/* F. NON-OPERASIONAL */}
          <p className="font-bold text-[11px] mt-2 mb-0.5">F. Pendapatan &amp; Beban Non-Operasional</p>
          {data.nonOperasional.pendapatanLain.detail.filter(a => a.saldo !== 0).map(a => (
            <div key={a.kode} className="flex justify-between text-[11px] py-0.5">
              <span className="text-slate-700 ml-3"><span className="text-slate-400">{a.kode}</span> {a.nama}</span>
              <span className="tabular-nums">{fmt(a.saldo)}</span>
            </div>
          ))}
          {data.nonOperasional.bebanLain.detail.filter(a => a.saldo !== 0).map(a => (
            <div key={a.kode} className="flex justify-between text-[11px] py-0.5">
              <span className="text-slate-700 ml-3"><span className="text-slate-400">{a.kode}</span> {a.nama}</span>
              <span className="tabular-nums">{fmt(a.saldo)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-[11px] border-t border-slate-400 py-0.5 mt-0.5">
            <span>Subtotal Non-Operasional</span>
            <span className="tabular-nums">{fmt(data.nonOperasional.pendapatanLain.subtotal - data.nonOperasional.bebanLain.subtotal)}</span>
          </div>

          {/* G. LABA SEBELUM PAJAK */}
          <div className="flex justify-between font-bold text-[11px] border-t-2 border-slate-800 mt-1 py-0.5">
            <span>G. Laba / Rugi Sebelum Pajak</span>
            <span className="tabular-nums">{fmt(data.labaSebelumPajak)}</span>
          </div>

          {/* H. PAJAK */}
          <p className="font-bold text-[11px] mt-2 mb-0.5">H. Beban Pajak</p>
          {data.pajak.detail.filter(a => a.saldo !== 0).map(a => (
            <div key={a.kode} className="flex justify-between text-[11px] py-0.5">
              <span className="text-slate-700 ml-3"><span className="text-slate-400">{a.kode}</span> {a.nama}</span>
              <span className="tabular-nums">{fmt(a.saldo)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-[11px] border-t border-slate-400 py-0.5">
            <span>Subtotal Pajak</span>
            <span className="tabular-nums">{fmt(data.pajak.subtotal)}</span>
          </div>

          {/* LABA BERSIH */}
          <div className="flex justify-between font-bold text-[12px] border-t-2 border-slate-800 mt-2 py-1">
            <span>LABA BERSIH SETELAH PAJAK</span>
            <span className="tabular-nums">{fmt(data.labaBersih)}</span>
          </div>
        </div>}
      </ReportPrintLayout>
    </div>
  );
}
