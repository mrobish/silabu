import { useState, useEffect } from 'react';
import { Scale, ChevronDown, ChevronRight, Calendar, CheckCircle, AlertTriangle, ListOrdered } from 'lucide-react';

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

function rupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function NeracaSaldoPage() {
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<TBData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ '1': true, '2': true, '3': true, '4': false, '5': false, '6': false, '7': false });

  const toggle = (g: string) => setExpanded(p => ({ ...p, [g]: !p[g] }));

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/accounting/neraca-saldo?end_date=${endDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
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

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
          <ListOrdered size={22} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Neraca Saldo</h2>
          <p className="text-xs text-slate-400">Daftar seluruh saldo akun dan verifikasi keseimbangan</p>
        </div>
      </div>

      {/* Filter row */}
      <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              <Calendar size={13} /> Tanggal
            </label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
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
            </p>
          </div>

          {/* Table */}
          <div className="rounded-3xl border border-white/70 bg-white/80 p-2 shadow-sm backdrop-blur-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="text-left py-3 px-3 w-[100px]">Kode</th>
                  <th className="text-left py-3 px-3">Nama Akun</th>
                  <th className="text-right py-3 px-3 w-[140px]">Debit</th>
                  <th className="text-right py-3 px-3 w-[140px]">Kredit</th>
                </tr>
              </thead>
              <tbody>
                {glCodes.map(g => hasAny(g) && (
                  <tr key={g} className="border-0">
                    <td colSpan={4} className="p-0">
                      <button onClick={() => toggle(g)}
                        className={'w-full flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider ' + GL_COLOR[g] + ' hover:bg-slate-50 transition-colors'}>
                        {expanded[g] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {GL_LABEL[g]}
                      </button>
                      {expanded[g] && (
                        <div>
                          {grouped[g].map(a => (
                            <tr key={a.kode} className="border-b border-slate-50 last:border-0">
                              <td className="py-1.5 px-3 text-[11px] text-slate-400 font-mono">{a.kode}</td>
                              <td className="py-1.5 px-3 text-sm text-slate-700">{a.nama}</td>
                              <td className="py-1.5 px-3 text-right tabular-nums text-slate-700">{a.debit > 0 ? rupiah(a.debit) : ''}</td>
                              <td className="py-1.5 px-3 text-right tabular-nums text-slate-700">{a.kredit > 0 ? rupiah(a.kredit) : ''}</td>
                            </tr>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {/* TOTAL row */}
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={2} className="py-3 px-3 text-sm font-bold text-slate-800">TOTAL</td>
                  <td className="py-3 px-3 text-right text-sm font-bold text-emerald-700 tabular-nums">{rupiah(data.totalDebit)}</td>
                  <td className="py-3 px-3 text-right text-sm font-bold text-emerald-700 tabular-nums">{rupiah(data.totalKredit)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            Neraca Saldo per {new Date(data.asOf).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </>
      )}
    </div>
  );
}
