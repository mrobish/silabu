import { useState, useEffect, Fragment } from 'react';
import { useAccountingYears } from './useAccountingYears';
import { ChevronDown, ChevronRight, Calendar, CheckCircle, AlertTriangle, ListOrdered, Printer } from 'lucide-react';
import ReportPrintLayout from './ReportPrintLayout';

type Akun = { kode: string; nama: string; saldoNormal: string; debit: number; kredit: number };
type TBData = {
  asOf: string;
  akun: Akun[];
  totalDebit: number;
  totalKredit: number;
  isBalanced: boolean;
  selisih: number;
};

const GL_LABEL: Record<string, string> = { '1': 'ASET (1)', '2': 'KEWAJIBAN (2)', '3': 'EKUITAS (3)', '4': 'PENDAPATAN (4)', '5': 'HPP (5)', '6': 'BEBAN (6)', '7': 'PENDAPATAN/LAIN (7)' };
const GL_COLOR: Record<string, string> = { '1': 'text-emerald-600', '2': 'text-orange-600', '3': 'text-blue-600', '4': 'text-green-600', '5': 'text-red-600', '6': 'text-rose-600', '7': 'text-purple-600' };
const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function rupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}
function rupiahPrint(n: number) {
  if (n < 0) {
    return { text: `(Rp ${Math.abs(n).toLocaleString('id-ID')})`, negative: true };
  }
  return { text: 'Rp ' + n.toLocaleString('id-ID'), negative: false };
}


export default function NeracaSaldoPage() {
  const now = new Date();
  const years = useAccountingYears();
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [mode, setMode] = useState<'before' | 'after'>('before');
  const lastDay = new Date(tahun, bulan, 0).getDate();
  const endDate = `${tahun}-${String(bulan).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  const [data, setData] = useState<TBData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ '1': true, '2': true, '3': true, '4': false, '5': false, '6': false, '7': false });
  const [printOpen, setPrintOpen] = useState(false);

  const toggle = (g: string) => setExpanded(p => ({ ...p, [g]: !p[g] }));

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/accounting/neraca-saldo?end_date=${endDate}&mode=${mode}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.error || !json.akun) {
        console.error('[NeracaSaldo] API error:', json.error || 'No akun data');
        setData(null);
      } else {
        setData(json);
      }
    } catch (e) {
      console.error(e);
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const grouped: Record<string, Akun[]> = {};
  const glCodes = ['1', '2', '3', '4', '5', '6', '7'];
  if (data) {
    for (const g of glCodes) {
      grouped[g] = data.akun.filter(a => a.kode.startsWith(g) && (a.debit > 0 || a.kredit > 0));
    }
  }

  const hasAny = (g: string) => grouped[g] && grouped[g].length > 0;
  const periodLabel = `${lastDay} ${MONTHS_ID[bulan - 1]} ${tahun}`;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
            <ListOrdered size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Neraca Saldo</h2>
            <p className="text-xs text-slate-400">Daftar seluruh saldo akun dan verifikasi keseimbangan</p>
          </div>
        </div>
        {data && (
          <button onClick={() => setPrintOpen(true)}
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:shadow-lg transition-all">
            <Printer size={14} className="inline-block -mt-0.5 mr-1" /> Cetak
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              <Calendar size={13} /> Per Tanggal
            </label>
            <div className="flex gap-2">
              <select value={bulan} onChange={e => setBulan(Number(e.target.value))} className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                {MONTHS_ID.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <select value={tahun} onChange={e => setTahun(Number(e.target.value))} className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="min-w-[200px]">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Mode Tampilan
            </label>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => setMode('before')}
                className={`flex-1 px-3 py-2 text-xs font-semibold transition-all ${
                  mode === 'before'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}>
                Sebelum Penutupan
              </button>
              <button
                onClick={() => setMode('after')}
                className={`flex-1 px-3 py-2 text-xs font-semibold transition-all ${
                  mode === 'after'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}>
                Setelah Penutupan
              </button>
            </div>
          </div>
          <button onClick={fetchData} disabled={loading}
            className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white text-sm font-semibold rounded-xl hover:shadow-md hover:shadow-emerald-200 transition-all disabled:opacity-50">
            {loading ? 'Memuat...' : 'Tampilkan'}
          </button>
        </div>
      </div>

      {loading && <div className="text-center text-sm text-slate-400 py-8">Memuat data...</div>}

      {data && (
        <>
          {/* Balance Banner */}
          <div className={'rounded-2xl p-4 text-center ' + (data.isBalanced ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200')}>
            <div className="flex items-center justify-center gap-2">
              {data.isBalanced ? <CheckCircle size={22} className="text-emerald-600" /> : <AlertTriangle size={22} className="text-red-600" />}
              <span className={'font-bold text-lg ' + (data.isBalanced ? 'text-emerald-700' : 'text-red-700')}>
                {data.isBalanced ? 'NERACA SALDO SEIMBANG' : 'TIDAK SEIMBANG'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Debit {rupiah(data.totalDebit)} = Kredit {rupiah(data.totalKredit)}
              {!data.isBalanced && <span className="text-red-500 font-semibold"> — Selisih {rupiah(Math.abs(data.selisih))}</span>}
              <span className="ml-2 text-slate-400">({mode === 'after' ? 'Setelah Penutupan' : 'Sebelum Penutupan'})</span>
            </p>
          </div>

          {/* Table */}
          <div className="rounded-3xl border border-white/70 bg-white/80 p-2 shadow-sm backdrop-blur-xl overflow-x-auto">
            <div className="grid min-w-[480px]" style={{ gridTemplateColumns: '90px 1fr 120px 120px' }}>
              <div className="py-3 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">Kode</div>
              <div className="py-3 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">Nama Akun</div>
              <div className="py-3 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 text-right">Debit</div>
              <div className="py-3 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 text-right">Kredit</div>

              {glCodes.map(g => hasAny(g) && (
                <Fragment key={g}>
                  <button onClick={() => toggle(g)} style={{ gridColumn: 'span 4' }}
                    className={'flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider ' + GL_COLOR[g] + ' hover:bg-slate-50 transition-colors'}>
                    {expanded[g] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {GL_LABEL[g]}
                  </button>
                  {expanded[g] && grouped[g].map(a => (
                    <Fragment key={a.kode}>
                      <div className="py-1.5 px-3 text-[11px] text-slate-400 font-mono truncate border-b border-slate-50 last:border-0">{a.kode}</div>
                      <div className="py-1.5 px-3 text-sm text-slate-700 truncate border-b border-slate-50 last:border-0">{a.nama}</div>
                      <div className="py-1.5 px-3 text-right tabular-nums text-slate-700 whitespace-nowrap border-b border-slate-50 last:border-0">{a.debit > 0 ? rupiah(a.debit) : ''}</div>
                      <div className="py-1.5 px-3 text-right tabular-nums text-slate-700 whitespace-nowrap border-b border-slate-50 last:border-0">{a.kredit > 0 ? rupiah(a.kredit) : ''}</div>
                    </Fragment>
                  ))}
                </Fragment>
              ))}

              <div className="col-span-2 py-3 px-3 text-sm font-bold text-slate-800 border-t-2 border-slate-200 bg-slate-50">TOTAL</div>
              <div className="py-3 px-3 text-right text-sm font-bold text-emerald-700 tabular-nums border-t-2 border-slate-200 bg-slate-50">{rupiah(data.totalDebit)}</div>
              <div className="py-3 px-3 text-right text-sm font-bold text-emerald-700 tabular-nums border-t-2 border-slate-200 bg-slate-50">{rupiah(data.totalKredit)}</div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            Neraca Saldo per {new Date(data.asOf).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </>
      )}

      {/* Print Layout */}
      {data && (
        <ReportPrintLayout title="NERACA SALDO" isOpen={printOpen} onClose={() => setPrintOpen(false)} periodLabel={`Per ${periodLabel}`}>
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300">
                <th className="text-left py-1.5 font-bold w-20">Kode</th>
                <th className="text-left py-1.5 font-bold">Nama Akun</th>
                <th className="text-right py-1.5 font-bold w-28">Debit (Rp)</th>
                <th className="text-right py-1.5 font-bold w-28">Kredit (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {glCodes.map(g => hasAny(g) && (
                <Fragment key={g}>
                  <tr className="border-t border-gray-800">
                    <td colSpan={4} className="py-1.5 font-bold text-slate-700 text-[10px] uppercase tracking-wider">{GL_LABEL[g]}</td>
                  </tr>
                  {grouped[g].map(a => (
                    <tr key={a.kode} className="border-b border-slate-100">
                      <td className="py-1 pl-6 font-mono text-slate-500">{a.kode}</td>
                      <td className="py-1 pl-6 text-slate-700">{a.nama}</td>
                      <td className={"py-1 text-right tabular-nums" + (a.debit < 0 ? ' text-red-600 print:text-red-600' : '')}>{a.debit !== 0 ? rupiahPrint(a.debit).text : ''}</td>
                      <td className={"py-1 text-right tabular-nums" + (a.kredit < 0 ? ' text-red-600 print:text-red-600' : '')}>{a.kredit !== 0 ? rupiahPrint(a.kredit).text : ''}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr className="bg-gray-100 print:bg-gray-100 font-extrabold border-b-4 border-double border-gray-900">
                <td colSpan={2} className="py-2">TOTAL</td>
                {(() => { const td = rupiahPrint(data.totalDebit); const tk = rupiahPrint(data.totalKredit); return (
                  <>
                    <td className={"py-2 text-right tabular-nums" + (td.negative ? ' text-red-600 print:text-red-600' : ' text-emerald-700')}>{td.text}</td>
                    <td className={"py-2 text-right tabular-nums" + (tk.negative ? ' text-red-600 print:text-red-600' : ' text-emerald-700')}>{tk.text}</td>
                  </>
                ); })()}
              </tr>
            </tbody>
          </table>
          {!data.isBalanced && (
            <p className="text-center text-red-600 font-bold text-[11px] mt-3">
              ⚠️ TIDAK SEIMBANG — Selisih {rupiah(Math.abs(data.selisih))}
            </p>
          )}
        </ReportPrintLayout>
      )}
    </div>
  );
}
