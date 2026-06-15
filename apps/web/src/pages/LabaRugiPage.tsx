import { useState, useEffect } from 'react';
import { useDateFilter } from '../hooks/useDateFilter';
import { useCutoffDate } from "../hooks/useCutoffDate";
import { useDataRange } from "../hooks/useDataRange";
import { TrendingUp, TrendingDown, ChevronDown, ChevronRight, DollarSign, BarChart4, Receipt, Printer } from 'lucide-react';
import PdfTemplate from '../pdf/pdfTemplate';
import ReportPrintLayout from './ReportPrintLayout';
import DateRangePicker from './DateRangePicker';

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
const fmtPrint = (v: number) => v < 0
  ? <span className="text-red-600">({fmt(v)})</span>
  : <>{fmt(v)}</>;
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
  const { startDate, endDate, setStartDate, setEndDate } = useDateFilter();
  const cutoff = useCutoffDate();
  const { minDate: dataMinDate, maxDate: dataMaxDate } = useDataRange();
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
          <div className="sm:col-span-2">
            <DateRangePicker minDate={cutoff}
              showAllPresets
              dataMinDate={dataMinDate}
              dataMaxDate={dataMaxDate}
              startDate={startDate}
              endDate={endDate}
              onStartChange={setStartDate}
              onEndChange={setEndDate}
            />
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
      <PdfTemplate title="LAPORAN LABA RUGI" isOpen={printOpen} onClose={() => setPrintOpen(false)} periodLabel={periodLabel}>
        {data && <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-slate-800 font-bold">
              <td className="text-left pb-1">Akun</td>
              <td className="text-right pb-1">Jumlah</td>
            </tr>
          </thead>
          <tbody>
            {/* A. PENDAPATAN */}
            <tr><td colSpan={2} className="font-bold pt-2 pb-0.5">A. Pendapatan Operasional</td></tr>
            {data.pendapatanOperasional.jasa.filter(a => a.saldo !== 0).map(a => (
              <tr key={a.kode} className="print-row">
                <td className="text-slate-700 pl-6"><span className="text-slate-400">{a.kode}</span> {a.nama}</td>
                <td className="text-right tabular-nums">{fmtPrint(a.saldo)}</td>
              </tr>
            ))}
            {data.pendapatanOperasional.dagang.filter(a => a.saldo !== 0).map(a => (
              <tr key={a.kode} className="print-row">
                <td className="text-slate-700 pl-6"><span className="text-slate-400">{a.kode}</span> {a.nama}</td>
                <td className="text-right tabular-nums">{fmtPrint(a.saldo)}</td>
              </tr>
            ))}
            <tr className="font-bold border-t border-slate-400">
              <td className="pt-0.5">Subtotal Pendapatan Operasional</td>
              <td className="text-right tabular-nums pt-0.5">{fmtPrint(data.pendapatanOperasional.subtotal)}</td>
            </tr>

            {/* B. HPP */}
            <tr><td colSpan={2} className="font-bold pt-2 pb-0.5">B. Harga Pokok Penjualan</td></tr>
            {data.hpp.detail.filter(a => a.saldo !== 0).map(a => (
              <tr key={a.kode} className="print-row">
                <td className="text-slate-700 pl-6"><span className="text-slate-400">{a.kode}</span> {a.nama}</td>
                <td className="text-right tabular-nums">{fmtPrint(a.saldo)}</td>
              </tr>
            ))}
            <tr className="font-bold border-t border-slate-400">
              <td className="pt-0.5">Subtotal HPP</td>
              <td className="text-right tabular-nums pt-0.5">{fmtPrint(data.hpp.subtotal)}</td>
            </tr>

            {/* C. LABA KOTOR */}
            <tr className="font-bold border-b-4 border-double border-gray-900">
              <td className="pt-1">C. Laba Kotor Operasional</td>
              <td className="text-right tabular-nums pt-1">{fmtPrint(data.labaKotor)}</td>
            </tr>

            {/* D. BEBAN OPERASIONAL */}
            <tr><td colSpan={2} className="font-bold pt-2 pb-0.5">D. Beban Operasional</td></tr>
            {data.bebanOperasional.detail.filter(a => a.saldo !== 0).map(a => (
              <tr key={a.kode} className="print-row">
                <td className="text-slate-700 pl-6"><span className="text-slate-400">{a.kode}</span> {a.nama}</td>
                <td className="text-right tabular-nums">{fmtPrint(a.saldo)}</td>
              </tr>
            ))}
            <tr className="font-bold border-t border-slate-400">
              <td className="pt-0.5">Subtotal Beban Operasional</td>
              <td className="text-right tabular-nums pt-0.5">{fmtPrint(data.bebanOperasional.subtotal)}</td>
            </tr>

            {/* E. LABA OPERASIONAL */}
            <tr className="font-bold border-b-4 border-double border-gray-900">
              <td className="pt-1">E. Laba Operasional</td>
              <td className="text-right tabular-nums pt-1">{fmtPrint(data.labaOperasional)}</td>
            </tr>

            {/* F. NON-OPERASIONAL */}
            <tr><td colSpan={2} className="font-bold pt-2 pb-0.5">F. Pendapatan &amp; Beban Non-Operasional</td></tr>
            {data.nonOperasional.pendapatanLain.detail.filter(a => a.saldo !== 0).map(a => (
              <tr key={a.kode} className="print-row">
                <td className="text-slate-700 pl-6"><span className="text-slate-400">{a.kode}</span> {a.nama}</td>
                <td className="text-right tabular-nums">{fmtPrint(a.saldo)}</td>
              </tr>
            ))}
            {data.nonOperasional.bebanLain.detail.filter(a => a.saldo !== 0).map(a => (
              <tr key={a.kode} className="print-row">
                <td className="text-slate-700 pl-6"><span className="text-slate-400">{a.kode}</span> {a.nama}</td>
                <td className="text-right tabular-nums">{fmtPrint(a.saldo)}</td>
              </tr>
            ))}
            <tr className="font-bold border-t border-slate-400">
              <td className="pt-0.5">Subtotal Non-Operasional</td>
              <td className="text-right tabular-nums pt-0.5">{fmtPrint(data.nonOperasional.pendapatanLain.subtotal - data.nonOperasional.bebanLain.subtotal)}</td>
            </tr>

            {/* G. LABA SEBELUM PAJAK */}
            <tr className="font-bold border-b-4 border-double border-gray-900">
              <td className="pt-1">G. Laba / Rugi Sebelum Pajak</td>
              <td className="text-right tabular-nums pt-1">{fmtPrint(data.labaSebelumPajak)}</td>
            </tr>

            {/* H. PAJAK */}
            <tr><td colSpan={2} className="font-bold pt-2 pb-0.5">H. Beban Pajak</td></tr>
            {data.pajak.detail.filter(a => a.saldo !== 0).map(a => (
              <tr key={a.kode} className="print-row">
                <td className="text-slate-700 pl-6"><span className="text-slate-400">{a.kode}</span> {a.nama}</td>
                <td className="text-right tabular-nums">{fmtPrint(a.saldo)}</td>
              </tr>
            ))}
            <tr className="font-bold border-t border-slate-400">
              <td className="pt-0.5">Subtotal Pajak</td>
              <td className="text-right tabular-nums pt-0.5">{fmtPrint(data.pajak.subtotal)}</td>
            </tr>

            {/* LABA BERSIH */}
            <tr className="font-extrabold text-[12px] bg-gray-100 print:bg-gray-100 border-b-4 border-double border-gray-900">
              <td className="pt-2 pb-1">LABA BERSIH SETELAH PAJAK</td>
              <td className="text-right tabular-nums pt-2 pb-1">{fmtPrint(data.labaBersih)}</td>
            </tr>
          </tbody>
        </table>}
      </PdfTemplate>
    </div>
  );
}
