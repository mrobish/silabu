import { useState, useEffect } from 'react';
import { useDateFilter } from '../hooks/useDateFilter';
import { useCutoffDate } from "../hooks/useCutoffDate";
import { useDataRange } from "../hooks/useDataRange";
import { Printer } from 'lucide-react';
import PdfTemplate from '../pdf/pdfTemplate';
import ReportPrintLayout from './ReportPrintLayout';
import DateRangePicker from './DateRangePicker';

type MutasiItem = { kode: string; nama: string; debit: number; kredit: number };

type PerubahanModalData = {
  tahun: number;
  periode: { startDate: string; endDate: string };
  modalAwal: number;
  tambahanModal: number;
  labaBersih: number;
  prive: number;
  modalAkhir: number;
  tambahanDetail: MutasiItem[];
  priveDetail: MutasiItem[];
  labaRugi: { pendapatan: number; beban: number };
  crossCheck: {
    neracaEkuitasAkun: number;
    neracaLabaBerjalan: number;
    neracaTotalEkuitas: number;
    perubahanModalAkhir: number;
    selisih: number;
    isBalanced: boolean;
  };
};

function formatRupiah(v?: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
}

// Prive display: positive = reduction (red, parentheses), negative = reversal (green), zero = neutral
function displayPrive(v: number) {
  if (v === 0) return { text: formatRupiah(0), className: 'tabular-nums text-slate-400' };
  if (v > 0) return { text: `(${formatRupiah(v)})`, className: 'tabular-nums text-red-600' };
  return { text: formatRupiah(Math.abs(v)), className: 'tabular-nums text-emerald-600' };
}

export default function PerubahanModalPage() {
  const { startDate, endDate, setStartDate, setEndDate } = useDateFilter();
  const cutoff = useCutoffDate();
  const { minDate: dataMinDate, maxDate: dataMaxDate } = useDataRange();
  const [data, setData] = useState<PerubahanModalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [printOpen, setPrintOpen] = useState(false);

  const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const fmtIdDate = (d: string) => { const p = d.split('-'); return `${parseInt(p[2])} ${MONTHS_ID[parseInt(p[1]) - 1]} ${p[0]}`; };
  const periodLabel = `Periode: ${fmtIdDate(startDate)} s.d ${fmtIdDate(endDate)}`;
  const tahun = new Date(endDate + 'T00:00:00').getFullYear();

  useEffect(() => {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    setLoading(true); setError('');
    fetch(`/api/accounting/perubahan-modal?start_date=${startDate}&end_date=${endDate}`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const R = ({ v, bold }: { v: number; bold?: boolean }) => (
    <td className={'px-4 py-3 text-right tabular-nums ' + (bold ? 'font-bold text-slate-900' : 'text-slate-700')}>
      {formatRupiah(v)}
    </td>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Laporan Perubahan Modal</h2>
          <p className="text-sm text-slate-500 mt-0.5">Modal Awal + Tambahan + Laba Bersih − Prive = Modal Akhir</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setPrintOpen(true)}
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:shadow-lg transition-all">
            <Printer size={14} className="inline-block -mt-0.5 mr-1" /> Cetak
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
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
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* Cross-Check Badge */}
          <div className={'rounded-xl px-4 py-3 flex items-center gap-3 text-sm font-medium ' +
            (data.crossCheck.isBalanced ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700')}>
            {data.crossCheck.isBalanced ? (
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ) : (
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            )}
            <span>
              {data.crossCheck.isBalanced
                ? '✓ Validasi Emas: Modal Akhir === Total Ekuitas Neraca — BALANCED'
                : `✗ Selisih: ${formatRupiah(data.crossCheck.selisih)} — cek kembali data`}
            </span>
          </div>

          {/* Tabel Utama */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Keterangan</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <tr className="bg-slate-50/40">
                  <td className="px-4 py-3 font-semibold text-slate-800">Modal Awal per {fmtIdDate(startDate)}</td>
                  <R v={data.modalAwal} bold />
                </tr>
                <tr>
                  <td className="px-4 py-3 pl-8 text-slate-600">(+) Tambahan Modal</td>
                  <R v={data.tambahanModal} />
                </tr>
                {data.tambahanDetail.length > 0 && data.tambahanDetail.map((d, i) => (
                  <tr key={'t' + i} className="bg-slate-50/30">
                    <td className="px-4 py-2 pl-12 text-xs text-slate-500">{d.kode} — {d.nama}</td>
                    <td className="px-4 py-2 text-right text-xs text-slate-500 tabular-nums">{formatRupiah(d.kredit - d.debit)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="px-4 py-3 pl-8 text-slate-600">(+) Laba Bersih Periode</td>
                  <R v={data.labaBersih} />
                </tr>
                <tr className="bg-slate-50/30">
                  <td className="px-4 py-2 pl-12 text-xs text-slate-500">Pendapatan</td>
                  <td className="px-4 py-2 text-right text-xs text-slate-500 tabular-nums">{formatRupiah(data.labaRugi.pendapatan)}</td>
                </tr>
                <tr className="bg-slate-50/30">
                  <td className="px-4 py-2 pl-12 text-xs text-slate-500">(−) Beban & HPP</td>
                  <td className="px-4 py-2 text-right text-xs text-red-500 tabular-nums">({formatRupiah(data.labaRugi.beban)})</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 pl-8 text-slate-600">(−) Prive / Penarikan Modal</td>
                  <td className={`px-4 py-3 text-right ${displayPrive(data.prive).className}`}>{displayPrive(data.prive).text}</td>
                </tr>
                {data.priveDetail.length > 0 && data.priveDetail.map((d, i) => (
                  <tr key={'p' + i} className="bg-slate-50/30">
                    <td className="px-4 py-2 pl-12 text-xs text-slate-500">{d.kode} — {d.nama}</td>
                    <td className={`px-4 py-2 text-right text-xs ${displayPrive(d.debit - d.kredit).className}`}>{displayPrive(d.debit - d.kredit).text}</td>
                  </tr>
                ))}
                <tr className="bg-emerald-50/50 border-t-2 border-emerald-200">
                  <td className="px-4 py-4 font-bold text-emerald-800 text-base">Modal Akhir per {fmtIdDate(endDate)}</td>
                  <td className="px-4 py-4 text-right font-bold text-emerald-800 text-base tabular-nums">{formatRupiah(data.modalAkhir)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Cross-Check Detail */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Validasi Emas — Cross-Check Neraca
            </h3>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-slate-500">Ekuitas Akun (Gol 3)</span><span className="font-semibold tabular-nums">{formatRupiah(data.crossCheck.neracaEkuitasAkun)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">(+) Laba Berjalan</span><span className="font-semibold tabular-nums">{formatRupiah(data.crossCheck.neracaLabaBerjalan)}</span></div>
                <div className="flex justify-between border-t pt-2"><span className="font-bold text-slate-800">Total Ekuitas Neraca</span><span className="font-bold tabular-nums">{formatRupiah(data.crossCheck.neracaTotalEkuitas)}</span></div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-slate-500">Perubahan Modal Akhir</span><span className="font-semibold tabular-nums">{formatRupiah(data.crossCheck.perubahanModalAkhir)}</span></div>
                <div className="flex justify-between border-t pt-2"><span className="font-bold text-slate-800">Selisih</span><span className={'font-bold tabular-nums ' + (data.crossCheck.isBalanced ? 'text-emerald-600' : 'text-red-600')}>{formatRupiah(data.crossCheck.selisih)}</span></div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Print Layout */}
      {data && (
        <PdfTemplate title={`Laporan Perubahan Modal`} isOpen={printOpen} onClose={() => setPrintOpen(false)} periodLabel={`${fmtIdDate(startDate)} s.d ${fmtIdDate(endDate)}`}>
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300">
                <th className="text-left py-1.5 font-bold">Keterangan</th>
                <th className="text-right py-1.5 font-bold" style={{ width: '30%' }}>Jumlah</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200"><td className="py-1.5 font-semibold">Modal Awal per {fmtIdDate(startDate)}</td><td className="text-right py-1.5 tabular-nums">{formatRupiah(data.modalAwal)}</td></tr>
              <tr className="border-b border-slate-100"><td className="py-1.5 pl-4 font-semibold">(+) Tambahan Modal</td><td className="text-right py-1.5 tabular-nums">{formatRupiah(data.tambahanModal)}</td></tr>
              {data.tambahanDetail.length > 0 && data.tambahanDetail.map((d, i) => (
                <tr key={'pt' + i} className="border-b border-slate-100">
                  <td className="py-1 pl-6 text-slate-600">{d.kode} — {d.nama}</td>
                  <td className="text-right py-1 tabular-nums">{formatRupiah(d.kredit - d.debit)}</td>
                </tr>
              ))}
              <tr className="border-b border-slate-100 border-t border-gray-800"><td className="py-1.5 pl-4 font-semibold">(+) Laba Bersih Periode</td><td className="text-right py-1.5 tabular-nums">{formatRupiah(data.labaBersih)}</td></tr>
              <tr className="border-b border-slate-100"><td className="py-1.5 pl-4 font-semibold">(−) Prive / Penarikan Modal</td><td className={`text-right py-1.5 ${displayPrive(data.prive).className} print:${displayPrive(data.prive).className}`}>{displayPrive(data.prive).text}</td></tr>
              {data.priveDetail.length > 0 && data.priveDetail.map((d, i) => (
                <tr key={'pp' + i} className="border-b border-slate-100">
                  <td className="py-1 pl-6 text-slate-600">{d.kode} — {d.nama}</td>
                  <td className={`text-right py-1 ${displayPrive(d.debit - d.kredit).className} print:${displayPrive(d.debit - d.kredit).className}`}>{displayPrive(d.debit - d.kredit).text}</td>
                </tr>
              ))}
              <tr className="bg-gray-100 print:bg-gray-100 border-t border-gray-800 border-b-4 border-double border-gray-900"><td className="py-2 font-extrabold">Modal Akhir per {fmtIdDate(endDate)}</td><td className="text-right py-2 font-extrabold tabular-nums">{formatRupiah(data.modalAkhir)}</td></tr>
            </tbody>
          </table>
        </PdfTemplate>
      )}
    </div>
  );
}
