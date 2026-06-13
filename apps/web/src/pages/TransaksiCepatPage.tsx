import { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, ArrowLeft, CreditCard, HandCoins, ShoppingCart, Package, CheckCircle, X, Search } from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
const rupiah = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const parseRupiah = (s: string) => Number(s.replace(/[^0-9]/g, '')) || 0;
const fmtInput = (n: number) => (n ? n.toLocaleString('id-ID') : '');
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition';
const br = 'rounded-2xl border border-white/70 bg-white/80 backdrop-blur-xl shadow-sm';
const token = () => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';

// ── types ────────────────────────────────────────────────────────────────────
type Tipe = 'bayar_utang' | 'terima_piutang' | 'beli_persediaan' | 'jual_persediaan';
type Contact = { id: string; nama: string; tipe: string };
type InventoryItem = { id: string; nama: string; satuan: string; hargaSatuan: number; qtyAwal: number };
type Account = { id: string; kode: string; nama: string };
type EntryResp = { success: boolean; message: string; entry?: { id: string; noJurnal: string; tanggal: string; tipe: string; nominal: number; keterangan: string } };

const TIPE_META: Record<Tipe, {
  label: string; icon: typeof CreditCard; grad: string; desc: string;
  summary: (d: { contact?: string; item?: string; kas?: string; tipe: Tipe }) => string;
}> = {
  bayar_utang: {
    label: 'Bayar Utang',
    icon: CreditCard,
    grad: 'from-amber-500/20 to-orange-500/20 text-amber-600',
    desc: 'Bayar tagihan ke supplier secara otomatis',
    summary: d => `Debit: Utang Usaha (${d.contact}) · Credit: ${d.kas}`,
  },
  terima_piutang: {
    label: 'Terima Piutang',
    icon: HandCoins,
    grad: 'from-blue-500/20 to-indigo-500/20 text-blue-600',
    desc: 'Terima pembayaran dari pelanggan',
    summary: d => `Debit: ${d.kas} · Credit: Piutang Usaha (${d.contact})`,
  },
  beli_persediaan: {
    label: 'Beli Persediaan',
    icon: ShoppingCart,
    grad: 'from-emerald-500/20 to-teal-500/20 text-emerald-600',
    desc: 'Catat pembelian barang persediaan',
    summary: d => `Debit: Persediaan (${d.item}) · Credit: ${d.kas}`,
  },
  jual_persediaan: {
    label: 'Jual Persediaan',
    icon: Package,
    grad: 'from-purple-500/20 to-violet-500/20 text-purple-600',
    desc: 'Catat penjualan barang persediaan',
    summary: d => `Debit: ${d.kas} · Credit: Persediaan (${d.item})`,
  },
};

// ── Searchable Select ────────────────────────────────────────────────────────
function SearchSelect({
  value, onChange, options, placeholder, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; sub?: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = __useClickOutside(() => setOpen(false));
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(q.toLowerCase()) ||
    (o.sub || '').toLowerCase().includes(q.toLowerCase())
  );
  const selected = options.find(o => o.value === value);

  return (
    <div className="relative" ref={ref as any}>
      <button type="button" disabled={disabled}
        onClick={() => { setOpen(!open); setQ(''); }}
        className={`${inputCls} text-left flex items-center gap-2 ${!selected ? 'text-slate-400' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
        <span className="flex-1 truncate">{selected ? selected.label : placeholder}</span>
        <Search size={14} className="text-slate-400 shrink-0" />
      </button>
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full rounded-xl bg-white border border-slate-200 shadow-lg max-h-56 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Cari..."
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-emerald-400" />
          </div>
          <div className="overflow-y-auto max-h-44">
            {filtered.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">Tidak ditemukan</p>}
            {filtered.map(o => (
              <button key={o.value} type="button"
                onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition ${o.value === value ? 'bg-emerald-50 font-semibold' : ''}`}>
                <span className="text-slate-800">{o.label}</span>
                {o.sub && <span className="text-slate-400 text-xs ml-1">— {o.sub}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// simple click-outside hook
function __useClickOutside(cb: () => void) {
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

// ── Guided Form ──────────────────────────────────────────────────────────────
function GuidedForm({
  tipe, contacts, items, kasAccounts, onSuccess, onBack,
}: {
  tipe: Tipe;
  contacts: Contact[];
  items: InventoryItem[];
  kasAccounts: Account[];
  onSuccess: (entry: NonNullable<EntryResp['entry']>) => void;
  onBack: () => void;
}) {
  const meta = TIPE_META[tipe];
  const isUtang = tipe === 'bayar_utang';
  const isPiutang = tipe === 'terima_piutang';
  const isBeli = tipe === 'beli_persediaan';
  const isJual = tipe === 'jual_persediaan';
  const needContact = isUtang || isPiutang;
  const needItem = isBeli || isJual;

  const contactList = contacts.filter(c =>
    (isUtang && c.tipe === 'supplier') || (isPiutang && c.tipe === 'pelanggan')
  );

  const [contactId, setContactId] = useState('');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [hargaSatuan, setHargaSatuan] = useState('');
  const [total, setTotal] = useState('');
  const [kasId, setKasId] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [keterangan, setKeterangan] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // auto-fill harga when item changes
  useEffect(() => {
    if (needItem && itemId) {
      const it = items.find(i => i.id === itemId);
      if (it) {
        setHargaSatuan(String(it.hargaSatuan));
        if (qty) setTotal(String(Number(qty) * it.hargaSatuan));
      }
    }
  }, [itemId]); // eslint-disable-line

  // auto-calc total
  useEffect(() => {
    if (needItem && qty && hargaSatuan) {
      setTotal(String(Number(qty) * Number(hargaSatuan)));
    }
  }, [qty, hargaSatuan]); // eslint-disable-line

  const selectedItem = items.find(i => i.id === itemId);
  const selectedContact = contacts.find(c => c.id === contactId);
  const selectedKas = kasAccounts.find(a => a.id === kasId);

  const stokSetelah = selectedItem
    ? isBeli
      ? selectedItem.qtyAwal + (Number(qty) || 0)
      : selectedItem.qtyAwal - (Number(qty) || 0)
    : null;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (needContact && !contactId) e.contact = 'Pilih kontak';
    if (needItem && !itemId) e.item = 'Pilih barang';
    if (needItem && (!qty || Number(qty) <= 0)) e.qty = 'Jumlah harus > 0';
    if (needItem && isJual && selectedItem && Number(qty) > selectedItem.qtyAwal) e.qty = 'Stok tidak cukup';
    if (!kasId) e.kas = 'Pilih sumber dana';
    if (!total || parseRupiah(total) <= 0) e.total = 'Nominal harus > 0';
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
        nominal: parseRupiah(total),
        sumber_akun_id: kasId,
        keterangan: keterangan || undefined,
      };
      if (needContact) body.contact_id = contactId;
      if (needItem) {
        body.inventory_item_id = itemId;
        body.qty = Number(qty);
      }
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

  const summaryLabel = TIPE_META[tipe].summary({
    contact: selectedContact?.nama,
    item: selectedItem?.nama,
    kas: selectedKas ? `${selectedKas.kode} ${selectedKas.nama}` : '...',
    tipe,
  });

  return (
    <div className="space-y-5">
      {/* back + title */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50 transition">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${meta.grad}`}>
          <meta.icon size={18} />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">{meta.label}</h3>
          <p className="text-xs text-slate-500">{meta.desc}</p>
        </div>
      </div>

      {/* form card */}
      <div className={`${br} p-5 space-y-4`}>
        {/* Contact */}
        {needContact && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              {isUtang ? 'Pilih Supplier' : 'Pilih Pelanggan'} *
            </label>
            <SearchSelect
              value={contactId}
              onChange={setContactId}
              options={contactList.map(c => ({ value: c.id, label: c.nama }))}
              placeholder={isUtang ? 'Pilih supplier...' : 'Pilih pelanggan...'}
            />
            {errors.contact && <p className="text-xs text-red-500 mt-1">{errors.contact}</p>}
          </div>
        )}

        {/* Item + Qty + Harga */}
        {needItem && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Pilih Barang *</label>
              <SearchSelect
                value={itemId}
                onChange={setItemId}
                options={items.map(i => ({ value: i.id, label: i.nama, sub: `${i.satuan} · Stok: ${i.qtyAwal}` }))}
                placeholder="Pilih barang..."
              />
              {errors.item && <p className="text-xs text-red-500 mt-1">{errors.item}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Jumlah {selectedItem && `(${selectedItem.satuan})`} *
                </label>
                <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
                  placeholder="0" className={inputCls} />
                {errors.qty && <p className="text-xs text-red-500 mt-1">{errors.qty}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Harga Satuan</label>
                <CurrencyInput value={hargaSatuan} onChange={setHargaSatuan} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total</label>
                <CurrencyInput value={total} onChange={setTotal} />
                {errors.total && <p className="text-xs text-red-500 mt-1">{errors.total}</p>}
              </div>
            </div>
            {stokSetelah !== null && selectedItem && (
              <p className="text-xs text-slate-500">
                Stok setelah transaksi: <span className="font-semibold text-emerald-700">{stokSetelah} {selectedItem.satuan}</span>
              </p>
            )}
          </>
        )}

        {/* Nominal (for utang/piutang) */}
        {!needItem && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Nominal *</label>
            <CurrencyInput value={total} onChange={setTotal} placeholder="Rp 0" />
            {errors.total && <p className="text-xs text-red-500 mt-1">{errors.total}</p>}
          </div>
        )}

        {/* Sumber Dana */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Sumber Dana (Kas/Bank) *</label>
          <SearchSelect
            value={kasId}
            onChange={setKasId}
            options={kasAccounts.map(a => ({ value: a.id, label: `${a.kode} — ${a.nama}` }))}
            placeholder="Pilih kas atau bank..."
          />
          {errors.kas && <p className="text-xs text-red-500 mt-1">{errors.kas}</p>}
        </div>

        {/* Tanggal + Keterangan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Tanggal *</label>
            <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className={inputCls} />
            {errors.tanggal && <p className="text-xs text-red-500 mt-1">{errors.tanggal}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Keterangan</label>
            <input type="text" value={keterangan} onChange={e => setKeterangan(e.target.value)}
              placeholder="Opsional..." className={inputCls} />
          </div>
        </div>

        {/* Summary preview */}
        <div className="bg-emerald-50 rounded-xl px-4 py-3 text-xs text-emerald-700 flex items-start gap-2">
          <CheckCircle size={14} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold mb-0.5">Preview Jurnal:</p>
            <p>{summaryLabel}</p>
            {parseRupiah(total) > 0 && <p className="font-bold mt-0.5">{rupiah(parseRupiah(total))}</p>}
          </div>
        </div>

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
            className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-40 transition hover:shadow-xl">
            {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
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
  const meta = TIPE_META[tipe];
  return (
    <div className="space-y-5">
      <div className={`${br} p-6 text-center`}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 mb-4">
          <CheckCircle size={32} className="text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Transaksi Berhasil!</h3>
        <p className="text-sm text-slate-500 mb-4">{meta.label} telah dicatat</p>

        <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">No. Jurnal</span>
            <span className="font-bold text-emerald-700 tabular-nums">{entry.noJurnal}</span>
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
            className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:shadow-xl">
            Buat Lagi
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

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [kasAccounts, setKasAccounts] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchAll = useCallback(async () => {
    const h = { Authorization: 'Bearer ' + token() };
    const [supCust, cust, inv, coa] = await Promise.all([
      fetch('/api/accounting/contacts?tipe=supplier', { headers: h }).then(r => r.json()).catch(() => ({ contacts: [] })),
      fetch('/api/accounting/contacts?tipe=pelanggan', { headers: h }).then(r => r.json()).catch(() => ({ contacts: [] })),
      fetch('/api/accounting/inventory-items', { headers: h }).then(r => r.json()).catch(() => ({ items: [] })),
      fetch('/api/accounting/chart-of-accounts', { headers: h }).then(r => r.json()).catch(() => ({ accounts: [] })),
    ]);
    const allContacts: Contact[] = [
      ...((supCust.contacts || []).map((c: any) => ({ ...c, tipe: 'supplier' }))),
      ...((cust.contacts || []).map((c: any) => ({ ...c, tipe: 'pelanggan' }))),
    ];
    setContacts(allContacts);
    setItems((inv.items || []).map((i: any) => ({
      id: i.id, nama: i.nama, satuan: i.satuan || 'pcs',
      hargaSatuan: i.hargaSatuan || i.harga_satuan || 0,
      qtyAwal: i.qty ?? i.qtyAwal ?? i.qty_awal ?? 0,
    })));
    const kasFiltered = (coa.accounts || coa.data || []).filter((a: any) => {
      const k = (a.kode || '').replace(/\./g, '');
      return k.startsWith('1101') || k.startsWith('1102') || k.startsWith('110') || k.startsWith('1.1.01') || k.startsWith('1.1.02');
    });
    setKasAccounts(kasFiltered.length > 0 ? kasFiltered : (coa.accounts || coa.data || []).filter((a: any) => {
      const kode = (a.kode || '');
      return /kas|bank/i.test(a.nama) || /^1\.?1/i.test(kode);
    }));
    setLoaded(true);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const selectTipe = (t: Tipe) => {
    setActiveTipe(t);
    setView('form');
  };

  const goMenu = () => {
    setView('menu');
    setActiveTipe(null);
    setLastEntry(null as any);
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
          <Zap size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-900">Transaksi Cepat</h2>
          <p className="text-xs text-slate-500">Catat transaksi harian tanpa perlu tahu debit/kredit</p>
        </div>
      </div>

      {/* Menu View */}
      {view === 'menu' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(Object.keys(TIPE_META) as Tipe[]).map(t => {
            const m = TIPE_META[t];
            const Icon = m.icon;
            return (
              <button key={t} onClick={() => selectTipe(t)}
                className={`${br} p-5 text-left transition hover:shadow-md hover:-translate-y-0.5 group`}>
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${m.grad} shrink-0`}>
                    <Icon size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 mb-0.5">{m.label}</h3>
                    <p className="text-xs text-slate-500">{m.desc}</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <span className="rounded-xl bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 group-hover:bg-emerald-100 transition">
                    Buat Transaksi →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Form View */}
      {view === 'form' && activeTipe && loaded && (
        <GuidedForm
          key={activeTipe + '-' + Date.now()}
          tipe={activeTipe}
          contacts={contacts}
          items={items}
          kasAccounts={kasAccounts}
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

      {/* Loading */}
      {!loaded && (
        <div className="text-center py-12 text-sm text-slate-400">Memuat data...</div>
      )}

      <p className="text-[10px] text-slate-400 text-right">Transaksi Cepat · auto-jurnal tanpa pengetahuan akuntansi</p>
    </div>
  );
}
