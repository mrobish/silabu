// BantuanPage — Panduan lengkap pengisian Rincian Saldo untuk bendahara BUM Desa
// Terpisah dari halaman utama agar tidak membebani performa

import { useState } from 'react';

const fmt = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v);

// ─── Accordion Item ───────────────────────────────────────────
function AccordionItem({ id, icon, title, badge, children, isOpen, onToggle }: {
  id: string; icon: string; title: string; badge?: string;
  children: React.ReactNode; isOpen: boolean; onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="text-xl shrink-0">{icon}</span>
        <span className="flex-1 font-semibold text-sm text-slate-900">{title}</span>
        {badge && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">{badge}</span>}
        <svg className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="px-4 pb-4 pt-1 animate-fade-in">{children}</div>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function BantuanPage() {
  const [openId, setOpenId] = useState<string | null>('overview');
  const toggle = (id: string) => setOpenId(prev => prev === id ? null : id);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white text-2xl shadow-lg shadow-emerald-500/20">
          📚
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Panduan Rincian Saldo</h1>
          <p className="text-sm text-slate-500">Tutorial lengkap untuk bendahara BUM Desa — step-by-step dengan contoh kasus nyata</p>
        </div>
      </div>

      {/* Quick Nav */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'overview', label: '📖 Apa Ini?', },
          { id: 'alur', label: '🔄 Alur' },
          { id: 'persediaan', label: '📦 Persediaan' },
          { id: 'hutang-piutang', label: '🤝 Hutang/Piutang' },
          { id: 'aset-tetap', label: '🏗️ Aset Tetap' },
          { id: 'modal', label: '🏦 Modal' },
          { id: 'checklist', label: '✅ Checklist' },
        ].map(item => (
          <button key={item.id} onClick={() => setOpenId(item.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              openId === item.id ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {item.label}
          </button>
        ))}
      </div>

      {/* Accordion Sections */}
      <div className="space-y-2">

        {/* 1. Overview */}
        <AccordionItem id="overview" icon="📖" title="Apa itu Rincian Saldo?" isOpen={openId === 'overview'} onToggle={() => toggle('overview')}>
          <div className="space-y-3 text-sm text-slate-700">
            <p><strong>Rincian Saldo</strong> adalah detail dari akun-akun yang punya sub-item (persediaan barang, daftar pelanggan/supplier, aset tetap, sumber modal).</p>
            <p>Sistem akan membandingkan:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <p className="font-bold text-blue-800 mb-1">📊 Buku Besar (Saldo Awal)</p>
                <p className="text-xs text-blue-700">Angka yang kamu input di menu <strong>Setup Saldo Awal</strong></p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="font-bold text-emerald-800 mb-1">📋 Rincian (Sub-Ledger)</p>
                <p className="text-xs text-emerald-700">Total dari data yang kamu input di <strong>Rincian Saldo</strong></p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <strong>🎯 Tujuan:</strong> Memastikan angka di Saldo Awal = jumlah rincian di bawahnya. Jika cocok → badge hijau ✅. Jika beda → badge merah ❌ (ada yang belum diinput atau salah).
            </div>
          </div>
        </AccordionItem>

        {/* 2. Alur */}
        <AccordionItem id="alur" icon="🔄" title="Alur Pengisian yang Benar" isOpen={openId === 'alur'} onToggle={() => toggle('alur')}>
          <div className="space-y-3 text-sm text-slate-700">
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-emerald-200" />
              {[
                { step: 1, label: 'Isi Saldo Awal', desc: 'Menu "Setup Saldo Awal" → input semua saldo awal akun (Kas, Bank, Persediaan, Aset, Utang, Modal)', color: 'bg-emerald-500' },
                { step: 2, label: 'Buka Rincian Saldo', desc: 'Menu sidebar "Rincian Saldo" → pilih tab yang mau diisi', color: 'bg-blue-500' },
                { step: 3, label: 'Input Rincian per Tab', desc: 'Persediaan → Hutang/Piutang → Aset Tetap → Modal', color: 'bg-purple-500' },
                { step: 4, label: 'Cek Badge Rekonsiliasi', desc: 'Hijau = cocok ✅, Merah = selisih ❌ (cek kembali input)', color: 'bg-amber-500' },
              ].map((s, i) => (
                <div key={i} className="relative pl-10 pb-4">
                  <div className={`absolute left-2.5 w-3 h-3 rounded-full ${s.color} border-2 border-white shadow`} />
                  <p className="font-bold text-slate-900">Langkah {s.step}: {s.label}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </AccordionItem>

        {/* 3. Persediaan */}
        <AccordionItem id="persediaan" icon="📦" title="Tab 1: Persediaan" isOpen={openId === 'persediaan'} onToggle={() => toggle('persediaan')}>
          <div className="space-y-4 text-sm text-slate-700">
            <p>Untuk BUM Desa yang punya stok barang (sembako, material, dll).</p>
            
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="font-bold text-slate-900 mb-2">📝 Form yang perlu diisi:</p>
              <ul className="space-y-1.5 text-xs">
                <li><strong>Nama Barang*</strong> — Nama barang (contoh: "Beras Premium 5kg")</li>
                <li><strong>Kode</strong> — Kode internal (opsional, contoh: "BRG-001")</li>
                <li><strong>Satuan</strong> — pcs/kg/liter (default: pcs)</li>
                <li><strong>Qty Awal</strong> — Jumlah stok awal (contoh: 100)</li>
                <li><strong>Harga Satuan</strong> — Harga per unit (contoh: 50.000)</li>
                <li><strong>Akun CoA*</strong> — Pilih akun Persediaan (1.1.05.xx)</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="font-bold text-emerald-800 mb-2">💡 Contoh Kasus: BUM Desa "Maju Jaya"</p>
              <p className="text-xs text-emerald-700 mb-2">BUM Desa punya stok awal:</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-emerald-300">
                    <th className="text-left py-1 pr-2">Barang</th>
                    <th className="text-right py-1 px-2">Qty</th>
                    <th className="text-right py-1 px-2">Harga</th>
                    <th className="text-right py-1 pl-2">Total</th>
                  </tr></thead>
                  <tbody>
                    <tr className="border-b border-emerald-200"><td className="py-1 pr-2">Beras 5kg</td><td className="text-right px-2">100</td><td className="text-right px-2">Rp 50.000</td><td className="text-right pl-2 font-bold">Rp 5.000.000</td></tr>
                    <tr><td className="py-1 pr-2">Minyak Goreng</td><td className="text-right px-2">50</td><td className="text-right px-2">Rp 15.000</td><td className="text-right pl-2 font-bold">Rp 750.000</td></tr>
                    <tr className="border-t-2 border-emerald-400 font-bold"><td colSpan={3} className="py-1 pr-2 text-right">Total Rincian:</td><td className="text-right pl-2">Rp 5.750.000</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-emerald-700 mt-2">→ Di <strong>Saldo Awal</strong>, akun 1.1.05.01 (Persediaan) harus = <strong>Rp 5.750.000</strong></p>
              <p className="text-xs text-emerald-700">→ Badge hijau ✅ jika total rincian = saldo awal</p>
            </div>
          </div>
        </AccordionItem>

        {/* 4. Hutang/Piutang */}
        <AccordionItem id="hutang-piutang" icon="🤝" title="Tab 2: Hutang / Piutang" isOpen={openId === 'hutang-piutang'} onToggle={() => toggle('hutang-piutang')}>
          <div className="space-y-4 text-sm text-slate-700">
            <p>Untuk mencatat utang ke supplier dan piutang dari pelanggan.</p>
            
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="font-bold text-slate-900 mb-2">📝 Form yang perlu diisi:</p>
              <ul className="space-y-1.5 text-xs">
                <li><strong>Nama Kontak*</strong> — Nama orang/perusahaan</li>
                <li><strong>Tipe*</strong> — Supplier (Utang) atau Pelanggan (Piutang)</li>
                <li><strong>Telepon</strong> — Nomor HP (opsional)</li>
                <li><strong>Alamat</strong> — Alamat (opsional)</li>
                <li><strong>Akun CoA*</strong> — Supplier → 2.1.01.xx, Pelanggan → 1.1.03.xx</li>
                <li><strong>Saldo Awal</strong> — Jumlah utang/piutang</li>
                <li><strong>D/K</strong> — Otomatis: Supplier=K, Pelanggan=D</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <p className="font-bold text-blue-800 mb-2">💡 Contoh Kasus: BUM Desa "Maju Jaya"</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-blue-300">
                    <th className="text-left py-1 pr-2">Kontak</th>
                    <th className="text-left py-1 px-2">Tipe</th>
                    <th className="text-left py-1 px-2">Akun CoA</th>
                    <th className="text-right py-1 pl-2">Saldo</th>
                  </tr></thead>
                  <tbody>
                    <tr className="border-b border-blue-200"><td className="py-1 pr-2">Toko Pak Budi</td><td className="px-2"><span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-bold">Supplier</span></td><td className="px-2">2.1.01.01 Utang Usaha</td><td className="text-right pl-2 font-bold">Rp 3.000.000 (K)</td></tr>
                    <tr><td className="py-1 pr-2">Ibu Ani</td><td className="px-2"><span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold">Pelanggan</span></td><td className="px-2">1.1.03.01 Piutang Usaha</td><td className="text-right pl-2 font-bold">Rp 1.500.000 (D)</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-3 p-2 rounded-lg bg-blue-100/50 text-xs text-blue-800">
                <strong>Bedanya D/K:</strong><br/>
                • <strong>Utang</strong> (supplier) → normalnya <strong>Kredit</strong> (kita berhutang)<br/>
                • <strong>Piutang</strong> (pelanggan) → normalnya <strong>Debit</strong> (orang berhutang ke kita)
              </div>
            </div>
          </div>
        </AccordionItem>

        {/* 5. Aset Tetap */}
        <AccordionItem id="aset-tetap" icon="🏗️" title="Tab 3: Aset Tetap" badge="PENTING" isOpen={openId === 'aset-tetap'} onToggle={() => toggle('aset-tetap')}>
          <div className="space-y-4 text-sm text-slate-700">
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              <strong>⚠️ PERHATIAN AUDITOR:</strong> Validasi aset tetap dilakukan secara <strong>TERPISAH</strong> sesuai kaidah akuntansi!
            </div>
            
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="font-bold text-slate-900 mb-2">📝 Form yang perlu diisi:</p>
              <ul className="space-y-1.5 text-xs">
                <li><strong>Nama Aset*</strong> — Nama aset (contoh: "Komputer Admin")</li>
                <li><strong>Kategori</strong> — Kendaraan/Bangunan/Peralatan/Tanah/Lainnya</li>
                <li><strong>Akun CoA*</strong> — Pilih akun Aset Tetap (1.3.xx)</li>
                <li><strong>Tgl Perolehan</strong> — Tanggal beli (opsional)</li>
                <li><strong>Harga Perolehan</strong> — Harga beli aset</li>
                <li><strong>Akum. Penyusutan</strong> — Total penyusutan sampai awal tahun</li>
                <li><strong>Umur Manfaat (bulan)</strong> — Contoh: 48 bulan (4 tahun)</li>
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <p className="font-bold text-blue-800 text-xs mb-1">📊 Validasi 1: Harga Perolehan</p>
                <p className="text-[11px] text-blue-700">Total Harga Perolehan di rincian harus = Saldo Awal akun <strong>Aset Tetap (1.3.x)</strong></p>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                <p className="font-bold text-purple-800 text-xs mb-1">📊 Validasi 2: Akum. Penyusutan</p>
                <p className="text-[11px] text-purple-700">Total Akum. Penyusutan di rincian harus = Saldo Awal akun <strong>Akum. Penyusutan (1.3.07.x)</strong></p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="font-bold text-emerald-800 mb-2">💡 Contoh Kasus: BUM Desa "Maju Jaya"</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-emerald-300">
                    <th className="text-left py-1 pr-2">Aset</th>
                    <th className="text-right py-1 px-2">Harga Perolehan</th>
                    <th className="text-right py-1 px-2">Akum. Susut</th>
                    <th className="text-right py-1 pl-2">Nilai Buku</th>
                  </tr></thead>
                  <tbody>
                    <tr className="border-b border-emerald-200"><td className="py-1 pr-2">Komputer Admin</td><td className="text-right px-2">{fmt(15000000)}</td><td className="text-right px-2">{fmt(3000000)}</td><td className="text-right pl-2">{fmt(12000000)}</td></tr>
                    <tr><td className="py-1 pr-2">Motor Operasional</td><td className="text-right px-2">{fmt(25000000)}</td><td className="text-right px-2">{fmt(10000000)}</td><td className="text-right pl-2">{fmt(15000000)}</td></tr>
                    <tr className="border-t-2 border-emerald-400 font-bold"><td className="py-1 pr-2 text-right">Total:</td><td className="text-right px-2">{fmt(40000000)}</td><td className="text-right px-2">{fmt(13000000)}</td><td className="text-right pl-2">{fmt(27000000)}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-3 space-y-1 text-xs text-emerald-700">
                <p>→ Di <strong>Saldo Awal</strong>, akun 1.3.03.01 (Peralatan) harus = <strong>{fmt(15000000)}</strong> (harga perolehan Komputer)</p>
                <p>→ Di <strong>Saldo Awal</strong>, akun 1.3.02.01 (Kendaraan) harus = <strong>{fmt(25000000)}</strong> (harga perolehan Motor)</p>
                <p>→ Di <strong>Saldo Awal</strong>, akun 1.3.07.02 (Akum. Peralatan) harus = <strong>{fmt(3000000)}</strong></p>
                <p>→ Di <strong>Saldo Awal</strong>, akun 1.3.07.01 (Akum. Kendaraan) harus = <strong>{fmt(10000000)}</strong></p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <strong>💡 Nilai Buku</strong> = Harga Perolehan − Akum. Penyusutan → <strong>info saja</strong>, bukan untuk validasi. Yang divalidasi adalah Harga Perolehan dan Akum. Penyusutan secara terpisah!
            </div>
          </div>
        </AccordionItem>

        {/* 6. Modal */}
        <AccordionItem id="modal" icon="🏦" title="Tab 4: Modal / Ekuitas" isOpen={openId === 'modal'} onToggle={() => toggle('modal')}>
          <div className="space-y-4 text-sm text-slate-700">
            <p>Untuk mencatat sumber modal BUM Desa.</p>
            
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="font-bold text-slate-900 mb-2">📝 Form yang perlu diisi:</p>
              <ul className="space-y-1.5 text-xs">
                <li><strong>Sumber*</strong> — Pemerintah Desa / Masyarakat / Lainnya</li>
                <li><strong>Tahun Penerimaan*</strong> — Tahun terima modal (contoh: 2024)</li>
                <li><strong>Keterangan</strong> — Catatan (opsional, contoh: "Dana DD tahap 1")</li>
                <li><strong>Akun CoA*</strong> — Pilih akun Modal (3.1.01.xx)</li>
                <li><strong>Saldo Awal</strong> — Jumlah modal</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="font-bold text-emerald-800 mb-2">💡 Contoh Kasus: BUM Desa "Maju Jaya"</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-emerald-300">
                    <th className="text-left py-1 pr-2">Sumber</th>
                    <th className="text-left py-1 px-2">Tahun</th>
                    <th className="text-left py-1 px-2">Keterangan</th>
                    <th className="text-right py-1 pl-2">Saldo</th>
                  </tr></thead>
                  <tbody>
                    <tr className="border-b border-emerald-200"><td className="py-1 pr-2"><span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">Pemerintah Desa</span></td><td className="px-2">2024</td><td className="px-2">Dana Desa tahap 1</td><td className="text-right pl-2 font-bold">{fmt(50000000)}</td></tr>
                    <tr><td className="py-1 pr-2"><span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold">Masyarakat</span></td><td className="px-2">2024</td><td className="px-2">Swadaya warga</td><td className="text-right pl-2 font-bold">{fmt(5000000)}</td></tr>
                    <tr className="border-t-2 border-emerald-400 font-bold"><td colSpan={3} className="py-1 pr-2 text-right">Total Rincian:</td><td className="text-right pl-2">{fmt(55000000)}</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-emerald-700 mt-2">→ Di <strong>Saldo Awal</strong>, akun 3.1.01.01 (Modal Desa) harus = <strong>{fmt(55000000)}</strong></p>
            </div>
          </div>
        </AccordionItem>

        {/* 7. Checklist */}
        <AccordionItem id="checklist" icon="✅" title="Checklist Sebelum Audit" isOpen={openId === 'checklist'} onToggle={() => toggle('checklist')}>
          <div className="space-y-3 text-sm text-slate-700">
            <p>Pastikan semua badge hijau ✅ sebelum laporan diajukan:</p>
            <div className="space-y-2">
              {[
                { label: 'Persediaan', check: 'Total rincian barang = Saldo Awal 1.1.05.xx' },
                { label: 'Piutang', check: 'Total piutang pelanggan = Saldo Awal 1.1.03.xx' },
                { label: 'Utang', check: 'Total utang supplier = Saldo Awal 2.1.01.xx' },
                { label: 'Aset Tetap', check: 'Total harga perolehan = Saldo Awal 1.3.xx' },
                { label: 'Akum. Penyusutan', check: 'Total akum. penyusutan = Saldo Awal 1.3.07.xx' },
                { label: 'Modal', check: 'Total sumber modal = Saldo Awal 3.1.01.xx' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-white border border-slate-200">
                  <span className="text-emerald-500 mt-0.5">☐</span>
                  <div>
                    <p className="font-semibold text-slate-900 text-xs">{item.label}</p>
                    <p className="text-[11px] text-slate-600">{item.check}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              <strong>⚠️ Jika ada badge merah:</strong> Cek kembali input di Saldo Awal dan Rincian Saldo. Selisih = angka yang belum cocok.
            </div>
          </div>
        </AccordionItem>

      </div>
    </div>
  );
}
