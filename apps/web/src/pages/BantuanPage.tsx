// BantuanPage — Panduan lengkap SILABU DIGI untuk bendahara BUM Desa
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

// ─── Info Box ─────────────────────────────────────────────────
function InfoBox({ type, title, children }: { type: 'info' | 'warning' | 'tip' | 'danger'; title?: string; children: React.ReactNode }) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    tip: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    danger: 'bg-red-50 border-red-200 text-red-800',
  };
  const icons = { info: '💡', warning: '⚠️', tip: '✅', danger: '🚫' };
  return (
    <div className={`p-3 rounded-xl border text-xs ${styles[type]}`}>
      {title && <p className="font-bold mb-1">{icons[type]} {title}</p>}
      {children}
    </div>
  );
}

// ─── Example Table ────────────────────────────────────────────
function ExampleTable({ headers, rows, footer }: { headers: string[]; rows: (string | number)[][]; footer?: (string | number)[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {headers.map((h, i) => <th key={i} className="text-left px-3 py-2 font-bold text-slate-600">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              {row.map((cell, j) => <td key={j} className="px-3 py-2 text-slate-700">{cell}</td>)}
            </tr>
          ))}
          {footer && (
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
              {footer.map((cell, i) => <td key={i} className="px-3 py-2 text-slate-900">{cell}</td>)}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// JURNAL UMUM TUTORIAL
// ═══════════════════════════════════════════════════════════════
function JurnalUmumTutorial({ openId, toggle }: { openId: string | null; toggle: (id: string) => void }) {
  return (
    <div className="space-y-2">
      {/* JU-1: Apa itu Jurnal Umum */}
      <AccordionItem id="ju-overview" icon="📒" title="Apa itu Jurnal Umum?" isOpen={openId === 'ju-overview'} onToggle={() => toggle('ju-overview')}>
        <div className="space-y-4 text-sm text-slate-700">
          <p><strong>Jurnal Umum</strong> adalah tempat mencatat SEMUA transaksi keuangan BUM Desa. Setiap transaksi dicatat dengan sistem <strong>jurnal ganda (double-entry)</strong>:</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
              <p className="font-bold text-blue-800 mb-1">📤 DEBIT (D)</p>
              <p className="text-xs text-blue-700">Sisi kiri jurnal. Untuk akun yang <strong>bertambah</strong> (Aset, Beban) atau akun yang <strong>berkurang</strong> (Utang, Modal, Pendapatan).</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
              <p className="font-bold text-purple-800 mb-1">📥 KREDIT (K)</p>
              <p className="text-xs text-purple-700">Sisi kanan jurnal. Untuk akun yang <strong>bertambah</strong> (Utang, Modal, Pendapatan) atau akun yang <strong>berkurang</strong> (Aset, Beban).</p>
            </div>
          </div>

          <InfoBox type="danger" title="ATURAN EMAS:">
            <p>Total DEBIT harus SELALU sama dengan total KREDIT. Jika beda = sistem menolak!</p>
          </InfoBox>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <p className="font-bold text-slate-900 mb-2">📊 Contoh Sederhana:</p>
            <p className="text-xs text-slate-600 mb-2">BUM Desa terima uang iuran warga Rp 500.000:</p>
            <ExampleTable
              headers={['Akun', 'Debit', 'Kredit']}
              rows={[
                ['1.1.01.01 — Kas Tunai', 'Rp 500.000', ''],
                ['4.1.01.01 — Pendapatan Iuran', '', 'Rp 500.000'],
              ]}
              footer={['Total', 'Rp 500.000', 'Rp 500.000 ✓']}
            />
          </div>
        </div>
      </AccordionItem>

      {/* JU-2: Cara Input */}
      <AccordionItem id="ju-input" icon="⌨️" title="Cara Input Jurnal" isOpen={openId === 'ju-input'} onToggle={() => toggle('ju-input')}>
        <div className="space-y-4 text-sm text-slate-700">
          <p>Halaman Jurnal Umum menggunakan sistem <strong>Excel-Style Batch Input</strong> — kamu bisa input banyak transaksi sekaligus!</p>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <p className="font-bold text-slate-900 mb-3">📋 Kolom yang perlu diisi:</p>
            <div className="space-y-2">
              {[
                { col: 'Tanggal', desc: 'Tanggal transaksi (format: DD/MM/YYYY)', icon: '📅' },
                { col: 'No. Bukti', desc: 'Nomor kwitansi/nota/bukti (opsional tapi disarankan)', icon: '🧾' },
                { col: 'Keterangan', desc: 'Deskripsi transaksi (contoh: "Terima iuran warga")', icon: '📝' },
                { col: 'Akun', desc: 'Ketik kode atau nama akun → pilih dari dropdown', icon: '🔍' },
                { col: 'Debit', desc: 'Nominal debit (isi salah satu: debit ATAU kredit)', icon: '📤' },
                { col: 'Kredit', desc: 'Nominal kredit (isi salah satu: debit ATAU kredit)', icon: '📥' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-white border border-slate-100">
                  <span className="text-lg shrink-0">{item.icon}</span>
                  <div>
                    <p className="font-semibold text-slate-900 text-xs">{item.col}</p>
                    <p className="text-[11px] text-slate-600">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <InfoBox type="tip" title="Tips Pencarian Akun (Fuzzy Search):">
            <p>Ketik <strong>kode akun</strong> (misal: "1.1.01") atau <strong>Nama akun</strong> (misal: "kas") → sistem akan menampilkan akun yang cocok. Kode lebih diprioritaskan daripada nama.</p>
          </InfoBox>

          <InfoBox type="info" title="In-Cell Math (Kalkulasi Langsung):">
            <p>Kamu bisa langsung ketik rumus matematika di kolom Debit/Kredit! Contoh: <code className="bg-blue-100 px-1 rounded">100000+50000</code> atau <code className="bg-blue-100 px-1 rounded">250000*4</code> → sistem otomatis menghitung.</p>
          </InfoBox>

          <InfoBox type="info" title="Auto-Draft (Simpan Otomatis):">
            <p>Form otomatis tersimpan ke browser setiap 1 detik. Jika kamu tutup halaman dan buka lagi, data akan kembali! Draft dihapus otomatis setelah berhasil disimpan.</p>
          </InfoBox>
        </div>
      </AccordionItem>

      {/* JU-3: Quick Actions */}
      <AccordionItem id="ju-quick" icon="⚡" title="Quick Action: Penerimaan & Pengeluaran Kas" isOpen={openId === 'ju-quick'} onToggle={() => toggle('ju-quick')}>
        <div className="space-y-4 text-sm text-slate-700">
          <p>Untuk transaksi yang sering dilakukan, gunakan <strong>Quick Action</strong> — tombol cepat yang sudah menyiapkan template jurnal!</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="font-bold text-emerald-800 mb-2">💚 Penerimaan Kas</p>
              <p className="text-xs text-emerald-700 mb-2">Untuk mencatat uang MASUK ke kas BUM Desa.</p>
              <p className="text-xs text-emerald-600 italic">Template: Akun Kas/Bank (Debit) + Akun Pendapatan (Kredit)</p>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
              <p className="font-bold text-rose-800 mb-2">❤️ Pengeluaran Kas</p>
              <p className="text-xs text-rose-700 mb-2">Untuk mencatat uang KELUAR dari kas BUM Desa.</p>
              <p className="text-xs text-rose-600 italic">Template: Akun Beban/Biaya (Debit) + Akun Kas/Bank (Kredit)</p>
            </div>
          </div>

          <InfoBox type="tip" title="Cara Pakai Quick Action:">
            <ol className="list-decimal list-inside space-y-1">
              <li>Klik tombol <strong>"Penerimaan Kas"</strong> atau <strong>"Pengeluaran Kas"</strong></li>
              <li>Sistem otomatis isi akun Kas/Bank dan keterangan</li>
              <li>Tinggal isi nominal di kolom yang kosong (Debit untuk penerimaan, Kredit untuk pengeluaran)</li>
              <li>Pilih akun lawan (misal: Pendapatan Iuran untuk penerimaan)</li>
              <li>Klik <strong>"Simpan Jurnal"</strong></li>
            </ol>
          </InfoBox>

          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="font-bold text-emerald-800 mb-2">💡 Contoh: Penerimaan Iuran Warga</p>
            <p className="text-xs text-emerald-700 mb-2">Klik "Penerimaan Kas" → isi:</p>
            <ExampleTable
              headers={['Keterangan', 'Akun', 'Debit', 'Kredit']}
              rows={[
                ['Penerimaan Kas', '1.1.01.01 — Kas Tunai', 'Rp 500.000', ''],
                ['Penerimaan Kas', '4.1.01.01 — Pendapatan Iuran', '', 'Rp 500.000'],
              ]}
              footer={['', 'Total', 'Rp 500.000', 'Rp 500.000 ✓']}
            />
          </div>

          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
            <p className="font-bold text-rose-800 mb-2">💡 Contoh: Bayar Listrik</p>
            <p className="text-xs text-rose-700 mb-2">Klik "Pengeluaran Kas" → isi:</p>
            <ExampleTable
              headers={['Keterangan', 'Akun', 'Debit', 'Kredit']}
              rows={[
                ['Bayar Listrik', '6.1.03.01 — Beban Listrik', 'Rp 350.000', ''],
                ['Bayar Listrik', '1.1.01.01 — Kas Tunai', '', 'Rp 350.000'],
              ]}
              footer={['', 'Total', 'Rp 350.000', 'Rp 350.000 ✓']}
            />
          </div>
        </div>
      </AccordionItem>

      {/* JU-4: Contoh Transaksi Berbeda */}
      <AccordionItem id="ju-cases" icon="📊" title="Contoh Transaksi Berbagai Jenis" badge="WAJIB BACA" isOpen={openId === 'ju-cases'} onToggle={() => toggle('ju-cases')}>
        <div className="space-y-6 text-sm text-slate-700">
          <p>Ini dia contoh transaksi yang paling sering terjadi di BUM Desa, lengkap dengan cara inputnya:</p>

          {/* Case 1: Penerimaan Modal */}
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
            <p className="font-bold text-blue-800 mb-2">🏦 Kasus 1: Terima Modal dari Pemerintah Desa</p>
            <p className="text-xs text-blue-700 mb-2">BUM Desa terima dana DD (Dana Desa) sebesar Rp 50.000.000.</p>
            <p className="text-xs font-semibold text-blue-800 mb-1">Analisis:</p>
            <ul className="text-xs text-blue-700 list-disc list-inside mb-2">
              <li>Kas/Bank BERTAMBAH → Debit</li>
              <li>Modal BERTAMBAH → Kredit</li>
            </ul>
            <ExampleTable
              headers={['Tanggal', 'No. Bukti', 'Keterangan', 'Akun', 'Debit', 'Kredit']}
              rows={[
                ['02/01/2026', 'Bukti-001', 'Terima Dana DD Tahap 1', '1.1.01.01 — Kas Tunai', 'Rp 50.000.000', ''],
                ['02/01/2026', 'Bukti-001', 'Terima Dana DD Tahap 1', '3.1.01.01 — Penyertaan Modal Desa', '', 'Rp 50.000.000'],
              ]}
            />
          </div>

          {/* Case 2: Pembelian Persediaan */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <p className="font-bold text-amber-800 mb-2">📦 Kasus 2: Beli Stok Barang Dagangan</p>
            <p className="text-xs text-amber-700 mb-2">BUM Desa beli Beras 50 karung @ Rp 100.000 = Rp 5.000.000 (tunai).</p>
            <p className="text-xs font-semibold text-amber-800 mb-1">Analisis:</p>
            <ul className="text-xs text-amber-700 list-disc list-inside mb-2">
              <li>Persediaan BERTAMBAH → Debit</li>
              <li>Kas/Bank BERKURANG → Kredit</li>
            </ul>
            <ExampleTable
              headers={['Tanggal', 'No. Bukti', 'Keterangan', 'Akun', 'Debit', 'Kredit']}
              rows={[
                ['05/01/2026', 'Nota-001', 'Beli Beras 50 karung', '1.1.05.01 — Persediaan Barang Dagangan', 'Rp 5.000.000', ''],
                ['05/01/2026', 'Nota-001', 'Beli Beras 50 karung', '1.1.01.01 — Kas Tunai', '', 'Rp 5.000.000'],
              ]}
            />
          </div>

          {/* Case 3: Penjualan */}
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="font-bold text-emerald-800 mb-2">💰 Kasus 3: Penjualan Barang</p>
            <p className="text-xs text-emerald-700 mb-2">BUM Desa jual beras ke warga sebesar Rp 2.500.000 (tunai).</p>
            <p className="text-xs font-semibold text-emerald-800 mb-1">Analisis:</p>
            <ul className="text-xs text-emerald-700 list-disc list-inside mb-2">
              <li>Kas/Bank BERTAMBAH → Debit</li>
              <li>Pendapatan BERTAMBAH → Kredit</li>
            </ul>
            <ExampleTable
              headers={['Tanggal', 'No. Bukti', 'Keterangan', 'Akun', 'Debit', 'Kredit']}
              rows={[
                ['10/01/2026', 'KP-001', 'Jual beras ke warga', '1.1.01.01 — Kas Tunai', 'Rp 2.500.000', ''],
                ['10/01/2026', 'KP-001', 'Jual beras ke warga', '4.1.01.01 — Pendapatan Usaha', '', 'Rp 2.500.000'],
              ]}
            />
          </div>

          {/* Case 4: Bayar Gaji */}
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
            <p className="font-bold text-rose-800 mb-2">💸 Kasus 4: Bayar Gaji Karyawan</p>
            <p className="text-xs text-rose-700 mb-2">BUM Desa bayar gaji karyawan Rp 3.000.000 via transfer Bank.</p>
            <p className="text-xs font-semibold text-rose-800 mb-1">Analisis:</p>
            <ul className="text-xs text-rose-700 list-disc list-inside mb-2">
              <li>Beban Gaji BERTAMBAH → Debit</li>
              <li>Bank BERKURANG → Kredit</li>
            </ul>
            <ExampleTable
              headers={['Tanggal', 'No. Bukti', 'Keterangan', 'Akun', 'Debit', 'Kredit']}
              rows={[
                ['25/01/2026', 'BBM-001', 'Bayar gaji karyawan Januari', '6.1.01.01 — Beban Gaji', 'Rp 3.000.000', ''],
                ['25/01/2026', 'BBM-001', 'Bayar gaji karyawan Januari', '1.1.02.01 — Bank BSI', '', 'Rp 3.000.000'],
              ]}
            />
          </div>

          {/* Case 5: Utang */}
          <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
            <p className="font-bold text-purple-800 mb-2">🤝 Kasus 5: Beli Barang secara Kredit (Utang)</p>
            <p className="text-xs text-purple-700 mb-2">BUM Desa beli ATK Rp 750.000 secara kredit ke Toko Pak Budi.</p>
            <p className="text-xs font-semibold text-purple-800 mb-1">Analisis:</p>
            <ul className="text-xs text-purple-700 list-disc list-inside mb-2">
              <li>Beban ATK BERTAMBAH → Debit</li>
              <li>Utang Usaha BERTAMBAH → Kredit</li>
            </ul>
            <ExampleTable
              headers={['Tanggal', 'No. Bukti', 'Keterangan', 'Akun', 'Debit', 'Kredit']}
              rows={[
                ['08/01/2026', 'INV-001', 'Beli ATK kredit ke Toko Pak Budi', '6.1.05.01 — Beban ATK', 'Rp 750.000', ''],
                ['08/01/2026', 'INV-001', 'Beli ATK kredit ke Toko Pak Budi', '2.1.01.01 — Utang Usaha', '', 'Rp 750.000'],
              ]}
            />
          </div>

          {/* Case 6: Bayar Utang */}
          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
            <p className="font-bold text-indigo-800 mb-2">💳 Kasus 6: Bayar Utang ke Supplier</p>
            <p className="text-xs text-indigo-700 mb-2">BUM Desa bayar utang ke Toko Pak Budi sebesar Rp 750.000.</p>
            <p className="text-xs font-semibold text-indigo-800 mb-1">Analisis:</p>
            <ul className="text-xs text-indigo-700 list-disc list-inside mb-2">
              <li>Utang Usaha BERKURANG → Debit</li>
              <li>Kas/Bank BERKURANG → Kredit</li>
            </ul>
            <ExampleTable
              headers={['Tanggal', 'No. Bukti', 'Keterangan', 'Akun', 'Debit', 'Kredit']}
              rows={[
                ['15/01/2026', 'BBM-002', 'Bayar utang ke Toko Pak Budi', '2.1.01.01 — Utang Usaha', 'Rp 750.000', ''],
                ['15/01/2026', 'BBM-002', 'Bayar utang ke Toko Pak Budi', '1.1.01.01 — Kas Tunai', '', 'Rp 750.000'],
              ]}
            />
          </div>

          {/* Case 7: Piutang */}
          <div className="p-4 rounded-xl bg-cyan-50 border border-cyan-200">
            <p className="font-bold text-cyan-800 mb-2">📋 Kasus 7: Jual Kredit (Piutang)</p>
            <p className="text-xs text-cyan-700 mb-2">BUM Desa jual barang ke Ibu Ani secara kredit Rp 1.200.000.</p>
            <p className="text-xs font-semibold text-cyan-800 mb-1">Analisis:</p>
            <ul className="text-xs text-cyan-700 list-disc list-inside mb-2">
              <li>Piutang Usaha BERTAMBAH → Debit</li>
              <li>Pendapatan BERTAMBAH → Kredit</li>
            </ul>
            <ExampleTable
              headers={['Tanggal', 'No. Bukti', 'Keterangan', 'Akun', 'Debit', 'Kredit']}
              rows={[
                ['12/01/2026', 'KP-002', 'Jual kredit ke Ibu Ani', '1.1.03.01 — Piutang Usaha', 'Rp 1.200.000', ''],
                ['12/01/2026', 'KP-002', 'Jual kredit ke Ibu Ani', '4.1.01.01 — Pendapatan Usaha', '', 'Rp 1.200.000'],
              ]}
            />
          </div>

          {/* Case 8: Terima Piutang */}
          <div className="p-4 rounded-xl bg-teal-50 border border-teal-200">
            <p className="font-bold text-teal-800 mb-2">✅ Kasus 8: Terima Pembayaran Piutang</p>
            <p className="text-xs text-teal-700 mb-2">Ibu Ani bayar utangnya Rp 1.200.000.</p>
            <p className="text-xs font-semibold text-teal-800 mb-1">Analisis:</p>
            <ul className="text-xs text-teal-700 list-disc list-inside mb-2">
              <li>Kas/Bank BERTAMBAH → Debit</li>
              <li>Piutang Usaha BERKURANG → Kredit</li>
            </ul>
            <ExampleTable
              headers={['Tanggal', 'No. Bukti', 'Keterangan', 'Akun', 'Debit', 'Kredit']}
              rows={[
                ['20/01/2026', 'BM-001', 'Terima bayar piutang Ibu Ani', '1.1.01.01 — Kas Tunai', 'Rp 1.200.000', ''],
                ['20/01/2026', 'BM-001', 'Terima bayar piutang Ibu Ani', '1.1.03.01 — Piutang Usaha', '', 'Rp 1.200.000'],
              ]}
            />
          </div>

          {/* Case 9: Aset Tetap */}
          <div className="p-4 rounded-xl bg-orange-50 border border-orange-200">
            <p className="font-bold text-orange-800 mb-2">🏗️ Kasus 9: Beli Aset Tetap</p>
            <p className="text-xs text-orange-700 mb-2">BUM Desa beli komputer Rp 8.000.000 (tunai).</p>
            <p className="text-xs font-semibold text-orange-800 mb-1">Analisis:</p>
            <ul className="text-xs text-orange-700 list-disc list-inside mb-2">
              <li>Aset Tetap BERTAMBAH → Debit</li>
              <li>Kas/Bank BERKURANG → Kredit</li>
            </ul>
            <ExampleTable
              headers={['Tanggal', 'No. Bukti', 'Keterangan', 'Akun', 'Debit', 'Kredit']}
              rows={[
                ['03/02/2026', 'INV-002', 'Beli komputer admin', '1.3.03.01 — Peralatan dan Mesin', 'Rp 8.000.000', ''],
                ['03/02/2026', 'INV-002', 'Beli komputer admin', '1.1.02.01 — Bank BSI', '', 'Rp 8.000.000'],
              ]}
            />
          </div>

          {/* Case 10: Multi-baris */}
          <div className="p-4 rounded-xl bg-violet-50 border border-violet-200">
            <p className="font-bold text-violet-800 mb-2">📊 Kasus 10: Transaksi Multi-Baris (Lebih dari 2 Akun)</p>
            <p className="text-xs text-violet-700 mb-2">BUM Desa terima pembayaran: Rp 500.000 cash + Rp 300.000 transfer = Rp 800.000 total penjualan.</p>
            <p className="text-xs font-semibold text-violet-800 mb-1">Analisis:</p>
            <ul className="text-xs text-violet-700 list-disc list-inside mb-2">
              <li>Kas Tunai BERTAMBAH → Debit Rp 500.000</li>
              <li>Bank BERTAMBAH → Debit Rp 300.000</li>
              <li>Pendapatan BERTAMBAH → Kredit Rp 800.000</li>
            </ul>
            <ExampleTable
              headers={['Tanggal', 'No. Bukti', 'Keterangan', 'Akun', 'Debit', 'Kredit']}
              rows={[
                ['15/02/2026', 'KP-003', 'Penjualan barang', '1.1.01.01 — Kas Tunai', 'Rp 500.000', ''],
                ['15/02/2026', 'KP-003', 'Penjualan barang', '1.1.02.01 — Bank BSI', 'Rp 300.000', ''],
                ['15/02/2026', 'KP-003', 'Penjualan barang', '4.1.01.01 — Pendapatan Usaha', '', 'Rp 800.000'],
              ]}
              footer={['', '', '', 'Total', 'Rp 800.000', 'Rp 800.000 ✓']}
            />
          </div>
        </div>
      </AccordionItem>

      {/* JU-5: Fitur Lanjutan */}
      <AccordionItem id="ju-features" icon="🛠️" title="Fitur Canggih Jurnal Umum" isOpen={openId === 'ju-features'} onToggle={() => toggle('ju-features')}>
        <div className="space-y-4 text-sm text-slate-700">
          <p>Jurnal Umum punya beberapa fitur canggih untuk mempercepat input:</p>

          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="font-bold text-emerald-800 mb-1">⚡ Auto-Balance Smart Fill</p>
              <p className="text-xs text-emerald-700">Klik tombol ⚡ di samping baris → sistem otomatis isi nominal yang kurang agar debit = kredit! Cocok untuk transaksi sederhana 2 akun.</p>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
              <p className="font-bold text-blue-800 mb-1">🔍 Fuzzy Account Search</p>
              <p className="text-xs text-blue-700">Ketik sebagian kode atau nama akun → sistem cari yang paling cocok. Pencarian berdasarkan kode lebih diprioritaskan.</p>
            </div>

            <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
              <p className="font-bold text-purple-800 mb-1">➕ Insert Row di Tengah</p>
              <p className="text-xs text-purple-700">Klik tombol ➕ di samping baris → baris baru ditambahkan TEPAT di bawah baris tersebut, bukan di akhir.</p>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="font-bold text-amber-800 mb-1">📐 In-Cell Math Expressions</p>
              <p className="text-xs text-amber-700">Langsung ketik rumus di kolom nominal! Contoh: <code className="bg-amber-100 px-1 rounded">100000+50000</code>, <code className="bg-amber-100 px-1 rounded">250000*4</code>, <code className="bg-amber-100 px-1 rounded">1000000-50000</code>. Tekan Tab atau Enter untuk evaluasi.</p>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
              <p className="font-bold text-rose-800 mb-1">↕️ Row Reordering</p>
              <p className="text-xs text-rose-700"><strong>Desktop:</strong> Drag & drop baris (ikon ⠿ di kiri). <strong>Mobile:</strong> Tombol ⬆️⬇️ untuk pindah posisi baris.</p>
            </div>

            <div className="p-3 rounded-xl bg-cyan-50 border border-cyan-200">
              <p className="font-bold text-cyan-800 mb-1">⌨️ Keyboard Shortcuts</p>
              <p className="text-xs text-cyan-700"><strong>Tab:</strong> Pindah ke kolom berikutnya. <strong>Enter:</strong> Pindah ke baris berikutnya. <strong>Tab di kolom terakhir:</strong> Auto-tambah baris baru (maks 50 baris).</p>
            </div>
          </div>
        </div>
      </AccordionItem>

      {/* JU-6: Aturan Penting */}
      <AccordionItem id="ju-rules" icon="⚠️" title="Aturan Penting & Kesalahan Umum" badge="PENTING" isOpen={openId === 'ju-rules'} onToggle={() => toggle('ju-rules')}>
        <div className="space-y-4 text-sm text-slate-700">
          <InfoBox type="danger" title="JANGAN LUPA: Debit harus = Kredit!">
            <p>Sistem akan menolak jika total debit ≠ total kredit. Cek badge merah di bawah form — jika ada selisih, perbaiki dulu sebelum simpan.</p>
          </InfoBox>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <p className="font-bold text-slate-900 mb-3">❌ Kesalahan yang Sering Terjadi:</p>
            <div className="space-y-2">
              {[
                { mistake: 'Isi debit DAN kredit di baris yang sama', fix: 'Pilih salah satu: debit ATAU kredit per baris' },
                { mistake: 'Lupa isi keterangan', fix: 'Isi deskripsi transaksi agar mudah dicari nanti' },
                { mistake: 'Salah pilih akun', fix: 'Cek kode akun dengan teliti sebelum simpan' },
                { mistake: 'Nominal tidak sesuai kwitansi', fix: 'Cocokkan dengan bukti transaksi' },
                { mistake: 'Tanggal salah tahun', fix: 'Pastikan tahun sesuai periode akuntansi' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-white border border-slate-100">
                  <span className="text-red-500 shrink-0">✗</span>
                  <div>
                    <p className="text-xs text-red-700 font-medium">{item.mistake}</p>
                    <p className="text-[11px] text-emerald-700">→ {item.fix}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <InfoBox type="warning" title="Batch Input: Grup per Tanggal + No. Bukti">
            <p>Sistem mengelompokkan baris berdasarkan <strong>(Tanggal + No. Bukti)</strong> yang sama → setiap grup = 1 jurnal entry. Jika kamu punya 3 transaksi berbeda, gunakan No. Bukti yang berbeda!</p>
          </InfoBox>

          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="font-bold text-emerald-800 mb-2">✅ Checklist Sebelum Klik "Simpan":</p>
            <div className="space-y-1">
              {[
                'Total Debit = Total Kredit (badge hijau)',
                'Setiap baris punya akun yang dipilih',
                'Setiap baris punya nominal (debit atau kredit)',
                'Keterangan sudah diisi',
                'Tanggal sudah benar',
                'No. Bukti sudah diisi (untuk jejak audit)',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-emerald-700">
                  <span>☐</span> {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </AccordionItem>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RINCIAN SALDO TUTORIAL
// ═══════════════════════════════════════════════════════════════
function RincianSaldoTutorial({ openId, toggle }: { openId: string | null; toggle: (id: string) => void }) {
  return (
    <div className="space-y-2">
      {/* RS-1: Overview */}
      <AccordionItem id="rs-overview" icon="📖" title="Apa itu Rincian Saldo?" isOpen={openId === 'rs-overview'} onToggle={() => toggle('rs-overview')}>
        <div className="space-y-3 text-sm text-slate-700">
          <p><strong>Rincian Saldo</strong> adalah detail dari akun-akun yang punya sub-item (persediaan barang, daftar pelanggan/supplier, aset tetap, sumber modal).</p>
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
          <InfoBox type="tip" title="Tujuan:">
            <p>Memastikan angka di Saldo Awal = jumlah rincian di bawahnya. Jika cocok → badge hijau ✅. Jika beda → badge merah ❌.</p>
          </InfoBox>
        </div>
      </AccordionItem>

      {/* RS-2: Alur */}
      <AccordionItem id="rs-alur" icon="🔄" title="Alur Pengisian yang Benar" isOpen={openId === 'rs-alur'} onToggle={() => toggle('rs-alur')}>
        <div className="space-y-3 text-sm text-slate-700">
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-emerald-200" />
            {[
              { step: 1, label: 'Isi Saldo Awal', desc: 'Menu "Setup Saldo Awal" → input semua saldo awal akun', color: 'bg-emerald-500' },
              { step: 2, label: 'Buka Rincian Saldo', desc: 'Menu sidebar "Rincian Saldo" → pilih tab', color: 'bg-blue-500' },
              { step: 3, label: 'Input Rincian per Tab', desc: 'Persediaan → Hutang/Piutang → Aset Tetap → Modal', color: 'bg-purple-500' },
              { step: 4, label: 'Cek Badge Rekonsiliasi', desc: 'Hijau = cocok ✅, Merah = selisih ❌', color: 'bg-amber-500' },
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

      {/* RS-3: Persediaan */}
      <AccordionItem id="rs-persediaan" icon="📦" title="Tab 1: Persediaan" isOpen={openId === 'rs-persediaan'} onToggle={() => toggle('rs-persediaan')}>
        <div className="space-y-4 text-sm text-slate-700">
          <p>Untuk BUM Desa yang punya stok barang (sembako, material, dll).</p>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <p className="font-bold text-slate-900 mb-2">📝 Form yang perlu diisi:</p>
            <ul className="space-y-1.5 text-xs">
              <li><strong>Nama Barang*</strong> — Nama barang (contoh: "Beras Premium 5kg")</li>
              <li><strong>Kode</strong> — Kode internal (opsional)</li>
              <li><strong>Satuan</strong> — pcs/kg/liter</li>
              <li><strong>Qty Awal</strong> — Jumlah stok awal</li>
              <li><strong>Harga Satuan</strong> — Harga per unit</li>
              <li><strong>Akun CoA*</strong> — Pilih akun Persediaan (1.1.05.xx)</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="font-bold text-emerald-800 mb-2">💡 Contoh: BUM Desa "Maju Jaya"</p>
            <ExampleTable
              headers={['Barang', 'Qty', 'Harga', 'Total']}
              rows={[
                ['Beras 5kg', '100', 'Rp 50.000', 'Rp 5.000.000'],
                ['Minyak Goreng', '50', 'Rp 15.000', 'Rp 750.000'],
              ]}
              footer={['', '', 'Total Rincian:', 'Rp 5.750.000']}
            />
            <p className="text-xs text-emerald-700 mt-2">→ Saldo Awal akun 1.1.05.01 harus = <strong>Rp 5.750.000</strong></p>
          </div>
        </div>
      </AccordionItem>

      {/* RS-4: Hutang/Piutang */}
      <AccordionItem id="rs-hutang" icon="🤝" title="Tab 2: Hutang / Piutang" isOpen={openId === 'rs-hutang'} onToggle={() => toggle('rs-hutang')}>
        <div className="space-y-4 text-sm text-slate-700">
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
            <p className="font-bold text-blue-800 mb-2">💡 Contoh:</p>
            <ExampleTable
              headers={['Kontak', 'Tipe', 'Akun CoA', 'Saldo']}
              rows={[
                ['Toko Pak Budi', 'Supplier', '2.1.01.01 Utang Usaha', 'Rp 3.000.000 (K)'],
                ['Ibu Ani', 'Pelanggan', '1.1.03.01 Piutang Usaha', 'Rp 1.500.000 (D)'],
              ]}
            />
            <div className="mt-3 p-2 rounded-lg bg-blue-100/50 text-xs text-blue-800">
              <strong>Bedanya D/K:</strong> Utang = Kredit (kita berhutang), Piutang = Debit (orang berhutang ke kita)
            </div>
          </div>
        </div>
      </AccordionItem>

      {/* RS-5: Aset Tetap */}
      <AccordionItem id="rs-aset" icon="🏗️" title="Tab 3: Aset Tetap" badge="PENTING" isOpen={openId === 'rs-aset'} onToggle={() => toggle('rs-aset')}>
        <div className="space-y-4 text-sm text-slate-700">
          <InfoBox type="danger" title="PERHATIAN AUDITOR:">
            <p>Validasi aset tetap dilakukan secara <strong>TERPISAH</strong> sesuai kaidah akuntansi!</p>
          </InfoBox>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
              <p className="font-bold text-blue-800 text-xs mb-1">📊 Validasi 1: Harga Perolehan</p>
              <p className="text-[11px] text-blue-700">Total Harga Perolehan = Saldo Awal akun <strong>Aset Tetap (1.3.x)</strong></p>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
              <p className="font-bold text-purple-800 text-xs mb-1">📊 Validasi 2: Akum. Penyusutan</p>
              <p className="text-[11px] text-purple-700">Total Akum. Penyusutan = Saldo Awal akun <strong>Akum. Penyusutan (1.3.07.x)</strong></p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="font-bold text-emerald-800 mb-2">💡 Contoh:</p>
            <ExampleTable
              headers={['Aset', 'Harga Perolehan', 'Akum. Susut', 'Nilai Buku']}
              rows={[
                ['Komputer Admin', fmt(15000000), fmt(3000000), fmt(12000000)],
                ['Motor Operasional', fmt(25000000), fmt(10000000), fmt(15000000)],
              ]}
              footer={['Total', fmt(40000000), fmt(13000000), fmt(27000000)]}
            />
            <div className="mt-3 space-y-1 text-xs text-emerald-700">
              <p>→ Saldo Awal 1.3.03.01 (Peralatan) = <strong>{fmt(15000000)}</strong></p>
              <p>→ Saldo Awal 1.3.02.01 (Kendaraan) = <strong>{fmt(25000000)}</strong></p>
              <p>→ Saldo Awal 1.3.07.02 (Akum. Peralatan) = <strong>{fmt(3000000)}</strong></p>
              <p>→ Saldo Awal 1.3.07.01 (Akum. Kendaraan) = <strong>{fmt(10000000)}</strong></p>
            </div>
          </div>
          <InfoBox type="warning" title="Nilai Buku = Info Saja">
            <p>Nilai Buku = Harga Perolehan − Akum. Penyusutan → tidak divalidasi. Yang divalidasi adalah Harga Perolehan dan Akum. Penyusutan secara terpisah!</p>
          </InfoBox>
        </div>
      </AccordionItem>

      {/* RS-6: Modal */}
      <AccordionItem id="rs-modal" icon="🏦" title="Tab 4: Modal / Ekuitas" isOpen={openId === 'rs-modal'} onToggle={() => toggle('rs-modal')}>
        <div className="space-y-4 text-sm text-slate-700">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="font-bold text-emerald-800 mb-2">💡 Contoh:</p>
            <ExampleTable
              headers={['Sumber', 'Tahun', 'Keterangan', 'Saldo']}
              rows={[
                ['Pemerintah Desa', '2024', 'Dana Desa tahap 1', fmt(50000000)],
                ['Masyarakat', '2024', 'Swadaya warga', fmt(5000000)],
              ]}
              footer={['', '', 'Total Rincian:', fmt(55000000)]}
            />
            <p className="text-xs text-emerald-700 mt-2">→ Saldo Awal 3.1.01.01 (Modal Desa) = <strong>{fmt(55000000)}</strong></p>
          </div>
        </div>
      </AccordionItem>

      {/* RS-7: Checklist */}
      <AccordionItem id="rs-checklist" icon="✅" title="Checklist Sebelum Audit" isOpen={openId === 'rs-checklist'} onToggle={() => toggle('rs-checklist')}>
        <div className="space-y-3 text-sm text-slate-700">
          <p>Pastikan semua badge hijau ✅:</p>
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
        </div>
      </AccordionItem>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
type TutorialTab = 'jurnal-umum' | 'rincian-saldo';

export default function BantuanPage() {
  const [activeTab, setActiveTab] = useState<TutorialTab>('jurnal-umum');
  const [openId, setOpenId] = useState<string | null>('ju-overview');
  const toggle = (id: string) => setOpenId(prev => prev === id ? null : id);

  const tabs: { id: TutorialTab; label: string; icon: string; desc: string }[] = [
    { id: 'jurnal-umum', label: 'Jurnal Umum', icon: '📒', desc: 'Cara input transaksi jurnal' },
    { id: 'rincian-saldo', label: 'Rincian Saldo', icon: '📋', desc: 'Detail persediaan, aset, modal' },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white text-2xl shadow-lg shadow-emerald-500/20">
          📚
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Panduan SILABU DIGI</h1>
          <p className="text-sm text-slate-500">Tutorial lengkap untuk bendahara BUM Desa — step-by-step dengan contoh kasus nyata</p>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setOpenId(null); }}
            className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === tab.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'jurnal-umum' && <JurnalUmumTutorial openId={openId} toggle={toggle} />}
      {activeTab === 'rincian-saldo' && <RincianSaldoTutorial openId={openId} toggle={toggle} />}
    </div>
  );
}
