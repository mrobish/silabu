import { useState, useEffect, useRef } from 'react';
import { BookOpen, Calendar, FileText, DollarSign, Search, ChevronDown, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────
interface CoAAccount { id: string; kode: string; nama: string; isPostable?: boolean; is_postable?: boolean; level?: number; }
interface MutasiRow { noJurnal: string; tanggal: string; referensi: string; keterangan: string; tipeTransaksi: string; debit: number; kredit: number; saldoBerjalan: number; }
interface BukuBesarData {
  akun: { id: string; kode: string; nama: string; saldoNormal: string };
  periode: { startDate: string | null; endDate: string | null };
  saldoAwal: number;
  saldoAkhir: number;
  totalDebit: number;
  totalKredit: number;
  mutasi: MutasiRow[];
}

// ─── Helpers ─────────────────────────────────────────────────
const token = () => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
const rupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID');
const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return d; } };
const today = () => new Date().toISOString().slice(0, 10);
const startOfYear = () => new Date().getFullYear() + '-01-01';

// ─── Component ───────────────────────────────────────────────
export default function BukuBesarPage() {
  const [coaList, setCoaList] = useState<CoAAccount[]>([]);
  const [akunId, setAkunId] = useState('');
  const [search, setSearch] = useState('');
  const [openSearch, setOpenSearch] = useState(false);
  const [startDate, setStartDate] = useState(startOfYear);
  const [endDate, setEndDate] = useState(today);
  const [data, setData] = useState<BukuBesarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/accounting/coa', { headers: { Authorization: 'Bearer ' + token() } })
      .then(r => r.json())
      .then(d => {
        const all: CoAAccount[] = Array.isArray(d) ? d : d.coa || d.accounts || [];
        setCoaList(all.filter((a: CoAAccount) => a.isPostable ?? a.is_postable));
      })
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpenSearch(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedAkun = coaList.find(a => a.id === akunId);

  const filteredCoa = coaList.filter(a => {
    const q = search.toLowerCase();
    return a.kode.includes(q) || a.nama.toLowerCase().includes(q);
  });

  async function fetchData() {
    if (!akunId) { setError('Pilih akun terlebih dahulu'); return; }
    setLoading(true); setError(''); setData(null);
    try {
      const params = new URLSearchParams({ akun_id: akunId });
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const res = await fetch('/api/accounting/buku-besar?' + params.toString(), { headers: { Authorization: 'Bearer ' + token() } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat data');
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Buku Besar</h1>
          <p className="text-sm text-slate-500">Rincian mutasi per akun dengan saldo berjalan.</p>
        </div>
      </div>

      {/* Filter Card */}
      <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
          {/* CoA dropdown */}
          <div className="sm:col-span-2 relative" ref={dropdownRef}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Pilih Akun</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={openSearch ? search : (selectedAkun ? selectedAkun.kode + ' — ' + selectedAkun.nama : '')}
                onChange={e => { setSearch(e.target.value); if (!openSearch) setOpenSearch(true); }}
                onFocus={() => { setOpenSearch(true); setSearch(''); }}
                placeholder="Ketik kode atau nama akun..."
                className={inputCls + ' pl-10 pr-10'}
              />
              {(selectedAkun || openSearch) && (
                <button type="button" onClick={() => { setAkunId(''); setSearch(''); setOpenSearch(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {openSearch && (
              <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                {filteredCoa.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400 italic">Akun tidak ditemukan</p>
                ) : filteredCoa.map(a => (
                  <button key={a.id} type="button"
                    onClick={() => { setAkunId(a.id); setSearch(a.kode + ' — ' + a.nama); setOpenSearch(false); setData(null); }}
                    className={'w-full text-left px-4 py-2.5 text-sm transition hover:bg-emerald-50 ' +
                      (akunId === a.id ? 'bg-emerald-50 font-medium text-emerald-700' : 'text-slate-700')}>
                    <span className="font-mono font-semibold text-emerald-600">{a.kode}</span>{' — '}<span>{a.nama}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Start date */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Dari Tanggal</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
          </div>

          {/* End date */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Sampai Tanggal</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
          </div>

          {/* Submit button */}
          <div>
            <button type="button" onClick={fetchData}
              disabled={!akunId || loading}
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:shadow-xl transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
              {loading ? 'Memuat...' : 'Tampilkan'}
            </button>
          </div>
        </div>

        {/* Selected akun badge */}
        {data?.akun && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="font-mono">{data.akun.kode}</span> {data.akun.nama}
            </span>
            <span className={'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ' +
              (data.akun.saldoNormal === 'D' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700')}>
              Normal {data.akun.saldoNormal === 'D' ? 'Debit' : 'Kredit'}
            </span>
          </div>
        )}
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}

      {/* Ledger Table */}
      {data && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase">Saldo Awal</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{rupiah(data.saldoAwal)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase">Total Debit</p>
              <p className="mt-1 text-lg font-bold text-blue-600">{rupiah(data.totalDebit)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase">Total Kredit</p>
              <p className="mt-1 text-lg font-bold text-purple-600">{rupiah(data.totalKredit)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
              <p className="text-xs font-semibold text-emerald-500 uppercase">Saldo Akhir</p>
              <p className="mt-1 text-lg font-bold text-emerald-700">{rupiah(data.saldoAkhir)}</p>
            </div>
          </div>

          {/* Ledger table */}
          <div className="rounded-3xl border border-white/70 bg-white/80 shadow-sm backdrop-blur-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Tanggal</th>
                    <th className="px-5 py-3.5 font-semibold">No. Bukti</th>
                    <th className="px-5 py-3.5 font-semibold">Keterangan</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Debit</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Kredit</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Baris Saldo Awal — hanya jika ada saldo */}
                  {data.saldoAwal !== 0 && (
                  <tr className="bg-slate-50/80">
                    <td className="px-5 py-3 font-semibold text-slate-500 text-xs" colSpan={1}>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {startDate ? fmtDate(startDate) : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Saldo Awal</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 italic" colSpan={1}>Saldo awal periode</td>
                    <td className="px-5 py-3 text-right text-xs text-slate-400">—</td>
                    <td className="px-5 py-3 text-right text-xs text-slate-400">—</td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900">{rupiah(data.saldoAwal)}</td>
                  </tr>
                  )}

                  {/* Mutasi rows */}
                  {data.mutasi.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400 italic">Belum ada transaksi di periode ini.</td></tr>
                  )}
                  {data.mutasi.map((m, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-3 text-slate-600">{fmtDate(m.tanggal)}</td>
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs text-emerald-600">{m.noJurnal}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-900">{m.keterangan || '-'}</td>
                      <td className={'px-5 py-3 text-right font-medium ' + (m.debit > 0 ? 'text-blue-700' : 'text-slate-300')}>
                        {m.debit > 0 ? rupiah(m.debit) : '—'}
                      </td>
                      <td className={'px-5 py-3 text-right font-medium ' + (m.kredit > 0 ? 'text-purple-700' : 'text-slate-300')}>
                        {m.kredit > 0 ? rupiah(m.kredit) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">{rupiah(m.saldoBerjalan)}</td>
                    </tr>
                  ))}

                  {/* Baris Total */}
                  {data.mutasi.length > 0 && (
                    <tr className="bg-slate-50/80 border-t-2 border-slate-200">
                      <td colSpan={3} className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total Mutasi</td>
                      <td className="px-5 py-3 text-right font-bold text-blue-700">{rupiah(data.totalDebit)}</td>
                      <td className="px-5 py-3 text-right font-bold text-purple-700">{rupiah(data.totalKredit)}</td>
                      <td className="px-5 py-3 text-right font-bold text-emerald-700">{rupiah(data.saldoAkhir)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!data && !error && !loading && (
        <div className="rounded-3xl border border-white/70 bg-white/80 p-10 text-center shadow-sm backdrop-blur-xl">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="mt-4 text-sm text-slate-400">Pilih akun dan klik <strong>Tampilkan</strong> untuk melihat buku besar.</p>
        </div>
      )}
    </div>
  );
}
