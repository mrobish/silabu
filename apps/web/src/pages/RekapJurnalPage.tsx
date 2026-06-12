import { useState, useEffect } from 'react';
import { FileText, Search } from 'lucide-react';
import ReportPrintLayout from './ReportPrintLayout';

// ─── Types ───────────────────────────────────────────────────
interface CoAAccount { id: string; kode: string; nama: string; }
interface JournalLine { id: string; akunId: string; debit: number; kredit: number; keterangan: string; }
interface JournalEntry {
  id: string;
  noJurnal: string;
  tanggal: string;
  keterangan: string;
  referensi: string;
  tipeTransaksi: string;
  lines: JournalLine[];
}

// ─── Helpers ─────────────────────────────────────────────────
const token = () => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
const rupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID');
const rupiahPrint = (n: number) => n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return d; } };
const fmtDateShort = (d: string) => { try { return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return d; } };
const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// ─── Component ───────────────────────────────────────────────
export default function RekapJurnalPage() {
  const now = new Date();
  const [coaMap, setCoaMap] = useState<Record<string, CoAAccount>>({});
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterMode, setFilterMode] = useState<'bulanan' | 'tahunan'>('bulanan');
  const [journalType, setJournalType] = useState<'ALL' | 'GENERAL' | 'ADJUSTMENT'>('ALL');
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [printOpen, setPrintOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const periodLabel = filterMode === 'bulanan'
    ? `Periode: ${MONTHS_ID[bulan - 1]} ${tahun}`
    : `Tahun: ${tahun}`;

  const startDate = filterMode === 'bulanan'
    ? `${tahun}-${String(bulan).padStart(2, '0')}-01`
    : `${tahun}-01-01`;
  const endDate = filterMode === 'bulanan'
    ? `${tahun}-${String(bulan).padStart(2, '0')}-${String(new Date(tahun, bulan, 0).getDate()).padStart(2, '0')}`
    : `${tahun}-12-31`;

  // Load CoA for kode/nama lookup
  useEffect(() => {
    fetch('/api/accounting/coa', { headers: { Authorization: 'Bearer ' + token() } })
      .then(r => r.json())
      .then(d => {
        const all: CoAAccount[] = Array.isArray(d) ? d : d.coa || d.accounts || [];
        const map: Record<string, CoAAccount> = {};
        for (const a of all) map[a.id] = a;
        setCoaMap(map);
      })
      .catch(() => {});
  }, []);

  async function fetchData() {
    setLoading(true); setError(''); setLoaded(false);
    try {
      const params = new URLSearchParams({ tahun: String(tahun) });
      if (filterMode === 'bulanan') params.set('bulan', String(bulan));
      if (journalType !== 'ALL') params.set('tipeTransaksi', journalType);
      params.set('limit', '200');
      const res = await fetch('/api/accounting/jurnal-umum?' + params.toString(), { headers: { Authorization: 'Bearer ' + token() } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat data');
      const list: JournalEntry[] = Array.isArray(json) ? json : json.entries || json.data || [];
      setEntries(list);
      setLoaded(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Flatten all lines for grand total
  const allLines = entries.flatMap(e => e.lines || []);
  const grandDebit = allLines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const grandKredit = allLines.reduce((s, l) => s + Number(l.kredit || 0), 0);
  const isBalanced = Math.abs(grandDebit - grandKredit) < 0.01;

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rekap Transaksi Jurnal</h1>
          <p className="text-sm text-slate-500">Master audit trail — semua transaksi jurnal BUM Desa.</p>
        </div>
      </div>

      {/* Filter Card */}
      <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          {/* Filter Mode Toggle */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Periode</label>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden">
              <button type="button" onClick={() => setFilterMode('bulanan')}
                className={'flex-1 px-3 py-2.5 text-xs font-bold transition ' + (filterMode === 'bulanan' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}>
                Bulanan
              </button>
              <button type="button" onClick={() => setFilterMode('tahunan')}
                className={'flex-1 px-3 py-2.5 text-xs font-bold transition ' + (filterMode === 'tahunan' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}>
                Tahunan
              </button>
            </div>
          </div>

          {/* Journal Type Filter */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tipe Jurnal</label>
            <select value={journalType} onChange={e => setJournalType(e.target.value as any)} className={inputCls + ' text-xs'}>
              <option value="ALL">Semua</option>
              <option value="GENERAL">Jurnal Umum</option>
              <option value="ADJUSTMENT">Penyesuaian</option>
            </select>
          </div>

          {/* Month (only when bulanan) */}
          {filterMode === 'bulanan' && (
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Bulan</label>
              <select value={bulan} onChange={e => setBulan(Number(e.target.value))} className={inputCls}>
                {MONTHS_ID.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}

          {/* Year */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tahun</label>
            <select value={tahun} onChange={e => setTahun(Number(e.target.value))} className={inputCls}>
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Action buttons */}
          <div className="sm:col-span-5 flex gap-2 justify-end">
            <button type="button" onClick={fetchData}
              disabled={loading}
              className="rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:shadow-xl transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
              {loading ? 'Memuat...' : 'Tampilkan'}
            </button>
            {loaded && entries.length > 0 && (
              <button type="button" onClick={() => setPrintOpen(true)}
                className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100 transition whitespace-nowrap">
                🖨️ Cetak
              </button>
            )}
          </div>
        </div>

        {/* Summary badges */}
        {loaded && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {periodLabel}
            </span>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              {entries.length} jurnal • {allLines.length} baris
            </span>
            <span className={'inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ' + (isBalanced ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
              {isBalanced ? '✓ Balance' : '✗ Tidak Balance!'}
            </span>
          </div>
        )}
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}

      {/* Data Table */}
      {loaded && entries.length > 0 && (
        <div className="rounded-3xl border border-white/70 bg-white/80 shadow-sm backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3.5 font-semibold w-28">Tanggal</th>
                  <th className="px-4 py-3.5 font-semibold w-28">No. Jurnal</th>
                  <th className="px-4 py-3.5 font-semibold">Keterangan</th>
                  <th className="px-4 py-3.5 font-semibold">Akun</th>
                  <th className="px-4 py-3.5 font-semibold text-right w-32">Debit</th>
                  <th className="px-4 py-3.5 font-semibold text-right w-32">Kredit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry, ei) => {
                  const lines = entry.lines || [];
                  return lines.map((line, li) => {
                    const akun = coaMap[line.akunId];
                    const isFirst = li === 0;
                    return (
                      <tr key={entry.id + '-' + li} className={'hover:bg-slate-50/50 transition ' + (isFirst && ei > 0 ? 'border-t-2 border-t-slate-200' : '')}>
                        <td className="px-4 py-2.5 text-slate-600 text-xs">
                          {isFirst ? fmtDate(entry.tanggal) : ''}
                        </td>
                        <td className="px-4 py-2.5">
                          {isFirst ? <>
                            <span className="font-mono text-xs font-semibold text-emerald-600">{entry.noJurnal}</span>
                            {entry.tipeTransaksi === 'ADJUSTMENT' && <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">ADJ</span>}
                          </> : ''}
                        </td>
                        <td className="px-4 py-2.5 text-slate-900 text-xs">
                          {isFirst ? (entry.keterangan || '-') : ''}
                          {isFirst && entry.referensi ? <span className="block text-slate-400 text-[10px]">Ref: {entry.referensi}</span> : ''}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          <span className="font-mono text-emerald-600">{akun?.kode || line.akunId}</span>
                          <span className="ml-1 text-slate-600">{akun?.nama || ''}</span>
                        </td>
                        <td className={'px-4 py-2.5 text-right font-medium text-xs ' + (Number(line.debit) > 0 ? 'text-blue-700' : 'text-slate-300')}>
                          {Number(line.debit) > 0 ? rupiah(Number(line.debit)) : '—'}
                        </td>
                        <td className={'px-4 py-2.5 text-right font-medium text-xs ' + (Number(line.kredit) > 0 ? 'text-purple-700' : 'text-slate-300')}>
                          {Number(line.kredit) > 0 ? rupiah(Number(line.kredit)) : '—'}
                        </td>
                      </tr>
                    );
                  });
                })}

                {/* Grand Total */}
                <tr className="bg-slate-100 border-t-2 border-slate-300">
                  <td colSpan={4} className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wide">
                    Grand Total ({entries.length} Jurnal)
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700">{rupiah(grandDebit)}</td>
                  <td className="px-4 py-3 text-right font-bold text-purple-700">{rupiah(grandKredit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {loaded && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-300">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="mt-4 text-sm text-slate-400">Tidak ada jurnal ditemukan untuk periode ini.</p>
        </div>
      )}
      {!loaded && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-300">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="mt-4 text-sm text-slate-400">Pilih periode dan klik <strong>Tampilkan</strong> untuk melihat rekap jurnal.</p>
        </div>
      )}

      {/* Print Preview */}
      {printOpen && loaded && entries.length > 0 && (
        <ReportPrintLayout
          title="REKAPITULASI JURNAL UMUM"
          isOpen={printOpen}
          onClose={() => setPrintOpen(false)}
          periodLabel={periodLabel + ` (${fmtDate(startDate)} — ${fmtDate(endDate)})`}
          landscape
        >
          {/* Print Table */}
          <table className="w-full border-collapse text-[9px]" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 px-1.5 py-1.5 text-left font-bold" style={{ width: '10%' }}>Tanggal</th>
                <th className="border border-slate-400 px-1.5 py-1.5 text-left font-bold" style={{ width: '10%' }}>No. Ref/Bukti</th>
                <th className="border border-slate-400 px-1.5 py-1.5 text-left font-bold" style={{ width: '22%' }}>Uraian Transaksi</th>
                <th className="border border-slate-400 px-1.5 py-1.5 text-left font-bold" style={{ width: '24%' }}>Kode &amp; Nama Akun</th>
                <th className="border border-slate-400 px-1.5 py-1.5 text-right font-bold" style={{ width: '17%' }}>Debit (Rp)</th>
                <th className="border border-slate-400 px-1.5 py-1.5 text-right font-bold" style={{ width: '17%' }}>Kredit (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const lines = entry.lines || [];
                return lines.map((line, li) => {
                  const akun = coaMap[line.akunId];
                  const isFirst = li === 0;
                  return (
                    <tr key={'p-' + entry.id + '-' + li}>
                      <td className="border border-slate-300 px-1.5 py-1">{isFirst ? fmtDateShort(entry.tanggal) : ''}</td>
                      <td className="border border-slate-300 px-1.5 py-1 font-mono text-[8px]">{isFirst ? (entry.referensi || entry.noJurnal) : ''}</td>
                      <td className="border border-slate-300 px-1.5 py-1">{isFirst ? (entry.keterangan || '-') : ''}</td>
                      <td className="border border-slate-300 px-1.5 py-1">
                        <span className="font-mono">{akun?.kode || line.akunId}</span>{' '}
                        <span>{akun?.nama || ''}</span>
                      </td>
                      <td className="border border-slate-300 px-1.5 py-1 text-right">{Number(line.debit) > 0 ? rupiahPrint(Number(line.debit)) : ''}</td>
                      <td className="border border-slate-300 px-1.5 py-1 text-right">{Number(line.kredit) > 0 ? rupiahPrint(Number(line.kredit)) : ''}</td>
                    </tr>
                  );
                });
              })}

              {/* Grand Total */}
              <tr className="bg-slate-100 font-bold">
                <td colSpan={4} className="border border-slate-400 px-1.5 py-1.5 text-right uppercase text-[9px] tracking-wide">
                  Grand Total ({entries.length} Jurnal)
                </td>
                <td className="border border-slate-400 px-1.5 py-1.5 text-right">{rupiahPrint(grandDebit)}</td>
                <td className="border border-slate-400 px-1.5 py-1.5 text-right">{rupiahPrint(grandKredit)}</td>
              </tr>

              {/* Balance check */}
              <tr className={isBalanced ? 'bg-emerald-50' : 'bg-red-50'}>
                <td colSpan={6} className={'border border-slate-400 px-1.5 py-1.5 text-center font-bold text-[10px] ' + (isBalanced ? 'text-emerald-800' : 'text-red-800')}>
                  {isBalanced ? '✓ JURNAL BALANCE — Total Debit = Total Kredit' : '✗ JURNAL TIDAK BALANCE — Periksa kembali!'}
                </td>
              </tr>
            </tbody>
          </table>
        </ReportPrintLayout>
      )}
    </div>
  );
}
