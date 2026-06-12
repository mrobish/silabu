import { useState, useEffect, useRef, useCallback, Fragment } from 'react';

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
  tipeTransaksi?: string;
  referensi?: string;
  lines?: { akun_id: number; debit: number; kredit: number; keterangan: string; akunId?: string }[];
};

interface Row {
  id: string;
  tanggal: string;
  no_bukti: string;
  keterangan: string;
  akun_id: string;
  debit: string;
  kredit: string;
  searchTerm: string;
}

// ─── Helpers ─────────────────────────────────────────────────
function formatRupiah(value?: number) {
  if (value == null) return 'Rp 0';
  return 'Rp ' + value.toLocaleString('id-ID');
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCurrencyDisplay(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseCurrencyInput(displayVal: string): number {
  const digits = displayVal.replace(/\D/g, '');
  return parseInt(digits, 10) || 0;
}

function getToken() {
  return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
}

function makeRowId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function emptyRow(): Row {
  return { id: makeRowId(), tanggal: '', no_bukti: '', keterangan: '', akun_id: '', debit: '', kredit: '', searchTerm: '' };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function getInheritedValue(rows: Row[], index: number, field: 'tanggal' | 'no_bukti' | 'keterangan'): string {
  if (rows[index][field]) return rows[index][field];
  for (let i = index - 1; i >= 0; i--) {
    if (rows[i][field]) return rows[i][field];
  }
  return '';
}

function safeMathEval(expr: string): number | null {
  try {
    const cleaned = expr.replace(/\./g, '').replace(/,/g, '.');
    const tokens = cleaned.match(/(\d+\.?\d*|\+|\-|\*|\/)/g);
    if (!tokens || tokens.length < 3) return null;
    if (['+', '-', '*', '/'].includes(tokens[tokens.length - 1])) return null;
    let result = parseFloat(tokens[0]);
    for (let i = 1; i < tokens.length; i += 2) {
      const op = tokens[i];
      const num = parseFloat(tokens[i + 1]);
      if (isNaN(num)) return null;
      if (op === '+') result += num;
      else if (op === '-') result -= num;
      else if (op === '*') result *= num;
      else if (op === '/') { if (num === 0) return null; result /= num; }
      else return null;
    }
    return Math.round(result * 100) / 100;
  } catch { return null; }
}

function getDraftKey(): string {
  try {
    const token = getToken();
    const payload = JSON.parse(atob(token.split('.')[1]));
    return 'jurnal-batch-draft-' + (payload.tenantId || 'unknown');
  } catch { return 'jurnal-batch-draft-unknown'; }
}

function getOldDraftKey(): string {
  try {
    const token = getToken();
    const payload = JSON.parse(atob(token.split('.')[1]));
    return 'jurnal-draft-' + (payload.tenantId || 'unknown');
  } catch { return 'jurnal-draft-unknown'; }
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

// ─── Fuzzy search scoring ────────────────────────────────────
function fuzzyAccountFilter(accounts: CoAAccount[], q: string): CoAAccount[] {
  if (!q) return accounts;
  const lower = q.toLowerCase();
  const scored: { account: CoAAccount; score: number }[] = [];
  for (const a of accounts) {
    const kodeLower = a.kode.toLowerCase();
    const namaLower = a.nama.toLowerCase();
    let score = 0;
    if (kodeLower.startsWith(lower)) score = 400;
    else if (kodeLower.includes(lower)) score = 300;
    else if (namaLower.startsWith(lower)) score = 200;
    else if (namaLower.includes(lower)) score = 100;
    if (score > 0) scored.push({ account: a, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.account);
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return <>{text.slice(0, idx)}<mark className="bg-yellow-200 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>;
}

// ─── Component ───────────────────────────────────────────────
export default function JurnalUmumPage({ setPage }: { setPage: (p: any) => void }) {
  const [coaAccounts, setCoaAccounts] = useState<CoAAccount[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState('');
  const [toast, setToast] = useState('');
  const [deleteModal, setDeleteModal] = useState<JournalEntry | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow()]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLines, setEditLines] = useState<{ tanggal: string; keterangan: string; referensi: string; lines: { akun_id: string; debit: string; kredit: string; keterangan: string; searchTerm: string }[] } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  // Focus management
  const refMap = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  function setRef(key: string, el: HTMLInputElement | null) {
    refMap.current.set(key, el);
  }

  // ── Toast helper ────────────────────────────────────────────
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  // ── Fetch data + restore draft ──────────────────────────────
  useEffect(() => {
    // Migration: check old draft key
    try {
      const oldKey = getOldDraftKey();
      if (localStorage.getItem(oldKey)) {
        alert('Draft lama tidak kompatibel dengan format baru. Silakan isi ulang.');
        localStorage.removeItem(oldKey);
      }
    } catch {}

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
        // Restore draft
        try {
          const key = getDraftKey();
          const draft = localStorage.getItem(key);
          if (draft) {
            const parsed = JSON.parse(draft);
            if (parsed.rows?.length > 0) {
              setRows(parsed.rows.map((r: Row) => ({ ...r, id: r.id || makeRowId() })));
            }
          }
        } catch {}
      });
  }, []);

  // ── Close dropdown on outside click ─────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Auto-save draft (debounced 1s) ──────────────────────────
  useEffect(() => {
    if (editingId) return;
    const hasAnyValue = rows.some(r => r.tanggal || r.no_bukti || r.keterangan || r.akun_id || r.debit || r.kredit);
    if (!hasAnyValue) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(getDraftKey(), JSON.stringify({ rows, savedAt: new Date().toISOString() }));
      } catch {}
    }, 1000);
    return () => {
      clearTimeout(timer);
      try { localStorage.setItem(getDraftKey(), JSON.stringify({ rows, savedAt: new Date().toISOString() })); } catch {}
    };
  }, [rows, editingId]);

  // ── Derived values ──────────────────────────────────────────
  const totalDebit = rows.reduce((s, r) => s + parseCurrencyInput(r.debit), 0);
  const totalKredit = rows.reduce((s, r) => s + parseCurrencyInput(r.kredit), 0);
  const isBalanced = Math.abs(totalDebit - totalKredit) < 0.01;
  const selisih = Math.abs(totalDebit - totalKredit);
  const jurnalGroups = new Set(rows.filter(r => r.tanggal || getInheritedValue(rows, rows.indexOf(r), 'tanggal')).map((r, i) => getInheritedValue(rows, i, 'tanggal') + '|' + getInheritedValue(rows, i, 'no_bukti'))).size;
  const validRowCount = rows.filter(r => r.akun_id && (parseCurrencyInput(r.debit) > 0 || parseCurrencyInput(r.kredit) > 0)).length;

  // ── Row management ──────────────────────────────────────────
  function addRow(index?: number) {
    if (rows.length >= 50) return;
    const nr = emptyRow();
    if (index !== undefined) {
      setRows(prev => {
        const next = [...prev];
        next.splice(index + 1, 0, nr);
        return next;
      });
      setTimeout(() => refMap.current.get('tanggal-' + (index + 1))?.focus(), 50);
    } else {
      setRows(prev => [...prev, nr]);
      setTimeout(() => refMap.current.get('tanggal-' + rows.length)?.focus(), 50);
    }
  }

  function removeRow(i: number) {
    setRows(prev => {
      if (prev.length <= 2) return prev.map((r, idx) => idx === i ? emptyRow() : r);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  function moveRow(from: number, to: number) {
    if (to < 0 || to >= rows.length) return;
    setRows(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function updateRow(i: number, field: keyof Row, val: string) {
    setRows(prev => {
      let next = prev.map((r, idx) => {
        if (idx !== i) return r;
        let storeVal = val;
        if (field === 'debit' || field === 'kredit') {
          storeVal = formatCurrencyDisplay(val);
        }
        const updated = { ...r, [field]: storeVal };
        if (field === 'debit' && parseCurrencyInput(val) > 0) updated.kredit = '';
        if (field === 'kredit' && parseCurrencyInput(val) > 0) updated.debit = '';
        return updated;
      });
      // Auto-add row on last row fill (up to 50)
      const last = next[next.length - 1];
      const lastTouched = last.akun_id || last.tanggal || last.no_bukti || last.keterangan || last.debit || last.kredit;
      if (i === next.length - 1 && lastTouched && next.length < 50) {
        next = [...next, emptyRow()];
      }
      return next;
    });
  }

  // ── In-cell math evaluation ────────────────────────────────
  function handleCellBlur(i: number, field: 'debit' | 'kredit') {
    const raw = rows[i][field];
    if (!raw) return;
    // Only evaluate if it contains math operators
    if (!/[+\-*\/]/.test(raw)) return;
    const result = safeMathEval(raw);
    if (result !== null && result >= 0) {
      updateRow(i, field, String(result));
    } else {
      showToast('Format matematika tidak valid');
      // Revert to just digits
      const digits = raw.replace(/[^\d]/g, '');
      updateRow(i, field, digits);
    }
  }

  // ── Auto-Balance Smart Fill ─────────────────────────────────
  function autoFillBalance(i: number) {
    if (selisih < 1) return;
    const currentDebit = parseCurrencyInput(rows[i].debit);
    const currentKredit = parseCurrencyInput(rows[i].kredit);
    if (currentDebit > 0 || currentKredit > 0) {
      // If row already has value, try the other side
      if (totalKredit > totalDebit && currentDebit === 0) {
        updateRow(i, 'debit', String(Math.round(selisih)));
      } else if (totalDebit > totalKredit && currentKredit === 0) {
        updateRow(i, 'kredit', String(Math.round(selisih)));
      } else {
        showToast('Baris sudah terisi, gunakan baris kosong');
      }
    } else {
      if (totalKredit > totalDebit) {
        updateRow(i, 'debit', String(Math.round(selisih)));
      } else {
        updateRow(i, 'kredit', String(Math.round(selisih)));
      }
    }
  }

  // ── Handle Enter in last cell ───────────────────────────────
  function handleCellKeyDown(i: number, field: string, e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'kredit') {
        if (rows.length < 50) {
          addRow();
        }
      } else {
        // Move to next cell in the same row
        const fields = ['tanggal', 'no_bukti', 'keterangan', 'akun', 'debit', 'kredit'];
        const idx = fields.indexOf(field);
        if (idx >= 0 && idx < fields.length - 1) {
          const nextField = fields[idx + 1];
          refMap.current.get(nextField + '-' + i)?.focus();
        }
      }
    }
  }

  // ── Quick Actions ───────────────────────────────────────────
  function applyQuickAction(type: 'penerimaan' | 'pengeluaran') {
    const kasBank = coaAccounts.filter(a => a.kode?.startsWith('1.1.01') || a.kode?.startsWith('1.1.02'));
    if (kasBank.length === 0) { setError('Akun Kas/Bank tidak ditemukan di CoA'); return; }

    const bankAccount = kasBank[0];
    const bankSearch = bankAccount.kode + ' — ' + bankAccount.nama;
    const hasExisting = rows.some(r => r.akun_id || r.tanggal || r.no_bukti || r.keterangan || r.debit || r.kredit);

    const newRow1: Row = {
      id: makeRowId(),
      tanggal: today(),
      no_bukti: '',
      keterangan: type === 'penerimaan' ? 'Penerimaan Kas' : 'Pengeluaran Kas',
      akun_id: String(bankAccount.id),
      debit: type === 'penerimaan' ? '' : '',
      kredit: type === 'pengeluaran' ? '' : '',
      searchTerm: bankSearch,
    };
    const newRow2 = emptyRow();

    if (hasExisting) {
      setRows(prev => [...prev, newRow1, newRow2]);
    } else {
      setRows([newRow1, newRow2]);
    }

    setTimeout(() => {
      refMap.current.get((type === 'penerimaan' ? 'debit' : 'kredit') + '-' + (hasExisting ? rows.length : 0))?.focus();
    }, 100);
  }

  // ── Clear form ──────────────────────────────────────────────
  function handleClearForm() {
    if (!confirm('Yakin kosongkan form? Draft yang tersimpan akan hilang.')) return;
    setEditingId(null);
    setEditLines(null);
    setError('');
    setShowSuccess('');
    setRows([emptyRow(), emptyRow()]);
    try { localStorage.removeItem(getDraftKey()); } catch {}
  }

  // ── Submit batch ────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setShowSuccess('');

    // Sanitize: filter out empty rows
    const validRows = rows.filter(r => {
      const hasAkun = !!r.akun_id;
      const hasDebit = parseCurrencyInput(r.debit) > 0;
      const hasKredit = parseCurrencyInput(r.kredit) > 0;
      return hasAkun && (hasDebit || hasKredit);
    });

    if (validRows.length < 2) {
      setError('Minimal 2 baris dengan akun dan nominal diperlukan');
      return;
    }

    const cleanDebit = validRows.reduce((s, r) => s + parseCurrencyInput(r.debit), 0);
    const cleanKredit = validRows.reduce((s, r) => s + parseCurrencyInput(r.kredit), 0);
    if (Math.abs(cleanDebit - cleanKredit) >= 0.01) {
      setError('Total debit dan kredit harus seimbang');
      return;
    }

    setSubmitting(true);
    try {
      // Build batch payload with inherited values
      const batchRows = validRows.map((r, idx) => {
        const ri = rows.indexOf(r);
        return {
          tanggal: getInheritedValue(rows, ri, 'tanggal') || today(),
          no_bukti: getInheritedValue(rows, ri, 'no_bukti'),
          keterangan: getInheritedValue(rows, ri, 'keterangan'),
          akun_id: r.akun_id,
          debit: parseCurrencyInput(r.debit),
          kredit: parseCurrencyInput(r.kredit),
        };
      });

      const res = await fetch('/api/accounting/jurnal-umum/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
        body: JSON.stringify({ rows: batchRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Gagal menyimpan jurnal');

      const count = data.entries?.length || 0;
      const nos = (data.entries || []).map((e: any) => e.noJurnal || e.no_jurnal || '').filter(Boolean);
      setShowSuccess(`${count} jurnal berhasil disimpan${nos.length ? ': ' + nos.join(', ') : ''}`);

      // Reset
      setRows([emptyRow(), emptyRow()]);
      try { localStorage.removeItem(getDraftKey()); } catch {}

      // Refresh
      const refreshed = await fetch('/api/accounting/jurnal-umum?limit=20', { headers: { Authorization: 'Bearer ' + getToken() } });
      const rd = await refreshed.json();
      setEntries(Array.isArray(rd) ? rd : rd.entries || rd.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Submit single edit ──────────────────────────────────────
  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !editLines) return;
    setError('');
    setShowSuccess('');

    const cleanLines = editLines.lines.filter(l => {
      const hasAkun = !!l.akun_id;
      const hasDebit = parseCurrencyInput(l.debit) > 0;
      const hasKredit = parseCurrencyInput(l.kredit) > 0;
      return hasAkun && (hasDebit || hasKredit);
    });

    if (cleanLines.length < 2) {
      setError('Minimal 2 baris dengan akun dan nominal diperlukan');
      return;
    }

    const cleanDebit = cleanLines.reduce((s, l) => s + parseCurrencyInput(l.debit), 0);
    const cleanKredit = cleanLines.reduce((s, l) => s + parseCurrencyInput(l.kredit), 0);
    if (Math.abs(cleanDebit - cleanKredit) >= 0.01) {
      setError('Total debit dan kredit harus seimbang');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        tanggal: editLines.tanggal,
        keterangan: editLines.keterangan,
        referensi: editLines.referensi || undefined,
        lines: cleanLines.map(l => ({
          akun_id: l.akun_id,
          debit: parseCurrencyInput(l.debit),
          kredit: parseCurrencyInput(l.kredit),
          keterangan: l.keterangan,
        })),
      };
      const res = await fetch('/api/accounting/jurnal-umum/' + editingId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Gagal memperbarui jurnal');

      setShowSuccess('Jurnal berhasil diperbarui');
      setEditingId(null);
      setEditLines(null);

      const refreshed = await fetch('/api/accounting/jurnal-umum?limit=20', { headers: { Authorization: 'Bearer ' + getToken() } });
      const rd = await refreshed.json();
      setEntries(Array.isArray(rd) ? rd : rd.entries || rd.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Edit existing entry ─────────────────────────────────────
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
      const loadedLines = (j.lines || []).map((l: any) => ({
        akun_id: l.akunId || l.akun_id || '',
        debit: Number(l.debit) > 0 ? formatCurrencyDisplay(String(Number(l.debit))) : '',
        kredit: Number(l.kredit) > 0 ? formatCurrencyDisplay(String(Number(l.kredit))) : '',
        keterangan: l.keterangan || '',
        searchTerm: '',
      }));
      while (loadedLines.length < 2) loadedLines.push({ akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' });
      setEditLines({
        tanggal: (j.tanggal || '').slice(0, 10),
        keterangan: j.keterangan || '',
        referensi: j.referensi || '',
        lines: loadedLines,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setError(e.message || 'Gagal memuat jurnal untuk diedit');
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditLines(null);
    setError('');
  }

  // ── Edit mode: update editLines ─────────────────────────────
  function updateEditLine(i: number, field: string, val: string) {
    if (!editLines) return;
    setEditLines(prev => {
      if (!prev) return prev;
      const newLines = prev.lines.map((l, idx) => {
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
      return { ...prev, lines: newLines };
    });
  }

  function addEditLine() {
    if (!editLines) return;
    setEditLines(prev => prev ? { ...prev, lines: [...prev.lines, { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' }] } : prev);
  }

  function removeEditLine(i: number) {
    if (!editLines) return;
    setEditLines(prev => {
      if (!prev) return prev;
      const newLines = prev.lines.filter((_, idx) => idx !== i);
      while (newLines.length < 2) newLines.push({ akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' });
      return { ...prev, lines: newLines };
    });
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
      if (!res.ok) throw new Error(data.error || data.message || 'Gagal menghapus jurnal');
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

  // ── Drag and drop handlers ──────────────────────────────────
  function onDragStart(i: number) { setDragIndex(i); }
  function onDragOver(e: React.DragEvent, i: number) { e.preventDefault(); setDropIndex(i); }
  function onDragLeave() { setDropIndex(null); }
  function onDrop(i: number) {
    if (dragIndex !== null && dragIndex !== i) {
      moveRow(dragIndex, i);
    }
    setDragIndex(null);
    setDropIndex(null);
  }
  function onDragEnd() { setDragIndex(null); setDropIndex(null); }

  // ── Loading ─────────────────────────────────────────────────
  if (loading) return <div className="rounded-2xl border border-slate-100 bg-white p-8 text-sm text-slate-500 shadow-sm">Memuat Jurnal Umum...</div>;

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none';
  const cellCls = 'w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none focus:z-10 relative';

  return (
    <div className="space-y-8 animate-fade-in pb-24">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Jurnal Umum</h1>
        <p className="mt-1 text-sm text-slate-500">Catat transaksi jurnal umum BUM Desa — Excel-Style Batch Input.</p>
      </div>

      {/* Quick Action Buttons */}
      {!editingId && (
        <div className="flex flex-wrap gap-3">
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
        </div>
      )}

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
      {showSuccess && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{showSuccess}</div>}
      {toast && <div className="fixed top-4 right-4 z-[100] rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg animate-fade-in">{toast}</div>}

      {/* ── EDIT MODE ─────────────────────────────────────────── */}
      {editingId && editLines ? (
        <form onSubmit={handleEditSubmit} className="rounded-3xl border border-amber-200 bg-white/80 p-6 shadow-sm backdrop-blur-xl space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Icon d={jurnalIcon} className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-bold text-slate-900">Edit Jurnal</h2>
            <span className="ml-auto inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Mode Edit</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal</label>
              <input type="date" value={editLines.tanggal} onChange={e => setEditLines(p => p ? { ...p, tanggal: e.target.value } : p)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Keterangan <span className="text-red-400">*</span></label>
              <input type="text" value={editLines.keterangan} onChange={e => setEditLines(p => p ? { ...p, keterangan: e.target.value } : p)} placeholder="Deskripsi transaksi..." className={inputCls} required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">No. Referensi</label>
              <input type="text" value={editLines.referensi} onChange={e => setEditLines(p => p ? { ...p, referensi: e.target.value } : p)} placeholder="No. kwitansi/nota" className={inputCls} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide px-1">
              <div className="col-span-4">Akun</div>
              <div className="col-span-3">Debit</div>
              <div className="col-span-3">Kredit</div>
              <div className="col-span-2">Aksi</div>
            </div>
            {editLines.lines.map((line, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Cari akun..."
                      value={line.searchTerm || ''}
                      onChange={e => {
                        const val = e.target.value;
                        updateEditLine(i, 'searchTerm', val);
                        if (line.akun_id) {
                          const selected = coaAccounts.find(a => String(a.id) === line.akun_id);
                          const selectedText = selected ? (selected.kode + ' — ' + selected.nama) : '';
                          if (val !== selectedText) { updateEditLine(i, 'akun_id', ''); }
                        }
                      }}
                      className={inputCls}
                    />
                    {(line.searchTerm && line.searchTerm.length > 0 && !line.akun_id) && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto">
                        {(() => {
                          const q = line.searchTerm.toLowerCase();
                          const matches = coaAccounts.filter(a => a.kode.toLowerCase().includes(q) || a.nama.toLowerCase().includes(q));
                          if (matches.length === 0) return <p className="px-3 py-2 text-sm text-slate-400 italic">Akun tidak ditemukan</p>;
                          return matches.map(a => (
                            <button key={a.id} type="button"
                              className={'w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition ' + (String(a.id) === line.akun_id ? 'bg-emerald-50 font-medium text-emerald-700' : 'text-slate-700')}
                              onClick={() => {
                                updateEditLine(i, 'searchTerm', a.kode + ' — ' + a.nama);
                                updateEditLine(i, 'akun_id', String(a.id));
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
                  <input type="text" inputMode="numeric" placeholder="0" value={line.debit} onChange={e => updateEditLine(i, 'debit', e.target.value)} className={inputCls} />
                </div>
                <div className="col-span-3">
                  <input type="text" inputMode="numeric" placeholder="0" value={line.kredit} onChange={e => updateEditLine(i, 'kredit', e.target.value)} className={inputCls} />
                </div>
                <div className="col-span-2 flex gap-1">
                  {editLines.lines.length > 2 && (
                    <button type="button" onClick={() => removeEditLine(i)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition text-sm font-bold" title="Hapus baris">
                      <Icon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={addEditLine}
              className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm font-semibold text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition">
              + Tambah Baris
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex gap-6 text-sm">
              <span>Total Debit: <strong>{formatRupiah(editLines.lines.reduce((s, l) => s + parseCurrencyInput(l.debit), 0))}</strong></span>
              <span>Total Kredit: <strong>{formatRupiah(editLines.lines.reduce((s, l) => s + parseCurrencyInput(l.kredit), 0))}</strong></span>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting}
                className="rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting ? 'Menyimpan...' : 'Perbarui Jurnal'}
              </button>
              <button type="button" onClick={cancelEdit}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                Batal
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* ── BATCH INPUT MODE ────────────────────────────────────── */
        <form onSubmit={handleSubmit} className="rounded-3xl border border-white/70 bg-white/80 p-4 sm:p-6 shadow-sm backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon d={jurnalIcon} className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">Input Jurnal Batch</h2>
            <span className="ml-auto text-xs text-slate-400">{rows.length} baris</span>
          </div>

          {/* Excel-style table */}
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[800px] px-4 sm:px-0">
              {/* Header */}
              <div className="grid grid-cols-[32px_120px_120px_1fr_1fr_120px_120px_80px] gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide px-1 mb-2">
                <div className="flex items-center justify-center">⠿</div>
                <div>Tanggal</div>
                <div>No. Bukti</div>
                <div>Akun</div>
                <div>Keterangan</div>
                <div className="text-right">Debit</div>
                <div className="text-right">Kredit</div>
                <div className="text-center">Aksi</div>
              </div>

              {/* Rows */}
              {rows.map((row, i) => {
                const inheritedTanggal = getInheritedValue(rows, i, 'tanggal');
                const inheritedBukti = getInheritedValue(rows, i, 'no_bukti');
                const inheritedKet = getInheritedValue(rows, i, 'keterangan');
                const isDragging = dragIndex === i;
                const isDropTarget = dropIndex === i;

                return (
                  <Fragment key={row.id}>
                    {/* Insert row button between rows */}
                    {i > 0 && rows.length < 50 && (
                      <div className="flex justify-center h-0 -my-0.5 relative z-10 group">
                        <button
                          type="button"
                          onClick={() => addRow(i - 1)}
                          className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center hover:bg-emerald-200 shadow-sm"
                          title="Sisipkan baris"
                        >
                          +
                        </button>
                      </div>
                    )}

                    <div
                      className={`grid grid-cols-[32px_120px_120px_1fr_1fr_120px_120px_80px] gap-1.5 items-start py-1 rounded-lg transition ${
                        isDragging ? 'opacity-40' : isDropTarget ? 'bg-emerald-50 ring-2 ring-emerald-300' : 'hover:bg-slate-50/50'
                      }`}
                      onDragOver={e => onDragOver(e, i)}
                      onDragLeave={onDragLeave}
                      onDrop={() => onDrop(i)}
                    >
                      {/* Drag grip */}
                      <div
                        className="flex items-center justify-center h-9 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 select-none"
                        draggable="true"
                        onDragStart={() => onDragStart(i)}
                        onDragEnd={onDragEnd}
                        title="Geser baris"
                      >
                        ⠿
                      </div>

                      {/* Tanggal */}
                      <input
                        type="date"
                        value={row.tanggal}
                        placeholder={inheritedTanggal}
                        onChange={e => updateRow(i, 'tanggal', e.target.value)}
                        onKeyDown={e => handleCellKeyDown(i, 'tanggal', e)}
                        ref={el => setRef('tanggal-' + i, el)}
                        className={cellCls + (!row.tanggal && inheritedTanggal ? ' text-slate-400' : '')}
                        style={!row.tanggal && inheritedTanggal ? { color: '#94a3b8' } : undefined}
                        title={inheritedTanggal || undefined}
                      />

                      {/* No. Bukti */}
                      <input
                        type="text"
                        value={row.no_bukti}
                        placeholder={inheritedBukti || 'No. bukti'}
                        onChange={e => updateRow(i, 'no_bukti', e.target.value)}
                        onKeyDown={e => handleCellKeyDown(i, 'no_bukti', e)}
                        ref={el => setRef('no_bukti-' + i, el)}
                        className={cellCls + (!row.no_bukti && inheritedBukti ? ' text-slate-400 italic' : '')}
                      />

                      {/* Akun */}
                      <div className="relative" ref={openDropdown === i ? dropdownRef : undefined}>
                        <input
                          type="text"
                          placeholder="Cari akun..."
                          value={row.searchTerm || ''}
                          onChange={e => {
                            const val = e.target.value;
                            updateRow(i, 'searchTerm', val);
                            if (row.akun_id) {
                              const selected = coaAccounts.find(a => String(a.id) === row.akun_id);
                              const selectedText = selected ? (selected.kode + ' — ' + selected.nama) : '';
                              if (val !== selectedText) { updateRow(i, 'akun_id', ''); }
                            }
                            setOpenDropdown(i);
                          }}
                          onFocus={() => setOpenDropdown(i)}
                          onKeyDown={e => handleCellKeyDown(i, 'akun', e)}
                          ref={el => setRef('akun-' + i, el)}
                          className={cellCls}
                        />
                        {openDropdown === i && (row.searchTerm || '').length > 0 && !row.akun_id && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto">
                            {(() => {
                              const matches = fuzzyAccountFilter(coaAccounts, row.searchTerm);
                              if (matches.length === 0) return <p className="px-3 py-2 text-sm text-slate-400 italic">Akun tidak ditemukan</p>;
                              return matches.slice(0, 15).map(a => (
                                <button key={a.id} type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition text-slate-700"
                                  onClick={() => {
                                    updateRow(i, 'searchTerm', a.kode + ' — ' + a.nama);
                                    updateRow(i, 'akun_id', String(a.id));
                                    setOpenDropdown(null);
                                  }}
                                >
                                  <span className="font-mono text-xs text-slate-400">{highlightMatch(a.kode, row.searchTerm)}</span>
                                  <span className="ml-2">{highlightMatch(a.nama, row.searchTerm)}</span>
                                </button>
                              ));
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Keterangan */}
                      <input
                        type="text"
                        value={row.keterangan}
                        placeholder={inheritedKet || 'Keterangan'}
                        onChange={e => updateRow(i, 'keterangan', e.target.value)}
                        onKeyDown={e => handleCellKeyDown(i, 'keterangan', e)}
                        ref={el => setRef('keterangan-' + i, el)}
                        className={cellCls + (!row.keterangan && inheritedKet ? ' text-slate-400 italic' : '')}
                      />

                      {/* Debit */}
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={row.debit}
                          onChange={e => updateRow(i, 'debit', e.target.value)}
                          onBlur={() => handleCellBlur(i, 'debit')}
                          onKeyDown={e => handleCellKeyDown(i, 'debit', e)}
                          ref={el => setRef('debit-' + i, el)}
                          className={cellCls + ' text-right tabular-nums'}
                        />
                      </div>

                      {/* Kredit */}
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={row.kredit}
                          onChange={e => updateRow(i, 'kredit', e.target.value)}
                          onBlur={() => handleCellBlur(i, 'kredit')}
                          onKeyDown={e => handleCellKeyDown(i, 'kredit', e)}
                          ref={el => setRef('kredit-' + i, el)}
                          className={cellCls + ' text-right tabular-nums'}
                        />
                        {/* Auto-Balance Smart Fill button */}
                        {i === rows.length - 1 && selisih >= 1 && (
                          <button
                            type="button"
                            onClick={() => autoFillBalance(i)}
                            onKeyDown={e => { if (e.key === ' ') { e.preventDefault(); autoFillBalance(i); } }}
                            className="flex-shrink-0 w-7 h-7 rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition text-xs font-bold flex items-center justify-center"
                            title={`Isi selisih: ${formatRupiah(selisih)}`}
                          >
                            ⚡
                          </button>
                        )}
                      </div>

                      {/* Aksi */}
                      <div className="flex items-center justify-center gap-1">
                        {/* Insert row */}
                        <button type="button" onClick={() => addRow(i)} disabled={rows.length >= 50}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-500 hover:bg-emerald-100 transition text-xs font-bold disabled:opacity-30" title="Sisipkan baris">
                          +
                        </button>
                        {/* Delete row */}
                        <button type="button" onClick={() => removeRow(i)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition text-xs font-bold" title="Hapus baris">
                          ×
                        </button>
                        {/* Mobile: move up/down */}
                        <div className="sm:hidden flex flex-col">
                          <button type="button" onClick={() => moveRow(i, i - 1)} disabled={i === 0}
                            className="w-6 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 disabled:opacity-20 text-xs">↑</button>
                          <button type="button" onClick={() => moveRow(i, i + 1)} disabled={i === rows.length - 1}
                            className="w-6 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 disabled:opacity-20 text-xs">↓</button>
                        </div>
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>

          {/* Add row + 50-row max */}
          {rows.length < 50 && (
            <button type="button" onClick={() => addRow()}
              className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm font-semibold text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition">
              + Tambah Baris ({rows.length}/50)
            </button>
          )}
          {rows.length >= 50 && (
            <p className="text-xs text-amber-600 text-center font-medium">Maksimal 50 baris per batch</p>
          )}

          {/* Submit area */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="text-sm text-slate-500">
              {validRowCount} baris valid | {jurnalGroups} jurnal akan dibuat
            </div>
            <div className="flex gap-3 flex-wrap items-center">
              <button type="submit" disabled={submitting || !isBalanced || validRowCount < 2}
                className="rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting ? 'Menyimpan...' : `Simpan ${jurnalGroups} Jurnal`}
              </button>
              <button type="button" onClick={handleClearForm}
                className="text-sm text-red-500 hover:text-red-700 hover:underline font-medium transition">
                Kosongkan Form
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Riwayat Jurnal ────────────────────────────────────────── */}
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

      {/* ── Delete confirmation modal ─────────────────────────────── */}
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

      {/* ── Sticky Balance Bar ────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between text-sm flex-wrap gap-2">
          <div className="flex gap-4">
            <span>Debit: <strong className="tabular-nums">{formatRupiah(totalDebit)}</strong></span>
            <span>Kredit: <strong className="tabular-nums">{formatRupiah(totalKredit)}</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{validRowCount} baris | {jurnalGroups} jurnal</span>
            <span className={isBalanced ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
              {isBalanced ? '✅ SEIMBANG' : `❌ SELISIH: ${formatRupiah(selisih)}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
