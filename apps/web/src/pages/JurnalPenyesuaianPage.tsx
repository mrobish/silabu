import { useState, useEffect } from 'react';
import ReportPrintLayout from './ReportPrintLayout';

// ─── Types ───────────────────────────────────────────────────
interface CoAAccount {
  id: string;
  kode: string;
  nama: string;
}

interface JournalLine {
  akunId: string;
  debit: number;
  kredit: number;
  keterangan: string;
}

// ─── Helpers ─────────────────────────────────────────────────
const token = () => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';

const rupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

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

// ─── SVG Icon helper ─────────────────────────────────────────
function Icon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

// ─── Template Row Config ─────────────────────────────────────
interface TemplateRow {
  label: string;
  position: 'debit' | 'kredit' | 'any';
  filter: (account: CoAAccount) => boolean;
}

interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
  rows: TemplateRow[];
}

const TEMPLATES: TemplateConfig[] = [
  {
    id: 'beban-dibayar-dimuka',
    name: 'Beban Dibayar Dimuka',
    description: 'Beban yang sudah dibayar di muka dan perlu disesuaikan pada akhir periode.',
    icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z',
    color: 'from-violet-500 to-purple-600',
    borderColor: 'border-violet-200',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-700',
    rows: [
      { label: 'Beban Dibayar Dimuka (Debit)', position: 'debit', filter: (a) => a.kode.startsWith('1.1.06') },
      { label: 'Kas / Bank (Kredit)', position: 'kredit', filter: (a) => a.kode.startsWith('1.1.01') || a.kode.startsWith('1.1.02') },
    ],
  },
  {
    id: 'pendapatan-diterima-dimuka',
    name: 'Pendapatan Diterima Dimuka',
    description: 'Pendapatan yang sudah diterima di muka dan perlu diakui sesuai periodenya.',
    icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'from-emerald-500 to-teal-600',
    borderColor: 'border-emerald-200',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    rows: [
      { label: 'Kas / Bank (Debit)', position: 'debit', filter: (a) => a.kode.startsWith('1.1.01') || a.kode.startsWith('1.1.02') },
      { label: 'Pendapatan Diterima Dimuka (Kredit)', position: 'kredit', filter: (a) => a.kode.startsWith('2.1.03') },
    ],
  },
  {
    id: 'beban-masih-harus-dibayar',
    name: 'Beban Masih Harus Dibayar',
    description: 'Beban yang sudah terjadi tapi belum dibayar (akru beban).',
    icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'from-rose-500 to-red-600',
    borderColor: 'border-rose-200',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    rows: [
      { label: 'Beban (Debit)', position: 'debit', filter: (a) => a.kode.startsWith('6') },
      { label: 'Utang (Kredit)', position: 'kredit', filter: (a) => a.kode.startsWith('2.1.01') || a.kode.startsWith('2.1.04') },
    ],
  },
  {
    id: 'pendapatan-masih-harus-diterima',
    name: 'Pendapatan Masih Harus Diterima',
    description: 'Pendapatan yang sudah terjadi tapi belum diterima (akru pendapatan).',
    icon: 'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941',
    color: 'from-sky-500 to-blue-600',
    borderColor: 'border-sky-200',
    bgColor: 'bg-sky-50',
    textColor: 'text-sky-700',
    rows: [
      { label: 'Piutang (Debit)', position: 'debit', filter: (a) => a.kode.startsWith('1.1.03') },
      { label: 'Pendapatan (Kredit)', position: 'kredit', filter: (a) => a.kode.startsWith('4') },
    ],
  },
  {
    id: 'penyesuaian-persediaan',
    name: 'Penyesuaian Persediaan',
    description: 'Penyesuaian nilai persediaan barang / bahan sesuai hasil opname fisik.',
    icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
    color: 'from-amber-500 to-orange-600',
    borderColor: 'border-amber-200',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    rows: [
      {
        label: 'Persediaan / Beban Pokok / Beban (Bebas)',
        position: 'any',
        filter: (a) => a.kode.startsWith('1.1.05') || a.kode.startsWith('5.1') || a.kode.startsWith('6'),
      },
      {
        label: 'Persediaan / Pendapatan / Beban Pokok (Bebas)',
        position: 'any',
        filter: (a) => a.kode.startsWith('1.1.05') || a.kode.startsWith('4') || a.kode.startsWith('5'),
      },
    ],
  },
];

// ─── Line state ──────────────────────────────────────────────
interface LineState {
  akun_id: string;
  debit: string;
  kredit: string;
  keterangan: string;
  searchTerm: string;
}

const emptyLine = (): LineState => ({ akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' });

// ─── Component ───────────────────────────────────────────────
export default function JurnalPenyesuaianPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [coaAccounts, setCoaAccounts] = useState<CoAAccount[]>([]);
  const [lines, setLines] = useState<LineState[]>([emptyLine(), emptyLine()]);
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [keterangan, setKeterangan] = useState('');
  const [referensi, setReferensi] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState('');

  const template = TEMPLATES.find((t) => t.id === selectedTemplate) || null;

  // Load CoA
  useEffect(() => {
    fetch('/api/accounting/coa', { headers: { Authorization: 'Bearer ' + token() } })
      .then((r) => r.json())
      .then((d) => {
        const all: CoAAccount[] = Array.isArray(d) ? d : d.coa || d.accounts || [];
        setCoaAccounts(all.filter((a: any) => a.isPostable ?? a.is_postable));
      })
      .catch(() => {});
  }, []);

  // Select template: reset form
  function selectTemplate(id: string) {
    setSelectedTemplate(id);
    setLines([emptyLine(), emptyLine()]);
    setKeterangan('');
    setReferensi('');
    setTanggal(new Date().toISOString().slice(0, 10));
    setError('');
    setShowSuccess('');
  }

  // Cancel template
  function cancelTemplate() {
    setSelectedTemplate(null);
    setLines([emptyLine(), emptyLine()]);
    setKeterangan('');
    setReferensi('');
    setError('');
    setShowSuccess('');
  }

  // Update a line field
  function updateLine(i: number, field: string, val: string) {
    if (!template) return;
    setLines((prev) => {
      let next = prev.map((l, idx) => {
        if (idx !== i) return l;
        let storeVal = val;
        if (field === 'debit' || field === 'kredit') {
          storeVal = formatCurrencyDisplay(val);
        }
        const updated = { ...l, [field]: storeVal };

        // Single-side rule: only when position='any'
        const rowCfg = template.rows[idx];
        if (rowCfg && rowCfg.position === 'any') {
          if (field === 'debit' && parseCurrencyInput(val) > 0) updated.kredit = '';
          if (field === 'kredit' && parseCurrencyInput(val) > 0) updated.debit = '';
        }

        // If selecting an account, set akun_id and searchTerm
        return updated;
      });

      // Auto-add row when last row gets filled (max 5)
      const last = next[next.length - 1];
      const lastTouched = last.akun_id || last.debit || last.kredit || last.keterangan || last.searchTerm;
      if (i === next.length - 1 && lastTouched && next.length < 5) {
        next = [...next, emptyLine()];
      }
      return next;
    });
  }

  // Remove a line
  function removeLine(i: number) {
    setLines((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, idx) => idx !== i);
    });
  }

  // Totals
  const totalDebit = lines.reduce((s, l) => s + parseCurrencyInput(l.debit), 0);
  const totalKredit = lines.reduce((s, l) => s + parseCurrencyInput(l.kredit), 0);
  const isBalanced = Math.abs(totalDebit - totalKredit) < 0.01 && totalDebit > 0;
  const validLines = lines.filter((l) => l.akun_id && (parseCurrencyInput(l.debit) > 0 || parseCurrencyInput(l.kredit) > 0));
  const canSubmit = isBalanced && validLines.length >= 2 && !!tanggal && !!keterangan.trim() && !submitting;

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    setShowSuccess('');
    try {
      const payload = {
        tanggal,
        keterangan,
        referensi: referensi.trim() || undefined,
        lines: validLines.map((l) => ({
          akun_id: l.akun_id,
          debit: parseCurrencyInput(l.debit),
          kredit: parseCurrencyInput(l.kredit),
          keterangan: l.keterangan,
        })),
        tipeTransaksi: 'ADJUSTMENT',
      };
      const res = await fetch('/api/accounting/jurnal-umum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan jurnal penyesuaian');
      const no = data.no_jurnal || data.entry?.no_jurnal || data.jurnal?.no_jurnal || '';
      setShowSuccess('Jurnal penyesuaian berhasil disimpan' + (no ? ': ' + no : ''));
      setLines([emptyLine(), emptyLine()]);
      setKeterangan('');
      setReferensi('');
      setTanggal(new Date().toISOString().slice(0, 10));
      setSelectedTemplate(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Get filtered accounts for a given row index
  function getFilteredAccounts(rowIndex: number): CoAAccount[] {
    if (!template || !template.rows[rowIndex]) return [];
    return coaAccounts.filter(template.rows[rowIndex].filter);
  }

  // Input styling
  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none';
  const inputDisabledCls = ' bg-slate-100 text-slate-400 cursor-not-allowed';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Jurnal Penyesuaian</h1>
          <p className="text-sm text-slate-500">Pilih template pintar untuk mencatat jurnal penyesuaian akhir periode BUM Desa.</p>
        </div>
      </div>

      {/* Alerts */}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
      {showSuccess && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{showSuccess}</div>}

      {/* Template Selection Grid */}
      {!selectedTemplate && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTemplate(t.id)}
              className={`group relative text-left rounded-2xl border-2 ${t.borderColor} bg-white p-5 transition hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5 active:scale-[0.98]`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${t.color} flex items-center justify-center flex-shrink-0`}>
                  <Icon d={t.icon} className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition">{t.name}</h3>
                  <p className="mt-1 text-sm text-slate-500 leading-relaxed">{t.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.rows.map((r, ri) => (
                      <span
                        key={ri}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                          r.position === 'debit'
                            ? 'bg-blue-50 text-blue-600'
                            : r.position === 'kredit'
                            ? 'bg-purple-50 text-purple-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}
                      >
                        {r.position === 'debit' ? 'Debit' : r.position === 'kredit' ? 'Kredit' : 'Bebas'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Form Area */}
      {template && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Template header badge */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center`}>
                <Icon d={template.icon} className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{template.name}</h2>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-violet-100 text-violet-700">
                    Jurnal Penyesuaian
                  </span>
                </div>
                <p className="text-xs text-slate-500">{template.description}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={cancelTemplate}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              ✕ Batal
            </button>
          </div>

          {/* Metadata fields */}
          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-xl space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Tanggal <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Keterangan <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Deskripsi penyesuaian..."
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  No. Referensi <span className="text-slate-400 font-normal">(opsional)</span>
                </label>
                <input
                  type="text"
                  value={referensi}
                  onChange={(e) => setReferensi(e.target.value)}
                  placeholder="No. dokumen/nota"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Lines */}
            <div className="space-y-3">
              {/* Column headers */}
              <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide px-1">
                <div className="col-span-4">Akun</div>
                <div className="col-span-3">Debit (Rp)</div>
                <div className="col-span-3">Kredit (Rp)</div>
                <div className="col-span-2 text-center">Posisi</div>
              </div>

              {lines.map((line, i) => {
                const rowCfg = template.rows[i] || { label: 'Baris Tambahan', position: 'any' as const, filter: () => true };
                const isDebitLocked = rowCfg.position === 'kredit';
                const isKreditLocked = rowCfg.position === 'debit';
                const filteredAccounts = getFilteredAccounts(i);

                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start">
                    {/* Account picker */}
                    <div className="col-span-4">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder={i < template.rows.length ? template.rows[i].label.split('(')[0].trim() + '...' : 'Cari akun...'}
                          value={line.searchTerm || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateLine(i, 'searchTerm', val);
                            // If account was selected, clear selection when user edits text
                            if (line.akun_id) {
                              const selected = filteredAccounts.find((a) => String(a.id) === line.akun_id);
                              const selectedText = selected ? selected.kode + ' — ' + selected.nama : '';
                              if (val !== selectedText) {
                                updateLine(i, 'akun_id', '');
                              }
                            } else {
                              // auto-select if exact match by kode
                              const match = filteredAccounts.find((a) => a.kode === val || a.nama.toLowerCase() === val.toLowerCase());
                              if (match) {
                                updateLine(i, 'akun_id', String(match.id));
                              }
                            }
                          }}
                          onFocus={() => {
                            // Show dropdown if no account selected yet
                          }}
                          className={inputCls}
                        />
                        {/* Dropdown: show when typing and no account selected */}
                        {line.searchTerm && line.searchTerm.length > 0 && !line.akun_id && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto">
                            {(() => {
                              const q = (line.searchTerm || '').toLowerCase();
                              const matches = q
                                ? filteredAccounts.filter((a) => a.kode.toLowerCase().includes(q) || a.nama.toLowerCase().includes(q))
                                : filteredAccounts;
                              if (matches.length === 0) {
                                return (
                                  <p className="px-3 py-2 text-sm text-slate-400 italic">Akun tidak ditemukan</p>
                                );
                              }
                              return matches.map((a) => (
                                <button
                                  key={a.id}
                                  type="button"
                                  className={
                                    'w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition ' +
                                    (String(a.id) === line.akun_id ? 'bg-emerald-50 font-medium text-emerald-700' : 'text-slate-700')
                                  }
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

                    {/* Debit input */}
                    <div className="col-span-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={line.debit}
                        disabled={isDebitLocked}
                        onChange={(e) => updateLine(i, 'debit', e.target.value)}
                        className={inputCls + (isDebitLocked ? inputDisabledCls : '')}
                      />
                    </div>

                    {/* Kredit input */}
                    <div className="col-span-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={line.kredit}
                        disabled={isKreditLocked}
                        onChange={(e) => updateLine(i, 'kredit', e.target.value)}
                        className={inputCls + (isKreditLocked ? inputDisabledCls : '')}
                      />
                    </div>

                    {/* Position badge + actions */}
                    <div className="col-span-2 flex flex-col items-center gap-1.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                          rowCfg.position === 'debit'
                            ? 'bg-blue-50 text-blue-600'
                            : rowCfg.position === 'kredit'
                            ? 'bg-purple-50 text-purple-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}
                      >
                        {rowCfg.position === 'debit' ? 'Debit Only' : rowCfg.position === 'kredit' ? 'Kredit Only' : 'Bebas'}
                      </span>
                      {lines.length > 2 && i >= template.rows.length && (
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition text-xs font-bold"
                          title="Hapus baris"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals + Submit */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap gap-6 text-sm">
                <span>
                  Total Debit: <strong className="text-slate-900 tabular-nums">{rupiah(totalDebit)}</strong>
                </span>
                <span>
                  Total Kredit: <strong className="text-slate-900 tabular-nums">{rupiah(totalKredit)}</strong>
                </span>
                <span className={isBalanced ? 'text-emerald-600 font-bold' : totalDebit > 0 || totalKredit > 0 ? 'text-red-600 font-bold' : 'text-slate-400 font-medium'}>
                  {totalDebit === 0 && totalKredit === 0 ? 'Belum ada nominal' : isBalanced ? '✓ Seimbang' : '✗ Belum Seimbang'}
                </span>
              </div>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Jurnal Penyesuaian'}
              </button>
            </div>

            {!isBalanced && validLines.length > 0 && (
              <p className="text-xs text-red-600 font-medium">Jurnal belum seimbang. Pastikan Total Debit sama dengan Total Kredit.</p>
            )}
            {validLines.length === 0 && (
              <p className="text-xs text-slate-400 font-medium">Isi minimal dua baris akun dengan nominal untuk mengaktifkan tombol Simpan.</p>
            )}
          </div>
        </form>
      )}

      {/* Info box when no template selected */}
      {!selectedTemplate && (
        <div className="p-4 bg-violet-50 border border-violet-200/60 rounded-xl text-sm text-violet-800">
          <p className="font-semibold mb-2">Tentang Jurnal Penyesuaian</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Jurnal penyesuaian dibuat di akhir periode akuntansi.</li>
            <li>Pilih salah satu template di atas untuk memulai dengan cepat.</li>
            <li>Setiap template menentukan posisi Debit/Kredit secara otomatis.</li>
            <li>Total Debit harus sama persis dengan Total Kredit.</li>
            <li>Jurnal yang tersimpan bertipe <code className="bg-violet-100 px-1 rounded text-xs">ADJUSTMENT</code>.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
