import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';

const API = '/api';

type Issue = {
  entry_id: string;
  no_jurnal: string;
  tanggal: string;
  keterangan: string;
  total_penjualan: number;
};

type FixResult = {
  entry_id: string;
  no_jurnal: string;
  status: string;
  message: string;
};

function rupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function HppFixBanner() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [scanning, setScanning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [results, setResults] = useState<FixResult[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = () => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
  const headers = { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    // Auto-scan on mount
    const scan = async () => {
      setScanning(true);
      try {
        const data = await apiFetch(`${API}/accounting/fix-missing-hpp/scan`, { headers });
        if (data.issues && data.issues.length > 0) {
          setIssues(data.issues);
        }
      } catch (e: any) {
        // Silent fail for scan — banner just won't show
        console.warn('[HPP Scan]', e.message);
      }
      setScanning(false);
    };
    scan();
  }, []);

  async function handleFix() {
    setFixing(true);
    setError(null);
    setResults([]);
    try {
      const data = await apiFetch(`${API}/accounting/fix-missing-hpp/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ entry_ids: issues.map(i => i.entry_id) }),
      });

      // Always show results from backend
      if (data.results) {
        setResults(data.results);
      }

      // Re-scan to check remaining issues
      try {
        const scanData = await apiFetch(`${API}/accounting/fix-missing-hpp/scan`, { headers });
        if (!scanData.issues || scanData.issues.length === 0) {
          setIssues([]);
        } else {
          // Update issues list with remaining
          setIssues(scanData.issues);
        }
      } catch {
        // Re-scan failed — keep current issues
      }
    } catch (e: any) {
      setError(e.message || 'Terjadi kesalahan saat koreksi HPP');
    }
    setFixing(false);
    setShowConfirm(false);
  }

  if (dismissed || scanning) return null;

  // Don't show if no issues AND no results
  if (issues.length === 0 && results.length === 0) return null;

  // Show results if fix was executed
  if (results.length > 0) {
    const fixed = results.filter(r => r.status === 'FIXED');
    const skipped = results.filter(r => r.status === 'SKIP');
    const failed = results.filter(r => r.status === 'FAILED' || r.status === 'NEED_MANUAL_REVIEW');
    const hasErrors = failed.length > 0 || error;

    return (
      <div className={`rounded-2xl border p-5 animate-fade-in ${
        hasErrors ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl shrink-0 ${
            hasErrors ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
          }`}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              {hasErrors
                ? <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                : <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              }
            </svg>
          </div>
          <div className="flex-1">
            <h3 className={`text-sm font-bold ${hasErrors ? 'text-amber-800' : 'text-emerald-800'}`}>
              {error ? '❌ Koreksi HPP Gagal' : hasErrors ? '⚠️ Koreksi HPP Selesai (Sebagian)' : '✅ Koreksi HPP Berhasil'}
            </h3>

            {/* Error banner */}
            {error && (
              <p className="text-xs text-red-600 mt-2 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            {/* Summary */}
            {!error && (
              <div className="flex gap-3 mt-2 text-xs">
                {fixed.length > 0 && <span className="text-emerald-700 font-semibold">✅ {fixed.length} diperbaiki</span>}
                {skipped.length > 0 && <span className="text-slate-500">⏭ {skipped.length} dilewati</span>}
                {failed.length > 0 && <span className="text-amber-700 font-semibold">❌ {failed.length} gagal</span>}
              </div>
            )}

            {/* Per-entry detail */}
            <div className="mt-2 space-y-1">
              {results.map((r, i) => (
                <div key={i} className={`text-xs rounded-lg px-3 py-1.5 ${
                  r.status === 'FIXED' ? 'bg-emerald-100/60 text-emerald-800' :
                  r.status === 'SKIP' ? 'bg-slate-100 text-slate-600' :
                  'bg-amber-100/60 text-amber-800'
                }`}>
                  <span className="font-mono">{r.no_jurnal}</span>
                  <span className="mx-1">→</span>
                  <span>{r.message}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-3">
              {issues.length > 0 && (
                <button onClick={() => { setResults([]); setError(null); }}
                  className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-all">
                  🔄 Coba Lagi ({issues.length} tersisa)
                </button>
              )}
              <button onClick={() => setDismissed(true)}
                className={`text-xs font-semibold hover:opacity-80 ${hasErrors ? 'text-amber-600' : 'text-emerald-600'}`}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show warning banner with confirmation modal
  return (
    <>
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-600 shrink-0">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-amber-800">
              ⚠️ Sistem Mendeteksi {issues.length} Transaksi Penjualan Tanpa HPP
            </h3>
            <p className="text-xs text-amber-700 mt-1">
              Transaksi penjualan berikut belum memiliki catatan Harga Pokok Penjualan (HPP),
              sehingga Laba Rugi dan Perubahan Modal tidak akurat.
            </p>

            <div className="mt-3 space-y-1.5">
              {issues.map(issue => (
                <div key={issue.entry_id} className="flex items-center gap-2 text-xs bg-white/60 rounded-lg px-3 py-2">
                  <span className="font-mono text-amber-600">{issue.no_jurnal}</span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-600">{issue.keterangan}</span>
                  <span className="text-slate-400">|</span>
                  <span className="font-semibold text-amber-700">{rupiah(issue.total_penjualan)}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button onClick={() => setShowConfirm(true)} disabled={fixing}
                className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-40 transition-all shadow-sm">
                🔧 Perbaiki Otomatis
              </button>
              <button onClick={() => setDismissed(true)}
                className="text-xs font-semibold text-amber-600 hover:text-amber-800">
                Nanti saja
              </button>
            </div>

            <p className="text-[10px] text-amber-500 mt-2">
              Koreksi akan membuat jurnal baru dengan tipe KOREKSI_HPP dan referensi ke jurnal asli.
              Proses ini dapat di-rollback dari Jurnal Umum jika diperlukan.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-600">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800">Konfirmasi Koreksi HPP</h3>
            </div>

            <p className="text-sm text-slate-600 mb-3">
              Anda akan memperbaiki <strong>{issues.length} transaksi</strong> yang belum memiliki catatan HPP.
            </p>

            <div className="bg-amber-50 rounded-xl p-3 mb-4 text-xs text-amber-700 space-y-1">
              <p>• Jurnal koreksi bertipe <strong>KOREKSI_HPP</strong> akan dibuat</p>
              <p>• Debit: Beban HPP — Kredit: Persediaan</p>
              <p>• HPP dihitung dari data persediaan aktual (moving average)</p>
              <p>• Transaksi tanpa data persediaan valid akan dilewati</p>
              <p>• Semua perubahan bersifat <strong>atomic</strong> — semua berhasil atau semua batal</p>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowConfirm(false); setError(null); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-all">
                Batal
              </button>
              <button onClick={handleFix} disabled={fixing}
                className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-40 transition-all shadow-sm">
                {fixing ? '⏳ Memproses...' : '🔧 Ya, Perbaiki Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
