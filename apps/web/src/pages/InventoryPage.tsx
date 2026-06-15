import { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Search, Edit3, Trash2, X, CheckCircle, Boxes, ShoppingBag, Link as LinkIcon, ArrowRight, AlertTriangle, FileWarning } from 'lucide-react';

type InventoryItem = {
  id: string;
  tenantId: string;
  nama: string;
  kode: string;
  satuan: string;
  akunId: string;
  qtyAwal: number;
  hargaSatuan: number;
  saldoAwal: number;
  createdAt: string;
  updatedAt: string;
};

type CoAAccount = {
  id: string;
  kode: string;
  nama: string;
};

type Candidate = {
  lineId: string;
  entryId: string;
  noJurnal: string;
  tanggal: string;
  keterangan: string;
  tipeTransaksi: string;
  akunKode: string;
  akunNama: string;
  debit: number;
  kredit: number;
  qty: number | null;
  isMasuk: boolean;
};

const rupiah = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition';
const br = 'rounded-2xl border border-white/70 bg-white/80 backdrop-blur-xl shadow-sm';

const token = () => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';

/* ─── Link Journal Modal ─── */
function LinkJurnalModal({ open, onClose, onDone }: {
  open: boolean; onClose: () => void; onDone: () => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<Candidate | null>(null);

  // Step 2 state
  const [itemMode, setItemMode] = useState<'select' | 'create'>('select');
  const [existingItems, setExistingItems] = useState<InventoryItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [newNama, setNewNama] = useState('');
  const [newKode, setNewKode] = useState('');
  const [newSatuan, setNewSatuan] = useState('');
  const [qty, setQty] = useState('');
  const [hargaSatuanRupiah, setHargaSatuanRupiah] = useState(0);
  const [saving, setSaving] = useState(false);

  const fetchCandidates = useCallback(async () => {
    setLoadingCandidates(true);
    setError('');
    try {
      const r = await fetch('/api/accounting/persediaan/journal-candidates', {
        headers: { Authorization: 'Bearer ' + token() },
      });
      if (r.ok) {
        const d = await r.json();
        setCandidates(d.candidates || []);
      } else {
        const e = await r.json();
        setError(e.error || 'Gagal memuat kandidat');
      }
    } catch {
      setError('Kesalahan jaringan');
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  const fetchExistingItems = useCallback(async () => {
    try {
      const r = await fetch('/api/accounting/inventory-items', {
        headers: { Authorization: 'Bearer ' + token() },
      });
      if (r.ok) {
        const d = await r.json();
        setExistingItems(d.items || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSelected(null);
    setError('');
    setItemMode('select');
    setSelectedItemId('');
    setNewNama('');
    setNewKode('');
    setNewSatuan('');
    setQty('');
    setHargaSatuanRupiah(0);
    fetchCandidates();
    fetchExistingItems();
  }, [open, fetchCandidates, fetchExistingItems]);

  // Auto-calculate harga satuan
  useEffect(() => {
    if (!selected || !qty) { setHargaSatuanRupiah(0); return; }
    const q = Number(qty);
    if (q <= 0) { setHargaSatuanRupiah(0); return; }
    const nilai = Math.max(Number(selected.debit), Number(selected.kredit));
    setHargaSatuanRupiah(nilai / q);
  }, [qty, selected]);

  const totalNilai = selected ? Math.max(Number(selected.debit), Number(selected.kredit)) : 0;
  const canSelect = !itemMode && selectedItemId;

  const submitLink = async () => {
    if (!selected) return;
    const qtyNum = Number(qty);
    if (!qtyNum || qtyNum <= 0) { setError('Qty harus > 0'); return; }

    if (itemMode === 'select' && !selectedItemId) { setError('Pilih item persediaan'); return; }
    if (itemMode === 'create' && !newNama.trim()) { setError('Nama barang wajib diisi'); return; }

    setSaving(true);
    setError('');
    try {
      const body: any = {
        journal_line_id: selected.lineId,
        mode: itemMode,
        qty: qtyNum,
      };
      if (itemMode === 'select') {
        body.inventory_item_id = selectedItemId;
      } else {
        body.nama = newNama.trim();
        body.kode = newKode.trim();
        body.satuan = newSatuan.trim();
      }

      const r = await fetch('/api/accounting/persediaan/link-journal-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        onDone();
        onClose();
      } else {
        setError(d.error || 'Gagal menghubungkan jurnal');
      }
    } catch {
      setError('Kesalahan jaringan');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  // Filter items that match the selected journal line's account
  const filteredItems = existingItems.filter(it => {
    if (!selected) return true;
    return it.akunId === selected.akunKode; // Not exact — we need CoA ID not kode
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-600">
            <LinkIcon size={18} />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {step === 1 ? 'Pilih Jurnal Persediaan' : step === 2 ? 'Hubungkan ke Stok' : 'Konfirmasi'}
          </h3>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-4 text-xs font-semibold text-slate-400">
          <span className={`flex items-center gap-1 ${step >= 1 ? 'text-emerald-600' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}>1</span>
            Pilih Jurnal
          </span>
          <ArrowRight size={12} />
          <span className={`flex items-center gap-1 ${step >= 2 ? 'text-emerald-600' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}>2</span>
            Isi Detail
          </span>
          <ArrowRight size={12} />
          <span className={`flex items-center gap-1 ${step >= 3 ? 'text-emerald-600' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}>3</span>
            Konfirmasi
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-600 flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ⚠️ Warning banner */}
        {step >= 2 && (
          <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-700 flex items-start gap-2">
            <FileWarning size={14} className="mt-0.5 shrink-0" />
            <span>
              Proses ini <strong>hanya menghubungkan jurnal ke kartu stok</strong>.
              Nominal jurnal, Buku Besar, Neraca, dan HPP historis <strong>tidak akan diubah</strong>.
            </span>
          </div>
        )}

        {/* Step 1: Select Candidate */}
        {step === 1 && (
          <>
            {loadingCandidates ? (
              <div className="text-center py-8 text-sm text-slate-400">Memuat kandidat...</div>
            ) : candidates.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle size={32} className="mx-auto text-emerald-400 mb-2" />
                <p className="text-sm text-slate-500">Semua jurnal persediaan sudah terhubung ke stok.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {candidates.map(c => (
                  <label
                    key={c.lineId}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition
                      ${selected?.lineId === c.lineId ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                  >
                    <input
                      type="radio"
                      name="candidate"
                      checked={selected?.lineId === c.lineId}
                      onChange={() => setSelected(c)}
                      className="mt-1 accent-emerald-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.isMasuk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {c.isMasuk ? 'MASUK' : 'KELUAR'}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">{c.noJurnal}</span>
                        <span className="text-[10px] text-slate-400">{c.tanggal}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 truncate">{c.keterangan || '(tanpa keterangan)'}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-slate-500">{c.akunKode} — {c.akunNama}</span>
                        <span className="text-xs font-bold text-slate-800 tabular-nums">{rupiah(Math.max(Number(c.debit), Number(c.kredit)))}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Batal</button>
              <button
                disabled={!selected}
                onClick={() => {
                  setStep(2);
                  // Auto-detect mode: masuk can create, keluar must select
                  if (selected && !selected.isMasuk) {
                    setItemMode('select');
                  }
                }}
                className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-40 transition hover:shadow-xl"
              >
                Lanjutkan
              </button>
            </div>
          </>
        )}

        {/* Step 2: Link Details */}
        {step === 2 && selected && (
          <>
            {/* Selected candidate summary */}
            <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selected.isMasuk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {selected.isMasuk ? 'MASUK' : 'KELUAR'}
                </span>
                <span className="text-xs font-semibold text-slate-800">{selected.noJurnal}</span>
                <span className="text-[10px] text-slate-400">{selected.tanggal}</span>
              </div>
              <p className="text-xs text-slate-600">{selected.keterangan || '(tanpa keterangan)'}</p>
              <div className="text-xs text-slate-600 mt-1">
                {selected.akunKode} — {selected.akunNama} | <strong>{rupiah(totalNilai)}</strong>
              </div>
            </div>

            {/* Mode selector — hanya untuk stok MASUK */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Hubungkan</label>
              {selected.isMasuk ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setItemMode('select')}
                    className={`flex-1 rounded-xl border-2 py-2.5 text-xs font-bold transition
                      ${itemMode === 'select' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  >
                    Pilih Item Existing
                  </button>
                  <button
                    onClick={() => setItemMode('create')}
                    className={`flex-1 rounded-xl border-2 py-2.5 text-xs font-bold transition
                      ${itemMode === 'create' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  >
                    Buat Item Baru
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-slate-200 bg-slate-50 py-2.5 px-3 text-xs text-slate-500">
                  Stok keluar — wajib pilih item existing
                </div>
              )}
            </div>

            {/* Item selector / creator */}
            {itemMode === 'select' && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Pilih Item Persediaan</label>
                <select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} className={inputCls}>
                  <option value="">— Pilih Item —</option>
                  {existingItems.map(it => (
                    <option key={it.id} value={it.id}>
                      {it.nama} {it.kode ? `(${it.kode})` : ''} — {it.qtyAwal > 0 ? `${it.qtyAwal} ${it.satuan || ''}` : 'stok awal 0'}
                    </option>
                  ))}
                  {existingItems.length === 0 && (
                    <option value="" disabled>Tidak ada item. Buat item baru dari menu Tambah Barang.</option>
                  )}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Hanya item dengan akun <strong>{selected.akunKode}</strong> yang ditampilkan.
                </p>
              </div>
            )}

            {itemMode === 'create' && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Nama Barang *</label>
                  <input type="text" value={newNama} onChange={e => setNewNama(e.target.value)} placeholder="Contoh: ATK Paket" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Kode</label>
                  <input type="text" value={newKode} onChange={e => setNewKode(e.target.value)} placeholder="Opsional" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Satuan</label>
                  <input type="text" value={newSatuan} onChange={e => setNewSatuan(e.target.value)} placeholder="pcs, kg, pak..." className={inputCls} />
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-slate-400">
                    Akun: <strong>{selected.akunKode} — {selected.akunNama}</strong>
                    (qty_awal = 0, saldo_awal = 0 — stok akan masuk via link ini)
                  </p>
                </div>
              </div>
            )}

            {/* Qty input */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Qty *</label>
                <input
                  type="number"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  placeholder="0"
                  min="0.01"
                  step="any"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Satuan</label>
                {itemMode === 'select' ? (
                  <div className="h-[42px] flex items-center px-3.5 rounded-xl bg-slate-50 text-sm text-slate-500 border border-slate-200">
                    {selectedItemId ? existingItems.find(it => it.id === selectedItemId)?.satuan || '-' : '-'}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={newSatuan}
                    onChange={e => setNewSatuan(e.target.value)}
                    placeholder="pcs"
                    className={inputCls}
                  />
                )}
              </div>
            </div>

            {/* Price preview */}
            {qty && Number(qty) > 0 && (
              <div className="bg-emerald-50 rounded-xl px-3.5 py-3 space-y-1 text-xs text-emerald-700">
                <div className="flex justify-between">
                  <span>Nilai dari jurnal</span>
                  <span className="font-bold">{rupiah(totalNilai)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Qty</span>
                  <span className="font-bold tabular-nums">{Number(qty).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between border-t border-emerald-200 pt-1">
                  <span>Harga Satuan (nilai ÷ qty)</span>
                  <span className="font-bold tabular-nums">{rupiah(hargaSatuanRupiah)}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Kembali</button>
              <button
                disabled={saving || !qty || Number(qty) <= 0 || (itemMode === 'select' && !selectedItemId) || (itemMode === 'create' && !newNama.trim())}
                onClick={() => setStep(3)}
                className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-40 transition hover:shadow-xl"
              >
                Konfirmasi
              </button>
            </div>
          </>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && selected && (
          <>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-slate-500">Jurnal</span>
                <span className="font-semibold text-slate-800">{selected.noJurnal} — {selected.tanggal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tipe</span>
                <span className={`font-semibold ${selected.isMasuk ? 'text-green-700' : 'text-red-700'}`}>
                  {selected.isMasuk ? 'Stok Masuk (+)' : 'Stok Keluar (-)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Akun</span>
                <span className="font-semibold text-slate-800">{selected.akunKode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nilai (tidak berubah)</span>
                <span className="font-bold text-slate-800">{rupiah(totalNilai)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Qty</span>
                <span className="font-bold text-slate-800 tabular-nums">{Number(qty).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Harga Satuan</span>
                <span className="font-bold text-slate-800">{rupiah(hargaSatuanRupiah)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Item</span>
                <span className="font-semibold text-slate-800">
                  {itemMode === 'select'
                    ? existingItems.find(it => it.id === selectedItemId)?.nama || '-'
                    : newNama
                  }
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-700 mb-6">
              <FileWarning size={14} className="inline mr-1 mb-0.5" />
              Proses ini <strong>hanya menghubungkan jurnal ke kartu stok</strong>.
              Nominal jurnal, Buku Besar, Neraca, dan HPP historis <strong>tidak akan diubah</strong>.
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Kembali</button>
              <button
                disabled={saving}
                onClick={submitLink}
                className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-40 transition hover:shadow-xl"
              >
                {saving ? 'Memproses...' : 'Hubungkan ke Stok'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Inventory Card ─── */
function InventoryCard({ item, onEdit, onDelete, currentStock }: { item: InventoryItem; onEdit: () => void; onDelete: () => void; currentStock?: number }) {
  const stok = currentStock !== undefined ? currentStock : item.qtyAwal;
  const isNegative = stok < 0;
  const saldo = item.qtyAwal * item.hargaSatuan;
  return (
    <div className={`${br} p-4 sm:p-5 transition hover:shadow-md hover:-translate-y-0.5`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-600 shrink-0">
          <Boxes size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900 truncate">{item.nama}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            {item.kode && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 whitespace-nowrap">
                {item.kode}
              </span>
            )}
            {item.satuan && <p className="text-xs text-slate-500">{item.satuan}</p>}
            {isNegative && (
              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 animate-pulse">
                {stok.toLocaleString('id-ID')} {item.satuan} ⚠️
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit} title="Edit" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition">
            <Edit3 size={14} />
          </button>
          <button onClick={onDelete} title="Hapus" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">{currentStock !== undefined ? 'Stok Saat Ini' : 'Qty Awal'}</span>
          <span className={'font-semibold tabular-nums ' + (isNegative ? 'text-red-600 font-bold' : 'text-slate-800')}>
            {stok.toLocaleString('id-ID')} {item.satuan}
            {isNegative && ' ⚠️'}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Harga Satuan</span>
          <span className="font-semibold text-slate-800 tabular-nums">{rupiah(item.hargaSatuan)}</span>
        </div>
        <div className="h-px bg-slate-100 my-1" />
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Saldo Awal</span>
          <span className="font-bold text-emerald-700 tabular-nums">{rupiah(saldo)}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Add / Edit Modal ─── */
function ItemModal({
  open, onClose, onDone, editItem, accounts,
}: {
  open: boolean; onClose: () => void; onDone: () => void;
  editItem: InventoryItem | null; accounts: CoAAccount[];
}) {
  const isEdit = !!editItem;
  const [form, setForm] = useState({
    nama: '', kode: '', satuan: '', akun_id: '', qty_awal: '', harga_satuan: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editItem) {
      setForm({
        nama: editItem.nama,
        kode: editItem.kode || '',
        satuan: editItem.satuan || '',
        akun_id: editItem.akunId || '',
        qty_awal: String(editItem.qtyAwal ?? ''),
        harga_satuan: String(editItem.hargaSatuan ?? ''),
      });
    } else {
      setForm({ nama: '', kode: '', satuan: '', akun_id: '', qty_awal: '', harga_satuan: '' });
    }
  }, [open, editItem]);

  const previewSaldo = (Number(form.qty_awal) || 0) * (Number(form.harga_satuan) || 0);

  const save = async () => {
    if (!form.nama.trim()) { setError('Nama wajib diisi'); return; }
    setSaving(true);
    setError('');
    try {
      const url = isEdit ? `/api/accounting/inventory-items/${editItem!.id}` : '/api/accounting/inventory-items';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
        body: JSON.stringify({
          nama: form.nama,
          kode: form.kode || null,
          satuan: form.satuan || null,
          akun_id: form.akun_id || null,
          qty_awal: Number(form.qty_awal) || 0,
          harga_satuan: Number(form.harga_satuan) || 0,
        }),
      });
      if (r.ok) { onDone(); onClose(); }
      else { const e = await r.json(); setError(e.error || 'Gagal menyimpan'); }
    } catch { setError('Kesalahan jaringan'); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-600">
            {isEdit ? <Edit3 size={18} /> : <Plus size={18} />}
          </div>
          <h3 className="text-base font-bold text-slate-900">{isEdit ? 'Edit Barang Persediaan' : 'Tambah Barang Persediaan'}</h3>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-600">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Nama Barang *</label>
            <input type="text" value={form.nama} onChange={e => setForm(p => ({ ...p, nama: e.target.value }))} placeholder="Contoh: Beras Premium" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Kode</label>
              <input type="text" value={form.kode} onChange={e => setForm(p => ({ ...p, kode: e.target.value }))} placeholder="Opsional" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Satuan</label>
              <input type="text" value={form.satuan} onChange={e => setForm(p => ({ ...p, satuan: e.target.value }))} placeholder="kg, pcs, karung..." className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Akun Persediaan (CoA)</label>
            <select value={form.akun_id} onChange={e => setForm(p => ({ ...p, akun_id: e.target.value }))} className={inputCls}>
              <option value="">Pilih Akun</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.kode} — {a.nama}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Qty Awal</label>
              <input type="number" value={form.qty_awal} onChange={e => setForm(p => ({ ...p, qty_awal: e.target.value }))} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Harga Satuan (Rp)</label>
              <input type="number" value={form.harga_satuan} onChange={e => setForm(p => ({ ...p, harga_satuan: e.target.value }))} placeholder="0" className={inputCls} />
            </div>
          </div>

          {previewSaldo > 0 && (
            <div className="bg-emerald-50 rounded-xl px-3.5 py-2.5 text-xs text-emerald-700 flex items-start gap-2">
              <CheckCircle size={14} className="mt-0.5 shrink-0" />
              <span>Saldo Awal (Qty × Harga): <strong>{rupiah(previewSaldo)}</strong></span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Batal</button>
            <button type="button" onClick={save} disabled={saving || !form.nama.trim()}
              className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-40 transition hover:shadow-xl">
              {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Barang'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Delete Confirm Modal ─── */
function DeleteModal({ open, item, onClose, onConfirm, deleting }: {
  open: boolean; item: InventoryItem | null; onClose: () => void; onConfirm: () => void; deleting: boolean;
}) {
  if (!open || !item) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500 mx-auto mb-4">
          <Trash2 size={24} />
        </div>
        <h3 className="text-center text-base font-bold text-slate-900 mb-1">Hapus Barang?</h3>
        <p className="text-center text-sm text-slate-500 mb-6">
          <strong>{item.nama}</strong> akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Batal</button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 rounded-2xl bg-gradient-to-r from-red-500 to-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-40 transition hover:shadow-xl">
            {deleting ? 'Menghapus...' : 'Ya, Hapus'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Toast ─── */
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const bg = type === 'success' ? 'bg-emerald-600' : 'bg-red-600';
  return (
    <div className={`fixed bottom-6 right-6 z-[60] ${bg} text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-[slideIn_.3s_ease]`}>
      {type === 'success' ? <CheckCircle size={16} /> : <X size={16} />}
      {message}
    </div>
  );
}

/* ─── Main Page ─── */
export default function InventoryPage({ setPage }: { setPage?: (page: any) => void }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [accounts, setAccounts] = useState<CoAAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [stockData, setStockData] = useState<Record<string, number>>({});
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [candidateCount, setCandidateCount] = useState(0);

  const fetchStock = useCallback(async () => {
    try {
      const r = await fetch('/api/accounting/penjualan/stock-check', { headers: { Authorization: 'Bearer ' + token() } });
      if (r.ok) {
        const d = await r.json();
        const map: Record<string, number> = {};
        for (const s of (d.items || [])) map[s.id] = Number(s.stok) || 0;
        setStockData(map);
      }
    } catch {}
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/accounting/inventory-items', { headers: { Authorization: 'Bearer ' + token() } });
      if (r.ok) { const d = await r.json(); setItems(d.items || []); }
    } finally { setLoading(false); }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const r = await fetch('/api/accounting/chart-of-accounts', { headers: { Authorization: 'Bearer ' + token() } });
      if (r.ok) {
        const d = await r.json();
        const all: CoAAccount[] = d.accounts || [];
        setAccounts(all.filter(a => a.kode.startsWith('1.1.05')));
      }
    } catch {}
  }, []);

  const fetchCandidates = useCallback(async () => {
    try {
      const r = await fetch('/api/accounting/persediaan/journal-candidates', {
        headers: { Authorization: 'Bearer ' + token() },
      });
      if (r.ok) {
        const d = await r.json();
        setCandidateCount((d.candidates || []).length);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchItems();
    fetchAccounts();
    fetchStock();
    fetchCandidates();
  }, [fetchItems, fetchAccounts, fetchStock, fetchCandidates]);

  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/accounting/inventory-items/${deleteItem.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token() },
      });
      if (r.ok) {
        setToast({ message: `"${deleteItem.nama}" berhasil dihapus`, type: 'success' });
        setDeleteItem(null);
        fetchItems();
      } else {
        const e = await r.json();
        setToast({ message: e.error || 'Gagal menghapus', type: 'error' });
      }
    } catch { setToast({ message: 'Kesalahan jaringan', type: 'error' }); }
    finally { setDeleting(false); }
  };

  const filtered = items.filter(it => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return it.nama.toLowerCase().includes(q) || it.kode.toLowerCase().includes(q) || it.satuan.toLowerCase().includes(q);
  });

  const totalSaldo = items.reduce((s, it) => s + it.qtyAwal * it.hargaSatuan, 0);
  const totalQty = items.reduce((s, it) => s + it.qtyAwal, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-600">
          <ShoppingBag size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-900">Data Barang Persediaan</h2>
          <p className="text-xs text-slate-500">Kelola master barang persediaan, stok awal, dan hubungkan jurnal persediaan yang belum masuk kartu stok.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage?.('buku-pembantu-persediaan')}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition whitespace-nowrap">
            Lihat Kartu Stok
          </button>
          <button onClick={() => { setEditItem(null); setModalOpen(true); }}
            className="rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:shadow-xl transition whitespace-nowrap">
            <Plus size={16} className="inline -mt-0.5 mr-1" /> Tambah Barang
          </button>
        </div>
      </div>

      {/* Link Banner — muncul kalau ada kandidat */}
      {candidateCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-600 shrink-0">
            <LinkIcon size={16} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              Ada {candidateCount} jurnal persediaan yang belum terhubung ke stok.
            </p>
            <p className="text-xs text-amber-600">Hubungkan jurnal untuk mengisi kartu stok. Nominal akuntansi tidak berubah.</p>
          </div>
          <button
            onClick={() => setLinkModalOpen(true)}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-bold text-white shadow-lg hover:shadow-xl transition shrink-0"
          >
            Hubungkan Jurnal
          </button>
        </div>
      )}

      {/* Summary */}
      <div className={`${br} p-4 sm:p-5`}>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-500">Total Jenis Barang</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{items.length} item</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Qty Awal</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{totalQty.toLocaleString('id-ID')}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Saldo Persediaan</p>
            <p className="text-lg font-bold text-emerald-700 tabular-nums">{rupiah(totalSaldo)}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari barang berdasarkan nama, kode, atau satuan..."
          className={`${inputCls} pl-10`}
        />
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className="text-center py-12 text-sm text-slate-400">Memuat data...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Boxes size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">
            {search.trim() ? 'Tidak ada barang yang cocok dengan pencarian.' : 'Belum ada persediaan barang. Klik "Tambah Barang" untuk memulai.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(it => (
            <InventoryCard
              key={it.id}
              item={it}
              currentStock={stockData[it.id]}
              onEdit={() => { setEditItem(it); setModalOpen(true); }}
              onDelete={() => setDeleteItem(it)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <ItemModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditItem(null); }}
        onDone={() => {
          fetchItems();
          setToast({ message: editItem ? 'Barang berhasil diperbarui' : 'Barang berhasil ditambahkan', type: 'success' });
        }}
        editItem={editItem}
        accounts={accounts}
      />
      <DeleteModal open={!!deleteItem} item={deleteItem} onClose={() => setDeleteItem(null)} onConfirm={handleDelete} deleting={deleting} />
      <LinkJurnalModal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        onDone={() => {
          fetchItems();
          fetchStock();
          fetchCandidates();
          setToast({ message: 'Jurnal berhasil dihubungkan ke stok persediaan', type: 'success' });
        }}
      />

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <p className="text-[10px] text-slate-400 text-right">Persediaan · Barang masuk & keluar dikelola melalui jurnal</p>
    </div>
  );
}
