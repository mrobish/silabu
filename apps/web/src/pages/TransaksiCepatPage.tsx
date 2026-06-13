import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, ArrowDownToLine, ArrowUpFromLine, CheckCircle, X,
  Search, Wallet, Landmark,
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
const rupiah = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const parseRupiah = (s: string) => Number(s.replace(/[^0-9]/g, '')) || 0;
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition';
const br = 'rounded-2xl border border-white/70 bg-white/80 backdrop-blur-xl shadow-sm';
const token = () => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';

// ── types ────────────────────────────────────────────────────────────────────
type Account = {
  id: string;
  kode: string;
  nama: string;
  jenisAkun?: string;
  jenis_akun?: string;
  isPostable?: boolean;
  is_postable?: boolean;
  isActive?: boolean;
  is_active?: boolean;
};

type EntryResp = {
  success: boolean;
  message: string;
  entry?: { id: string; noJurnal: string; no_jurnal?: string; tanggal: string; tipe: string; nominal: number; keterangan: string };
};

type Tipe = 'uang_masuk' | 'uang_keluar';

// ── click-outside hook ───────────────────────────────────────────────────────
function useClickOutside(cb: () => void) {
  const ref = useRef<HTMLElement | null>(null);
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cbRef.current();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return ref;
}

// ── Searchable Select ────────────────────────────────────────────────────────
function SearchSelect({
  value, onChange, options, placeholder, disabled, firstRef,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; sub?: string; group?: string }[];
  placeholder: string;
  disabled?: boolean;
  firstRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useClickOutside(() => setOpen(false));
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(q.toLowerCase()) ||
    (o.sub || '').toLowerCase().includes(q.toLowerCase()) ||
    (o.group || '').toLowerCase().includes(q.toLowerCase())
  );
  const selected = options.find(o => o.value === value);

  // group filtered items
  const groups: Record<string, typeof filtered> = {};
  filtered.forEach(o => {
    const g = o.group || '';
    if (!groups[g]) groups[g] = [];
    groups[g].push(o);
  });
  const groupKeys = Object.keys(groups);

  return (
    <div className="relative" ref={ref as any}>
      <button type="button" disabled={disabled}
        ref={firstRef as any}
        onClick={() => { setOpen(!open); setQ(''); }}
        className={`${inputCls} text-left flex items-center gap-2 ${!selected ? 'text-slate-400' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
        <span className="flex-1 truncate">{selected ? selected.label : placeholder}</span>
        <Search size={14} className="text-slate-400 shrink-0" />
      </button>
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full rounded-xl bg-white border border-slate-200 shadow-lg max-h-64 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Cari..."
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-emerald-400" />
          </div>
          <div className="overflow-y-auto max-h-52">
            {filtered.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">Tidak ditemukan</p>}
            {groupKeys.map(g => (
              <div key={g}>
                {g && (
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-100">
                    {g}
                  </div>
                )}
                {groups[g].map(o => (
                  <button key={o.value} type="button"
                    onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition ${o.value === value ? 'bg-emerald-50 font-semibold' : ''}`}>
                    <span className="text-slate-800">{o.label}</span>
                    {o.sub && <span className="text-slate-400 text-xs ml-1">— {o.sub}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Currency Input ───────────────────────────────────────────────────────────
function CurrencyInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [focused, setFocused] = useState(false);
  const display = focused ? value : (value ? rupiah(parseRupiah(value)) : '');
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      placeholder={placeholder || 'Rp 0'}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={e => {
        const digits = e.target.value.replace(/[^0-9]/g, '');
        onChange(digits);
      }}
      className={inputCls}
    />
  );
}

// ── categorize accounts ──────────────────────────────────────────────────────
function isKasBank(a: Account): boolean {
  const k = (a.kode || '').replace(/\s/g, '');
  return k.startsWith('1.1.01') || k.startsWith('1.1.02');
}

function categorizeMasuk(a: Account): string {
  const k = (a.kode || '').replace(/\s/g, '');
  if (k.startsWith('4')) return '💰 Pendapatan';
  if (k.startsWith('1.1.03')) return '👥 Piutang';
  if (k.startsWith('2.1.01') || k.startsWith('2.1.02')) return '📋 Utang';
  if (k.startsWith('3.1')) return '🏛️ Modal';
  return '📦 Lainnya';
}

function categorizeKeluar(a: Account): string {
  const k = (a.kode || '').replace(/\s/g, '');
  if (k.startsWith('5') || k.startsWith('6')) return '🏢 Beban Operasional';
  if (k.startsWith('2.1.01') || k.startsWith('2.1.02')) return '📋 Utang';
  if (k.startsWith('1.1.05')) return '📦 Persediaan';
  if (k.startsWith('1.3')) return '🏗️ Aset Tetap';
  if (k.startsWith('3.2')) return '💸 Prive';
  return '📦 Lainnya';
}

// ── Transaction Form ─────────────────────────────────────────────────────────
function TransactionForm({
  tipe, accounts, onSuccess, onBack,
}: {
  tipe: Tipe;
  accounts: Account[];
  onSuccess: (entry: NonNullable<EntryResp['entry']>) => void;
  onBack: () => void;
}) {
  const isMasuk = tipe === 'uang_masuk';

  const kasBankAccounts = accounts.filter(a => isKasBank(a));
  const targetAccounts = accounts.filter(a => !isKasBank(a) && (a.isPostable ?? a.is_postable ?? true) && (a.isActive ?? a.is_active ?? true));

  const [kasId, setKasId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [nominal, setNominal] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [keterangan, setKeterangan] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const firstRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // auto-focus first field
    setTimeout(() => firstRef.current?.focus(), 100);
  }, []);

  const selectedKas = kasBankAccounts.find(a => a.id === kasId);
  const selectedTarget = targetAccounts.find(a => a.id === targetId);

  // build options for target with grouping
  const targetOptions = targetAccounts.map(a => ({
    value: a.id,
    label: `${a.kode} — ${a.nama}`,
    sub: a.kode,
    group: isMasuk ? categorizeMasuk(a) : categorizeKeluar(a),
  }));

  const kasOptions = kasBankAccounts.map(a => ({
    value: a.id,
    label: `${a.kode} — ${a.nama}`,
  }));

  // journal preview
  const debitAccount = isMasuk ? selectedKas : selectedTarget;
  const creditAccount = isMasuk ? selectedTarget : selectedKas;
  const nominalNum = parseRupiah(nominal);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!kasId) e.kas = isMasuk ? 'Pilih akun kas/bank penerima' : 'Pilih akun kas/bank sumber';
    if (!targetId) e.target = isMasuk ? 'Pilih sumber penerimaan' : 'Pilih tujuan pengeluaran';
    if (!nominalNum || nominalNum <= 0) e.nominal = 'Nominal harus lebih dari 0';
    if (!tanggal) e.tanggal = 'Tanggal wajib diisi';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body: Record<string, any> = {
        tipe,
        tanggal,
        nominal: nominalNum,
        sumber_akun_id: kasId,
        target_akun_id: targetId,
        keterangan: keterangan || undefined,
      };
      const r = await fetch('/api/accounting/transaksi/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
        body: JSON.stringify(body),
      });
      const d: EntryResp = await r.json();
      if (r.ok && d.success && d.entry) {
        onSuccess(d.entry);
      } else {
        setErrors({ submit: d.message || 'Gagal menyimpan transaksi' });
      }
    } catch {
      setErrors({ submit: 'Terjadi kesalahan jaringan' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* back + title */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50 transition">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isMasuk ? 'bg-gradient-to-br from-emerald-500/20 to-green-500/20 text-emerald-600' : 'bg-gradient-to-br from-rose-500/20 to-red-500/20 text-rose-600'}`}>
          {isMasuk ? <ArrowDownToLine size={18} /> : <ArrowUpFromLine size={18} />}
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">
            {isMasuk ? '📥 Form Penerimaan Kas' : '📤 Form Pengeluaran Kas'}
          </h3>
          <p className="text-xs text-slate-500">
            {isMasuk ? 'Uang masuk ke Kas/Bank BUM Desa' : 'Uang keluar dari Kas/Bank BUM Desa'}
          </p>
        </div>
      </div>

      {/* form card */}
      <div className={`${br} p-5 space-y-5`}>
        {/* Kas/Bank */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            {isMasuk ? '🏦 Terima uang di mana?' : '🏦 Bayar dari mana?'}
          </label>
          <SearchSelect
            value={kasId}
            onChange={setKasId}
            options={kasOptions}
            placeholder={isMasuk ? 'Pilih kas/bank penerima...' : 'Pilih kas/bank sumber...'}
            firstRef={firstRef}
          />
          {errors.kas && <p className="text-xs text-red-500 mt-1">{errors.kas}</p>}
        </div>

        {/* Target account */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            {isMasuk ? '📝 Dari siapa / Untuk apa?' : '📝 Untuk apa / Ke siapa?'}
          </label>
          <SearchSelect
            value={targetId}
            onChange={setTargetId}
            options={targetOptions}
            placeholder={isMasuk ? 'Pilih sumber penerimaan...' : 'Pilih tujuan pengeluaran...'}
          />
          {errors.target && <p className="text-xs text-red-500 mt-1">{errors.target}</p>}
        </div>

        {/* Nominal */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">💵 Berapa jumlahnya?</label>
          <CurrencyInput value={nominal} onChange={setNominal} placeholder="Masukkan nominal..." />
          {errors.nominal && <p className="text-xs text-red-500 mt-1">{errors.nominal}</p>}
        </div>

        {/* Tanggal */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">📅 Tanggal</label>
          <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className={inputCls} />
          {errors.tanggal && <p className="text-xs text-red-500 mt-1">{errors.tanggal}</p>}
        </div>

        {/* Keterangan */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">📝 Keterangan <span className="text-slate-400 font-normal">(opsional)</span></label>
          <textarea value={keterangan} onChange={e => setKeterangan(e.target.value)}
            placeholder="Catatan tambahan..."
            rows={2}
            className={`${inputCls} resize-none`} />
        </div>

        {/* Journal Preview */}
        {(debitAccount || creditAccount) && nominalNum > 0 && (
          <div className={`${isMasuk ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'} rounded-xl border px-4 py-3`}>
            <p className={`text-xs font-bold mb-2 ${isMasuk ? 'text-emerald-700' : 'text-rose-700'}`}>📋 Preview Jurnal:</p>
            <div className="space-y-1 text-sm">
              <div className="flex items-baseline gap-2">
                <span className={`font-bold ${isMasuk ? 'text-emerald-600' : 'text-rose-600'}`}>Debit:</span>
                <span className="text-slate-800">
                  {debitAccount ? `${debitAccount.nama} (${debitAccount.kode})` : '...'}
                </span>
                <span className="ml-auto font-mono font-semibold text-slate-900">{rupiah(nominalNum)}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`font-bold ${isMasuk ? 'text-emerald-600' : 'text-rose-600'}`}>Credit:</span>
                <span className="text-slate-800">
                  {creditAccount ? `${creditAccount.nama} (${creditAccount.kode})` : '...'}
                </span>
                <span className="ml-auto font-mono font-semibold text-slate-900">{rupiah(nominalNum)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {errors.submit && (
          <div className="bg-red-50 rounded-xl px-4 py-3 text-xs text-red-700 flex items-center gap-2">
            <X size={14} className="shrink-0" /> {errors.submit}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onBack}
            className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
            Batal
          </button>
          <button type="button" onClick={submit} disabled={saving}
            className={`flex-1 rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-40 transition hover:shadow-xl ${isMasuk ? 'bg-gradient-to-r from-emerald-600 to-green-600' : 'bg-gradient-to-r from-rose-600 to-red-600'}`}>
            {saving ? 'Menyimpan...' : isMasuk ? '💾 Simpan Penerimaan' : '💾 Simpan Pengeluaran'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Success Screen ───────────────────────────────────────────────────────────
function SuccessScreen({
  entry, tipe, onAgain, onBack,
}: {
  entry: NonNullable<EntryResp['entry']>;
  tipe: Tipe;
  onAgain: () => void;
  onBack: () => void;
}) {
  const isMasuk = tipe === 'uang_masuk';
  const noJurnal = entry.noJurnal || entry.no_jurnal || '-';
  return (
    <div className="space-y-5">
      <div className={`${br} p-6 text-center`}>
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-4 ${isMasuk ? 'bg-gradient-to-br from-emerald-500/20 to-green-500/20' : 'bg-gradient-to-br from-rose-500/20 to-red-500/20'}`}>
          <CheckCircle size={32} className={isMasuk ? 'text-emerald-600' : 'text-rose-600'} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Transaksi Berhasil Disimpan!</h3>
        <p className="text-sm text-slate-500 mb-4">
          {isMasuk ? 'Penerimaan kas telah dicatat' : 'Pengeluaran kas telah dicatat'}
        </p>

        <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">No. Jurnal</span>
            <span className="font-bold text-emerald-700 tabular-nums">{noJurnal}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Tanggal</span>
            <span className="font-semibold text-slate-800">{entry.tanggal}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Nominal</span>
            <span className="font-bold text-slate-900 tabular-nums">{rupiah(entry.nominal)}</span>
          </div>
          {entry.keterangan && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Keterangan</span>
              <span className="text-slate-700">{entry.keterangan}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={onBack}
            className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
            Kembali ke Menu
          </button>
          <button onClick={onAgain}
            className={`flex-1 rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:shadow-xl ${isMasuk ? 'bg-gradient-to-r from-emerald-600 to-green-600' : 'bg-gradient-to-r from-rose-600 to-red-600'}`}>
            Buat Lagi (Jenis Sama)
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function TransaksiCepatPage() {
  const [view, setView] = useState<'menu' | 'form' | 'success'>('menu');
  const [activeTipe, setActiveTipe] = useState<Tipe | null>(null);
  const [lastEntry, setLastEntry] = useState<NonNullable<EntryResp['entry']> | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const r = await fetch('/api/accounting/chart-of-accounts', {
        headers: { Authorization: 'Bearer ' + token() },
      });
      const d = await r.json();
      const all: Account[] = (d.accounts || d.data || []).filter((a: any) =>
        (a.isPostable ?? a.is_postable ?? true) && (a.isActive ?? a.is_active ?? true)
      );
      setAccounts(all);
    } catch {
      setAccounts([]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const selectTipe = (t: Tipe) => {
    setActiveTipe(t);
    setView('form');
  };

  const goMenu = () => {
    setView('menu');
    setActiveTipe(null);
    setLastEntry(null);
  };

  const onSuccess = (entry: NonNullable<EntryResp['entry']>) => {
    setLastEntry(entry);
    setView('success');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-600">
          <Wallet size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-900">Kas &amp; Bank</h2>
          <p className="text-xs text-slate-500">Catat penerimaan dan pengeluaran kas/bank BUM Desa</p>
        </div>
      </div>

      {/* Menu View — Two big cards */}
      {view === 'menu' && loaded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Uang Masuk */}
          <button onClick={() => selectTipe('uang_masuk')}
            className={`${br} p-6 text-left transition hover:shadow-lg hover:-translate-y-0.5 group`}>
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white mb-4 shadow-lg shadow-emerald-500/20">
              <ArrowDownToLine size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Uang Masuk</h3>
            <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide mb-2">Penerimaan</p>
            <p className="text-sm text-slate-500 mb-5">
              Terima uang dari pelanggan, pendapatan, atau sumber lainnya
            </p>
            <span className="inline-block rounded-xl bg-emerald-50 px-5 py-2.5 text-sm font-bold text-emerald-700 group-hover:bg-emerald-100 transition">
              Buat Penerimaan →
            </span>
          </button>

          {/* Uang Keluar */}
          <button onClick={() => selectTipe('uang_keluar')}
            className={`${br} p-6 text-left transition hover:shadow-lg hover:-translate-y-0.5 group`}>
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white mb-4 shadow-lg shadow-rose-500/20">
              <ArrowUpFromLine size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Uang Keluar</h3>
            <p className="text-[11px] font-semibold text-rose-600 uppercase tracking-wide mb-2">Pengeluaran</p>
            <p className="text-sm text-slate-500 mb-5">
              Bayar beban, utang, beli barang, atau pengeluaran lainnya
            </p>
            <span className="inline-block rounded-xl bg-rose-50 px-5 py-2.5 text-sm font-bold text-rose-700 group-hover:bg-rose-100 transition">
              Buat Pengeluaran →
            </span>
          </button>
        </div>
      )}

      {/* Quick Transactions Section */}
      {view === 'menu' && loaded && (
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-600">
              <CheckCircle size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Transaksi Cepat</h3>
              <p className="text-xs text-slate-500">Panduan otomatis untuk transaksi umum</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Bayar Utang */}
            <button onClick={() => {/* TODO: implement bayar_utang form */}}
              className={`${br} p-5 text-left transition hover:shadow-lg hover:-translate-y-0.5 group`}>
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white mb-3 shadow-lg shadow-orange-500/20">
                <ArrowUpFromLine size={22} />
              </div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">Bayar Utang</h4>
              <p className="text-[11px] text-slate-500 mb-3">Bayar tagihan ke supplier</p>
              <span className="inline-block rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 group-hover:bg-orange-100 transition">
                Bayar →
              </span>
            </button>

            {/* Terima Piutang */}
            <button onClick={() => {/* TODO: implement terima_piutang form */}}
              className={`${br} p-5 text-left transition hover:shadow-lg hover:-translate-y-0.5 group`}>
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white mb-3 shadow-lg shadow-teal-500/20">
                <ArrowDownToLine size={22} />
              </div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">Terima Piutang</h4>
              <p className="text-[11px] text-slate-500 mb-3">Terima pembayaran dari pelanggan</p>
              <span className="inline-block rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 group-hover:bg-teal-100 transition">
                Terima →
              </span>
            </button>

            {/* Beli Persediaan */}
            <button onClick={() => {/* TODO: implement beli_persediaan form */}}
              className={`${br} p-5 text-left transition hover:shadow-lg hover:-translate-y-0.5 group`}>
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white mb-3 shadow-lg shadow-blue-500/20">
                <Landmark size={22} />
              </div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">Beli Persediaan</h4>
              <p className="text-[11px] text-slate-500 mb-3">Catat pembelian barang/stok</p>
              <span className="inline-block rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 group-hover:bg-blue-100 transition">
                Beli →
              </span>
            </button>

            {/* Jual Persediaan */}
            <button onClick={() => {/* TODO: implement jual_persediaan form */}}
              className={`${br} p-5 text-left transition hover:shadow-lg hover:-translate-y-0.5 group`}>
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 text-white mb-3 shadow-lg shadow-purple-500/20">
                <Wallet size={22} />
              </div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">Jual Persediaan</h4>
              <p className="text-[11px] text-slate-500 mb-3">Catat penjualan barang/stok</p>
              <span className="inline-block rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 group-hover:bg-purple-100 transition">
                Jual →
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {!loaded && (
        <div className="text-center py-12 text-sm text-slate-400">Memuat data akun...</div>
      )}

      {/* Form View */}
      {view === 'form' && activeTipe && loaded && (
        <TransactionForm
          key={activeTipe + '-' + Date.now()}
          tipe={activeTipe}
          accounts={accounts}
          onSuccess={onSuccess}
          onBack={goMenu}
        />
      )}

      {/* Success View */}
      {view === 'success' && activeTipe && lastEntry && (
        <SuccessScreen
          entry={lastEntry}
          tipe={activeTipe}
          onAgain={() => setView('form')}
          onBack={goMenu}
        />
      )}

      <p className="text-[10px] text-slate-400 text-right">Transaksi Cepat · penerimaan, pengeluaran, dan transaksi umum BUM Desa</p>
    </div>
  );
}
