import { useState, useEffect } from 'react';
import { DollarSign, CheckCircle, AlertTriangle, TrendingUp, Building2, PiggyBank, ChevronDown, ChevronRight, Printer } from 'lucide-react';
import ReportPrintLayout from './ReportPrintLayout';
import DateRangePicker from './DateRangePicker';

type FlowItem = { kode: string; nama: string; masuk: number; keluar: number; net: number };
type Aktivitas = { detail: FlowItem[]; totalMasuk: number; totalKeluar: number; net: number };
type ArusKasData = {
  periode: { startDate: string; endDate: string };
  aktivitasOperasi: Aktivitas;
  aktivitasInvestasi: Aktivitas;
  aktivitasPendanaan: Aktivitas;
  kasTahunLalu: number;
  kasBerjalan: number;
  validasiNeraca: { neracaKasTotal: number; cocok: boolean };
};

const rupiah = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const br = 'rounded-2xl border border-white/70 bg-white/80 backdrop-blur-xl shadow-sm';

function AktivitasBlock({ title, icon, data, color, open, onToggle }: {
  title: string; icon: React.ReactNode; data: Aktivitas;
  color: 'emerald' | 'violet' | 'amber'; open: boolean; onToggle: () => void;
}) {
  const cl = color === 'emerald' ? 'emerald' : color === 'violet' ? 'violet' : 'amber';
  const bg = { emerald: 'from-emerald-500/20 to-cyan-500/20 text-emerald-600', violet: 'from-violet-500/20 to-purple-500/20 text-violet-600', amber: 'from-amber-500/20 to-orange-500/20 text-amber-600' }[cl];
  const bdr = { emerald: 'border-emerald-200', violet: 'border-violet-200', amber: 'border-amber-200' }[cl];
  const netCl = data.net >= 0 ? 'text-emerald-700' : 'text-red-600';

  return (
    <div className={`${br} p-4 sm:p-5`}>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 text-left">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${bg} shrink-0`}>{icon}</div>
        <h3 className="text-sm font-bold text-slate-900 flex-1">{title}</h3>
        <span className={`text-sm font-bold ${netCl} tabular-nums`}>{rupiah(data.net)}</span>
        <span className="text-slate-400 ml-1">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
      </button>

      {open && data.detail.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={`border-b ${bdr}`}>
                <th className="text-left py-1.5 font-semibold text-slate-500">Akun Lawan</th>
                <th className="text-right py-1.5 font-semibold text-emerald-600">Penerimaan</th>
                <th className="text-right py-1.5 font-semibold text-red-500">Pengeluaran</th>
                <th className="text-right py-1.5 font-semibold text-slate-600">Bersih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.detail.map(d => (
                <tr key={d.kode} className="hover:bg-slate-50/50">
                  <td className="py-1.5 text-slate-700 max-w-[200px] truncate">{d.nama}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-700">{d.masuk > 0 ? rupiah(d.masuk) : '-'}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-700">{d.keluar > 0 ? rupiah(d.keluar) : '-'}</td>
                  <td className={`py-1.5 text-right font-semibold tabular-nums ${d.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{rupiah(d.net)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={`border-t-2 ${bdr}`}>
                <td className="py-2 font-bold text-slate-900">Total</td>
                <td className="py-2 text-right font-bold tabular-nums text-emerald-700">{rupiah(data.totalMasuk)}</td>
                <td className="py-2 text-right font-bold tabular-nums text-red-600">{rupiah(data.totalKeluar)}</td>
                <td className={`py-2 text-right font-bold tabular-nums ${data.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{rupiah(data.net)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {open && data.detail.length === 0 && (
        <p className="text-xs text-slate-400 mt-3 italic text-center">Tidak ada transaksi di periode ini</p>
      )}
    </div>
  );
}

export default function ArusKasPage() {
  const [start, setStart] = useState(() => { const d = new Date(); d.setMonth(0, 1); return d.toISOString().slice(0, 10); });
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<ArusKasData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exp, setExp] = useState<Record<string, boolean>>({ operasi: true, investasi: true, pendanaan: true });
  const [printOpen, setPrintOpen] = useState(false);

  const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const fmtIdDate = (d: string) => { const p = d.split('-'); return `${parseInt(p[2])} ${MONTHS_ID[parseInt(p[1]) - 1]} ${p[0]}`; };
  const periodLabelArus = `Periode: ${fmtIdDate(start)} s/d ${fmtIdDate(end)}`;

  const token = () => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
  const fetchD = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/accounting/arus-kas?start_date=${start}&end_date=${end}`, { headers: { Authorization: 'Bearer ' + token() } });
      if (!r.ok) return;
      setData(await r.json());
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchD(); }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-600">
          <DollarSign size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Arus Kas</h2>
          <p className="text-xs text-slate-500">Cash Flow Statement — Laporan Aktivitas Keuangan</p>
        </div>
      </div>

      {/* Filter */}
      <div className={`${br} p-5 relative z-10`}>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div className="sm:col-span-2" data-help-target="filter-periode">
            <DateRangePicker
              startDate={start}
              endDate={end}
              onStartChange={setStart}
              onEndChange={setEnd}
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" onClick={fetchD} disabled={loading}
              className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:shadow-xl transition disabled:opacity-40 whitespace-nowrap">
              {loading ? 'Memuat...' : 'Tampilkan'}
            </button>
            <button type="button" onClick={() => setPrintOpen(true)} disabled={!data}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-emerald-300 transition whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block -mt-[2px] mr-1"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg> Cetak
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {data && (
        <>
          {/* 3 Aktivitas */}
          <div className="space-y-3">
            <AktivitasBlock title="Arus Kas dari Aktivitas Operasi" icon={<TrendingUp size={18} />}
              data={data.aktivitasOperasi} color="emerald" open={exp.operasi} onToggle={() => setExp(p => ({ ...p, operasi: !p.operasi }))} />
            <AktivitasBlock title="Arus Kas dari Aktivitas Investasi" icon={<Building2 size={18} />}
              data={data.aktivitasInvestasi} color="violet" open={exp.investasi} onToggle={() => setExp(p => ({ ...p, investasi: !p.investasi }))} />
            <AktivitasBlock title="Arus Kas dari Aktivitas Pendanaan" icon={<PiggyBank size={18} />}
              data={data.aktivitasPendanaan} color="amber" open={exp.pendanaan} onToggle={() => setExp(p => ({ ...p, pendanaan: !p.pendanaan }))} />
          </div>

          {/* Ringkasan Kas */}
          <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-cyan-600 p-5 text-white shadow-xl shadow-emerald-500/20" data-help-target="saldo-kas">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={18} />
              <h3 className="text-sm font-bold">Ringkasan Kas</h3>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-emerald-100">Kas Awal Periode</span>
                <span className="font-bold tabular-nums">{rupiah(data.kasTahunLalu)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-emerald-100">Arus Kas Operasi</span>
                <span className={`font-bold tabular-nums ${data.aktivitasOperasi.net >= 0 ? '' : 'text-red-300'}`}>{data.aktivitasOperasi.net >= 0 ? '+' : ''}{rupiah(data.aktivitasOperasi.net)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-emerald-100">Arus Kas Investasi</span>
                <span className={`font-bold tabular-nums ${data.aktivitasInvestasi.net >= 0 ? '' : 'text-red-300'}`}>{data.aktivitasInvestasi.net >= 0 ? '+' : ''}{rupiah(data.aktivitasInvestasi.net)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-emerald-100">Arus Kas Pendanaan</span>
                <span className={`font-bold tabular-nums ${data.aktivitasPendanaan.net >= 0 ? '' : 'text-red-300'}`}>{data.aktivitasPendanaan.net >= 0 ? '+' : ''}{rupiah(data.aktivitasPendanaan.net)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-white/20 pt-2.5 mt-1">
                <span className="font-bold">Kas Akhir Periode</span>
                <span className="text-lg font-extrabold tabular-nums">{rupiah(data.kasBerjalan)}</span>
              </div>
            </div>

            {/* Validasi */}
            <div className={`mt-4 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm ${data.validasiNeraca.cocok ? 'bg-white/15' : 'bg-red-500/30'}`}>
              {data.validasiNeraca.cocok
                ? <><CheckCircle size={16} className="shrink-0" /><span className="font-semibold">Validasi Emas: Cocok dengan Neraca (Kas {rupiah(data.validasiNeraca.neracaKasTotal)})</span></>
                : <><AlertTriangle size={16} className="shrink-0" /><span className="font-semibold">TIDAK COCOK — Arus Kas {rupiah(data.kasBerjalan)} ≠ Neraca {rupiah(data.validasiNeraca.neracaKasTotal)}</span></>
              }
            </div>
          </div>

          <p className="text-[10px] text-slate-400 text-right">Arus Kas per {data.periode.endDate}</p>
        </>
      )}

      {/* Print Modal */}
      <ReportPrintLayout title="LAPORAN ARUS KAS" isOpen={printOpen} onClose={() => setPrintOpen(false)} periodLabel={periodLabelArus}>
        {data && <div className="space-y-0">
          <div className="flex justify-between border-b border-slate-800 pb-1 mb-3 font-bold text-[11px]">
            <span>Akun Lawan</span>
            <span>Jumlah (Rp)</span>
          </div>

          {/* A. Operasi */}
          <p className="font-bold text-[11px] mt-2 mb-0.5">A. Arus Kas dari Aktivitas Operasi</p>
          {data.aktivitasOperasi.detail.filter(d => d.net !== 0).map(d => (
            <div key={d.kode} className="flex justify-between text-[11px] py-0.5">
              <span className="text-slate-700 ml-3"><span className="text-slate-400">{d.kode}</span> {d.nama}</span>
              <span className={`tabular-nums ${d.net < 0 ? 'text-red-600' : ''}`}>{d.net < 0 ? '(' + rupiah(Math.abs(d.net)) + ')' : rupiah(d.net)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-[11px] border-t border-slate-400 py-0.5">
            <span>Arus Kas Bersih dari Aktivitas Operasi</span>
            <span className={`tabular-nums ${data.aktivitasOperasi.net < 0 ? 'text-red-600' : ''}`}>{data.aktivitasOperasi.net < 0 ? '(' + rupiah(Math.abs(data.aktivitasOperasi.net)) + ')' : rupiah(data.aktivitasOperasi.net)}</span>
          </div>

          {/* B. Investasi */}
          <p className="font-bold text-[11px] mt-2 mb-0.5">B. Arus Kas dari Aktivitas Investasi</p>
          {data.aktivitasInvestasi.detail.filter(d => d.net !== 0).map(d => (
            <div key={d.kode} className="flex justify-between text-[11px] py-0.5">
              <span className="text-slate-700 ml-3"><span className="text-slate-400">{d.kode}</span> {d.nama}</span>
              <span className={`tabular-nums ${d.net < 0 ? 'text-red-600' : ''}`}>{d.net < 0 ? '(' + rupiah(Math.abs(d.net)) + ')' : rupiah(d.net)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-[11px] border-t border-slate-400 py-0.5">
            <span>Arus Kas Bersih dari Aktivitas Investasi</span>
            <span className={`tabular-nums ${data.aktivitasInvestasi.net < 0 ? 'text-red-600' : ''}`}>{data.aktivitasInvestasi.net < 0 ? '(' + rupiah(Math.abs(data.aktivitasInvestasi.net)) + ')' : rupiah(data.aktivitasInvestasi.net)}</span>
          </div>

          {/* C. Pendanaan */}
          <p className="font-bold text-[11px] mt-2 mb-0.5">C. Arus Kas dari Aktivitas Pendanaan</p>
          {data.aktivitasPendanaan.detail.filter(d => d.net !== 0).map(d => (
            <div key={d.kode} className="flex justify-between text-[11px] py-0.5">
              <span className="text-slate-700 ml-3"><span className="text-slate-400">{d.kode}</span> {d.nama}</span>
              <span className={`tabular-nums ${d.net < 0 ? 'text-red-600' : ''}`}>{d.net < 0 ? '(' + rupiah(Math.abs(d.net)) + ')' : rupiah(d.net)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-[11px] border-t border-slate-400 py-0.5">
            <span>Arus Kas Bersih dari Aktivitas Pendanaan</span>
            <span className={`tabular-nums ${data.aktivitasPendanaan.net < 0 ? 'text-red-600' : ''}`}>{data.aktivitasPendanaan.net < 0 ? '(' + rupiah(Math.abs(data.aktivitasPendanaan.net)) + ')' : rupiah(data.aktivitasPendanaan.net)}</span>
          </div>

          {/* Summary */}
          <div className="flex justify-between font-bold text-[11px] border-t-2 border-slate-800 mt-2 py-0.5">
            <span>Kas Awal Periode</span>
            <span className="tabular-nums">{rupiah(data.kasTahunLalu)}</span>
          </div>
          <div className="flex justify-between text-[11px] py-0.5 ml-3">
            <span>Arus Kas Operasi</span>
            <span className={`tabular-nums ${data.aktivitasOperasi.net < 0 ? 'text-red-600' : ''}`}>{data.aktivitasOperasi.net < 0 ? '(' + rupiah(Math.abs(data.aktivitasOperasi.net)) + ')' : '+' + rupiah(data.aktivitasOperasi.net)}</span>
          </div>
          <div className="flex justify-between text-[11px] py-0.5 ml-3">
            <span>Arus Kas Investasi</span>
            <span className={`tabular-nums ${data.aktivitasInvestasi.net < 0 ? 'text-red-600' : ''}`}>{data.aktivitasInvestasi.net < 0 ? '(' + rupiah(Math.abs(data.aktivitasInvestasi.net)) + ')' : '+' + rupiah(data.aktivitasInvestasi.net)}</span>
          </div>
          <div className="flex justify-between text-[11px] py-0.5 ml-3">
            <span>Arus Kas Pendanaan</span>
            <span className={`tabular-nums ${data.aktivitasPendanaan.net < 0 ? 'text-red-600' : ''}`}>{data.aktivitasPendanaan.net < 0 ? '(' + rupiah(Math.abs(data.aktivitasPendanaan.net)) + ')' : '+' + rupiah(data.aktivitasPendanaan.net)}</span>
          </div>
          <div className="flex justify-between font-bold text-[12px] border-t-2 border-slate-800 mt-2 py-1">
            <span>KAS AKHIR PERIODE</span>
            <span className="tabular-nums">{rupiah(data.kasBerjalan)}</span>
          </div>
        </div>}
      </ReportPrintLayout>
    </div>
  );
}
