import { useState, useEffect, useCallback } from 'react';

const API = '/api';
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition';

type WAStatus = {
  connected: boolean;
  status: string;
  engine?: any;
  error?: string;
};

export default function WhatsAppSettingsPage() {
  const [status, setStatus] = useState<WAStatus | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const token = (localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchStatus = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${API}/admin/whatsapp/status`, { headers });
      const data = await res.json();
      setStatus(data);

      // If needs QR, fetch it
      if (data.status === 'SCAN_QR_CODE' || data.status === 'STARTING') {
        const qrRes = await fetch(`${API}/admin/whatsapp/qr`, { headers });
        const qrData = await qrRes.json();
        setQr(qrData.qr || null);
      } else {
        setQr(null);
      }
    } catch {
      setStatus({ connected: false, status: 'ERROR', error: 'Gagal menghubungi server' });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Auto-refresh QR every 20s if scanning
  useEffect(() => {
    if (status?.status !== 'SCAN_QR_CODE') return;
    const t = setInterval(fetchStatus, 20000);
    return () => clearInterval(t);
  }, [status?.status, fetchStatus]);

  async function handleStartSession() {
    setLoading(true);
    try {
      await fetch(`${API}/admin/whatsapp/session`, { method: 'POST', headers });
      setTimeout(fetchStatus, 3000);
    } catch { /* */ }
    finally { setLoading(false); }
  }

  async function handleTest() {
    if (!testPhone) return;
    setLoading(true);
    setTestResult('');
    try {
      const res = await fetch(`${API}/admin/whatsapp/test`, {
        method: 'POST', headers,
        body: JSON.stringify({ phone: testPhone }),
      });
      const data = await res.json();
      setTestResult(data.ok ? '✅ ' + data.message : '❌ ' + (data.error || 'Gagal'));
    } catch {
      setTestResult('❌ Koneksi gagal');
    } finally { setLoading(false); }
  }

  const statusColor = status?.connected ? 'bg-emerald-500' : status?.status === 'SCAN_QR_CODE' ? 'bg-amber-500' : 'bg-red-500';
  const statusLabel = status?.connected ? 'Terhubung' : status?.status === 'SCAN_QR_CODE' ? 'Perlu Scan QR' : status?.status === 'STARTING' ? 'Memulai...' : 'Terputus';

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Connection Status */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/></svg>
          Status Koneksi WhatsApp
        </h3>

        <div className="flex items-center gap-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${statusColor} ${status?.connected ? 'animate-pulse' : ''}`} />
          <span className="text-sm font-semibold text-slate-800">{statusLabel}</span>
          {status?.error && <span className="text-xs text-red-500">({status.error})</span>}
        </div>

        <div className="flex gap-2">
          <button onClick={handleStartSession} disabled={loading}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 transition">
            {loading ? 'Memproses...' : 'Mulai / Restart Sesi'}
          </button>
          <button onClick={fetchStatus} disabled={refreshing}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">
            {refreshing ? '...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* QR Code */}
      {(status?.status === 'SCAN_QR_CODE' || qr) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h3 className="text-sm font-bold text-amber-800 mb-2">📷 Scan QR Code</h3>
          <p className="text-xs text-amber-700 mb-4">
            Buka WhatsApp di HP → <strong>Settings → Linked Devices → Link a Device</strong> → Scan QR di bawah
          </p>
          {qr ? (
            <div className="flex justify-center">
              <img src={qr} alt="WhatsApp QR" className="w-64 h-64 rounded-xl border-2 border-white shadow-lg" />
            </div>
          ) : (
            <p className="text-sm text-amber-600 text-center">Memuat QR code...</p>
          )}
          <p className="text-[11px] text-amber-600 text-center mt-3">QR diperbarui otomatis setiap 20 detik</p>
        </div>
      )}

      {/* Connected! */}
      {status?.connected && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <h3 className="text-sm font-bold text-emerald-800 mb-1">✅ WhatsApp Terhubung!</h3>
          <p className="text-xs text-emerald-700">Sistem OTP siap mengirim kode verifikasi via WhatsApp.</p>
        </div>
      )}

      {/* Test Send */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">🧪 Test Kirim Pesan</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
            placeholder="08xxxxxxxxxx"
            className={inputCls + ' flex-1'}
          />
          <button onClick={handleTest} disabled={loading || !testPhone}
            className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-700 disabled:opacity-40 transition whitespace-nowrap">
            Kirim Test
          </button>
        </div>
        {testResult && <p className="text-sm mt-2">{testResult}</p>}
      </div>

      {/* Info */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-xs text-blue-700">
          <strong>Cara kerja:</strong> Setelah login, sistem mengirim kode OTP 6 digit via WhatsApp (utama) dan Email (cadangan).
          Kode berlaku 5 menit. Maksimal 3× percobaan salah sebelum harus login ulang.
        </p>
      </div>
    </div>
  );
}
