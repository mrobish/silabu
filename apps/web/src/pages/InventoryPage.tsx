import { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Search, Edit3, Trash2, X, CheckCircle, Boxes, ShoppingBag } from 'lucide-react';

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

const rupiah = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition';
const br = 'rounded-2xl border border-white/70 bg-white/80 backdrop-blur-xl shadow-sm';

const token = () => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';

/* ─── Inventory Card ─── */
function InventoryCard({ item, onEdit, onDelete }: { item: InventoryItem; onEdit: () => void; onDelete: () => void }) {
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
          <span className="text-slate-500">Qty Awal</span>
          <span className="font-semibold text-slate-800 tabular-nums">{Number(item.qtyAwal).toLocaleString('id-ID')} {item.satuan}</span>
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

          {/* Saldo preview */}
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
export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [accounts, setAccounts] = useState<CoAAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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

  useEffect(() => { fetchItems(); fetchAccounts(); }, [fetchItems, fetchAccounts]);

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
          <h2 className="text-lg font-bold text-slate-900">Persediaan Barang</h2>
          <p className="text-xs text-slate-500">Inventory Management — Kelola persediaan barang desa</p>
        </div>
        <button onClick={() => { setEditItem(null); setModalOpen(true); }}
          className="rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:shadow-xl transition whitespace-nowrap">
          <Plus size={16} className="inline -mt-0.5 mr-1" /> Tambah Barang
        </button>
      </div>

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

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <p className="text-[10px] text-slate-400 text-right">Persediaan · Barang masuk & keluar dikelola melalui jurnal</p>
    </div>
  );
}
