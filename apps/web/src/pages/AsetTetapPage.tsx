import { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Download, CalendarDots, Calculator, Laptop, Truck, Armchair, Building, Trees, BoxArrowUp, CheckCircle, AlertTriangle, X, Search, Printer } from 'lucide-react';
import ReportPrintLayout from './ReportPrintLayout';
import DatePicker from './DatePicker';

type Aset = {
  id: string; nama: string; kategori: string;
  hargaPerolehan: number; akumulasiPenyusutan: number;
  nilaiBuku: number; nilaiBukuAwal: number;
  umurManfaatBulan: number;
  bulanTerpakai: number; bulanTersisa: number;
  tanggalPerolehan: string;
  persenHidup: number; habis: boolean;
};

const rupiah = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition';
const br = 'rounded-2xl border border-white/70 bg-white/80 backdrop-blur-xl shadow-sm';

const KATEGORI_ICON: Record<string, string> = {
  Kendaraan: 'Truck', Komputer: 'Laptop', Meubelair: 'Armchair', Bangunan: 'Building', Tanah: 'Trees', Lainnya: 'BoxArrowUp',
};
const KATEGORI_BG: Record<string, string> = {
  Kendaraan: 'from-amber-500/20 to-orange-500/20 text-amber-600',
  Komputer: 'from-blue-500/20 to-indigo-500/20 text-blue-600',
  Meubelair: 'from-violet-500/20 to-purple-500/20 text-violet-600',
  Bangunan: 'from-emerald-500/20 to-teal-500/20 text-emerald-600',
  Tanah: 'from-green-500/20 to-emerald-500/20 text-green-600',
  Lainnya: 'from-slate-500/20 to-gray-500/20 text-slate-600',
};
const KATEGORI_OPTIONS = ['Kendaraan', 'Komputer', 'Meubelair', 'Bangunan', 'Tanah', 'Lainnya'];

function AssetCard({ aset, onDepreciate }: { aset: Aset; onDepreciate?: () => void }) {
  const bgCls = KATEGORI_BG[aset.kategori] || KATEGORI_BG['Lainnya'];
  const barColor = aset.habis ? 'bg-red-500' : aset.persenHidup < 25 ? 'bg-amber-500' : 'bg-emerald-500';
  const iconName = KATEGORI_ICON[aset.kategori] || 'Package';
  return (
    <div className={`${br} p-4 sm:p-5 transition hover:shadow-md hover:-translate-y-0.5`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${bgCls} shrink-0`}>
          <Package size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900 truncate">{aset.nama}</h3>
          <p className="text-xs text-slate-500">{aset.kategori} · {aset.tanggalPerolehan}</p>
        </div>
        {aset.habis && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 whitespace-nowrap">HABIS</span>}
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Nilai Perolehan</span>
          <span className="font-semibold text-slate-800 tabular-nums">{rupiah(aset.hargaPerolehan)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Nilai Buku</span>
          <span className={`font-bold tabular-nums ${aset.habis ? 'text-red-600' : 'text-emerald-700'}`}>{rupiah(aset.nilaiBuku)}</span>
        </div>
        {aset.umurManfaatBulan > 0 && (
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-500">Sisa {aset.bulanTersisa}/{aset.umurManfaatBulan} bln</span>
              <span className={`text-xs font-semibold ${aset.habis ? 'text-red-500' : 'text-emerald-600'}`}>{aset.persenHidup}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full ${barColor} transition-all duration-300`} style={{ width: aset.persenHidup + '%' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddAssetModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ nama: '', kategori: 'Komputer', tanggal_perolehan: new Date().toISOString().slice(0, 10), harga_perolehan: '', umur: '48', sumber_dana_id: '' });
  const [kasAccs, setKasAccs] = useState<{ id: string; kode: string; nama: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
    fetch('/api/accounting/aset-tetap/kas-accounts', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => setKasAccs(d.data || [])).catch(() => {});
  }, [open]);

  const save = async () => {
    if (!form.nama || !form.harga_perolehan || !form.sumber_dana_id) return;
    setSaving(true);
    try {
      const t = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
      const r = await fetch('/api/accounting/aset-tetap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({
          nama: form.nama,
          kategori: form.kategori,
          tanggal_perolehan: form.tanggal_perolehan,
          harga_perolehan: Number(form.harga_perolehan),
          umur_manfaat_bulan: Number(form.umur),
          sumber_dana_id: form.sumber_dana_id,
        }),
      });
      if (r.ok) { onDone(); onClose(); } else { const e = await r.json(); alert(e.error || 'Gagal'); }
    } finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-600"><Plus size={18} /></div>
          <h3 className="text-base font-bold text-slate-900">Tambah Aset Baru</h3>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Nama Aset *</label>
            <input type="text" value={form.nama} onChange={e => setForm(p => ({ ...p, nama: e.target.value }))} placeholder="Contoh: Laptop Asus" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Kategori *</label>
            <select value={form.kategori} onChange={e => setForm(p => ({ ...p, kategori: e.target.value }))} className={inputCls}>
              {KATEGORI_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Tanggal Beli *</label>
              <DatePicker value={form.tanggal_perolehan} onChange={v => setForm(p => ({ ...p, tanggal_perolehan: v }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Harga Beli *</label>
              <input type="number" value={form.harga_perolehan} onChange={e => setForm(p => ({ ...p, harga_perolehan: e.target.value }))} placeholder="Rp 10.000.000" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Umur Ekonomis (Bulan) *</label>
              <input type="number" value={form.umur} onChange={e => setForm(p => ({ ...p, umur: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Sumber Dana *</label>
              <select value={form.sumber_dana_id} onChange={e => setForm(p => ({ ...p, sumber_dana_id: e.target.value }))} className={inputCls}>
                <option value="">Pilih Kas/Bank</option>
                {kasAccs.map(a => <option key={a.id} value={a.id}>{a.kode} — {a.nama}</option>)}
              </select>
            </div>
          </div>
          <div className="bg-emerald-50 rounded-xl px-3.5 py-2.5 text-xs text-emerald-700 flex items-start gap-2">
            <CheckCircle size={14} className="mt-0.5 shrink-0" />
            <span>Aset baru akan otomatis membuat jurnal pembelian (Debit Aset, Kredit Kas/Bank) dan masuk ke Laporan Neraca.</span>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Batal</button>
            <button type="button" onClick={save} disabled={saving || !form.nama || !form.harga_perolehan || !form.sumber_dana_id}
              className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-40 transition hover:shadow-xl">
              {saving ? 'Menyimpan...' : 'Simpan Aset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AsetTetapPage() {
  const [asets, setAsets] = useState<Aset[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [depreMsg, setDepreMsg] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('');
  const [printOpen, setPrintOpen] = useState(false);

  const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const fmtIdDate = (d: string) => { const p = d.split('-'); return `${parseInt(p[2])} ${MONTHS_ID[parseInt(p[1]) - 1]} ${p[0]}`; };
  const periodLabelAset = `Per ${fmtIdDate(new Date().toISOString().slice(0, 10))}`;

  const token = () => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/accounting/aset-tetap', { headers: { Authorization: 'Bearer ' + token() } });
      if (r.ok) { const d = await r.json(); setAsets(d.data || []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runDepreciate = async () => {
    if (!confirm('Jalankan penyusutan bulanan untuk semua aset aktif?')) return;
    try {
      const r = await fetch('/api/accounting/aset-tetap/depreciate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      });
      if (r.ok) {
        const d = await r.json();
        setDepreMsg(`${d.success} aset berhasil disusutkan`);
        fetchData();
      }
    } catch {}
  };

  const filtered = asets.filter(a => !kategoriFilter || a.kategori === kategoriFilter);
  const totalPerolehan = asets.reduce((s, a) => s + a.hargaPerolehan, 0);
  const totalBuku = asets.reduce((s, a) => s + a.nilaiBuku, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-600">
          <Package size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-900">Manajemen Aset & Inventaris</h2>
          <p className="text-xs text-slate-500">Fixed Asset Management — Lacak, susutkan, dan cetak daftar aset</p>
        </div>
        <div className="flex gap-2">
          <button onClick={runDepreciate} title="Jalankan penyusutan bulanan"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition whitespace-nowrap">
            <Calculator size={16} className="inline -mt-0.5 mr-1" /> Susutkan
          </button>
          <button onClick={() => setModalOpen(true)}
            className="rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:shadow-xl transition whitespace-nowrap">
            <Plus size={16} className="inline -mt-0.5 mr-1" /> Tambah Aset
          </button>
          <button type="button" onClick={() => setPrintOpen(true)} disabled={!asets.length}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-emerald-300 transition whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed">
            <Printer size={16} className="inline -mt-0.5 mr-1" /> Cetak
          </button>
        </div>
      </div>

      {depreMsg && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle size={16} className="shrink-0" /> {depreMsg}
          <button onClick={() => setDepreMsg('')} className="ml-auto text-emerald-400 hover:text-emerald-600"><X size={14} /></button>
        </div>
      )}

      {/* Summary */}
      <div className={`${br} p-4 sm:p-5`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-500">Total Aset</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{asets.length} item</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Nilai Perolehan</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{rupiah(totalPerolehan)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Akumulasi Susut</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{rupiah(totalPerolehan - totalBuku)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Nilai Buku Bersih</p>
            <p className="text-lg font-bold text-emerald-700 tabular-nums">{rupiah(totalBuku)}</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setKategoriFilter('')} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${!kategoriFilter ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Semua</button>
        {KATEGORI_OPTIONS.map(k => (
          <button key={k} onClick={() => setKategoriFilter(k)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${kategoriFilter === k ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{k}</button>
        ))}
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className="text-center py-12 text-sm text-slate-400">Memuat data...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Package size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">Belum ada aset. Klik "Tambah Aset" untuk memulai.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(a => <AssetCard key={a.id} aset={a} />)}
        </div>
      )}

      {/* Modal */}
      <AddAssetModal open={modalOpen} onClose={() => setModalOpen(false)} onDone={fetchData} />

      <p className="text-[10px] text-slate-400 text-right">Penyusutan metode garis lurus · bulanan auto-jurnal</p>

      {/* Print Modal */}
      <ReportPrintLayout title="LAPORAN ASET & INVENTARIS" isOpen={printOpen} onClose={() => setPrintOpen(false)} periodLabel={periodLabelAset} landscape={true}>
        {asets.length > 0 && (
          <div className="text-[11px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-1 pr-2 font-bold">No</th>
                  <th className="text-left py-1 pr-2 font-bold">Kode Aset</th>
                  <th className="text-left py-1 pr-2 font-bold">Nama Aset</th>
                  <th className="text-left py-1 pr-2 font-bold">Kategori</th>
                  <th className="text-right py-1 pr-2 font-bold">Harga Perolehan</th>
                  <th className="text-right py-1 pr-2 font-bold">Akumulasi</th>
                  <th className="text-right py-1 pr-2 font-bold">Nilai Buku</th>
                  <th className="text-center py-1 font-bold">Kondisi</th>
                </tr>
              </thead>
              <tbody>
                {asets.map((a, i) => (
                  <tr key={a.id} className="border-b border-slate-200">
                    <td className="py-1 pr-2 text-slate-600">{i + 1}</td>
                    <td className="py-1 pr-2 text-slate-600">{a.id.slice(0, 8)}</td>
                    <td className="py-1 pr-2 text-slate-800">{a.nama}</td>
                    <td className="py-1 pr-2 text-slate-600">{a.kategori}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{rupiah(a.hargaPerolehan)}</td>
                    <td className="py-1 pr-2 text-right tabular-nums text-red-600">{rupiah(a.akumulasiPenyusutan)}</td>
                    <td className="py-1 pr-2 text-right tabular-nums font-semibold">{rupiah(a.nilaiBuku)}</td>
                    <td className="py-1 text-center">{a.habis ? 'Habis' : 'Aktif'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-800 font-bold">
                  <td colSpan={4} className="py-1.5 pr-2 text-right">TOTAL</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{rupiah(asets.reduce((s, a) => s + a.hargaPerolehan, 0))}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-red-600">{rupiah(asets.reduce((s, a) => s + a.akumulasiPenyusutan, 0))}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums font-bold">{rupiah(asets.reduce((s, a) => s + a.nilaiBuku, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </ReportPrintLayout>
    </div>
  );
}
