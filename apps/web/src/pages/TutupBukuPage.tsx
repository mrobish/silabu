import { useState, useEffect } from 'react';
import { Lock, Unlock, AlertTriangle, CheckCircle, XCircle, FileText } from 'lucide-react';

interface Period {
  id: string;
  tahun: number;
  status: string;
  closed_at: string | null;
}

export default function TutupBukuPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingYear, setClosingYear] = useState<number | null>(null);
  const [confirmYear, setConfirmYear] = useState<number | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const api = (path: string, opts?: RequestInit) => {
    const token = localStorage.getItem('accessToken');
    return fetch(`/api/accounting${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts?.headers },
    });
  };

  const fetchPeriods = async () => {
    try {
      const r = await api('/tutup-buku/periods');
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `HTTP ${r.status}`); }
      const d = await r.json();
      setPeriods(d.periods || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPeriods(); }, []);

  const handleTutupBuku = async (year: number) => {
    setClosingYear(year);
    setError('');
    setResult(null);
    try {
      const r = await api('/tutup-buku', {
        method: 'POST',
        body: JSON.stringify({ tahun: year }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal');
      setResult(d);
      setConfirmYear(null);
      setConfirmInput('');
      fetchPeriods();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setClosingYear(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Memuat periode...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/40">
          <Lock size={20} className="text-violet-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tutup Buku Tahunan</h3>
          <p className="text-sm text-gray-500">Lock periode, jurnal penutup otomatis, rollover Laba Rugi ke Saldo Laba</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl p-4 flex gap-2 items-start">
          <XCircle size={18} className="mt-0.5 shrink-0" />
          <p className="text-sm">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">X</button>
        </div>
      )}
      {result && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl p-4 flex gap-3 items-start">
          <CheckCircle size={18} className="mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold mb-1">Tutup Buku {result.tahun} Berhasil!</p>
            <p>Jurnal: <code className="bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded text-xs font-mono">{result.noJurnal}</code></p>
            <p>Akun P&amp;L: {result.totalAkun} | Pendapatan: {fmt(result.totalPendapatan)} | Beban: {fmt(result.totalBeban)}</p>
            <p className="font-bold mt-1">Laba Bersih: <span className="text-emerald-800 dark:text-emerald-200">{fmt(result.labaBersih)}</span> - Saldo Laba</p>
          </div>
          <button onClick={() => setResult(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">X</button>
        </div>
      )}

      {/* Periods */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Periode Keuangan</h4>
        </div>
        {periods.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">
            Belum ada periode. Buat transaksi pertama untuk memulai.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {periods.sort((a,b) => b.tahun - a.tahun).map((p) => {
              const isOpen = p.status === 'OPEN';
              return (
                <div key={p.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${isOpen ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-red-50 dark:bg-red-950/40'}`}>
                      {isOpen ? <Unlock size={18} className="text-emerald-600" /> : <Lock size={18} className="text-red-600" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{p.tahun}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isOpen
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        }`}>
                          {isOpen ? 'OPEN' : 'CLOSED'}
                        </span>
                      </div>
                      {p.closed_at && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Ditutup: {new Date(p.closed_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                  {isOpen && (
                    <button
                      onClick={() => { setConfirmYear(p.tahun); setConfirmInput(''); setError(''); }}
                      disabled={closingYear === p.tahun}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-red-200 dark:shadow-red-900/30 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Lock size={14} />
                      Tutup Buku
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex gap-3">
        <FileText size={18} className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <p className="font-semibold">Cara Kerja Tutup Buku (SAK ETAP)</p>
          <p>1. <strong>Jurnal Penutup</strong>: Saldo akhir akun Pendapatan (Debit) &amp; Beban (Kredit) di-nol-kan. Selisih masuk Saldo Laba (Gol 3.3).</p>
          <p>2. <strong>Neraca Berlanjut</strong>: Aset (Gol 1), Kewajiban (Gol 2), Modal (Gol 3) TIDAK di-reset.</p>
          <p>3. <strong>Lock Periode</strong>: Transaksi di periode yang sudah ditutup tidak bisa ditambah/diedit/dihapus.</p>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmYear !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="bg-red-50 dark:bg-red-950/30 px-6 py-4 border-b border-red-200 dark:border-red-800">
              <div className="flex items-center gap-3">
                <AlertTriangle size={24} className="text-red-600" />
                <div>
                  <h4 className="font-bold text-red-900 dark:text-red-200">Konfirmasi Tutup Buku {confirmYear}</h4>
                  <p className="text-xs text-red-600 mt-0.5">Tindakan ini TIDAK DAPAT DIBATALKAN</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                <p className="text-sm text-amber-800 dark:text-amber-300">Apa yang akan terjadi:</p>
                <ul className="text-xs text-amber-700 dark:text-amber-400 mt-2 space-y-1.5 ml-3">
                  <li>1. <strong>Jurnal Penutup</strong> - Zeroing Pendapatan &amp; Beban (Gol 4-7)</li>
                  <li>2. <strong>Laba Bersih</strong> - Ditransfer ke Saldo Laba Tidak Dicadangkan</li>
                  <li>3. <strong>Lock Periode</strong> - Semua transaksi s/d {confirmYear}-12-31 terkunci</li>
                </ul>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Ketik <span className="font-bold text-red-600">TUTUP BUKU {confirmYear}</span> untuk konfirmasi:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value.toUpperCase())}
                  placeholder={'TUTUP BUKU ' + confirmYear}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setConfirmYear(null); setConfirmInput(''); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleTutupBuku(confirmYear)}
                  disabled={confirmInput !== ('TUTUP BUKU ' + confirmYear) || !!closingYear}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {closingYear === confirmYear ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Memproses...</>
                  ) : (
                    <><Lock size={14} /> Tutup Buku Sekarang</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}
