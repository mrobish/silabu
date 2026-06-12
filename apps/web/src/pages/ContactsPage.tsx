import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Search, X, Pencil, Trash2, Phone, MapPin, CheckCircle, AlertTriangle } from 'lucide-react';

type Contact = {
  id: string;
  tenantId: string;
  nama: string;
  tipe: 'supplier' | 'pelanggan';
  telepon: string;
  alamat: string;
  akunId: string;
  saldoAwal: number;
  saldoAwalTipe: 'debit' | 'kredit';
  createdAt: string;
  updatedAt: string;
};

type CoA = {
  id: string;
  kode: string;
  nama: string;
};

const rupiah = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition';
const br = 'rounded-2xl border border-white/70 bg-white/80 backdrop-blur-xl shadow-sm';

const EMPTY_FORM = {
  nama: '',
  telepon: '',
  alamat: '',
  akunId: '',
  saldoAwal: '',
  saldoAwalTipe: 'debit' as 'debit' | 'kredit',
};

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const bg = type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700';
  const Icon = type === 'success' ? CheckCircle : AlertTriangle;
  return (
    <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium shadow-xl backdrop-blur-sm ${bg}`}>
      <Icon size={16} /> {msg}
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-600"><X size={14} /></button>
    </div>
  );
}

function ContactCard({ contact, coas, onEdit, onDelete }: { contact: Contact; coas: CoA[]; onEdit: (c: Contact) => void; onDelete: (id: string) => void }) {
  const akun = coas.find(a => a.id === contact.akunId);
  const isSupplier = contact.tipe === 'supplier';
  return (
    <div className={`${br} p-4 sm:p-5 transition hover:shadow-md hover:-translate-y-0.5`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shrink-0 ${isSupplier ? 'from-blue-500/20 to-indigo-500/20 text-blue-600' : 'from-amber-500/20 to-orange-500/20 text-amber-600'}`}>
          <Users size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900 truncate">{contact.nama}</h3>
          <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${isSupplier ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
            {contact.tipe}
          </span>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button onClick={() => onEdit(contact)} title="Edit"
            className="rounded-lg p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(contact.id)} title="Hapus"
            className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {contact.telepon && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Phone size={12} className="shrink-0" /> {contact.telepon}
          </div>
        )}
        {contact.alamat && (
          <div className="flex items-start gap-2 text-xs text-slate-500">
            <MapPin size={12} className="mt-0.5 shrink-0" /> <span className="line-clamp-2">{contact.alamat}</span>
          </div>
        )}
        {akun && (
          <div className="flex justify-between text-xs pt-1">
            <span className="text-slate-400">Akun</span>
            <span className="font-medium text-slate-600">{akun.kode} — {akun.nama}</span>
          </div>
        )}
        {contact.saldoAwal > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Saldo Awal</span>
            <span className="font-semibold text-slate-800 tabular-nums">{rupiah(contact.saldoAwal)} <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-1 ${contact.saldoAwalTipe === 'debit' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>{contact.saldoAwalTipe}</span></span>
          </div>
        )}
      </div>
    </div>
  );
}

function ContactModal({ open, onClose, onDone, editData, tipe, coas }: {
  open: boolean; onClose: () => void; onDone: () => void; editData?: Contact | null; tipe: 'supplier' | 'pelanggan'; coas: CoA[];
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saldoAwalTipe, setSaldoAwalTipe] = useState<'debit' | 'kredit'>('debit');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editData) {
      setForm({
        nama: editData.nama,
        telepon: editData.telepon || '',
        alamat: editData.alamat || '',
        akunId: editData.akunId || '',
        saldoAwal: editData.saldoAwal > 0 ? String(editData.saldoAwal) : '',
        saldoAwalTipe: editData.saldoAwalTipe,
      });
      setSaldoAwalTipe(editData.saldoAwalTipe);
    } else {
      setForm(EMPTY_FORM);
      setSaldoAwalTipe('debit');
    }
  }, [open, editData]);

  const save = async () => {
    if (!form.nama) return;
    setSaving(true);
    try {
      const t = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
      const url = editData ? `/api/accounting/contacts/${editData.id}` : '/api/accounting/contacts';
      const method = editData ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({
          nama: form.nama,
          tipe,
          telepon: form.telepon,
          alamat: form.alamat,
          akun_id: form.akunId || null,
          saldo_awal: Number(form.saldoAwal) || 0,
          saldo_awal_tipe: saldoAwalTipe,
        }),
      });
      if (r.ok) { onDone(); onClose(); } else { const e = await r.json(); alert(e.error || 'Gagal menyimpan'); }
    } finally { setSaving(false); }
  };

  if (!open) return null;
  const isSupplier = tipe === 'supplier';
  const prefixFilter = isSupplier ? '2.1.01' : '1.1.03';
  const filteredCoas = coas.filter(a => a.kode.startsWith(prefixFilter));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${isSupplier ? 'from-blue-500/20 to-indigo-500/20 text-blue-600' : 'from-amber-500/20 to-orange-500/20 text-amber-600'}`}>
            {editData ? <Pencil size={18} /> : <Plus size={18} />}
          </div>
          <h3 className="text-base font-bold text-slate-900">{editData ? 'Edit' : 'Tambah'} {isSupplier ? 'Supplier' : 'Pelanggan'}</h3>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Nama *</label>
            <input type="text" value={form.nama} onChange={e => setForm(p => ({ ...p, nama: e.target.value }))} placeholder="Nama kontak" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Telepon</label>
            <input type="text" value={form.telepon} onChange={e => setForm(p => ({ ...p, telepon: e.target.value }))} placeholder="08xxx" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Alamat</label>
            <textarea value={form.alamat} onChange={e => setForm(p => ({ ...p, alamat: e.target.value }))} placeholder="Alamat lengkap" rows={2} className={inputCls + ' resize-none'} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Akun {isSupplier ? 'Hutang' : 'Piutang'} ({prefixFilter})</label>
            <select value={form.akunId} onChange={e => setForm(p => ({ ...p, akunId: e.target.value }))} className={inputCls}>
              <option value="">— Pilih Akun —</option>
              {filteredCoas.map(a => <option key={a.id} value={a.id}>{a.kode} — {a.nama}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Saldo Awal</label>
              <input type="number" value={form.saldoAwal} onChange={e => setForm(p => ({ ...p, saldoAwal: e.target.value }))} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Tipe Saldo</label>
              <div className="flex gap-2 pt-1">
                {(['debit', 'kredit'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setSaldoAwalTipe(t)}
                    className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold border transition ${saldoAwalTipe === t ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Batal</button>
            <button type="button" onClick={save} disabled={saving || !form.nama}
              className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-40 transition hover:shadow-xl">
              {saving ? 'Menyimpan...' : editData ? 'Simpan Perubahan' : 'Tambah Kontak'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const [tab, setTab] = useState<'supplier' | 'pelanggan'>('supplier');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [coas, setCoas] = useState<CoA[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState<Contact | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const token = () => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/accounting/contacts', { headers: { Authorization: 'Bearer ' + token() } });
      if (r.ok) { const d = await r.json(); setContacts(d.contacts || d.data || []); }
    } finally { setLoading(false); }
  }, []);

  const fetchCoas = useCallback(async () => {
    try {
      const r = await fetch('/api/accounting/chart-of-accounts', { headers: { Authorization: 'Bearer ' + token() } });
      if (r.ok) { const d = await r.json(); setCoas(d.accounts || d.data || []); }
    } catch {}
  }, []);

  useEffect(() => { fetchContacts(); fetchCoas(); }, [fetchContacts, fetchCoas]);

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus kontak ini? Tindakan tidak dapat dibatalkan.')) return;
    try {
      const r = await fetch(`/api/accounting/contacts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token() },
      });
      if (r.ok) {
        setToast({ msg: 'Kontak berhasil dihapus', type: 'success' });
        fetchContacts();
      } else {
        setToast({ msg: 'Gagal menghapus kontak', type: 'error' });
      }
    } catch {
      setToast({ msg: 'Terjadi kesalahan jaringan', type: 'error' });
    }
  };

  const filtered = contacts.filter(c =>
    c.tipe === tab &&
    (!search || c.nama.toLowerCase().includes(search.toLowerCase()) || (c.telepon || '').includes(search))
  );

  const handleEdit = (c: Contact) => { setEditData(c); setModalOpen(true); };
  const handleAdd = () => { setEditData(null); setModalOpen(true); };

  return (
    <div className="space-y-4">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-600">
          <Users size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-900">Manajemen Kontak</h2>
          <p className="text-xs text-slate-500">Kelola data supplier dan pelanggan BUM Desa</p>
        </div>
        <button onClick={handleAdd}
          className="rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:shadow-xl transition whitespace-nowrap">
          <Plus size={16} className="inline -mt-0.5 mr-1" /> Tambah {tab === 'supplier' ? 'Supplier' : 'Pelanggan'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['supplier', 'pelanggan'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setSearch(''); }}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === t ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {contacts.filter(c => c.tipe === t).length}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className={`${br} p-3 flex items-center gap-2`}>
        <Search size={16} className="text-slate-400 shrink-0" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Cari ${tab} berdasarkan nama atau telepon...`}
          className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" />
        {search && <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>}
      </div>

      {/* Summary */}
      <div className={`${br} p-4 sm:p-5`}>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-500">Total {tab === 'supplier' ? 'Supplier' : 'Pelanggan'}</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{filtered.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Saldo Awal</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{rupiah(filtered.reduce((s, c) => s + (c.saldoAwal || 0), 0))}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Dengan Akun</p>
            <p className="text-lg font-bold text-emerald-700 tabular-nums">{filtered.filter(c => c.akunId).length}</p>
          </div>
        </div>
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className="text-center py-12 text-sm text-slate-400">Memuat data...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users size={48} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500 mb-1">Belum ada {tab}.</p>
          <p className="text-xs text-slate-400">Klik "Tambah {tab === 'supplier' ? 'Supplier' : 'Pelanggan'}" untuk memulai.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <ContactCard key={c.id} contact={c} coas={coas} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Modal */}
      <ContactModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditData(null); }}
        onDone={() => { fetchContacts(); setToast({ msg: editData ? 'Kontak berhasil diperbarui' : 'Kontak berhasil ditambahkan', type: 'success' }); }}
        editData={editData}
        tipe={tab}
        coas={coas}
      />

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setDeleteId(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 mb-4">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Hapus Kontak?</h3>
              <p className="text-sm text-slate-500 mb-6">Tindakan ini tidak dapat dibatalkan. Data kontak akan dihapus permanen.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Batal</button>
                <button onClick={() => { handleDelete(deleteId); setDeleteId(null); }}
                  className="flex-1 rounded-2xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-red-700 transition">
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400 text-right">Kelola kontak supplier & pelanggan untuk pencatatan transaksi</p>
    </div>
  );
}
