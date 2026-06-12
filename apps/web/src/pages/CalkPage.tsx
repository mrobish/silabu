import { useState, useRef } from 'react';
import { useAccountingYears } from './useAccountingYears';
import { FileText, Loader2, CheckCircle, ChevronDown, ChevronRight, Printer } from 'lucide-react';

const rupiah = (n: number) => {
  const neg = n < 0;
  const s = Math.abs(n).toLocaleString('id-ID');
  return neg ? `(Rp ${s})` : `Rp ${s}`;
};

const br = 'rounded-2xl border border-white/70 bg-white/80 backdrop-blur-xl shadow-sm';

type CalkData = {
  asOf: string;
  kas: { kode: string; nama: string; saldo: number }[];
  piutang: { nama: string; saldo_awal: number; tipe: string; akun: string }[];
  persediaan: { nama: string; kode: string; satuan: string; qty_awal: number; harga_satuan: number; saldo_awal: number; akun_kode: string }[];
  asetTetap: { nama: string; kategori: string; tanggal_perolehan: string; harga_perolehan: number; akumulasi_penyusutan: number; nilai_buku_awal: number; umur_manfaat_bulan: number; akun_kode: string }[];
  utang: { nama: string; saldo_awal: number; tipe: string; akun: string }[];
  ekuitas: { sumber: string; tahun: number; keterangan: string; saldo_awal: number; akun: string }[];
  labaRugi: { kode: string; nama: string; saldo: number }[];
};


const DEFAULT_NARRATIVE = `IKHTISAR KEBIJAKAN AKUNTANSI

Dasar Penyusunan
Laporan Keuangan disusun berdasarkan Standar Akuntansi Keuangan untuk Entitas Tanpa Akuntabilitas Publik (SAK ETAP).

Kas & Setara Kas
Disajikan sebesar nilai nominal pada akhir periode.

Persediaan
Menggunakan sistem pencatatan Perpetual FIFO.

Aset Tetap
Aset tetap dicatat sebesar biaya perolehannya dan disusutkan menggunakan metode garis lurus tanpa nilai residu.`;

function Section({ title, n, children }: { title: string; n: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={br + ' p-5'}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 text-left"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold shrink-0">{n}</span>
        <h3 className="text-sm font-bold text-slate-900 flex-1">{title}</h3>
        {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

export default function CalkPage() {
  const now = new Date();
  const years = useAccountingYears();
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const lastDay = new Date(tahun, bulan, 0).getDate();
  const end = `${tahun}-${String(bulan).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  const [narasi, setNarasi] = useState(DEFAULT_NARRATIVE);
  const [data, setData] = useState<CalkData | null>(null);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const token = () => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';

  const generate = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/accounting/calk-details?end_date=${end}`, { headers: { Authorization: 'Bearer ' + token() } });
      if (!r.ok) throw new Error('Gagal memuat data');
      setData(await r.json());
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handlePrint = () => window.print();

  const totalKas = data?.kas.reduce((s, i) => s + i.saldo, 0) || 0;
  const totalPersediaan = data?.persediaan.reduce((s, i) => s + i.saldo_awal, 0) || 0;
  const totalAset = data?.asetTetap.reduce((s, i) => s + i.nilai_buku_awal, 0) || 0;
  const totalHargaPerolehan = data?.asetTetap.reduce((s, i) => s + i.harga_perolehan, 0) || 0;
  const totalAkum = data?.asetTetap.reduce((s, i) => s + i.akumulasi_penyusutan, 0) || 0;
  const totalPiutang = data?.piutang.reduce((s, i) => s + i.saldo_awal, 0) || 0;
  const totalUtang = data?.utang.reduce((s, i) => s + i.saldo_awal, 0) || 0;
  const totalEkuitas = data?.ekuitas.reduce((s, i) => s + i.saldo_awal, 0) || 0;
  const pendapatan = data?.labaRugi.filter(r => r.kode.startsWith('4')).reduce((s, r) => s + r.saldo, 0) || 0;
  const beban = data?.labaRugi.filter(r => !r.kode.startsWith('4')).reduce((s, r) => s + r.saldo, 0) || 0;
  const labaBersih = pendapatan - beban;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-600">
          <FileText size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">CALK</h2>
          <p className="text-xs text-slate-500">Catatan Atas Laporan Keuangan - SAK ETAP</p>
        </div>
        <div className="flex-1" />
        {data && (
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center gap-2"
          >
            <Printer size={14} /> Cetak
          </button>
        )}
      </div>

      {/* Filter + Generate */}
      <div className={br + ' p-5 relative z-10 print:hidden'}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Periode</label>
            <div className="flex gap-2">
              <select value={bulan} onChange={e => setBulan(Number(e.target.value))} className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition">
                {['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'].map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <select value={tahun} onChange={e => setTahun(Number(e.target.value))} className="w-24 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={generate} disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:shadow-xl transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Memuat...</> : 'Generate Rincian Angka CALK'}
            </button>
          </div>
        </div>
      </div>

      <div ref={printRef} className="space-y-4 print:space-y-2">
        {/* BAGIAN 1: Narasi */}
        <Section title="Ikhtisar Kebijakan Akuntansi" n={1}>
          <textarea
            value={narasi} onChange={e => setNarasi(e.target.value)}
            rows={10}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 font-mono leading-relaxed focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-y print:border-none print:bg-transparent"
          />
        </Section>

        {/* BAGIAN 2: Rincian Angka (auto-generated) */}
        {data && (
          <>
            {/* Cat 1: Kas & Setara Kas */}
            <Section title="Cat 1: Kas & Setara Kas" n={2}>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-200">
                  <th className="text-left py-2 font-semibold text-slate-500">Akun</th>
                  <th className="text-right py-2 font-semibold text-slate-500">Saldo Akhir</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.kas.filter(k => k.saldo !== 0).map(k => (
                    <tr key={k.kode} className="hover:bg-slate-50/50">
                      <td className="py-1.5 text-slate-700">{k.nama}</td>
                      <td className="py-1.5 text-right tabular-nums">{rupiah(k.saldo)}</td>
                    </tr>
                  ))}
                  {data.kas.every(k => k.saldo === 0) && (
                    <tr><td colSpan={2} className="py-3 text-center text-slate-400 italic">Semua akun Kas & Bank bersaldo 0</td></tr>
                  )}
                </tbody>
                <tfoot><tr className="border-t-2 border-emerald-200 font-bold">
                  <td className="py-2 text-slate-900">Total Kas & Setara Kas</td>
                  <td className="py-2 text-right tabular-nums text-emerald-700">{rupiah(totalKas)}</td>
                </tr></tfoot>
              </table>
            </Section>

            {/* Cat 2: Piutang */}
            <Section title="Cat 2: Piutang Usaha" n={3}>
              {data.piutang.length === 0
                ? <p className="text-xs text-slate-400 italic">Tidak ada data piutang pelanggan</p>
                : <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-200">
                      <th className="text-left py-2 font-semibold text-slate-500">Pelanggan</th>
                      <th className="text-left py-2 font-semibold text-slate-500">Akun</th>
                      <th className="text-right py-2 font-semibold text-slate-500">Saldo</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.piutang.map(p => (
                        <tr key={p.nama} className="hover:bg-slate-50/50">
                          <td className="py-1.5 text-slate-700">{p.nama}</td>
                          <td className="py-1.5 text-slate-500 text-xs">{p.akun}</td>
                          <td className="py-1.5 text-right tabular-nums">{rupiah(p.saldo_awal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="border-t-2 border-emerald-200 font-bold">
                      <td colSpan={2} className="py-2 text-slate-900">Total Piutang</td>
                      <td className="py-2 text-right tabular-nums text-emerald-700">{rupiah(totalPiutang)}</td>
                    </tr></tfoot>
                  </table>
              }
            </Section>

            {/* Cat 3: Persediaan */}
            <Section title="Cat 3: Persediaan" n={4}>
              {data.persediaan.length === 0
                ? <p className="text-xs text-slate-400 italic">Tidak ada data persediaan</p>
                : <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-200">
                      <th className="text-left py-2 font-semibold text-slate-500">Barang</th>
                      <th className="text-left py-2 font-semibold text-slate-500">Satuan</th>
                      <th className="text-right py-2 font-semibold text-slate-500">Qty</th>
                      <th className="text-right py-2 font-semibold text-slate-500">Harga Satuan</th>
                      <th className="text-right py-2 font-semibold text-slate-500">Total</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.persediaan.map(p => (
                        <tr key={p.kode || p.nama} className="hover:bg-slate-50/50">
                          <td className="py-1.5 text-slate-700">{p.nama}</td>
                          <td className="py-1.5 text-slate-500">{p.satuan || '-'}</td>
                          <td className="py-1.5 text-right tabular-nums">{Number(p.qty_awal)}</td>
                          <td className="py-1.5 text-right tabular-nums">{rupiah(p.harga_satuan)}</td>
                          <td className="py-1.5 text-right tabular-nums">{rupiah(p.saldo_awal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="border-t-2 border-emerald-200 font-bold">
                      <td colSpan={4} className="py-2 text-slate-900">Total Persediaan</td>
                      <td className="py-2 text-right tabular-nums text-emerald-700">{rupiah(totalPersediaan)}</td>
                    </tr></tfoot>
                  </table>
              }
            </Section>

            {/* Cat 4: Aset Tetap */}
            <Section title="Cat 4: Aset Tetap" n={5}>
              {data.asetTetap.length === 0
                ? <p className="text-xs text-slate-400 italic">Tidak ada data aset tetap tercatat</p>
                : <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-200">
                      <th className="text-left py-2 font-semibold text-slate-500">Aset</th>
                      <th className="text-left py-2 font-semibold text-slate-500">Kategori</th>
                      <th className="text-right py-2 font-semibold text-slate-500">Perolehan</th>
                      <th className="text-right py-2 font-semibold text-slate-500">Akum. Penyusutan</th>
                      <th className="text-right py-2 font-semibold text-slate-500">Nilai Buku</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.asetTetap.map((a, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-1.5 text-slate-700">{a.nama}</td>
                          <td className="py-1.5 text-slate-500 capitalize">{a.kategori}</td>
                          <td className="py-1.5 text-right tabular-nums">{rupiah(a.harga_perolehan)}</td>
                          <td className="py-1.5 text-right tabular-nums text-red-600">{rupiah(a.akumulasi_penyusutan)}</td>
                          <td className="py-1.5 text-right tabular-nums">{rupiah(a.nilai_buku_awal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-emerald-200 font-bold">
                        <td colSpan={2} className="py-2 text-slate-900">Total</td>
                        <td className="py-2 text-right tabular-nums">{rupiah(totalHargaPerolehan)}</td>
                        <td className="py-2 text-right tabular-nums text-red-600">{rupiah(totalAkum)}</td>
                        <td className="py-2 text-right tabular-nums text-emerald-700">{rupiah(totalAset)}</td>
                      </tr>
                    </tfoot>
                  </table>
              }
            </Section>

            {/* Cat 5: Utang */}
            <Section title="Cat 5: Kewajiban (Utang)" n={6}>
              {data.utang.length === 0
                ? <p className="text-xs text-slate-400 italic">Tidak ada data utang supplier</p>
                : <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-200">
                      <th className="text-left py-2 font-semibold text-slate-500">Supplier</th>
                      <th className="text-left py-2 font-semibold text-slate-500">Akun</th>
                      <th className="text-right py-2 font-semibold text-slate-500">Saldo</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.utang.map(u => (
                        <tr key={u.nama} className="hover:bg-slate-50/50">
                          <td className="py-1.5 text-slate-700">{u.nama}</td>
                          <td className="py-1.5 text-slate-500 text-xs">{u.akun}</td>
                          <td className="py-1.5 text-right tabular-nums">{rupiah(u.saldo_awal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="border-t-2 border-emerald-200 font-bold">
                      <td colSpan={2} className="py-2 text-slate-900">Total Utang</td>
                      <td className="py-2 text-right tabular-nums text-emerald-700">{rupiah(totalUtang)}</td>
                    </tr></tfoot>
                  </table>
              }
            </Section>

            {/* Cat 6: Ekuitas */}
            <Section title="Cat 6: Ekuitas" n={7}>
              {data.ekuitas.length === 0
                ? <p className="text-xs text-slate-400 italic">Tidak ada data ekuitas</p>
                : <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-200">
                      <th className="text-left py-2 font-semibold text-slate-500">Sumber</th>
                      <th className="text-right py-2 font-semibold text-slate-500">Tahun</th>
                      <th className="text-left py-2 font-semibold text-slate-500">Keterangan</th>
                      <th className="text-right py-2 font-semibold text-slate-500">Saldo</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.ekuitas.map((e, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-1.5 text-slate-700">{e.sumber}</td>
                          <td className="py-1.5 text-right tabular-nums">{e.tahun}</td>
                          <td className="py-1.5 text-slate-500">{e.keterangan || '-'}</td>
                          <td className="py-1.5 text-right tabular-nums">{rupiah(e.saldo_awal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="border-t-2 border-emerald-200 font-bold">
                      <td colSpan={3} className="py-2 text-slate-900">Total Ekuitas</td>
                      <td className="py-2 text-right tabular-nums text-emerald-700">{rupiah(totalEkuitas)}</td>
                    </tr></tfoot>
                  </table>
              }
            </Section>

            {/* Cat 7: Pendapatan & Beban */}
            <Section title="Cat 7: Pendapatan & Beban" n={8}>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-200">
                  <th className="text-left py-2 font-semibold text-slate-500">Kode</th>
                  <th className="text-left py-2 font-semibold text-slate-500">Akun</th>
                  <th className="text-right py-2 font-semibold text-slate-500">Saldo</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.labaRugi.map(r => (
                    <tr key={r.kode} className="hover:bg-slate-50/50">
                      <td className="py-1.5 text-slate-500 font-mono text-xs">{r.kode}</td>
                      <td className="py-1.5 text-slate-700">{r.nama}</td>
                      <td className={`py-1.5 text-right tabular-nums ${r.kode.startsWith('4') ? 'text-emerald-700' : 'text-red-600'}`}>{rupiah(r.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-emerald-200 font-bold">
                    <td colSpan={2} className="py-2 text-slate-900">Pendapatan</td>
                    <td className="py-2 text-right tabular-nums text-emerald-700">{rupiah(pendapatan)}</td>
                  </tr>
                  <tr className="font-bold">
                    <td colSpan={2} className="py-1 text-slate-900">Beban & HPP</td>
                    <td className="py-1 text-right tabular-nums text-red-600">{rupiah(beban)}</td>
                  </tr>
                  <tr className="border-t border-slate-300 font-extrabold">
                    <td colSpan={2} className="py-2 text-slate-900">Laba/Rugi Bersih</td>
                    <td className="py-2 text-right tabular-nums text-emerald-700">{rupiah(labaBersih)}</td>
                  </tr>
                </tfoot>
              </table>
            </Section>

            {/* Footer */}
            <p className="text-[10px] text-slate-400 text-right mt-2">CALK per {data.asOf} - SILABU DIGI</p>
          </>
        )}

        {/* Empty state */}
        {!data && !loading && (
          <div className={br + ' p-8 text-center'}>
            <FileText size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500 font-medium">
              Klik tombol <b>Generate Rincian Angka CALK</b> untuk mengisi data otomatis dari sistem.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Semua angka ditarik dari Jurnal, Sub-Ledger, dan Chart of Accounts secara real-time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
