// RincianSaldoPage — Sub-Ledger: Persediaan, Utang/Piutang (contacts), Aset Tetap
// Badge rekonsiliasi membandingkan SUM(rincian) vs Saldo Awal global CoA

import { useState, useEffect, useCallback } from 'react';
import { Printer } from 'lucide-react';
import DatePicker from './DatePicker';
import ReportPrintLayout from './ReportPrintLayout';

type CoAOption = { id: string; kode: string; nama: string };

type InventoryItem = {
  id: string; nama: string; kode: string; satuan: string;
  akunId: string; qtyAwal: number; hargaSatuan: number; saldoAwal: number;
};

type Contact = {
  id: string; nama: string; tipe: 'supplier' | 'pelanggan'; telepon: string; alamat: string;
  akunId: string; saldoAwal: number; saldoAwalTipe: 'debit' | 'kredit';
};

type FixedAsset = {
  id: string; nama: string; kategori: string; akunId: string;
  tanggalPerolehan: string; hargaPerolehan: number; akumulasiPenyusutan: number;
  nilaiBukuAwal: number; umurManfaatBulan: number;
};

type Equity = {
  id: string; sumber: 'Pemerintah Desa' | 'Masyarakat' | 'Lainnya';
  tahunPenerimaan: number; keterangan: string; akunId: string; saldoAwal: number;
};

type ReconRow = {
  akunId: string; kode: string; namaAkun: string; subledgerType: string;
  globalValue: number; rincianValue: number; selisih: number;
  detailCount: number; status: 'MATCHED' | 'UNMATCHED' | 'NO_SUBLEDGER';
};

const TABS = ['persediaan', 'hutang-piutang', 'aset-tetap', 'modal'] as const;
type TabId = typeof TABS[number];
const TAB_LABELS: Record<TabId, string> = {
  'persediaan': 'Persediaan',
  'hutang-piutang': 'Hutang / Piutang',
  'aset-tetap': 'Aset Tetap',
  'modal': 'Modal / Ekuitas',
};

const fmt = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v);

const getToken = () => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
const H = () => ({ Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json' });

// ─── Reconciliation Badge ─────────────────────────────────────
function ReconBadge({ rows, tabId }: { rows: ReconRow[]; tabId: TabId }) {
  const prefixes: Record<TabId, string[]> = {
    'persediaan': ['1.1.05'],
    'hutang-piutang': ['1.1.03', '2.1.01'],
    'aset-tetap': ['1.2', '1.3'],
    'modal': ['3'],
  };
  const relevant = rows.filter(r => prefixes[tabId].some(p => r.kode.startsWith(p)));
  if (!relevant.length) return null;

  const totalGlobal = relevant.reduce((s, r) => s + r.globalValue, 0);
  const totalRincian = relevant.reduce((s, r) => s + r.rincianValue, 0);
  const totalSelisih = totalGlobal - totalRincian;
  const matched = Math.abs(totalSelisih) < 1;
  const label = TAB_LABELS[tabId];

  return (
    <div className={'flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 rounded-2xl border text-sm ' +
      (matched ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800')}>
      <div className="flex items-center gap-2 flex-1">
        <svg className={'w-5 h-5 shrink-0 ' + (matched ? 'text-emerald-500' : 'text-red-500')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={matched
            ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
            : 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z'} />
        </svg>
        <div>
          <p className="font-semibold">{matched ? 'Rincian Selaras' : 'Selisih Terdeteksi'}</p>
          <p className="text-xs opacity-80 mt-0.5">
            Total Buku Besar: {fmt(totalGlobal)} &bull; Rincian: {fmt(totalRincian)} &bull;
            {matched ? ' Cocok' : ` Selisih ${fmt(totalSelisih)}`}
          </p>
        </div>
      </div>
      {!matched && (
        <span className="px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-xs font-bold text-center">
          Selisih {fmt(Math.abs(totalSelisih))}
        </span>
      )}
    </div>
  );
}

// ─── Inventory (Persediaan) Tab ────────────────────────────────
function InventoryTab({ reconRows }: { reconRows: ReconRow[] }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [coaList, setCoaList] = useState<CoAOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nama: '', kode: '', satuan: 'pcs', akunId: '', qtyAwal: '', hargaSatuan: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const t = getToken();
    const [iRes, cRes] = await Promise.all([
      fetch('/api/accounting/inventory-items', { headers: { Authorization: 'Bearer ' + t } }),
      fetch('/api/accounting/coa', { headers: { Authorization: 'Bearer ' + t } }),
    ]);
    const [iData, cData] = await Promise.all([iRes.json(), cRes.json()]);
    setItems((iData.items || []).map((r: any) => ({ ...r, qtyAwal: Number(r.qtyAwal), hargaSatuan: Number(r.hargaSatuan), saldoAwal: Number(r.saldoAwal) })));
    setCoaList((Array.isArray(cData) ? cData : cData.coa || [])
      .filter((a: any) => a.isActive && a.kode?.startsWith('1.1.05') && a.isPostable !== false)
      .map((a: any) => ({ id: a.id, kode: a.kode, nama: a.nama })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setError('');
    const body = {
      nama: form.nama, kode: form.kode, satuan: form.satuan, akun_id: form.akunId,
      qty_awal: parseFloat(form.qtyAwal) || 0, harga_satuan: parseFloat(form.hargaSatuan) || 0,
    };
    if (!body.nama || !body.akun_id) return setError('Nama barang dan akun CoA wajib');
    const method = editId ? 'PUT' : 'POST';
    const url = '/api/accounting/inventory-items' + (editId ? '/' + editId : '');
    const res = await fetch(url, { method, headers: H(), body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); return setError(d.error || 'Gagal'); }
    setForm({ nama: '', kode: '', satuan: 'pcs', akunId: '', qtyAwal: '', hargaSatuan: '' });
    setEditId(null);
    load();
  };

  const edit = (item: InventoryItem) => {
    setEditId(item.id);
    setForm({ nama: item.nama, kode: item.kode, satuan: item.satuan || 'pcs', akunId: item.akunId,
              qtyAwal: String(item.qtyAwal), hargaSatuan: String(item.hargaSatuan) });
  };

  const remove = async (id: string) => {
    await fetch('/api/accounting/inventory-items/' + id, { method: 'DELETE', headers: H() });
    load();
  };

  const saveable = form.nama.trim() && form.akunId;

  return (
    <div className="space-y-6 animate-fade-in">
      <ReconBadge rows={reconRows} tabId="persediaan" />

      <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm">
        <h3 className="font-bold text-slate-900 mb-3">{editId ? 'Edit Barang' : 'Tambah Barang'}</h3>
        {error && <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input placeholder="Nama Barang*" value={form.nama} onChange={e => setForm({...form, nama: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition" />
          <input placeholder="Kode" value={form.kode} onChange={e => setForm({...form, kode: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition" />
          <input placeholder="Satuan (pcs/kg)" value={form.satuan} onChange={e => setForm({...form, satuan: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition" />
          <input type="number" placeholder="Qty Awal" value={form.qtyAwal} onChange={e => setForm({...form, qtyAwal: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition" />
          <input type="number" placeholder="Harga Satuan" value={form.hargaSatuan} onChange={e => setForm({...form, hargaSatuan: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition" />
          <select value={form.akunId} onChange={e => setForm({...form, akunId: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition">
            <option value="">Pilih Akun CoA*</option>
            {coaList.map(a => <option key={a.id} value={a.id}>{a.kode} — {a.nama}</option>)}
          </select>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={save} disabled={!saveable}
            className={'rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all shadow-sm ' +
              (saveable ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:shadow-md cursor-pointer' : 'bg-slate-300 cursor-not-allowed')}>
            {editId ? 'Simpan' : 'Tambah'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm({ nama: '', kode: '', satuan: 'pcs', akunId: '', qtyAwal: '', hargaSatuan: '' }); }}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition">Batal</button>}
        </div>
      </div>

      {loading ? <p className="text-sm text-slate-400">Memuat...</p> : !items.length
        ? <div className="py-10 text-center text-slate-400 text-sm">Belum ada barang</div>
        : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-slate-50/70"><tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 rounded-l-xl">Nama</th><th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Qty</th><th className="px-4 py-3">Harga/Satuan</th>
                <th className="px-4 py-3 text-right">Saldo Awal</th>
                <th className="px-4 py-3 rounded-r-xl text-center">Aksi</th>
              </tr></thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.id} className="border-t border-slate-100 hover:bg-emerald-50/30 transition">
                    <td className="px-4 py-3 font-medium text-slate-900">{it.nama}</td>
                    <td className="px-4 py-3 text-slate-600">{it.kode}</td>
                    <td className="px-4 py-3 text-slate-600">{it.qtyAwal}</td>
                    <td className="px-4 py-3 text-slate-600">{fmt(it.hargaSatuan)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{fmt(it.saldoAwal)}</td>
                    <td className="px-4 py-3 text-center space-x-2">
                      <button onClick={() => edit(it)} className="text-cyan-600 hover:text-cyan-800 text-xs font-semibold">Edit</button>
                      <button onClick={() => remove(it.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Hapus</button>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-slate-50/50 font-bold">
                  <td colSpan={4} className="px-4 py-3 text-right text-slate-700">Total Rincian:</td>
                  <td className="px-4 py-3 text-right text-emerald-800">{fmt(items.reduce((s, i) => s + Number(i.saldoAwal), 0))}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

// ─── Contacts (Hutang/Piutang) Tab ──────────────────────────────
function ContactsTab({ reconRows }: { reconRows: ReconRow[] }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [coaList, setCoaList] = useState<CoAOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nama: '', tipe: 'supplier' as 'supplier' | 'pelanggan', telepon: '', alamat: '', akunId: '', saldoAwal: '', saldoAwalTipe: 'debit' as 'debit' | 'kredit' });
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const t = getToken();
    const [cRes, cRes2] = await Promise.all([
      fetch('/api/accounting/contacts', { headers: { Authorization: 'Bearer ' + t } }),
      fetch('/api/accounting/coa', { headers: { Authorization: 'Bearer ' + t } }),
    ]);
    const [cData, cData2] = await Promise.all([cRes.json(), cRes2.json()]);
    setContacts((cData.contacts || []).map((r: any) => ({ ...r, saldoAwal: Number(r.saldoAwal) })));
    setCoaList((Array.isArray(cData2) ? cData2 : cData2.coa || [])
      .filter((a: any) => a.isActive && a.isPostable !== false &&
        (a.kode?.startsWith('1.1.03') || a.kode?.startsWith('2.1.01')))
      .map((a: any) => ({ id: a.id, kode: a.kode, nama: a.nama })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setError('');
    const body = {
      nama: form.nama, tipe: form.tipe, telepon: form.telepon, alamat: form.alamat,
      akun_id: form.akunId, saldo_awal: parseFloat(form.saldoAwal) || 0, saldo_awal_tipe: form.saldoAwalTipe,
    };
    if (!body.nama || !body.akun_id) return setError('Nama kontak dan akun CoA wajib');
    const method = editId ? 'PUT' : 'POST';
    const url = '/api/accounting/contacts' + (editId ? '/' + editId : '');
    const res = await fetch(url, { method, headers: H(), body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); return setError(d.error || 'Gagal'); }
    setForm({ nama: '', tipe: 'supplier', telepon: '', alamat: '', akunId: '', saldoAwal: '', saldoAwalTipe: 'debit' });
    setEditId(null);
    load();
  };

  const edit = (c: Contact) => {
    setEditId(c.id);
    setForm({ nama: c.nama, tipe: c.tipe, telepon: c.telepon, alamat: c.alamat,
              akunId: c.akunId, saldoAwal: String(c.saldoAwal), saldoAwalTipe: c.saldoAwalTipe });
  };

  const remove = async (id: string) => {
    await fetch('/api/accounting/contacts/' + id, { method: 'DELETE', headers: H() });
    load();
  };

  const saveable = form.nama.trim() && form.akunId;

  return (
    <div className="space-y-6 animate-fade-in">
      <ReconBadge rows={reconRows} tabId="hutang-piutang" />

      <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm">
        <h3 className="font-bold text-slate-900 mb-3">{editId ? 'Edit Kontak' : 'Tambah Kontak'}</h3>
        {error && <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input placeholder="Nama Kontak*" value={form.nama} onChange={e => setForm({...form, nama: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition" />
          <select value={form.tipe} onChange={e => setForm({...form, tipe: e.target.value as 'supplier' | 'pelanggan', saldoAwalTipe: e.target.value === 'supplier' ? 'kredit' : 'debit' })}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition">
            <option value="supplier">Supplier (Utang)</option>
            <option value="pelanggan">Pelanggan (Piutang)</option>
          </select>
          <input placeholder="Telepon" value={form.telepon} onChange={e => setForm({...form, telepon: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition" />
          <input placeholder="Alamat" value={form.alamat} onChange={e => setForm({...form, alamat: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition" />
          <select value={form.akunId} onChange={e => setForm({...form, akunId: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition">
            <option value="">Pilih Akun CoA*</option>
            {coaList.map(a => <option key={a.id} value={a.id}>{a.kode} — {a.nama}</option>)}
          </select>
          <div className="flex gap-2">
            <input type="number" placeholder="Saldo Awal" value={form.saldoAwal} onChange={e => setForm({...form, saldoAwal: e.target.value})}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition" />
            <select value={form.saldoAwalTipe} onChange={e => setForm({...form, saldoAwalTipe: e.target.value as 'debit' | 'kredit' })}
              className="rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-emerald-500/30 transition">
              <option value="debit">D</option>
              <option value="kredit">K</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={save} disabled={!saveable}
            className={'rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all shadow-sm ' +
              (saveable ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:shadow-md cursor-pointer' : 'bg-slate-300 cursor-not-allowed')}>
            {editId ? 'Simpan' : 'Tambah'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm({ nama: '', tipe: 'supplier', telepon: '', alamat: '', akunId: '', saldoAwal: '', saldoAwalTipe: 'debit' }); }}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition">Batal</button>}
        </div>
      </div>

      {loading ? <p className="text-sm text-slate-400">Memuat...</p> : !contacts.length
        ? <div className="py-10 text-center text-slate-400 text-sm">Belum ada kontak</div>
        : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-slate-50/70"><tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 rounded-l-xl">Nama</th><th className="px-4 py-3">Tipe</th>
                <th className="px-4 py-3">Telepon</th>
                <th className="px-4 py-3 text-right">Saldo Awal</th>
                <th className="px-4 py-3 rounded-r-xl text-center">Aksi</th>
              </tr></thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-emerald-50/30 transition">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.nama}</td>
                    <td className="px-4 py-3"><span className={c.tipe === 'supplier' ? 'px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700' : 'px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700'}>{c.tipe === 'supplier' ? 'Supplier' : 'Pelanggan'}</span></td>
                    <td className="px-4 py-3 text-slate-600">{c.telepon}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{fmt(c.saldoAwal)}</td>
                    <td className="px-4 py-3 text-center space-x-2">
                      <button onClick={() => edit(c)} className="text-cyan-600 hover:text-cyan-800 text-xs font-semibold">Edit</button>
                      <button onClick={() => remove(c.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Hapus</button>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-slate-50/50 font-bold">
                  <td colSpan={3} className="px-4 py-3 text-right text-slate-700">Total Rincian:</td>
                  <td className="px-4 py-3 text-right text-emerald-800">{fmt(contacts.reduce((s, c) => s + Number(c.saldoAwal), 0))}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

// ─── Fixed Assets (Aset Tetap) Tab ──────────────────────────────
function AssetsTab({ reconRows }: { reconRows: ReconRow[] }) {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [coaList, setCoaList] = useState<CoAOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nama: '', kategori: 'lainnya', akunId: '', tanggalPerolehan: '', hargaPerolehan: '', akumulasiPenyusutan: '', umurManfaatBulan: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const t = getToken();
    const [aRes, cRes] = await Promise.all([
      fetch('/api/accounting/fixed-assets', { headers: { Authorization: 'Bearer ' + t } }),
      fetch('/api/accounting/coa', { headers: { Authorization: 'Bearer ' + t } }),
    ]);
    const [aData, cData] = await Promise.all([aRes.json(), cRes.json()]);
    setAssets((aData.assets || []).map((r: any) => ({ ...r, hargaPerolehan: Number(r.hargaPerolehan), akumulasiPenyusutan: Number(r.akumulasiPenyusutan), nilaiBukuAwal: Number(r.nilaiBukuAwal), umurManfaatBulan: Number(r.umurManfaatBulan || 0) })));
    setCoaList((Array.isArray(cData) ? cData : cData.coa || [])
      .filter((a: any) => a.isActive && a.isPostable !== false &&
        (a.kode?.startsWith('1.2') || a.kode?.startsWith('1.3')))
      .map((a: any) => ({ id: a.id, kode: a.kode, nama: a.nama })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setError('');
    const body = {
      nama: form.nama, kategori: form.kategori, akun_id: form.akunId,
      tanggal_perolehan: form.tanggalPerolehan || null,
      harga_perolehan: parseFloat(form.hargaPerolehan) || 0,
      akumulasi_penyusutan: parseFloat(form.akumulasiPenyusutan) || 0,
      umur_manfaat_bulan: parseInt(form.umurManfaatBulan) || null,
    };
    if (!body.nama || !body.akun_id) return setError('Nama aset dan akun CoA wajib');
    const method = editId ? 'PUT' : 'POST';
    const url = '/api/accounting/fixed-assets' + (editId ? '/' + editId : '');
    const res = await fetch(url, { method, headers: H(), body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); return setError(d.error || 'Gagal'); }
    setForm({ nama: '', kategori: 'lainnya', akunId: '', tanggalPerolehan: '', hargaPerolehan: '', akumulasiPenyusutan: '', umurManfaatBulan: '' });
    setEditId(null);
    load();
  };

  const edit = (a: FixedAsset) => {
    setEditId(a.id);
    setForm({ nama: a.nama, kategori: a.kategori, akunId: a.akunId, tanggalPerolehan: a.tanggalPerolehan || '',
              hargaPerolehan: String(a.hargaPerolehan), akumulasiPenyusutan: String(a.akumulasiPenyusutan),
              umurManfaatBulan: a.umurManfaatBulan ? String(a.umurManfaatBulan) : '' });
  };

  const remove = async (id: string) => {
    await fetch('/api/accounting/fixed-assets/' + id, { method: 'DELETE', headers: H() });
    load();
  };

  const saveable = form.nama.trim() && form.akunId;

  return (
    <div className="space-y-6 animate-fade-in">
      <ReconBadge rows={reconRows} tabId="aset-tetap" />

      <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm">
        <h3 className="font-bold text-slate-900 mb-3">{editId ? 'Edit Aset' : 'Tambah Aset'}</h3>
        {error && <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input placeholder="Nama Aset*" value={form.nama} onChange={e => setForm({...form, nama: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition" />
          <select value={form.kategori} onChange={e => setForm({...form, kategori: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition">
            <option value="kendaraan">Kendaraan</option><option value="bangunan">Bangunan</option>
            <option value="peralatan">Peralatan</option><option value="tanah">Tanah</option>
            <option value="lainnya">Lainnya</option>
          </select>
          <select value={form.akunId} onChange={e => setForm({...form, akunId: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition">
            <option value="">Pilih Akun CoA*</option>
            {coaList.map(a => <option key={a.id} value={a.id}>{a.kode} — {a.nama}</option>)}
          </select>
          <DatePicker value={form.tanggalPerolehan} onChange={v => setForm({...form, tanggalPerolehan: v})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition" />
          <input type="number" placeholder="Harga Perolehan" value={form.hargaPerolehan} onChange={e => setForm({...form, hargaPerolehan: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition" />
          <input type="number" placeholder="Akum. Penyusutan" value={form.akumulasiPenyusutan} onChange={e => setForm({...form, akumulasiPenyusutan: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition" />
          <input type="number" placeholder="Umur Manfaat (bulan)" value={form.umurManfaatBulan} onChange={e => setForm({...form, umurManfaatBulan: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition" />
        </div>
        <div className="mt-3 text-xs text-slate-400">Nilai Buku Awal = Harga Perolehan − Akumulasi Penyusutan (auto)</div>
        <div className="mt-3 flex gap-2">
          <button onClick={save} disabled={!saveable}
            className={'rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all shadow-sm ' +
              (saveable ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:shadow-md cursor-pointer' : 'bg-slate-300 cursor-not-allowed')}>
            {editId ? 'Simpan' : 'Tambah'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm({ nama: '', kategori: 'lainnya', akunId: '', tanggalPerolehan: '', hargaPerolehan: '', akumulasiPenyusutan: '', umurManfaatBulan: '' }); }}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition">Batal</button>}
        </div>
      </div>

      {loading ? <p className="text-sm text-slate-400">Memuat...</p> : !assets.length
        ? <div className="py-10 text-center text-slate-400 text-sm">Belum ada aset tetap</div>
        : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50/70"><tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 rounded-l-xl">Nama</th><th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Tgl Perolehan</th><th className="px-4 py-3 text-right">Harga</th>
                <th className="px-4 py-3 text-right">Akum. Susut</th>
                <th className="px-4 py-3 text-right">Nilai Buku</th>
                <th className="px-4 py-3 rounded-r-xl text-center">Aksi</th>
              </tr></thead>
              <tbody>
                {assets.map(a => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-emerald-50/30 transition">
                    <td className="px-4 py-3 font-medium text-slate-900">{a.nama}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 capitalize">{a.kategori}</span></td>
                    <td className="px-4 py-3 text-slate-600">{a.tanggalPerolehan || '-'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(a.hargaPerolehan)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{fmt(a.akumulasiPenyusutan)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{fmt(a.nilaiBukuAwal)}</td>
                    <td className="px-4 py-3 text-center space-x-2">
                      <button onClick={() => edit(a)} className="text-cyan-600 hover:text-cyan-800 text-xs font-semibold">Edit</button>
                      <button onClick={() => remove(a.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Hapus</button>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-slate-50/50 font-bold">
                  <td colSpan={5} className="px-4 py-3 text-right text-slate-700">Total Nilai Buku:</td>
                  <td className="px-4 py-3 text-right text-emerald-800">{fmt(assets.reduce((s, a) => s + Number(a.nilaiBukuAwal), 0))}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

// ─── Equity (Modal / Ekuitas) Tab ────────────────────────────────
function EquityTab({ reconRows }: { reconRows: ReconRow[] }) {
  const [equities, setEquities] = useState<Equity[]>([]);
  const [coaList, setCoaList] = useState<CoAOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ sumber: 'Pemerintah Desa' as 'Pemerintah Desa' | 'Masyarakat' | 'Lainnya', tahunPenerimaan: new Date().getFullYear().toString(), keterangan: '', akunId: '', saldoAwal: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const t = getToken();
    const [eRes, cRes] = await Promise.all([
      fetch('/api/accounting/equity-details', { headers: { Authorization: 'Bearer ' + t } }),
      fetch('/api/accounting/coa', { headers: { Authorization: 'Bearer ' + t } }),
    ]);
    const [eData, cData] = await Promise.all([eRes.json(), cRes.json()]);
    setEquities((eData.equities || []).map((r: any) => ({ ...r, saldoAwal: Number(r.saldoAwal), tahunPenerimaan: Number(r.tahunPenerimaan) })));
    setCoaList((Array.isArray(cData) ? cData : cData.coa || [])
      .filter((a: any) => a.isActive && a.isPostable !== false &&
        (a.kode?.startsWith('3') || a.kode?.startsWith('4')))
      .map((a: any) => ({ id: a.id, kode: a.kode, nama: a.nama })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setError('');
    const body = {
      sumber: form.sumber, tahun_penerimaan: parseInt(form.tahunPenerimaan, 10),
      keterangan: form.keterangan, akun_id: form.akunId, saldo_awal: parseFloat(form.saldoAwal) || 0,
    };
    if (!body.akun_id || !body.tahun_penerimaan) return setError('Akun CoA dan tahun wajib');
    const method = editId ? 'PUT' : 'POST';
    const url = '/api/accounting/equity-details' + (editId ? '/' + editId : '');
    const res = await fetch(url, { method, headers: H(), body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); return setError(d.error || 'Gagal'); }
    setForm({ sumber: 'Pemerintah Desa', tahunPenerimaan: new Date().getFullYear().toString(), keterangan: '', akunId: '', saldoAwal: '' });
    setEditId(null);
    load();
  };

  const edit = (e: Equity) => {
    setEditId(e.id);
    setForm({ sumber: e.sumber, tahunPenerimaan: String(e.tahunPenerimaan), keterangan: e.keterangan, akunId: e.akunId, saldoAwal: String(e.saldoAwal) });
  };

  const remove = async (id: string) => {
    await fetch('/api/accounting/equity-details/' + id, { method: 'DELETE', headers: H() });
    load();
  };

  const saveable = form.akunId.trim() && form.tahunPenerimaan.trim();

  return (
    <div className="space-y-6 animate-fade-in">
      <ReconBadge rows={reconRows} tabId="modal" />

      <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm">
        <h3 className="font-bold text-slate-900 mb-3">{editId ? 'Edit Rincian Modal' : 'Tambah Rincian Modal'}</h3>
        {error && <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <select value={form.sumber} onChange={e => setForm({...form, sumber: e.target.value as 'Pemerintah Desa' | 'Masyarakat' | 'Lainnya'})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition">
            <option value="Pemerintah Desa">Pemerintah Desa</option>
            <option value="Masyarakat">Masyarakat</option>
            <option value="Lainnya">Lainnya</option>
          </select>
          <input type="number" placeholder="Tahun Penerimaan*" value={form.tahunPenerimaan} onChange={e => setForm({...form, tahunPenerimaan: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition" />
          <input placeholder="Keterangan" value={form.keterangan} onChange={e => setForm({...form, keterangan: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition" />
          <select value={form.akunId} onChange={e => setForm({...form, akunId: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition">
            <option value="">Pilih Akun CoA*</option>
            {coaList.map(a => <option key={a.id} value={a.id}>{a.kode} — {a.nama}</option>)}
          </select>
          <input type="number" placeholder="Saldo Awal" value={form.saldoAwal} onChange={e => setForm({...form, saldoAwal: e.target.value})}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition" />
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={save} disabled={!saveable}
            className={'rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all shadow-sm ' +
              (saveable ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:shadow-md cursor-pointer' : 'bg-slate-300 cursor-not-allowed')}>
            {editId ? 'Simpan' : 'Tambah'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm({ sumber: 'Pemerintah Desa', tahunPenerimaan: new Date().getFullYear().toString(), keterangan: '', akunId: '', saldoAwal: '' }); }}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition">Batal</button>}
        </div>
      </div>

      {loading ? <p className="text-sm text-slate-400">Memuat...</p> : !equities.length
        ? <div className="py-10 text-center text-slate-400 text-sm">Belum ada rincian modal</div>
        : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[650px]">
              <thead className="bg-slate-50/70"><tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 rounded-l-xl">Sumber</th><th className="px-4 py-3">Tahun</th>
                <th className="px-4 py-3">Keterangan</th>
                <th className="px-4 py-3 text-right">Saldo Awal</th>
                <th className="px-4 py-3 rounded-r-xl text-center">Aksi</th>
              </tr></thead>
              <tbody>
                {equities.map(e => (
                  <tr key={e.id} className="border-t border-slate-100 hover:bg-emerald-50/30 transition">
                    <td className="px-4 py-3"><span className={
                      e.sumber === 'Pemerintah Desa' ? 'px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700' :
                      e.sumber === 'Masyarakat' ? 'px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700' :
                      'px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700'
                    }>{e.sumber}</span></td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{e.tahunPenerimaan}</td>
                    <td className="px-4 py-3 text-slate-600">{e.keterangan || '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{fmt(e.saldoAwal)}</td>
                    <td className="px-4 py-3 text-center space-x-2">
                      <button onClick={() => edit(e)} className="text-cyan-600 hover:text-cyan-800 text-xs font-semibold">Edit</button>
                      <button onClick={() => remove(e.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Hapus</button>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-slate-50/50 font-bold">
                  <td colSpan={3} className="px-4 py-3 text-right text-slate-700">Total Rincian:</td>
                  <td className="px-4 py-3 text-right text-emerald-800">{fmt(equities.reduce((s, e) => s + e.saldoAwal, 0))}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────
export default function RincianSaldoPage() {
  const [activeTab, setActiveTab] = useState<TabId>('persediaan');
  const [reconRows, setReconRows] = useState<ReconRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [printOpen, setPrintOpen] = useState(false);

  const loadRecon = useCallback(async () => {
    const t = getToken();
    const res = await fetch('/api/accounting/rincian-saldo/reconciliation', { headers: { Authorization: 'Bearer ' + t } });
    const data = await res.json();
    setReconRows(data.accounts || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadRecon(); }, [loadRecon]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rincian Saldo</h1>
          <p className="mt-1 text-sm text-slate-500">Detail Persediaan, Hutang/Piutang, Aset Tetap, dan Modal yang terhubung ke Saldo Awal global.</p>
        </div>
        <button type="button" onClick={() => setPrintOpen(true)} disabled={!reconRows.length}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-emerald-300 transition whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
          <Printer size={16} className="inline -mt-0.5 mr-1" /> Cetak
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={'flex-1 min-w-[100px] rounded-lg px-3 py-2 text-sm font-semibold transition-all ' +
              (activeTab === tab ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}>
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">Memuat data rekonsiliasi...</div>
      ) : (
        <>
          {activeTab === 'persediaan' && <InventoryTab reconRows={reconRows} />}
          {activeTab === 'hutang-piutang' && <ContactsTab reconRows={reconRows} />}
          {activeTab === 'aset-tetap' && <AssetsTab reconRows={reconRows} />}
          {activeTab === 'modal' && <EquityTab reconRows={reconRows} />}
        </>
      )}

      {/* Print Modal */}
      <ReportPrintLayout title="BUKU KAS" isOpen={printOpen} onClose={() => setPrintOpen(false)}>
        {reconRows.length > 0 && (
          <div className="text-[11px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-1 pr-2 font-bold">No</th>
                  <th className="text-left py-1 pr-2 font-bold">Kode Akun</th>
                  <th className="text-left py-1 pr-2 font-bold">Nama Akun</th>
                  <th className="text-left py-1 pr-2 font-bold">Tipe</th>
                  <th className="text-right py-1 pr-2 font-bold">Buku Besar</th>
                  <th className="text-right py-1 pr-2 font-bold">Rincian</th>
                  <th className="text-right py-1 pr-2 font-bold">Selisih</th>
                  <th className="text-center py-1 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {reconRows.map((r, i) => (
                  <tr key={r.akunId} className="border-b border-slate-200">
                    <td className="py-1 pr-2 text-slate-600">{i + 1}</td>
                    <td className="py-1 pr-2 text-slate-600">{r.kode}</td>
                    <td className="py-1 pr-2 text-slate-800">{r.namaAkun}</td>
                    <td className="py-1 pr-2 text-slate-600">{r.subledgerType}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{fmt(r.globalValue)}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{fmt(r.rincianValue)}</td>
                    <td className={`py-1 pr-2 text-right tabular-nums ${Math.abs(r.selisih) < 1 ? '' : 'text-red-600'}`}>{fmt(r.selisih)}</td>
                    <td className="py-1 text-center">
                      <span className={r.status === 'MATCHED' ? 'text-emerald-600' : 'text-red-600'}>{r.status === 'MATCHED' ? '✓ Cocok' : '✗ Tidak Cocok'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportPrintLayout>
    </div>
  );
}
