import { useState, useEffect, useCallback } from 'react';

const API = '/api';
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition';
const textareaCls = inputCls + ' min-h-[100px] resize-y font-mono text-xs';

type WAStatus = {
  connected: boolean;
  status: string;
  engine?: any;
  error?: string;
};

type Templates = {
  whatsapp: string;
  email_subject: string;
  email_body: string;
};

type Variable = { key: string; desc: string };

export default function WhatsAppSettingsPage() {
  const [status, setStatus] = useState<WAStatus | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Template state
  const [tpl, setTpl] = useState<Templates>({ whatsapp: '', email_subject: '', email_body: '' });
  const [tplVars, setTplVars] = useState<Variable[]>([]);
  const [tplSaved, setTplSaved] = useState(false);
  const [tplError, setTplError] = useState('');
  const [previewOtp] = useState('123456');
  const [previewName] = useState('Budi Santoso');
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'email'>('whatsapp');

  const token = (localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // ── Fetch WA status ──
  const fetchStatus = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${API}/admin/whatsapp/status`, { headers });
      const data = await res.json();
      setStatus(data);
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

  // ── Fetch templates ──
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/otp/templates`, { headers });
      const data = await res.json();
      if (data.templates) setTpl(data.templates);
      if (data.variables) setTplVars(data.variables);
    } catch {}
  }, []);

  // ── Fetch OTP status ──
  const [otpEnabled, setOtpEnabled] = useState(false);
  const fetchOtpStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/otp/status`, { headers });
      const data = await res.json();
      setOtpEnabled(data.enabled);
    } catch {}
  }, []);

  useEffect(() => { fetchStatus(); fetchTemplates(); fetchOtpStatus(); }, [fetchStatus, fetchTemplates, fetchOtpStatus]);

  async function handleToggleOtp() {
    const newVal = !otpEnabled;
    try {
      const res = await fetch(`${API}/admin/otp/toggle`, {
        method: 'POST', headers,
        body: JSON.stringify({ enabled: newVal }),
      });
      const data = await res.json();
      if (data.ok) setOtpEnabled(newVal);
    } catch {}
  }

  // Auto-refresh QR
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
    } catch {}
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

  async function handleSaveTemplate() {
    setTplSaved(false);
    setTplError('');
    try {
      const res = await fetch(`${API}/admin/otp/templates`, {
        method: 'POST', headers,
        body: JSON.stringify(tpl),
      });
      const data = await res.json();
      if (data.ok) {
        setTplSaved(true);
        setTimeout(() => setTplSaved(false), 3000);
      } else {
        setTplError(data.error || 'Gagal menyimpan');
      }
    } catch {
      setTplError('Koneksi gagal');
    }
  }

  async function handleResetTemplate() {
    try {
      const res = await fetch(`${API}/admin/otp/templates/reset`, { method: 'POST', headers });
      const data = await res.json();
      if (data.templates) {
        setTpl(data.templates);
        setTplSaved(true);
        setTimeout(() => setTplSaved(false), 3000);
      }
    } catch {}
  }

  function previewTemplate(text: string): string {
    return text
      .replace(/\{app_name\}/g, 'SILABU DIGI')
      .replace(/\{otp\}/g, previewOtp)
      .replace(/\{user_name\}/g, previewName)
      .replace(/\{email\}/g, 'budi@example.com');
  }

  const statusColor = status?.connected ? 'bg-emerald-500' : status?.status === 'SCAN_QR_CODE' ? 'bg-amber-500' : 'bg-red-500';
  const statusLabel = status?.connected ? 'Terhubung' : status?.status === 'SCAN_QR_CODE' ? 'Perlu Scan QR' : status?.status === 'STARTING' ? 'Memulai...' : 'Terputus';

  return (
    <div className="space-y-6 max-w-3xl">
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

      {/* OTP Toggle */}
      <div className={`rounded-2xl border p-6 ${otpEnabled ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              🔐 Verifikasi OTP Saat Login
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {otpEnabled
                ? 'User wajib masukkan kode OTP setelah login (WhatsApp + Email)'
                : 'OTP dimatikan — user langsung masuk setelah login'}
            </p>
          </div>
          <button onClick={handleToggleOtp}
            className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${otpEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${otpEnabled ? 'translate-x-7' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {!otpEnabled && (
          <p className="text-[11px] text-amber-600 mt-2 font-semibold">
            ⚠️ OTP dimatikan — login tidak memerlukan verifikasi kedua
          </p>
        )}
      </div>

      {/* Test Send */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">🧪 Test Kirim Pesan</h3>
        <div className="flex gap-2">
          <input type="text" value={testPhone} onChange={e => setTestPhone(e.target.value)}
            placeholder="08xxxxxxxxxx" className={inputCls + ' flex-1'} />
          <button onClick={handleTest} disabled={loading || !testPhone}
            className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-700 disabled:opacity-40 transition whitespace-nowrap">
            Kirim Test
          </button>
        </div>
        {testResult && <p className="text-sm mt-2">{testResult}</p>}
      </div>

      {/* ── TEMPLATE EDITOR ── */}
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-6">
        <h3 className="text-sm font-bold text-violet-800 mb-1 flex items-center gap-2">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          Template Pesan OTP
        </h3>
        <p className="text-xs text-violet-600 mb-4">Customize pesan OTP yang dikirim ke user. Gunakan variabel di bawah untuk data dinamis.</p>

        {/* Variables */}
        <div className="flex flex-wrap gap-2 mb-4">
          {tplVars.map(v => (
            <code key={v.key} className="inline-flex items-center gap-1 px-2 py-1 bg-violet-100 text-violet-700 rounded-lg text-[11px] font-mono cursor-help" title={v.desc}>
              {v.key}
            </code>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-slate-100 rounded-xl p-1">
          <button onClick={() => setActiveTab('whatsapp')}
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'whatsapp' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            💬 WhatsApp
          </button>
          <button onClick={() => setActiveTab('email')}
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'email' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            📧 Email
          </button>
        </div>

        {activeTab === 'whatsapp' && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 mb-1 block">Pesan WhatsApp</span>
              <textarea value={tpl.whatsapp} onChange={e => setTpl({ ...tpl, whatsapp: e.target.value })}
                className={textareaCls} rows={4} placeholder="Ketik pesan WhatsApp..." />
            </label>
            <p className="text-[11px] text-slate-400">Gunakan *teks* untuk bold di WhatsApp</p>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 mb-1 block">Subject Email</span>
              <input type="text" value={tpl.email_subject} onChange={e => setTpl({ ...tpl, email_subject: e.target.value })}
                className={inputCls} placeholder="Subject email..." />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 mb-1 block">Body Email (HTML)</span>
              <textarea value={tpl.email_body} onChange={e => setTpl({ ...tpl, email_body: e.target.value })}
                className={textareaCls} rows={8} placeholder="<div>...</div>" />
            </label>
          </div>
        )}

        {/* Preview */}
        <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-xs font-bold text-slate-500 mb-2">👁️ Preview (OTP: {previewOtp}, User: {previewName})</p>
          {activeTab === 'whatsapp' ? (
            <div className="bg-emerald-700 text-white p-3 rounded-xl rounded-tl-sm text-sm whitespace-pre-wrap max-w-[300px]">
              {previewTemplate(tpl.whatsapp)}
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-500 mb-1">Subject: <strong>{previewTemplate(tpl.email_subject)}</strong></p>
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-sm"
                dangerouslySetInnerHTML={{ __html: previewTemplate(tpl.email_body) }} />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button onClick={handleSaveTemplate} disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-40 transition">
            💾 Simpan Template
          </button>
          <button onClick={handleResetTemplate}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition">
            ↩️ Reset Default
          </button>
        </div>
        {tplSaved && <p className="text-sm text-emerald-600 font-semibold mt-2">✅ Template berhasil disimpan!</p>}
        {tplError && <p className="text-sm text-red-500 font-semibold mt-2">❌ {tplError}</p>}
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
