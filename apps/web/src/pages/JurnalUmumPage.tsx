import { useState, useEffect } from 'react';
import DatePicker from './DatePicker';

// ─── Types ───────────────────────────────────────────────────
type CoAAccount = {
  id: number;
  kode: string;
  nama: string;
  jenis_akun?: string;
  jenisAkun?: string;
  saldo_normal?: string;
  saldoNormal?: string;
  is_postable?: boolean;
  isPostable?: boolean;
  parentId?: number | null;
  parent_id?: number | null;
  isSeeded?: boolean;
  is_seeded?: boolean;
  isSystemDefault?: boolean;
  is_system_default?: boolean;
  level?: number;
  isActive?: boolean;
  kelompok?: string;
};

type JournalEntry = {
  id: number;
  no_jurnal: string;
  tanggal: string;
  keterangan: string;
  total: number;
  lines?: { akun_id: number; debit: number; kredit: number; keterangan: string }[];
};

// ─── Page type (matching AppDashboard) ───────────────────────
type Page = 'dashboard' | 'password' | 'langganan' | 'profil' | 'coa' | 'saldo-awal' | 'jurnal' | 'rekap-jurnal' | 'penyesuaian' | 'rincian-saldo' | 'buku-besar' | 'laba-rugi' | 'neraca' | 'neraca-saldo' | 'arus-kas' | 'perubahan-modal' | 'aset-tetap' | 'tutup-buku' | 'calk';

// ─── Helpers ─────────────────────────────────────────────────
function formatRupiah(value?: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
}

function formatCurrencyDisplay(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseCurrencyInput(displayVal: string): number {
  const digits = displayVal.replace(/\D/g, '');
  return parseFloat(digits) || 0;
}

function getToken() {
  return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
}

// ─── Icons ───────────────────────────────────────────────────
function Icon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
      <path d={d} />
    </svg>
  );
}

const jurnalIcon = 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h6m-6 4h6';

// ─── Draft helpers ───────────────────────────────────────────
function getDraftKey(): string {
  try {
    const t = getToken();
    const payload = JSON.parse(atob(t.split('.')[1]));
    return 'jurnal-draft-' + (payload.tenantId || 'unknown');
  } catch { return 'jurnal-draft-unknown'; }
}

// ─── Component ───────────────────────────────────────────────
export default function JurnalUmumPage({ setPage }: { setPage: (p: Page) => void }) {
  const [coaAccounts, setCoaAccounts] = useState<CoAAccount[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [keterangan, setKeterangan] = useState('');
  const [referensi, setReferensi] = useState('');
  const [lines, setLines] = useState<{ akun_id: string; debit: string; kredit: string; keterangan: string; searchTerm?: string }[]>([
    { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' },
    { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' },
  ]);
  const [showSuccess, setShowSuccess] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<JournalEntry | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [quickAction, setQuickAction] = useState<'penerimaan' | 'pengeluaran' | null>(null);

  // ── Fetch data + restore draft ──────────────────────────────
  useEffect(() => {
    const t = getToken();
    Promise.all([
      fetch('/api/accounting/coa', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      fetch('/api/accounting/jurnal-umum?limit=20', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
    ])
      .then(([coaData, jurnalData]) => {
        const all: CoAAccount[] = (Array.isArray(coaData) ? coaData : coaData.coa || coaData.accounts || []);
        setCoaAccounts(all.filter((a: CoAAccount) => a.isPostable ?? a.is_postable));
        setEntries(Array.isArray(jurnalData) ? jurnalData : jurnalData.entries || jurnalData.data || []);
      })
      .catch(e => setError(e.message || 'Gagal memuat data'))
      .finally(() => {
        setLoading(false);
        // Restore draft after data loaded (only when not editing/quickAction)
        try {
          const key = getDraftKey();
          const draft = localStorage.getItem(key);
          if (draft) {
            const parsed = JSON.parse(draft);
            if (parsed.tanggal) setTanggal(parsed.tanggal);
            if (parsed.keterangan) setKeterangan(parsed.keterangan);
            if (parsed.referensi) setReferensi(parsed.referensi);
            if (parsed.lines?.length > 0) setLines(parsed.lines);
          }
        } catch {}
      });
  }, []);

  // ── Auto-save draft (debounced) ─────────────────────────────
  useEffect(() => {
    if (editingId || quickAction) return; // don't auto-save in edit/quick-action mode
    const timer = setTimeout(() => {
      try {
        const key = getDraftKey();
        const hasAnyValue = lines.some(l => l.akun_id || l.debit || l.kredit || l.searchTerm);
        if (!hasAnyValue && !tanggal && !keterangan) return;
        localStorage.setItem(key, JSON.stringify({
          tanggal, keterangan, referensi, lines: lines.map(l => ({
            akun_id: l.akun_id, debit: l.debit, kredit: l.kredit,
            keterangan: l.keterangan, searchTerm: l.searchTerm
          })),
          savedAt: new Date().toISOString()
        }));
      } catch {}
    }, 1000);
    // Save immediately on unmount too
    return () => {
      clearTimeout(timer);
      try {
        const key = getDraftKey();
        const hasAnyValue = lines.some(l => l.akun_id || l.debit || l.kredit || l.searchTerm);
        if (!hasAnyValue && !tanggal && !keterangan) return;
        localStorage.setItem(key, JSON.stringify({
          tanggal, keterangan, referensi, lines: lines.map(l => ({
            akun_id: l.akun_id, debit: l.debit, kredit: l.kredit,
            keterangan: l.keterangan, searchTerm: l.searchTerm
          })),
          savedAt: new Date().toISOString()
        }));
      } catch {}
    };
  }, [lines, tanggal, keterangan, referensi, editingId, quickAction]);

  // ── Quick Actions (Append mode) ─────────────────────────────
  function applyQuickAction(type: 'penerimaan' | 'pengeluaran') {
    const kasBank = coaAccounts.filter(a => a.kode?.startsWith('1.1.01') || a.kode?.startsWith('1.1.02'));
    if (kasBank.length === 0) { setError('Akun Kas/Bank tidak ditemukan di CoA'); return; }

    setEditingId(null);
    setError('');
    setShowSuccess('');

    const newLines = [
      { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' },
      { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' },
    ];

    // Opsi B: Append to existing lines if form has data; otherwise replace
    const hasExisting = lines.some(l => l.akun_id || l.debit || l.kredit);
    if (hasExisting) {
      setLines(prev => [...prev, ...newLines]);
    } else {
      setLines(newLines);
    }

    setQuickAction(type);
  }

  function cancelQuickAction() {
    setQuickAction(null);
    setLines([
      { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' },
      { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' },
    ]);
  }

  // ── Line management ─────────────────────────────────────────
  function updateLine(i: number, field: string, val: string) {
    setLines(prev => {
      let next = prev.map((l, idx) => {
        if (idx !== i) return l;
        let storeVal = val;
        if (field === 'debit' || field === 'kredit') {
          storeVal = formatCurrencyDisplay(val);
        }
        const updated = { ...l, [field]: storeVal };
        if (field === 'debit' && parseCurrencyInput(val) > 0) updated.kredit = '';
        if (field === 'kredit' && parseCurrencyInput(val) > 0) updated.debit = '';
        return updated;
      });
      // Auto-add empty row when last row gets filled (up to 50)
      const last = next[next.length - 1];
      const lastTouched = last.akun_id || last.debit || last.kredit || last.searchTerm;
      if (i === next.length - 1 && lastTouched && next.length < 50) {
        next = [...next, { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' }];
      }
      return next;
    });
  }

  function addLine() {
    if (lines.length >= 50) return;
    setLines(prev => [...prev, { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' }]);
  }

  function removeLine(i: number) {
    setLines(prev => prev.filter((_, idx) => idx !== i));
  }

  // ── Derived values ──────────────────────────────────────────
  const totalDebit = lines.reduce((s, l) => s + parseCurrencyInput(l.debit), 0);
  const totalKredit = lines.reduce((s, l) => s + parseCurrencyInput(l.kredit), 0);
  const isBalanced = Math.abs(totalDebit - totalKredit) < 0.01;
  const validLines = lines.filter(l => l.akun_id && (parseCurrencyInput(l.debit) > 0 || parseCurrencyInput(l.kredit) > 0));
  const canSubmit = isBalanced && validLines.length >= 2 && !!tanggal && !!keterangan.trim() && !submitting;

  // ── Clear form ──────────────────────────────────────────────
  function handleClearForm() {
    if (!confirm('Yakin kosongkan form? Draft yang tersimpan akan hilang.')) return;
    setEditingId(null);
    setQuickAction(null);
    setError('');
    setShowSuccess('');
    setKeterangan('');
    setReferensi('');
    setTanggal(new Date().toISOString().slice(0, 10));
    setLines([
      { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' },
      { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' },
    ]);
    try { localStorage.removeItem(getDraftKey()); } catch {}
  }

  // ── Submit ──────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Ghost rows sanitization: filter out empty rows
    const cleanLines = validLines.filter(l => {
      if (!l.akun_id) return false;
      const d = parseCurrencyInput(l.debit);
      const k = parseCurrencyInput(l.kredit);
      return d > 0 || k > 0;
    });

    if (cleanLines.length === 0) {
      setError('Isi minimal 1 baris transaksi dengan akun dan nominal');
      return;
    }
    if (cleanLines.length < 2) {
      setError('Minimal 2 baris transaksi diperlukan');
      return;
    }
    // Re-check balance with clean lines
    const cleanDebit = cleanLines.reduce((s, l) => s + parseCurrencyInput(l.debit), 0);
    const cleanKredit = cleanLines.reduce((s, l) => s + parseCurrencyInput(l.kredit), 0);
    if (Math.abs(cleanDebit - cleanKredit) >= 0.01) {
      setError('Total debit dan kredit harus seimbang');
      return;
    }

    setSubmitting(true);
    setError('');
    setShowSuccess('');
    try {
      const payload = {
        tanggal,
        keterangan,
        referensi: referensi.trim() || undefined,
        lines: cleanLines.map(l => ({
          akun_id: l.akun_id,
          debit: parseCurrencyInput(l.debit),
          kredit: parseCurrencyInput(l.kredit),
          keterangan: l.keterangan,
        })),
      };
      const res = await fetch(editingId ? '/api/accounting/jurnal-umum/' + editingId : '/api/accounting/jurnal-umum', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (data.message ? data.error + ' — ' + data.message : 'Gagal menyimpan jurnal'));
      const no = data.no_jurnal || data.entry?.no_jurnal || data.jurnal?.no_jurnal || '';
      setShowSuccess(editingId ? ('Jurnal berhasil diperbarui' + (no ? ': ' + no : '')) : (no ? 'Jurnal berhasil disimpan: ' + no : 'Jurnal berhasil disimpan'));
      setEditingId(null);
      setQuickAction(null);
      setKeterangan('');
      setReferensi('');
      setLines([{ akun_id: '', debit: '', kredit: '', keterangan: '' }, { akun_id: '', debit: '', kredit: '', keterangan: '' }]);
      // Clear draft after successful submit
      try { localStorage.removeItem(getDraftKey()); } catch {}
      const refreshed = await fetch('/api/accounting/jurnal-umum?limit=20', { headers: { Authorization: 'Bearer ' + getToken() } });
      const rd = await refreshed.json();
      setEntries(Array.isArray(rd) ? rd : rd.entries || rd.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Edit ────────────────────────────────────────────────────
  async function startEdit(entryId: number | string) {
    setError('');
    setShowSuccess('');
    try {
      const res = await fetch('/api/accounting/jurnal-umum/' + entryId, { headers: { Authorization: 'Bearer ' + getToken() } });
      const data = await res.json();
      const j = data.jurnal || data;
      if (!j || j.error) throw new Error(j?.error || 'Gagal memuat jurnal');
      if (j.tipeTransaksi && !['GENERAL', 'ADJUSTMENT'].includes(j.tipeTransaksi)) {
        setError('Jurnal ini (' + j.tipeTransaksi + ') hanya bisa diubah dari modul terkait.');
        return;
      }
      setEditingId(String(entryId));
      setTanggal((j.tanggal || '').slice(0, 10));
      setKeterangan(j.keterangan || '');
      setReferensi(j.referensi || '');
      const loadedLines = (j.lines || []).map((l: any) => ({
        akun_id: l.akunId || l.akun_id || '',
        debit: Number(l.debit) > 0 ? formatCurrencyDisplay(String(Number(l.debit))) : '',
        kredit: Number(l.kredit) > 0 ? formatCurrencyDisplay(String(Number(l.kredit))) : '',
        keterangan: l.keterangan || '',
        searchTerm: '',
      }));
      while (loadedLines.length < 2) loadedLines.push({ akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' });
      loadedLines.push({ akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' });
      setLines(loadedLines);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setError(e.message || 'Gagal memuat jurnal untuk diedit');
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setQuickAction(null);
    setError('');
    setKeterangan('');
    setReferensi('');
    setTanggal(new Date().toISOString().slice(0, 10));
    setLines([{ akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' }, { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' }]);
  }

  // ── Delete ──────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteModal) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/accounting/jurnal-umum/' + deleteModal.id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + getToken() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (data.message || 'Gagal menghapus jurnal'));
      setShowSuccess('Jurnal ' + deleteModal.no_jurnal + ' berhasil dihapus');
      setDeleteModal(null);
      setConfirmText('');
      if (editingId === String(deleteModal.id)) cancelEdit();
      const refreshed = await fetch('/api/accounting/jurnal-umum?limit=20', { headers: { Authorization: 'Bearer ' + getToken() } });
      const rd = await refreshed.json();
      setEntries(Array.isArray(rd) ? rd : rd.entries || rd.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ─────────────────────────────────────────────────
  if (loading) return <div className="rounded-2xl border border-slate-100 bg-white p-8 text-sm text-slate-500 shadow-sm">Memuat Jurnal Umum...</div>;

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none';
  const selectCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none';

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Jurnal Umum</h1>
        <p className="mt-1 text-sm text-slate-500">Catat transaksi jurnal umum BUM Desa.</p>
      </div>

      {/* CoA Info Banner — dismissible */}
      {!localStorage.getItem('coa-info-banner-dismissed') && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-amber-50 border border-blue-200/60 shadow-sm">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-blue-900 leading-relaxed">
              <span className="font-semibold">Tips:</span> Untuk menjaga kerapian, beberapa rincian akun keuangan disembunyikan oleh sistem. Silakan kunjungi menu <span className="font-semibold">Pengaturan CoA</span> untuk mengaktifkan akun spesifik sesuai kebutuhan BUM Desa Anda.
            </p>
            <button
              onClick={() => setPage('coa')}
              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-sm hover:bg-blue-700 transition active:scale-[0.97]"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              Ke Pengaturan CoA
            </button>
          </div>
          <button
            onClick={() => { localStorage.setItem('coa-info-banner-dismissed', '1'); }}
            className="flex-shrink-0 p-1 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-100 transition"
            title="Tutup pengumuman"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Quick Action Buttons */}
      {!editingId && (
        <div className="flex flex-wrap gap-3">
          {!quickAction ? (
            <>
              <button type="button" onClick={() => applyQuickAction('penerimaan')}
                className="group flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200 px-5 py-3 text-sm font-bold text-emerald-700 transition hover:from-emerald-100 hover:to-cyan-100 hover:border-emerald-300 hover:shadow-md active:scale-[0.97]">
                <svg className="w-5 h-5 text-emerald-600 transition group-hover:scale-110" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Penerimaan Kas
              </button>
              <button type="button" onClick={() => applyQuickAction('pengeluaran')}
                className="group flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 px-5 py-3 text-sm font-bold text-rose-700 transition hover:from-rose-100 hover:to-orange-100 hover:border-rose-300 hover:shadow-md active:scale-[0.97]">
                <svg className="w-5 h-5 text-rose-600 transition group-hover:scale-110" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>
                Pengeluaran Kas
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold ${quickAction === 'penerimaan' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d={quickAction === 'penerimaan' ? 'M12 4.5v15m7.5-7.5h-15' : 'M19.5 12h-15'} /></svg>
                {quickAction === 'penerimaan' ? 'Penerimaan Kas — Debit: Kas/Bank' : 'Pengeluaran Kas — Kredit: Kas/Bank'}
              </span>
              <button type="button" onClick={cancelQuickAction}
                className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                ✕ Batal
              </button>
            </div>
          )}
        </div>
      )}

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
      {showSuccess && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{showSuccess}</div>}

      <form onSubmit={handleSubmit} className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-xl space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Icon d={jurnalIcon} className={'w-5 h-5 ' + (editingId ? 'text-amber-600' : 'text-emerald-600')} />
          <h2 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Jurnal' : 'Form Jurnal Baru'}</h2>
          {editingId && <span className="ml-auto inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Mode Edit</span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal</label>
            <DatePicker value={tanggal} onChange={setTanggal} className={inputCls} required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Keterangan <span className="text-red-400">*</span></label>
            <input type="text" value={keterangan} onChange={e => setKeterangan(e.target.value)} placeholder="Deskripsi transaksi..." className={inputCls} required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">No. Referensi <span className="text-slate-400 font-normal">(opsional)</span></label>
            <input type="text" value={referensi} onChange={e => setReferensi(e.target.value)} placeholder="No. kwitansi/nota" className={inputCls} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide px-1">
            <div className="col-span-4">Akun</div>
            <div className="col-span-3">Debit</div>
            <div className="col-span-3">Kredit</div>
            <div className="col-span-2">Aksi</div>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder={quickAction && i === 0 ? 'Pilih Kas/Bank...' : 'Cari akun...'}
                    value={line.searchTerm || ''}
                    onChange={e => {
                      const val = e.target.value;
                      updateLine(i, 'searchTerm', val);
                      if (line.akun_id) {
                        const selected = coaAccounts.find(a => String(a.id) === line.akun_id);
                        const selectedText = selected ? (selected.kode + ' — ' + selected.nama) : '';
                        if (val !== selectedText) { updateLine(i, 'akun_id', ''); }
                      } else {
                        const match = coaAccounts.find(a => a.kode === val || a.nama.toLowerCase() === val.toLowerCase());
                        if (match) { updateLine(i, 'akun_id', String(match.id)); }
                      }
                    }}
                    className={selectCls}
                  />
                  {((line.searchTerm && line.searchTerm.length > 0 && !line.akun_id) || (quickAction && i === 0 && !line.akun_id)) && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto">
                      {(() => {
                        const q = (line.searchTerm || '').toLowerCase();
                        const pool = quickAction && i === 0
                          ? coaAccounts.filter(a => a.kode?.startsWith('1.1.01') || a.kode?.startsWith('1.1.02'))
                          : coaAccounts;
                        const matches = q ? pool.filter(a => a.kode.includes(q) || a.nama.toLowerCase().includes(q)) : pool;
                        if (matches.length === 0) {
                          return <p className="px-3 py-2 text-sm text-slate-400 italic">{quickAction && i === 0 ? 'Akun Kas/Bank tidak ditemukan' : 'Akun tidak ditemukan'}</p>;
                        }
                        return matches.map(a => (
                          <button
                            key={a.id}
                            type="button"
                            className={'w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition ' + (String(a.id) === line.akun_id ? 'bg-emerald-50 font-medium text-emerald-700' : 'text-slate-700')}
                            onClick={() => {
                              updateLine(i, 'searchTerm', a.kode + ' — ' + a.nama);
                              updateLine(i, 'akun_id', String(a.id));
                            }}
                          >
                            <span className="font-mono text-xs text-slate-400">{a.kode}</span>
                            <span className="ml-2">{a.nama}</span>
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>
              <div className="col-span-3">
                <input type="text" inputMode="numeric" placeholder="0" value={line.debit} disabled={!!(quickAction === 'pengeluaran' && i === 0)} onChange={e => updateLine(i, 'debit', e.target.value)} className={inputCls + (quickAction === 'pengeluaran' && i === 0 ? ' bg-slate-100 text-slate-400 cursor-not-allowed' : '')} />
              </div>
              <div className="col-span-3">
                <input type="text" inputMode="numeric" placeholder="0" value={line.kredit} disabled={!!(quickAction === 'penerimaan' && i === 0)} onChange={e => updateLine(i, 'kredit', e.target.value)} className={inputCls + (quickAction === 'penerimaan' && i === 0 ? ' bg-slate-100 text-slate-400 cursor-not-allowed' : '')} />
              </div>
              <div className="col-span-2 flex gap-1">
                {lines.length > 2 && !(quickAction && i === 0) && (
                  <button type="button" onClick={() => removeLine(i)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition text-sm font-bold" title="Hapus baris">
                    <Icon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Explicit "+ Tambah Baris" button + 50-row max */}
          {lines.length < 50 && (
            <button type="button" onClick={addLine}
              className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm font-semibold text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition">
              + Tambah Baris ({lines.length}/50)
            </button>
          )}
          {lines.length >= 50 && (
            <p className="text-xs text-amber-600 text-center font-medium">Maksimal 50 baris per jurnal</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex gap-6 text-sm">
            <span>Total Debit: <strong className="text-slate-900">{formatRupiah(totalDebit)}</strong></span>
            <span>Total Kredit: <strong className="text-slate-900">{formatRupiah(totalKredit)}</strong></span>
            <span className={isBalanced ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
              {isBalanced ? 'Seimbang' : 'Belum Seimbang'}
            </span>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <button type="submit" disabled={!canSubmit}
              className="rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed">
              {submitting ? 'Menyimpan...' : editingId ? 'Perbarui Jurnal' : 'Simpan Jurnal'}
            </button>
            {!editingId && (
              <button type="button" onClick={handleClearForm}
                className="text-sm text-red-500 hover:text-red-700 hover:underline font-medium transition">
                Kosongkan Form
              </button>
            )}
            {editingId && (
              <button type="button" onClick={cancelEdit}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:border-slate-400">
                Batal
              </button>
            )}
          </div>
        </div>
      </form>

      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Riwayat Jurnal</h3>
        {entries.length === 0 ? (
          <div className="rounded-3xl border border-white/70 bg-white/80 p-8 text-center shadow-sm backdrop-blur-xl">
            <Icon d={jurnalIcon} className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="mt-3 text-sm text-slate-400">Belum ada jurnal tercatat</p>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/70 bg-white/80 shadow-sm backdrop-blur-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">No. Jurnal</th>
                    <th className="px-5 py-3.5 font-semibold">Tanggal</th>
                    <th className="px-5 py-3.5 font-semibold">Keterangan</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Total</th>
                    <th className="px-5 py-3.5 font-semibold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map(e => {
                    const noJurnal = e.no_jurnal || (e as any).noJurnal || '';
                    const rowTotal = Number((e as any).total) || ((e as any).lines || []).reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
                    const isOpening = noJurnal.startsWith('OB') || (e as any).tipeTransaksi === 'OPENING_BALANCE';
                    return (
                    <tr key={e.id} className={'transition ' + (editingId === String(e.id) ? 'bg-amber-50/60' : 'hover:bg-slate-50/50')}>
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-emerald-700">{noJurnal}</td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(e.tanggal)}</td>
                      <td className="px-5 py-3 text-slate-900">{e.keterangan || '-'}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatRupiah(rowTotal)}</td>
                      <td className="px-5 py-3">
                        {isOpening ? (
                          <span className="block text-center text-xs text-slate-400 italic" title="Saldo Awal hanya bisa diubah dari modul Saldo Awal">Saldo Awal</span>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <button type="button" onClick={() => startEdit(e.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition" title="Edit jurnal">
                              <Icon d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => { setDeleteModal(e); setConfirmText(''); }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition" title="Hapus jurnal">
                              <Icon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setDeleteModal(null); setConfirmText(''); }}>
          <div className="mx-4 w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-2xl backdrop-blur-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <Icon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Hapus Jurnal</h3>
                <p className="text-sm text-slate-500">Hapus jurnal <span className="font-mono font-bold text-red-600">{deleteModal.no_jurnal}</span> — {deleteModal.keterangan?.slice(0, 50) || '-'}</p>
              </div>
            </div>
            <p className="mb-2 text-sm text-slate-700">Ketik <strong className="text-red-600">HAPUS</strong> untuk konfirmasi:</p>
            <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="Ketik HAPUS" autoFocus
              className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-red-400 focus:ring-2 focus:ring-red-500/20 focus:outline-none mb-4" />
            <div className="flex gap-3">
              <button type="button" onClick={() => { setDeleteModal(null); setConfirmText(''); }}
                className="flex-1 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                Batal
              </button>
              <button type="button" disabled={confirmText !== 'HAPUS' || submitting} onClick={handleDelete}
                className="flex-1 rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting ? 'Menghapus...' : 'Hapus Jurnal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Balance Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between text-sm">
          <div className="flex gap-4">
            <span>Debit: <strong className="tabular-nums">{formatRupiah(totalDebit)}</strong></span>
            <span>Kredit: <strong className="tabular-nums">{formatRupiah(totalKredit)}</strong></span>
          </div>
          <span className={isBalanced ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
            {isBalanced ? '✅ SEIMBANG' : `❌ SELISIH: ${formatRupiah(Math.abs(totalDebit - totalKredit))}`}
          </span>
        </div>
      </div>
    </div>
  );
}
