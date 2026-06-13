import { useHelp, HelpLink } from './HelpContext';

const HELP_PAGES: Record<string, { title: string; content: React.ReactNode }> = {
  'jurnal-umum': {
    title: '📘 Panduan Jurnal Umum',
    content: (
      <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
        <section>
          <h4 className="font-bold text-slate-900 mb-2">🎯 Mode Master-Detail</h4>
          <p className="mb-2">
            Mode default yang lebih rapi. Anda cukup mengisi <HelpLink target="header-tanggal">Tanggal</HelpLink>,{' '}
            <HelpLink target="header-no_bukti">No. Bukti</HelpLink>, dan{' '}
            <HelpLink target="header-keterangan">Keterangan</HelpLink> sekali saja di bagian atas.
          </p>
          <p>
            Kemudian isi rincian transaksi di tabel bawah: pilih{' '}
            <HelpLink target="line-akun">Akun</HelpLink>, masukkan nominal di{' '}
            <HelpLink target="line-debit">Kolom Debit</HelpLink> atau{' '}
            <HelpLink target="line-kredit">Kolom Kredit</HelpLink>.
          </p>
        </section>

        <section>
          <h4 className="font-bold text-slate-900 mb-2">⚡ Smart Autofill</h4>
          <p className="mb-2">
            Saat Anda mengisi Debit di baris pertama, lalu klik <HelpLink target="btn-tambah-baris">Tambah Baris</HelpLink>,
            sistem otomatis mengisi nominal Kredit di baris baru dengan angka yang sama!
          </p>
          <p>
            Anda juga akan melihat <span className="text-amber-600 font-semibold">⭐ saran akun lawan</span> di dropdown pencarian akun — akun yang sering dipasangkan akan muncul di paling atas.
          </p>
        </section>

        <section>
          <h4 className="font-bold text-slate-900 mb-2">📊 Mode Batch</h4>
          <p className="mb-2">
            Klik tombol <HelpLink target="mode-toggle">Batch Mode</HelpLink> untuk beralih ke tampilan spreadsheet.
            Cocok untuk bendahara yang ingin memasukkan banyak transaksi sekaligus.
          </p>
          <p>
            Kedua mode memiliki <strong>validasi yang sama</strong> — tidak ada perbedaan keamanan.
          </p>
        </section>

        <section>
          <h4 className="font-bold text-slate-900 mb-2">📋 Template Jurnal</h4>
          <p className="mb-2">
            Klik tombol <HelpLink target="btn-template">Template</HelpLink> untuk memilih template siap pakai:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-500 ml-2">
            <li><strong>💰 Penjualan Tunai</strong> — 4 baris otomatis (Kas + Pendapatan + HPP + Persediaan)</li>
            <li><strong>📦 Pembelian Persediaan</strong> — 2 baris (Persediaan + Kas)</li>
            <li><strong>🏢 Beban Operasional</strong> — 2 baris (Beban + Kas)</li>
          </ul>
          <p className="mt-2 text-xs text-slate-400">
            Fitur <span className="text-amber-600">Smart Link 🔗</span> menghubungkan nominal antar baris — ubah satu, yang lain ikut berubah.
          </p>
        </section>

        <section>
          <h4 className="font-bold text-slate-900 mb-2">✅ Validasi & Penyimpanan</h4>
          <p className="mb-2">
            Perhatikan bilah di bagian bawah layar — menunjukkan total Debit, Kredit, dan status keseimbangan.
          </p>
          <p>
            Tombol <HelpLink target="btn-simpan">Simpan</HelpLink> hanya aktif jika jurnal sudah seimbang (Debit = Kredit) dan minimal 2 baris terisi.
          </p>
        </section>

        <section>
          <h4 className="font-bold text-slate-900 mb-2">⚡ Tombol Kilat (Auto-Balance)</h4>
          <p>
            Jika selisih kecil, klik tombol ⚡ di samping kolom Kredit baris terakhir untuk mengisi selisih secara otomatis. Sangat mempercepat pekerjaan!
          </p>
        </section>

        <section className="border-t border-slate-200 pt-4">
          <h4 className="font-bold text-slate-900 mb-2">⌨️ Shortcut Keyboard</h4>
          <ul className="space-y-1 text-slate-500">
            <li><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">Tab</kbd> — Pindah ke kolom berikutnya</li>
            <li><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">Enter</kbd> — Lanjut ke kolom/baris berikutnya</li>
            <li><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">Esc</kbd> — Tutup dropdown / hapus highlight</li>
          </ul>
        </section>

        <section className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
          <p className="text-xs text-emerald-700">
            💡 <strong>Tip:</strong> Klik teks berwarna hijau di atas untuk langsung melihat elemen yang dimaksud di form sebelah kiri!
          </p>
        </section>
      </div>
    ),
  },
};

export default function HelpDrawer() {
  const { isOpen, closeHelp, helpPage } = useHelp();

  const page = HELP_PAGES[helpPage] || HELP_PAGES['jurnal-umum'];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[150] bg-black/20 backdrop-blur-sm lg:hidden" onClick={closeHelp} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 z-[150] w-full max-w-md bg-white shadow-2xl border-l border-slate-200 animate-slide-in-right overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-bold text-slate-900">{page.title}</h3>
          <button type="button" onClick={closeHelp}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 transition text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {page.content}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <p className="text-[11px] text-slate-400 text-center">
            SILABU DIGI — Pusat Bantuan Interaktif
          </p>
        </div>
      </div>
    </>
  );
}
