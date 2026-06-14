import { useState, useEffect } from 'react';

const API = '/api';

type Issue = {
  entry_id: string;
  no_jurnal: string;
  tanggal: string;
  keterangan: string;
  total_penjualan: number;
};

type FixResult = {
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

  const token = () => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
  const headers = { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    // Auto-scan on mount
    const scan = async () => {
      setScanning(true);
      try {
        const res = await fetch(`${API}/accounting/fix-missing-hpp/scan`, { headers });
        const data = await res.json();
        if (data.issues && data.issues.length > 0) {
          setIssues(data.issues);
        }
      } catch {}
      setScanning(false);
    };
    scan();
  }, []);

  async function handleFix() {
    setFixing(true);
    try {
      const res = await fetch(`${API}/accounting/fix-missing-hpp/execute`, {
        method: 'POST', headers,
        body: JSON.stringify({ entry_ids: issues.map(i => i.entry_id) }),
      });
      const data = await res.json();
      if (data.results) {
        setResults(data.results);
        // Re-scan to check if all fixed
        const scanRes = await fetch(`${API}/accounting/fix-missing-hpp/scan`, { headers });
        const scanData = await scanRes.json();
        if (!scanData.issues || scanData.issues.length === 0) {
          setIssues([]);
        }
      }
    } catch {}
    setFixing(false);
  }

  if (dismissed || scanning || issues.length === 0) return null;

  // Show results if fix was executed
  if (results.length > 0 && issues.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600 shrink-0">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-emerald-800">✅ Koreksi HPP Berhasil</h3>
            <div className="mt-2 space-y-1">
              {results.map((r, i) => (
                <p key={i} className="text-xs text-emerald-700">
                  {r.no_jurnal}: {r.message}
                </p>
              ))}
            </div>
            <button onClick={() => setDismissed(true)}
              className="mt-3 text-xs font-semibold text-emerald-600 hover:text-emerald-800">
              Tutup
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show warning banner
  return (
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
            <button onClick={handleFix} disabled={fixing}
              className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-40 transition-all shadow-sm">
              {fixing ? '⏳ Memproses...' : '🔧 Perbaiki Otomatis'}
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
  );
}
