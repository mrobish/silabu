import { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Users,
  Calendar,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
  FileText,
  X,
  Phone,
  MapPin,
  BookOpen,
} from 'lucide-react';
import ReportPrintLayout from './ReportPrintLayout';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Contact {
  id: string;
  nama: string;
  telepon?: string;
  alamat?: string;
}

interface Transaction {
  tanggal: string;
  noJurnal: string;
  keterangan: string;
  referensi?: string;
  tipeTransaksi?: string;
  debit: number;
  kredit: number;
  saldo: number;
}

interface BukuPembantuRow {
  contactId: string;
  nama: string;
  telepon?: string;
  alamat?: string;
  akunKode?: string;
  akunNama?: string;
  saldoAwal: number;
  saldoAkhir: number;
  transactions: Transaction[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const token = () =>
  localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';

const rupiah = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition';
const br = 'rounded-2xl border border-white/70 bg-white/80 backdrop-blur-xl shadow-sm';

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const fmtIdDate = (d: string) => {
  const p = d.split('-');
  return `${parseInt(p[2])} ${MONTHS_ID[parseInt(p[1]) - 1]} ${p[0]}`;
};

const fmtDateShort = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return d;
  }
};

// ─── CSV Export ──────────────────────────────────────────────────────────────
function exportCsv(data: BukuPembantuRow[]) {
  const header = [
    'Kontak', 'Akun', 'Saldo Awal',
    'Tanggal', 'No Jurnal', 'Keterangan', 'Referensi', 'Tipe', 'Debit', 'Kredit', 'Saldo',
    'Saldo Akhir',
  ];
  const rows: string[][] = [];
  for (const c of data) {
    rows.push([
      c.nama, `${c.akunKode} - ${c.akunNama}`, String(c.saldoAwal),
      '', '', 'SALDO AWAL', '', '', '', '', String(c.saldoAwal), '',
    ]);
    for (const t of c.transactions) {
      rows.push([
        '', '', '',
        fmtDateShort(t.tanggal), t.noJurnal, t.keterangan, t.referensi || '',
        t.tipeTransaksi || '', String(t.debit), String(t.kredit), String(t.saldo), '',
      ]);
    }
    rows.push([
      '', '', '',
      '', '', 'SALDO AKHIR', '', '', '', '', String(c.saldoAkhir), '',
    ]);
  }
  const csvContent =
    '\uFEFF' +
    [header, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'buku-pembantu-piutang.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Accordion Section ──────────────────────────────────────────────────────
function ContactSection({
  row,
  startDate,
  defaultOpen,
}: {
  row: BukuPembantuRow;
  startDate: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`${br} overflow-hidden transition hover:shadow-md`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-3 w-full px-5 py-4 text-left hover:bg-blue-50/30 transition"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-600 shrink-0">
          <Users size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900 truncate">{row.nama}</h3>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
            {row.telepon && (
              <span className="inline-flex items-center gap-1">
                <Phone size={10} /> {row.telepon}
              </span>
            )}
            {row.alamat && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={10} /> {row.alamat}
              </span>
            )}
            {row.akunKode && (
              <span className="inline-flex items-center gap-1">
                <BookOpen size={10} /> {row.akunKode} — {row.akunNama}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 mr-2">
          <p className="text-xs text-slate-400">Saldo Akhir</p>
          <p className="text-sm font-bold text-blue-700 tabular-nums">{rupiah(row.saldoAkhir)}</p>
        </div>
        {open ? (
          <ChevronDown size={18} className="text-slate-400 shrink-0" />
        ) : (
          <ChevronRight size={18} className="text-slate-400 shrink-0" />
        )}
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Tanggal</th>
                  <th className="px-5 py-3 font-semibold">No Jurnal</th>
                  <th className="px-5 py-3 font-semibold">Keterangan</th>
                  <th className="px-5 py-3 font-semibold text-right">Debit</th>
                  <th className="px-5 py-3 font-semibold text-right">Kredit</th>
                  <th className="px-5 py-3 font-semibold text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Saldo Awal */}
                <tr className="bg-blue-50/40">
                  <td className="px-5 py-2.5 text-xs text-slate-500" colSpan={1}>
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={12} />
                      {startDate ? fmtIdDate(startDate) : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-2.5" colSpan={2}>
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                      Saldo Awal
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right text-xs text-slate-400">—</td>
                  <td className="px-5 py-2.5 text-right text-xs text-slate-400">—</td>
                  <td className="px-5 py-2.5 text-right font-bold text-slate-900 tabular-nums">
                    {rupiah(row.saldoAwal)}
                  </td>
                </tr>

                {/* Transactions */}
                {row.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-sm text-slate-400 italic">
                      Belum ada transaksi di periode ini.
                    </td>
                  </tr>
                ) : (
                  row.transactions.map((t, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-2.5 text-slate-600">{fmtDateShort(t.tanggal)}</td>
                      <td className="px-5 py-2.5">
                        <span className="font-mono text-xs text-blue-600">{t.noJurnal}</span>
                      </td>
                      <td className="px-5 py-2.5 text-slate-900">{t.keterangan || '-'}</td>
                      <td
                        className={
                          'px-5 py-2.5 text-right font-medium tabular-nums ' +
                          (t.debit > 0 ? 'text-blue-700' : 'text-slate-300')
                        }
                      >
                        {t.debit > 0 ? rupiah(t.debit) : '—'}
                      </td>
                      <td
                        className={
                          'px-5 py-2.5 text-right font-medium tabular-nums ' +
                          (t.kredit > 0 ? 'text-indigo-700' : 'text-slate-300')
                        }
                      >
                        {t.kredit > 0 ? rupiah(t.kredit) : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-right font-bold text-slate-900 tabular-nums">
                        {rupiah(t.saldo)}
                      </td>
                    </tr>
                  ))
                )}

                {/* Saldo Akhir */}
                <tr className="bg-blue-50/60 border-t-2 border-blue-200">
                  <td colSpan={3} className="px-5 py-3 text-right text-xs font-bold text-blue-700 uppercase">
                    Saldo Akhir
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-blue-700 tabular-nums">
                    {rupiah(row.transactions.reduce((s, t) => s + t.debit, 0))}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-indigo-700 tabular-nums">
                    {rupiah(row.transactions.reduce((s, t) => s + t.kredit, 0))}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-blue-800 text-base tabular-nums">
                    {rupiah(row.saldoAkhir)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className={`${br} p-5`}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="h-3 w-60 rounded bg-slate-100" />
            </div>
            <div className="h-4 w-24 rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function BukuPembantuPiutangPage() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState('');
  const [startDate, setStartDate] = useState(`${y}-${m}-01`);
  const [endDate, setEndDate] = useState(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
  const [data, setData] = useState<BukuPembantuRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [printOpen, setPrintOpen] = useState(false);

  const periodLabel = `Periode: ${fmtIdDate(startDate)} s.d ${fmtIdDate(endDate)}`;

  // Fetch pelanggan contacts
  useEffect(() => {
    fetch('/api/accounting/contacts?tipe=pelanggan', {
      headers: { Authorization: 'Bearer ' + token() },
    })
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : d.data || d.contacts || [];
        setContacts(list);
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      if (contactId) params.set('contact_id', contactId);
      const res = await fetch('/api/accounting/buku-pembantu/piutang?' + params.toString(), {
        headers: { Authorization: 'Bearer ' + token() },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat data');
      setData(json.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [contactId, startDate, endDate]);

  // Auto-fetch on mount
  useEffect(() => {
    if (!initialLoading) fetchData();
  }, [initialLoading, fetchData]);

  // Summary
  const totalSaldoAwal = data.reduce((s, d) => s + d.saldoAwal, 0);
  const totalSaldoAkhir = data.reduce((s, d) => s + d.saldoAkhir, 0);
  const totalTransaksi = data.reduce((s, d) => s + d.transactions.length, 0);

  if (initialLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-48 rounded bg-slate-200 animate-pulse" />
            <div className="h-3 w-64 rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
        <Skeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-600">
          <Wallet size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-900">Buku Pembantu Piutang</h2>
          <p className="text-xs text-slate-500">
            Subsidiary Ledger — Rincian piutang per pelanggan dengan saldo berjalan
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => exportCsv(data)}
            disabled={!data.length}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-blue-300 transition whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={16} className="inline -mt-0.5 mr-1" /> CSV
          </button>
          <button
            type="button"
            onClick={() => setPrintOpen(true)}
            disabled={!data.length}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-blue-300 transition whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer size={16} className="inline -mt-0.5 mr-1" /> Cetak
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={`${br} p-4 sm:p-5 relative z-10`}>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          {/* Contact dropdown */}
          <div className="sm:col-span-4">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Pelanggan
            </label>
            <select
              value={contactId}
              onChange={e => setContactId(e.target.value)}
              className={inputCls}
            >
              <option value="">Semua Pelanggan</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Dari Tanggal
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* End date */}
          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Sampai Tanggal
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Fetch button */}
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:shadow-xl transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? 'Memuat...' : 'Tampilkan'}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 flex items-center gap-2">
          <X size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && <Skeleton />}

      {/* Summary Cards */}
      {!loading && data.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase">Total Saldo Awal</p>
            <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">{rupiah(totalSaldoAwal)}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
            <p className="text-xs font-semibold text-blue-500 uppercase">Total Saldo Akhir</p>
            <p className="mt-1 text-lg font-bold text-blue-700 tabular-nums">{rupiah(totalSaldoAkhir)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm col-span-2 sm:col-span-1">
            <p className="text-xs font-semibold text-slate-400 uppercase">Jumlah Transaksi</p>
            <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
              {totalTransaksi.toLocaleString('id-ID')} transaksi
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && data.length === 0 && !error && (
        <div className="text-center py-16">
          <FileText size={48} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500 font-medium">Belum ada data</p>
          <p className="text-xs text-slate-400 mt-1">
            Pilih pelanggan dan rentang tanggal, lalu klik "Tampilkan"
          </p>
        </div>
      )}

      {/* Per-Contact Accordion */}
      {!loading && data.length > 0 && (
        <div className="space-y-3">
          {data.map(row => (
            <ContactSection
              key={row.contactId}
              row={row}
              startDate={startDate}
              defaultOpen={data.length === 1}
            />
          ))}
        </div>
      )}

      {/* Footer note */}
      <p className="text-[10px] text-slate-400 text-right">
        Buku Pembantu Piutang · SILABU DIGI
      </p>

      {/* Print Modal */}
      <ReportPrintLayout
        title="BUKU PEMBANTU PIUTANG"
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        periodLabel={periodLabel}
        landscape={true}
      >
        {data.length > 0 && (
          <div className="text-[11px] space-y-6">
            {data.map(row => (
              <div key={row.contactId}>
                <div className="mb-2 font-bold text-[12px] border-b border-slate-800 pb-1">
                  {row.nama}
                  {row.telepon ? ` · ${row.telepon}` : ''}
                  {row.alamat ? ` · ${row.alamat}` : ''}
                  {row.akunKode ? ` (${row.akunKode} — ${row.akunNama})` : ''}
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left py-1 pr-2 font-bold">Tanggal</th>
                      <th className="text-left py-1 pr-2 font-bold">No Jurnal</th>
                      <th className="text-left py-1 pr-2 font-bold">Keterangan</th>
                      <th className="text-left py-1 pr-2 font-bold">Referensi</th>
                      <th className="text-right py-1 pr-2 font-bold">Debit</th>
                      <th className="text-right py-1 pr-2 font-bold">Kredit</th>
                      <th className="text-right py-1 font-bold">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Saldo Awal */}
                    <tr className="border-b border-slate-200 bg-blue-50/30">
                      <td className="py-1 pr-2 text-slate-600">{fmtDateShort(startDate)}</td>
                      <td className="py-1 pr-2 text-slate-600" colSpan={3}>
                        <em>Saldo Awal</em>
                      </td>
                      <td className="py-1 pr-2 text-right">—</td>
                      <td className="py-1 pr-2 text-right">—</td>
                      <td className="py-1 text-right font-semibold tabular-nums">
                        {rupiah(row.saldoAwal)}
                      </td>
                    </tr>
                    {row.transactions.map((t, i) => (
                      <tr key={i} className="border-b border-slate-200">
                        <td className="py-1 pr-2 text-slate-600">{fmtDateShort(t.tanggal)}</td>
                        <td className="py-1 pr-2 font-mono text-slate-600">{t.noJurnal}</td>
                        <td className="py-1 pr-2 text-slate-800">{t.keterangan || '-'}</td>
                        <td className="py-1 pr-2 text-slate-600">{t.referensi || '-'}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">
                          {t.debit > 0 ? rupiah(t.debit) : '—'}
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums">
                          {t.kredit > 0 ? rupiah(t.kredit) : '—'}
                        </td>
                        <td className="py-1 text-right tabular-nums">{rupiah(t.saldo)}</td>
                      </tr>
                    ))}
                    {/* Saldo Akhir */}
                    <tr className="border-t-2 border-slate-800 font-bold">
                      <td colSpan={4} className="py-1.5 pr-2 text-right uppercase">Saldo Akhir</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {rupiah(row.transactions.reduce((s, t) => s + t.debit, 0))}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {rupiah(row.transactions.reduce((s, t) => s + t.kredit, 0))}
                      </td>
                      <td className="py-1.5 text-right font-bold tabular-nums">
                        {rupiah(row.saldoAkhir)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </ReportPrintLayout>

      {/* Print-only @media CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
