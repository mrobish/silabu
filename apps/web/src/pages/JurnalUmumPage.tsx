import React, { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';

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

interface HeaderState {
  tanggal: string;
  no_bukti: string;
  keterangan: string;
}

interface LineState {
  id: string;
  akun_id: string;
  searchTerm: string;
  debit: string;
  kredit: string;
  keterangan: string;
  contact_id: string;
  inventory_item_id: string;
  qty: string;
}

// Batch mode flat row (legacy compatibility)
interface FlatRow {
  id: string;
  tanggal: string;
  no_bukti: string;
  keterangan: string;
  akun_id: string;
  debit: string;
  kredit: string;
  searchTerm: string;
  contact_id: string;
  inventory_item_id: string;
  qty: string;
}

interface DraftV2 {
  version: 2;
  header: HeaderState;
  lines: LineState[];
  savedAt: string;
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

function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function emptyLine(): LineState {
  return { id: makeId(), akun_id: '', searchTerm: '', debit: '', kredit: '', keterangan: '', contact_id: '', inventory_item_id: '', qty: '' };
}

function emptyHeader(): HeaderState {
  return { tanggal: today(), no_bukti: '', keterangan: '' };
}

function emptyFlatRow(): FlatRow {
  return { id: makeId(), tanggal: '', no_bukti: '', keterangan: '', akun_id: '', debit: '', kredit: '', searchTerm: '', contact_id: '', inventory_item_id: '', qty: '' };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function getTenantId(): string {
  try {
    const token = getToken();
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.tenantId || 'unknown';
  } catch { return 'unknown'; }
}

function getDraftKeyV2(): string {
  return 'jurnal-draft-v2-' + getTenantId();
}

function getDraftKeyLegacy(): string {
  return 'jurnal-batch-draft-' + getTenantId();
}

function getDraftKeyOld(): string {
  return 'jurnal-draft-' + getTenantId();
}

// ─── Smart Templates ─────────────────────────────────────
interface TemplateLink {
  from: { row: number; field: 'debit' | 'kredit' };
  to: { row: number; field: 'debit' | 'kredit' };
}
interface TemplateDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  keterangan: string;
  rows: { kode: string }[];
  links: TemplateLink[];
  kasRowIndex: number;
}
const TEMPLATES: TemplateDef[] = [
  {
    id: 'penjualan',
    name: 'Penjualan Tunai',
    icon: '💰',
    description: 'Penjualan + HPP otomatis (4 baris)',
    keterangan: 'Penjualan Barang Dagangan',
    rows: [
      { kode: '1.1.01.01' },
      { kode: '4.1.01.01' },
      { kode: '5.1.01.01' },
      { kode: '1.1.05.01' },
    ],
    links: [
      { from: { row: 0, field: 'debit' }, to: { row: 1, field: 'kredit' } },
      { from: { row: 2, field: 'debit' }, to: { row: 3, field: 'kredit' } },
    ],
    kasRowIndex: 0,
  },
  {
    id: 'pembelian',
    name: 'Pembelian Persediaan',
    icon: '📦',
    description: 'Beli stok dari kas/bank (2 baris)',
    keterangan: 'Pembelian Stok Persediaan',
    rows: [
      { kode: '1.1.05.01' },
      { kode: '1.1.01.01' },
    ],
    links: [
      { from: { row: 0, field: 'debit' }, to: { row: 1, field: 'kredit' } },
    ],
    kasRowIndex: 1,
  },
  {
    id: 'beban',
    name: 'Beban Operasional',
    icon: '🏢',
    description: 'Catat beban dari kas/bank (2 baris)',
    keterangan: 'Beban Operasional',
    rows: [
      { kode: '6.1.01.01' },
      { kode: '1.1.01.01' },
    ],
    links: [
      { from: { row: 0, field: 'debit' }, to: { row: 1, field: 'kredit' } },
    ],
    kasRowIndex: 1,
  },
];

// ─── Smart Partnering: counter-account suggestions ───────
const PARTNER_MAP: Record<string, string[]> = {
  '1.1.01': ['4.1.01.01', '4.2.01.01', '3.1.01.01'],   // Kas → Pendapatan, Pend Lain, Modal
  '1.1.02': ['4.1.01.01', '4.2.01.01', '3.1.01.01'],   // Bank → same
  '1.1.05': ['5.1.01.01', '1.1.01.01'],                  // Persediaan → HPP, Kas
  '2.1.01': ['1.1.01.01', '1.1.02.01'],                  // Utang → Kas, Bank
  '3.1.01': ['1.1.01.01', '1.1.02.01'],                  // Modal → Kas, Bank
  '4.1.01': ['1.1.01.01', '1.1.02.01', '1.1.03.01'],    // Pendapatan → Kas, Bank, Piutang
  '4.2.01': ['1.1.01.01', '1.1.02.01'],                  // Pend Lain → Kas, Bank
  '5.1.01': ['1.1.05.01', '1.1.01.01'],                  // HPP → Persediaan, Kas
  '6.1.01': ['1.1.01.01', '1.1.02.01', '2.1.01.01'],    // Beban → Kas, Bank, Utang
};

function getPartnerKodes(lineKode: string): string[] {
  if (!lineKode) return [];
  // Try exact match first, then prefix match
  for (const [prefix, partners] of Object.entries(PARTNER_MAP)) {
    if (lineKode.startsWith(prefix)) return partners;
  }
  return [];
}

// ─── Math eval ────────────────────────────────────────────
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

// ─── Icons ───────────────────────────────────────────────────
function Icon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
      <path d={d} />
    </svg>
  );
}

const jurnalIcon = 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h6m-6 4h6';

// ─── Fuzzy search ────────────────────────────────────────────
function fuzzyAccountFilter(accounts: CoAAccount[], q: string, boostIds: Set<number> = new Set()): CoAAccount[] {
  if (!q && boostIds.size === 0) return accounts;
  const lower = (q || '').toLowerCase();
  const scored: { account: CoAAccount; score: number }[] = [];
  for (const a of accounts) {
    const kodeLower = a.kode.toLowerCase();
    const namaLower = a.nama.toLowerCase();
    let score = 0;
    if (boostIds.has(a.id)) score = 500; // Smart Partner boost
    else if (kodeLower.startsWith(lower)) score = 400;
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

// ─── Shared Validation ───────────────────────────────────────
function validateJournal(header: HeaderState, lines: LineState[]): string | null {
  if (!header.tanggal) return 'Tanggal wajib diisi';
  if (!header.keterangan.trim()) return 'Keterangan wajib diisi';
  const validLines = lines.filter(l => l.akun_id && (parseCurrencyInput(l.debit) > 0 || parseCurrencyInput(l.kredit) > 0));
  if (validLines.length < 2) return 'Minimal 2 baris dengan akun dan nominal diperlukan';
  const totalD = validLines.reduce((s, l) => s + parseCurrencyInput(l.debit), 0);
  const totalK = validLines.reduce((s, l) => s + parseCurrencyInput(l.kredit), 0);
  if (Math.abs(totalD - totalK) >= 0.01) return 'Total debit dan kredit harus seimbang';
  return null; // valid
}

// ─── DetailRow (React.memo for performance) ──────────────────
interface DetailRowProps {
  line: LineState;
  index: number;
  coaAccounts: CoAAccount[];
  partnerKodes: string[];
  templateLinks: TemplateLink[];
  activeTemplate: string | null;
  kasRowIndex: number | null;
  totalDebit: number;
  totalKredit: number;
  selisih: number;
  isLast: boolean;
  contacts: any[];
  inventoryItems: any[];
  onUpdate: (index: number, field: keyof LineState, val: string) => void;
  onRemove: (index: number) => void;
  onBlur: (index: number, field: 'debit' | 'kredit') => void;
  onAutoFill: (index: number) => void;
  onOpenDropdown: (index: number | null) => void;
  openDropdown: number | null;
  onOpenTag: (index: number | null) => void;
  openTag: number | null;
  lineRefs: React.MutableRefObject<Map<string, HTMLElement | null>>;
  getKasBankAccounts: () => CoAAccount[];
  onChangeKas: (rowIdx: number, newAkunId: string) => void;
  showAutoFillSuggestion: boolean;
}

const DetailRowInner = React.memo(function DetailRowInner({
  line, index, coaAccounts, partnerKodes, templateLinks, activeTemplate, kasRowIndex,
  totalDebit, totalKredit, selisih, isLast, contacts, inventoryItems,
  onUpdate, onRemove, onBlur, onAutoFill, onOpenDropdown, openDropdown,
  onOpenTag, openTag, lineRefs, getKasBankAccounts, onChangeKas, showAutoFillSuggestion,
}: DetailRowProps) {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const tagPopoverRef = useRef<HTMLDivElement | null>(null);
  const cellCls = 'w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none focus:z-10 relative';

  const isAutoFilled = (field: 'debit' | 'kredit') => templateLinks.some(l => l.to.row === index && l.to.field === field);

  // Smart Partner boost IDs
  const boostIds = useMemo(() => {
    const ids = new Set<number>();
    for (const kode of partnerKodes) {
      const acc = coaAccounts.find(a => a.kode === kode);
      if (acc) ids.add(acc.id);
    }
    return ids;
  }, [partnerKodes, coaAccounts]);

  return (
    <tr className="group hover:bg-slate-50/50 transition">
      {/* Akun */}
      <td className="px-2 py-1.5">
        <div className="relative" ref={openDropdown === index ? dropdownRef : undefined}>
          {activeTemplate && kasRowIndex === index && (
            <select
              value={line.akun_id}
              onChange={e => onChangeKas(index, e.target.value)}
              className="w-full rounded-lg border border-emerald-200 bg-emerald-50/50 px-2 py-1 text-xs text-emerald-800 font-medium mb-1 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none appearance-none cursor-pointer"
            >
              {getKasBankAccounts().map(a => (
                <option key={a.id} value={a.id}>{a.kode} — {a.nama}</option>
              ))}
            </select>
          )}
          <input
            type="text"
            placeholder="Cari akun..."
            value={line.searchTerm || ''}
            onChange={e => {
              const val = e.target.value;
              onUpdate(index, 'searchTerm', val);
              if (line.akun_id) {
                const selected = coaAccounts.find(a => String(a.id) === line.akun_id);
                const selectedText = selected ? (selected.kode + ' — ' + selected.nama) : '';
                if (val !== selectedText) onUpdate(index, 'akun_id', '');
              }
              onOpenDropdown(index);
            }}
            onFocus={() => onOpenDropdown(index)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); lineRefs.current.get('debit-' + index)?.focus(); }
            }}
            ref={el => lineRefs.current.set('akun-' + index, el)}
            className={cellCls}
          />
          {openDropdown === index && (line.searchTerm || '').length > 0 && !line.akun_id && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto">
              {(() => {
                const matches = fuzzyAccountFilter(coaAccounts, line.searchTerm, boostIds);
                if (matches.length === 0) return <p className="px-3 py-2 text-sm text-slate-400 italic">Akun tidak ditemukan</p>;
                return matches.slice(0, 15).map(a => (
                  <button key={a.id} type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition text-slate-700"
                    onClick={() => {
                      onUpdate(index, 'searchTerm', a.kode + ' — ' + a.nama);
                      onUpdate(index, 'akun_id', String(a.id));
                      onOpenDropdown(null);
                    }}
                  >
                    {boostIds.has(a.id) && <span className="text-[10px] text-amber-500 mr-1">⭐</span>}
                    <span className="font-mono text-xs text-slate-400">{highlightMatch(a.kode, line.searchTerm)}</span>
                    <span className="ml-2">{highlightMatch(a.nama, line.searchTerm)}</span>
                  </button>
                ));
              })()}
            </div>
          )}
        </div>
      </td>

      {/* Debit */}
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1 relative">
          {isAutoFilled('debit') && <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-amber-400 pointer-events-none z-10">🔗</span>}
          {showAutoFillSuggestion && !line.debit && !line.kredit && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-400 pointer-events-none z-10">⚡ auto</span>
          )}
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={line.debit}
            onChange={e => onUpdate(index, 'debit', e.target.value)}
            onBlur={() => onBlur(index, 'debit')}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); lineRefs.current.get('kredit-' + index)?.focus(); }
            }}
            ref={el => lineRefs.current.set('debit-' + index, el)}
            className={cellCls + ' text-right tabular-nums' + (isAutoFilled('debit') ? ' bg-amber-50/50 border-amber-200/50' : '')}
          />
        </div>
      </td>

      {/* Kredit */}
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1 relative">
          {isAutoFilled('kredit') && <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-amber-400 pointer-events-none z-10">🔗</span>}
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={line.kredit}
            onChange={e => onUpdate(index, 'kredit', e.target.value)}
            onBlur={() => onBlur(index, 'kredit')}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                // Next line or add new line
                const nextAkun = lineRefs.current.get('akun-' + (index + 1));
                if (nextAkun) nextAkun.focus();
                else document.dispatchEvent(new CustomEvent('jurnal-add-line'));
              }
            }}
            ref={el => lineRefs.current.set('kredit-' + index, el)}
            className={cellCls + ' text-right tabular-nums' + (isAutoFilled('kredit') ? ' bg-amber-50/50 border-amber-200/50' : '')}
          />
          {/* ⚡ Auto-Balance */}
          {isLast && selisih >= 1 && (
            <button
              type="button"
              onClick={() => onAutoFill(index)}
              className="flex-shrink-0 w-7 h-7 rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition text-xs font-bold flex items-center justify-center"
              title={`Isi selisih: ${formatRupiah(selisih)}`}
            >⚡</button>
          )}
        </div>
      </td>

      {/* Aksi */}
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1">
          {/* Tag button */}
          <div className="relative" ref={openTag === index ? tagPopoverRef : undefined}>
            <button type="button" onClick={() => onOpenTag(openTag === index ? null : index)}
              className={"w-7 h-7 flex items-center justify-center rounded-lg transition text-xs font-bold relative " + (
                (line.contact_id || line.inventory_item_id)
                  ? 'bg-emerald-50 text-emerald-500 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-300 hover:bg-slate-100 hover:text-slate-500'
              )} title="Tag kontak/persediaan">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
              {line.contact_id && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-500 ring-1 ring-white" />}
              {line.inventory_item_id && <span className={"absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white" + (line.contact_id ? ' -right-0.5' : '')} />}
            </button>
            {openTag === index && (
              <div className="absolute z-50 top-full right-0 mt-1 w-[280px] bg-white rounded-xl shadow-xl border border-slate-200 p-3 space-y-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Kontak (Opsional)</label>
                  <select value={line.contact_id} onChange={e => onUpdate(index, 'contact_id', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none">
                    <option value="">— Pilih Kontak —</option>
                    {contacts.map((c: any) => <option key={c.id} value={c.id}>{c.nama} ({c.tipe})</option>)}
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Persediaan (Opsional)</label>
                  <select value={line.inventory_item_id} onChange={e => onUpdate(index, 'inventory_item_id', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none">
                    <option value="">— Pilih Barang —</option>
                    {inventoryItems.map((item: any) => <option key={item.id} value={item.id}>{item.nama} ({item.kode}) — {item.satuan}</option>)}
                  </select>
                </div>
                {line.inventory_item_id && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Jumlah</label>
                    <input type="number" inputMode="numeric" placeholder="0" value={line.qty}
                      onChange={e => onUpdate(index, 'qty', e.target.value)}
                      className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm" min="0" step="any" />
                  </div>
                )}
                <button type="button" onClick={() => onOpenTag(null)}
                  className="w-full py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition rounded-lg hover:bg-slate-50">Tutup</button>
              </div>
            )}
          </div>
          {/* Delete */}
          <button type="button" onClick={() => onRemove(index)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition text-xs font-bold" title="Hapus baris">×</button>
        </div>
      </td>
    </tr>
  );
});

// ─── Main Component ──────────────────────────────────────────
export default function JurnalUmumPage({ setPage }: { setPage: (p: any) => void }) {
  // ── State ───────────────────────────────────────────────
  const [coaAccounts, setCoaAccounts] = useState<CoAAccount[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState('');
  const [toast, setToast] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);

  // Master-Detail state
  const [header, setHeader] = useState<HeaderState>(emptyHeader());
  const [lines, setLines] = useState<LineState[]>([emptyLine(), emptyLine()]);

  // Batch mode (legacy flat rows)
  const [batchMode, setBatchMode] = useState(false);
  const [flatRows, setFlatRows] = useState<FlatRow[]>([emptyFlatRow(), emptyFlatRow()]);

  // Mode & templates
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [templateLinks, setTemplateLinks] = useState<TemplateLink[]>([]);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHeader, setEditHeader] = useState<HeaderState>(emptyHeader());
  const [editLines, setEditLines] = useState<{ akun_id: string; debit: string; kredit: string; keterangan: string; searchTerm: string }[]>([]);
  const [editReferensi, setEditReferensi] = useState('');

  // Delete modal
  const [deleteModal, setDeleteModal] = useState<JournalEntry | null>(null);
  const [confirmText, setConfirmText] = useState('');

  // Dropdowns & popovers
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [openTagPopover, setOpenTagPopover] = useState<number | null>(null);

  // Draft recovery
  const [draftRecovery, setDraftRecovery] = useState<DraftV2 | null>(null);

  // Focus management
  const lineRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const tagPopoverRef = useRef<HTMLDivElement | null>(null);
  const templateDropdownRef = useRef<HTMLDivElement | null>(null);

  // ── Toast ───────────────────────────────────────────────
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  // ── Derived values ──────────────────────────────────────
  const currentLines = batchMode ? [] : lines;
  const totalDebit = batchMode
    ? flatRows.reduce((s, r) => s + parseCurrencyInput(r.debit), 0)
    : currentLines.reduce((s, l) => s + parseCurrencyInput(l.debit), 0);
  const totalKredit = batchMode
    ? flatRows.reduce((s, r) => s + parseCurrencyInput(r.kredit), 0)
    : currentLines.reduce((s, l) => s + parseCurrencyInput(l.kredit), 0);
  const isBalanced = Math.abs(totalDebit - totalKredit) < 0.01;
  const selisih = Math.abs(totalDebit - totalKredit);
  const validRowCount = batchMode
    ? flatRows.filter(r => r.akun_id && (parseCurrencyInput(r.debit) > 0 || parseCurrencyInput(r.kredit) > 0)).length
    : currentLines.filter(l => l.akun_id && (parseCurrencyInput(l.debit) > 0 || parseCurrencyInput(l.kredit) > 0)).length;

  // Smart Partner: get partner kodes from the last filled line
  const partnerKodes = useMemo(() => {
    if (batchMode) return [];
    const filledLines = currentLines.filter(l => l.akun_id);
    if (filledLines.length === 0) return [];
    const lastLine = filledLines[filledLines.length - 1];
    const account = coaAccounts.find(a => String(a.id) === lastLine.akun_id);
    return account ? getPartnerKodes(account.kode) : [];
  }, [currentLines, coaAccounts, batchMode]);

  // Auto-fill suggestion: show on empty line if previous line has value
  const showAutoFillSuggestion = useMemo(() => {
    if (batchMode || currentLines.length < 2) return false;
    const last = currentLines[currentLines.length - 1];
    const prev = currentLines[currentLines.length - 2];
    if (!last || !prev) return false;
    const lastEmpty = !last.debit && !last.kredit;
    const prevHasValue = parseCurrencyInput(prev.debit) > 0 || parseCurrencyInput(prev.kredit) > 0;
    return lastEmpty && prevHasValue;
  }, [currentLines, batchMode]);

  // ── Fetch data + draft recovery ─────────────────────────
  useEffect(() => {
    // Clear legacy draft keys
    try { localStorage.removeItem(getDraftKeyLegacy()); } catch {}
    try { localStorage.removeItem(getDraftKeyOld()); } catch {}

    const t = getToken();
    Promise.all([
      fetch('/api/accounting/coa', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      fetch('/api/accounting/jurnal-umum?limit=20', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      fetch('/api/accounting/contacts', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => ({ contacts: [] })),
      fetch('/api/accounting/inventory-items', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).catch(() => ({ items: [] })),
    ])
      .then(([coaData, jurnalData, contactData, itemData]) => {
        const all: CoAAccount[] = (Array.isArray(coaData) ? coaData : coaData.coa || coaData.accounts || []);
        setCoaAccounts(all.filter((a: CoAAccount) => a.isPostable ?? a.is_postable));
        setEntries(Array.isArray(jurnalData) ? jurnalData : jurnalData.entries || jurnalData.data || []);
        setContacts(Array.isArray(contactData) ? contactData : contactData.contacts || []);
        setInventoryItems(Array.isArray(itemData) ? itemData : itemData.items || []);
      })
      .catch(e => setError(e.message || 'Gagal memuat data'))
      .finally(() => {
        setLoading(false);
        // Check for V2 draft — show recovery dialog
        try {
          const key = getDraftKeyV2();
          const draft = localStorage.getItem(key);
          if (draft) {
            const parsed = JSON.parse(draft);
            if (parsed.version === 2 && parsed.lines?.length > 0) {
              setDraftRecovery(parsed);
            }
          }
        } catch {}
      });
  }, []);

  // ── Close dropdowns on outside click ────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpenDropdown(null);
      if (tagPopoverRef.current && !tagPopoverRef.current.contains(e.target as Node)) setOpenTagPopover(null);
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(e.target as Node)) setTemplateDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Auto-save draft (debounced 1s) ──────────────────────
  useEffect(() => {
    if (editingId || draftRecovery) return;
    const hasData = batchMode
      ? flatRows.some(r => r.tanggal || r.no_bukti || r.keterangan || r.akun_id || r.debit || r.kredit)
      : (header.tanggal !== today() || header.no_bukti || header.keterangan || lines.some(l => l.akun_id || l.debit || l.kredit));
    if (!hasData) return;
    const timer = setTimeout(() => {
      try {
        if (batchMode) {
          // Save flat rows in legacy format
          localStorage.setItem(getDraftKeyLegacy(), JSON.stringify({ rows: flatRows, savedAt: new Date().toISOString() }));
        } else {
          const draft: DraftV2 = { version: 2, header, lines, savedAt: new Date().toISOString() };
          localStorage.setItem(getDraftKeyV2(), JSON.stringify(draft));
        }
      } catch {}
    }, 1000);
    return () => clearTimeout(timer);
  }, [header, lines, flatRows, batchMode, editingId, draftRecovery]);

  // ── Listen for custom event from DetailRow (Enter on last kredit) ──
  useEffect(() => {
    function handleAddLine() { addLine(); }
    document.addEventListener('jurnal-add-line', handleAddLine);
    return () => document.removeEventListener('jurnal-add-line', handleAddLine);
  }, [lines]);

  // ── Draft recovery handlers ─────────────────────────────
  function restoreDraft() {
    if (!draftRecovery) return;
    setHeader(draftRecovery.header);
    setLines(draftRecovery.lines.map(l => ({ ...l, id: l.id || makeId() })));
    setDraftRecovery(null);
    showToast('📋 Draft berhasil dipulihkan');
  }

  function discardDraft() {
    try { localStorage.removeItem(getDraftKeyV2()); } catch {}
    setDraftRecovery(null);
    showToast('🗑️ Draft dibuang');
  }

  // ── Header update ───────────────────────────────────────
  function updateHeader(field: keyof HeaderState, val: string) {
    setHeader(prev => ({ ...prev, [field]: val }));
  }

  // ── Line management (Master-Detail) ─────────────────────
  const updateLine = useCallback((index: number, field: keyof LineState, val: string) => {
    setLines(prev => {
      let next = prev.map((l, i) => {
        if (i !== index) return l;
        let storeVal = val;
        if (field === 'debit' || field === 'kredit') {
          storeVal = formatCurrencyDisplay(val);
        }
        const updated = { ...l, [field]: storeVal };
        // Mutual exclusion: debit clears kredit and vice versa
        if (field === 'debit' && parseCurrencyInput(val) > 0) updated.kredit = '';
        if (field === 'kredit' && parseCurrencyInput(val) > 0) updated.debit = '';
        return updated;
      });
      // Smart Link propagation
      for (const link of templateLinks) {
        if (link.from.row === index && link.from.field === field) {
          const sourceVal = next[index][field];
          next = next.map((l, i) => i !== link.to.row ? l : { ...l, [link.to.field]: sourceVal });
        }
      }
      return next;
    });
  }, [templateLinks]);

  const removeLine = useCallback((index: number) => {
    setLines(prev => {
      if (prev.length <= 2) return prev.map((l, i) => i === index ? emptyLine() : l);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  function addLine() {
    if (lines.length >= 50) return;
    const newLine = emptyLine();
    // Smart Autofill: mirror opposite side from last filled line
    const lastFilled = [...lines].reverse().find(l => l.akun_id && (parseCurrencyInput(l.debit) > 0 || parseCurrencyInput(l.kredit) > 0));
    if (lastFilled) {
      if (parseCurrencyInput(lastFilled.debit) > 0) {
        newLine.kredit = lastFilled.debit;
      } else if (parseCurrencyInput(lastFilled.kredit) > 0) {
        newLine.debit = lastFilled.kredit;
      }
    }
    setLines(prev => [...prev, newLine]);
    setTimeout(() => lineRefs.current.get('akun-' + lines.length)?.focus(), 50);
  }

  // ── In-cell math ────────────────────────────────────────
  function handleCellBlur(index: number, field: 'debit' | 'kredit') {
    const raw = lines[index][field];
    if (!raw || !/[+\-*\/]/.test(raw)) return;
    const result = safeMathEval(raw);
    if (result !== null && result >= 0) {
      updateLine(index, field, String(result));
    } else {
      showToast('Format matematika tidak valid');
      updateLine(index, field, raw.replace(/[^\d]/g, ''));
    }
  }

  // ── Auto-Balance ⚡ ────────────────────────────────────
  function autoFillBalance(index: number) {
    if (selisih < 1) return;
    const currentDebit = parseCurrencyInput(lines[index].debit);
    const currentKredit = parseCurrencyInput(lines[index].kredit);
    if (currentDebit > 0 || currentKredit > 0) {
      if (totalKredit > totalDebit && currentDebit === 0) updateLine(index, 'debit', String(Math.round(selisih)));
      else if (totalDebit > totalKredit && currentKredit === 0) updateLine(index, 'kredit', String(Math.round(selisih)));
      else showToast('Baris sudah terisi, gunakan baris kosong');
    } else {
      if (totalKredit > totalDebit) updateLine(index, 'debit', String(Math.round(selisih)));
      else updateLine(index, 'kredit', String(Math.round(selisih)));
    }
  }

  // ── Kas/Bank helpers for templates ──────────────────────
  function getKasBankAccounts(): CoAAccount[] {
    return coaAccounts.filter(a => a.kode?.startsWith('1.1.01.') && (a.isPostable ?? a.is_postable));
  }

  function changeKasAccount(rowIdx: number, newAkunId: string) {
    const account = coaAccounts.find(a => String(a.id) === newAkunId);
    if (!account) return;
    setLines(prev => prev.map((l, i) => i !== rowIdx ? l : { ...l, akun_id: newAkunId, searchTerm: account.kode + ' — ' + account.nama }));
  }

  // ── Smart Templates ─────────────────────────────────────
  function applyTemplate(tmpl: TemplateDef) {
    const hasData = lines.some(l => l.akun_id || parseCurrencyInput(l.debit) > 0 || parseCurrencyInput(l.kredit) > 0);
    if (hasData && !confirm('Template akan mengganti baris yang sudah ada. Lanjutkan?')) return;
    setHeader(prev => ({ ...prev, keterangan: tmpl.keterangan, tanggal: prev.tanggal || today() }));
    const newLines = tmpl.rows.map(r => {
      const account = coaAccounts.find(a => a.kode === r.kode);
      return {
        ...emptyLine(),
        akun_id: account ? String(account.id) : '',
        searchTerm: account ? account.kode + ' — ' + account.nama : '',
      };
    });
    setLines(newLines);
    setTemplateLinks(tmpl.links);
    setActiveTemplate(tmpl.id);
    setTemplateDropdownOpen(false);
    try { localStorage.removeItem(getDraftKeyV2()); } catch {}
    showToast('📋 Template "' + tmpl.name + '" diterapkan');
  }

  function clearTemplate() {
    setTemplateLinks([]);
    setActiveTemplate(null);
  }

  // ── Clear form ──────────────────────────────────────────
  function handleClearForm() {
    if (!confirm('Yakin kosongkan form? Draft yang tersimpan akan hilang.')) return;
    setEditingId(null);
    setEditHeader(emptyHeader());
    setEditLines([]);
    setEditReferensi('');
    setError('');
    setShowSuccess('');
    setHeader(emptyHeader());
    setLines([emptyLine(), emptyLine()]);
    setFlatRows([emptyFlatRow(), emptyFlatRow()]);
    setBatchMode(false);
    clearTemplate();
    try { localStorage.removeItem(getDraftKeyV2()); localStorage.removeItem(getDraftKeyLegacy()); } catch {}
  }

  // ── Submit (Master-Detail mode) ─────────────────────────
  async function handleSubmitMasterDetail(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setShowSuccess('');

    const validationError = validateJournal(header, lines);
    if (validationError) {
      setError(validationError);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const validLines = lines.filter(l => l.akun_id && (parseCurrencyInput(l.debit) > 0 || parseCurrencyInput(l.kredit) > 0));
    const batchRows = validLines.map(l => ({
      tanggal: header.tanggal || today(),
      no_bukti: header.no_bukti,
      keterangan: header.keterangan,
      akun_id: l.akun_id,
      debit: parseCurrencyInput(l.debit),
      kredit: parseCurrencyInput(l.kredit),
      contact_id: l.contact_id || undefined,
      inventory_item_id: l.inventory_item_id || undefined,
      qty: l.qty ? parseFloat(l.qty) : undefined,
    }));

    await submitBatch(batchRows);
  }

  // ── Submit (Batch mode — flat rows) ─────────────────────
  async function handleSubmitBatch(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setShowSuccess('');

    // Build header from first valid row
    const firstValid = flatRows.find(r => r.tanggal || r.no_bukti || r.keterangan);
    const batchHeader: HeaderState = {
      tanggal: firstValid?.tanggal || today(),
      no_bukti: firstValid?.no_bukti || '',
      keterangan: firstValid?.keterangan || '',
    };

    // Validate using shared validation (convert flat rows to lines for validation)
    const convertedLines: LineState[] = flatRows
      .filter(r => r.akun_id && (parseCurrencyInput(r.debit) > 0 || parseCurrencyInput(r.kredit) > 0))
      .map(r => ({
        id: r.id, akun_id: r.akun_id, searchTerm: '', debit: r.debit, kredit: r.kredit,
        keterangan: r.keterangan, contact_id: r.contact_id, inventory_item_id: r.inventory_item_id, qty: r.qty,
      }));

    const validationError = validateJournal(batchHeader, convertedLines);
    if (validationError) {
      setError(validationError);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Build batch rows with inherited values
    const batchRows = flatRows
      .filter(r => r.akun_id && (parseCurrencyInput(r.debit) > 0 || parseCurrencyInput(r.kredit) > 0))
      .map(r => ({
        tanggal: r.tanggal || today(),
        no_bukti: r.no_bukti,
        keterangan: r.keterangan,
        akun_id: r.akun_id,
        debit: parseCurrencyInput(r.debit),
        kredit: parseCurrencyInput(r.kredit),
        contact_id: r.contact_id || undefined,
        inventory_item_id: r.inventory_item_id || undefined,
        qty: r.qty ? parseFloat(r.qty) : undefined,
      }));

    await submitBatch(batchRows);
  }

  // ── Shared batch submit ─────────────────────────────────
  async function submitBatch(batchRows: any[]) {
    setSubmitting(true);
    try {
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
      setHeader(emptyHeader());
      setLines([emptyLine(), emptyLine()]);
      setFlatRows([emptyFlatRow(), emptyFlatRow()]);
      clearTemplate();
      try { localStorage.removeItem(getDraftKeyV2()); localStorage.removeItem(getDraftKeyLegacy()); } catch {}

      // Refresh
      const refreshed = await fetch('/api/accounting/jurnal-umum?limit=20', { headers: { Authorization: 'Bearer ' + getToken() } });
      const rd = await refreshed.json();
      setEntries(Array.isArray(rd) ? rd : rd.entries || rd.data || []);
    } catch (e: any) {
      setError(e.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Edit mode ───────────────────────────────────────────
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
      setEditHeader({
        tanggal: (j.tanggal || '').slice(0, 10),
        no_bukti: j.referensi || '',
        keterangan: j.keterangan || '',
      });
      setEditReferensi(j.referensi || '');
      const loaded = (j.lines || []).map((l: any) => ({
        akun_id: l.akunId || l.akun_id || '',
        debit: Number(l.debit) > 0 ? formatCurrencyDisplay(String(Number(l.debit))) : '',
        kredit: Number(l.kredit) > 0 ? formatCurrencyDisplay(String(Number(l.kredit))) : '',
        keterangan: l.keterangan || '',
        searchTerm: '',
      }));
      while (loaded.length < 2) loaded.push({ akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' });
      setEditLines(loaded);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setError(e.message || 'Gagal memuat jurnal untuk diedit');
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditHeader(emptyHeader());
    setEditLines([]);
    setEditReferensi('');
    setError('');
  }

  function updateEditHeader(field: keyof HeaderState, val: string) {
    setEditHeader(prev => ({ ...prev, [field]: val }));
  }

  function updateEditLine(i: number, field: string, val: string) {
    setEditLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l;
      let storeVal = val;
      if (field === 'debit' || field === 'kredit') storeVal = formatCurrencyDisplay(val);
      const updated = { ...l, [field]: storeVal };
      if (field === 'debit' && parseCurrencyInput(val) > 0) updated.kredit = '';
      if (field === 'kredit' && parseCurrencyInput(val) > 0) updated.debit = '';
      return updated;
    }));
  }

  function addEditLine() {
    setEditLines(prev => [...prev, { akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' }]);
  }

  function removeEditLine(i: number) {
    setEditLines(prev => {
      const next = prev.filter((_, idx) => idx !== i);
      while (next.length < 2) next.push({ akun_id: '', debit: '', kredit: '', keterangan: '', searchTerm: '' });
      return next;
    });
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError('');
    setShowSuccess('');

    const cleanLines = editLines.filter(l => l.akun_id && (parseCurrencyInput(l.debit) > 0 || parseCurrencyInput(l.kredit) > 0));
    if (cleanLines.length < 2) { setError('Minimal 2 baris dengan akun dan nominal diperlukan'); return; }
    const d = cleanLines.reduce((s, l) => s + parseCurrencyInput(l.debit), 0);
    const k = cleanLines.reduce((s, l) => s + parseCurrencyInput(l.kredit), 0);
    if (Math.abs(d - k) >= 0.01) { setError('Total debit dan kredit harus seimbang'); return; }

    setSubmitting(true);
    try {
      const payload = {
        tanggal: editHeader.tanggal,
        keterangan: editHeader.keterangan,
        referensi: editReferensi || undefined,
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
      cancelEdit();
      const refreshed = await fetch('/api/accounting/jurnal-umum?limit=20', { headers: { Authorization: 'Bearer ' + getToken() } });
      const rd = await refreshed.json();
      setEntries(Array.isArray(rd) ? rd : rd.entries || rd.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────
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

  // ── Batch mode flat row helpers ─────────────────────────
  function updateFlatRow(i: number, field: keyof FlatRow, val: string) {
    setFlatRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r;
      let storeVal = val;
      if (field === 'debit' || field === 'kredit') storeVal = formatCurrencyDisplay(val);
      const updated = { ...r, [field]: storeVal };
      if (field === 'debit' && parseCurrencyInput(val) > 0) updated.kredit = '';
      if (field === 'kredit' && parseCurrencyInput(val) > 0) updated.debit = '';
      return r;
    }));
  }

  function addFlatRow() {
    if (flatRows.length >= 50) return;
    setFlatRows(prev => [...prev, emptyFlatRow()]);
  }

  function removeFlatRow(i: number) {
    setFlatRows(prev => {
      if (prev.length <= 2) return prev.map((r, idx) => idx === i ? emptyFlatRow() : r);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  // ── CSS classes ─────────────────────────────────────────
  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none';

  // ── Loading ─────────────────────────────────────────────
  if (loading) return <div className="rounded-2xl border border-slate-100 bg-white p-8 text-sm text-slate-500 shadow-sm">Memuat Jurnal Umum...</div>;

  return (
    <div className="space-y-8 animate-fade-in pb-24">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Jurnal Umum</h1>
        <p className="mt-1 text-sm text-slate-500">Catat transaksi jurnal umum BUM Desa.</p>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
      {showSuccess && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{showSuccess}</div>}
      {toast && <div className="fixed top-4 right-4 z-[100] rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-lg animate-fade-in">{toast}</div>}

      {/* ── Draft Recovery Modal ─────────────────────────────── */}
      {draftRecovery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Pulihkan Draft?</h3>
                <p className="text-sm text-slate-500">Ditemukan draft tersimpan dari {new Date(draftRecovery.savedAt).toLocaleString('id-ID')}</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 mb-4 text-sm text-slate-600">
              <p><strong>Tanggal:</strong> {draftRecovery.header.tanggal}</p>
              <p><strong>Keterangan:</strong> {draftRecovery.header.keterangan || '-'}</p>
              <p><strong>Baris:</strong> {draftRecovery.lines.filter(l => l.akun_id).length} akun terisi</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={discardDraft}
                className="flex-1 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                Buang Draft
              </button>
              <button type="button" onClick={restoreDraft}
                className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:shadow-xl">
                Lanjutkan Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODE ─────────────────────────────────────────── */}
      {editingId && editLines.length > 0 ? (
        <form onSubmit={handleEditSubmit} className="rounded-3xl border border-amber-200 bg-white/80 p-6 shadow-sm backdrop-blur-xl space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Icon d={jurnalIcon} className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-bold text-slate-900">Edit Jurnal</h2>
            <span className="ml-auto inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Mode Edit</span>
          </div>

          {/* Master Header (Edit) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal</label>
              <input type="date" value={editHeader.tanggal} onChange={e => updateEditHeader('tanggal', e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Keterangan <span className="text-red-400">*</span></label>
              <input type="text" value={editHeader.keterangan} onChange={e => updateEditHeader('keterangan', e.target.value)} placeholder="Deskripsi transaksi..." className={inputCls} required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">No. Referensi</label>
              <input type="text" value={editReferensi} onChange={e => setEditReferensi(e.target.value)} placeholder="No. kwitansi/nota" className={inputCls} />
            </div>
          </div>

          {/* Detail Lines (Edit) */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  <th className="px-2 py-2 text-left w-[40%]">Akun</th>
                  <th className="px-2 py-2 text-right w-[22%]">Debit</th>
                  <th className="px-2 py-2 text-right w-[22%]">Kredit</th>
                  <th className="px-2 py-2 text-center w-[16%]">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {editLines.map((line, i) => (
                  <tr key={i} className="group hover:bg-slate-50/50">
                    <td className="px-2 py-1.5">
                      <div className="relative">
                        <input type="text" placeholder="Cari akun..." value={line.searchTerm || ''}
                          onChange={e => {
                            const val = e.target.value;
                            updateEditLine(i, 'searchTerm', val);
                            if (line.akun_id) {
                              const sel = coaAccounts.find(a => String(a.id) === line.akun_id);
                              if (val !== (sel ? sel.kode + ' — ' + sel.nama : '')) updateEditLine(i, 'akun_id', '');
                            }
                          }}
                          className={inputCls} />
                        {line.searchTerm && line.searchTerm.length > 0 && !line.akun_id && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto">
                            {coaAccounts.filter(a => a.kode.toLowerCase().includes(line.searchTerm.toLowerCase()) || a.nama.toLowerCase().includes(line.searchTerm.toLowerCase())).slice(0, 15).map(a => (
                              <button key={a.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition text-slate-700"
                                onClick={() => { updateEditLine(i, 'searchTerm', a.kode + ' — ' + a.nama); updateEditLine(i, 'akun_id', String(a.id)); }}>
                                <span className="font-mono text-xs text-slate-400">{a.kode}</span>
                                <span className="ml-2">{a.nama}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5"><input type="text" inputMode="numeric" placeholder="0" value={line.debit} onChange={e => updateEditLine(i, 'debit', e.target.value)} className={inputCls + ' text-right tabular-nums'} /></td>
                    <td className="px-2 py-1.5"><input type="text" inputMode="numeric" placeholder="0" value={line.kredit} onChange={e => updateEditLine(i, 'kredit', e.target.value)} className={inputCls + ' text-right tabular-nums'} /></td>
                    <td className="px-2 py-1.5 text-center">
                      {editLines.length > 2 && (
                        <button type="button" onClick={() => removeEditLine(i)} className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition text-xs font-bold">×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={addEditLine}
              className="w-full mt-2 py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm font-semibold text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition">
              + Tambah Baris
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex gap-6 text-sm">
              <span>Total Debit: <strong>{formatRupiah(editLines.reduce((s, l) => s + parseCurrencyInput(l.debit), 0))}</strong></span>
              <span>Total Kredit: <strong>{formatRupiah(editLines.reduce((s, l) => s + parseCurrencyInput(l.kredit), 0))}</strong></span>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting}
                className="rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting ? 'Menyimpan...' : 'Perbarui Jurnal'}
              </button>
              <button type="button" onClick={cancelEdit}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Batal</button>
            </div>
          </div>
        </form>
      ) : (
        /* ── INPUT MODE ────────────────────────────────────────── */
        <form onSubmit={batchMode ? handleSubmitBatch : handleSubmitMasterDetail}
          className="rounded-3xl border border-white/70 bg-white/80 p-4 sm:p-6 shadow-sm backdrop-blur-xl space-y-4">
          {/* Mode Toggle + Template */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Icon d={jurnalIcon} className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">Input Jurnal</h2>

            {/* Mode Toggle */}
            <div className="ml-4 flex items-center bg-slate-100 rounded-xl p-0.5">
              <button type="button" onClick={() => setBatchMode(false)}
                className={"px-3 py-1.5 rounded-lg text-xs font-semibold transition " + (!batchMode ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                Master-Detail
              </button>
              <button type="button" onClick={() => setBatchMode(true)}
                className={"px-3 py-1.5 rounded-lg text-xs font-semibold transition " + (batchMode ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                Batch Mode
              </button>
            </div>

            {/* Template Dropdown */}
            <div className="relative ml-2" ref={templateDropdownRef}>
              <button type="button" onClick={() => setTemplateDropdownOpen(!templateDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition border border-emerald-200">
                📋 Template
                <svg className={"w-3 h-3 transition-transform " + (templateDropdownOpen ? 'rotate-180' : '')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {templateDropdownOpen && (
                <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 overflow-hidden">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pilih Template</div>
                  {TEMPLATES.map(t => (
                    <button key={t.id} type="button" onClick={() => applyTemplate(t)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-emerald-50 transition flex items-start gap-3 group">
                      <span className="text-lg mt-0.5">{t.icon}</span>
                      <div>
                        <div className="font-semibold text-slate-900 group-hover:text-emerald-700 transition">{t.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{t.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Active Template Badge */}
            {activeTemplate && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">
                {TEMPLATES.find(t => t.id === activeTemplate)?.icon}
                {TEMPLATES.find(t => t.id === activeTemplate)?.name}
                <span className="text-amber-400 mx-0.5">•</span>
                <span className="text-[10px] text-amber-500">Smart Link aktif</span>
                <button type="button" onClick={clearTemplate}
                  className="ml-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-amber-200 transition text-amber-500 hover:text-amber-700"
                  title="Hapus template">✕</button>
              </span>
            )}

            <span className="ml-auto text-xs text-slate-400">{batchMode ? flatRows.length : lines.length} baris</span>
          </div>

          {!batchMode ? (
            /* ── MASTER-DETAIL MODE ─────────────────────────────── */
            <>
              {/* Master Header */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal <span className="text-red-400">*</span></label>
                  <input type="date" value={header.tanggal} onChange={e => updateHeader('tanggal', e.target.value)}
                    ref={el => lineRefs.current.set('header-tanggal', el)}
                    className={inputCls} required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">No. Bukti</label>
                  <input type="text" value={header.no_bukti} onChange={e => updateHeader('no_bukti', e.target.value)}
                    placeholder="No. kwitansi/nota"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lineRefs.current.get('header-keterangan')?.focus(); } }}
                    ref={el => lineRefs.current.set('header-no_bukti', el)}
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Keterangan <span className="text-red-400">*</span></label>
                  <input type="text" value={header.keterangan} onChange={e => updateHeader('keterangan', e.target.value)}
                    placeholder="Deskripsi transaksi..."
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lineRefs.current.get('akun-0')?.focus(); } }}
                    ref={el => lineRefs.current.set('header-keterangan', el)}
                    className={inputCls} required />
                </div>
              </div>

              {/* Detail Table */}
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-[600px] px-4 sm:px-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide">
                        <th className="px-2 py-2 text-left w-[40%]">Akun</th>
                        <th className="px-2 py-2 text-right w-[22%]">Debit (Rp)</th>
                        <th className="px-2 py-2 text-right w-[22%]">Kredit (Rp)</th>
                        <th className="px-2 py-2 text-center w-[16%]">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {lines.map((line, i) => (
                        <DetailRowInner
                          key={line.id}
                          line={line}
                          index={i}
                          coaAccounts={coaAccounts}
                          partnerKodes={i === lines.length - 1 ? partnerKodes : []}
                          templateLinks={templateLinks}
                          activeTemplate={activeTemplate}
                          kasRowIndex={activeTemplate ? TEMPLATES.find(t => t.id === activeTemplate)?.kasRowIndex ?? null : null}
                          totalDebit={totalDebit}
                          totalKredit={totalKredit}
                          selisih={selisih}
                          isLast={i === lines.length - 1}
                          contacts={contacts}
                          inventoryItems={inventoryItems}
                          onUpdate={updateLine}
                          onRemove={removeLine}
                          onBlur={handleCellBlur}
                          onAutoFill={autoFillBalance}
                          onOpenDropdown={setOpenDropdown}
                          openDropdown={openDropdown}
                          onOpenTag={setOpenTagPopover}
                          openTag={openTagPopover}
                          lineRefs={lineRefs}
                          getKasBankAccounts={getKasBankAccounts}
                          onChangeKas={changeKasAccount}
                          showAutoFillSuggestion={i === lines.length - 1 && showAutoFillSuggestion}
                        />
                      ))}
                    </tbody>
                  </table>
                  {lines.length < 50 && (
                    <button type="button" onClick={addLine}
                      className="w-full mt-2 py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm font-semibold text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition">
                      + Tambah Baris ({lines.length}/50)
                    </button>
                  )}
                  {lines.length >= 50 && <p className="text-xs text-amber-600 text-center font-medium mt-2">Maksimal 50 baris</p>}
                </div>
              </div>
            </>
          ) : (
            /* ── BATCH MODE (Legacy Excel-style) ────────────────── */
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-[800px] px-4 sm:px-0">
                <div className="grid grid-cols-[120px_120px_1fr_1fr_120px_120px_60px] gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide px-1 mb-2">
                  <div>Tanggal</div>
                  <div>No. Bukti</div>
                  <div>Akun</div>
                  <div>Keterangan</div>
                  <div className="text-right">Debit</div>
                  <div className="text-right">Kredit</div>
                  <div className="text-center">Aksi</div>
                </div>
                {flatRows.map((row, i) => (
                  <div key={row.id} className="grid grid-cols-[120px_120px_1fr_1fr_120px_120px_60px] gap-1.5 items-start py-1 rounded-lg hover:bg-slate-50/50 transition">
                    <input type="date" value={row.tanggal} onChange={e => updateFlatRow(i, 'tanggal', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none" />
                    <input type="text" value={row.no_bukti} onChange={e => updateFlatRow(i, 'no_bukti', e.target.value)}
                      placeholder="No. bukti" className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none" />
                    <div className="relative">
                      <input type="text" placeholder="Cari akun..." value={row.searchTerm || ''}
                        onChange={e => {
                          updateFlatRow(i, 'searchTerm', e.target.value);
                          if (row.akun_id) { const sel = coaAccounts.find(a => String(a.id) === row.akun_id); if (e.target.value !== (sel ? sel.kode + ' — ' + sel.nama : '')) updateFlatRow(i, 'akun_id', ''); }
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none" />
                      {row.searchTerm && row.searchTerm.length > 0 && !row.akun_id && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto">
                          {coaAccounts.filter(a => a.kode.toLowerCase().includes(row.searchTerm.toLowerCase()) || a.nama.toLowerCase().includes(row.searchTerm.toLowerCase())).slice(0, 10).map(a => (
                            <button key={a.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition text-slate-700"
                              onClick={() => { updateFlatRow(i, 'searchTerm', a.kode + ' — ' + a.nama); updateFlatRow(i, 'akun_id', String(a.id)); }}>
                              <span className="font-mono text-xs text-slate-400">{a.kode}</span>
                              <span className="ml-2">{a.nama}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input type="text" value={row.keterangan} onChange={e => updateFlatRow(i, 'keterangan', e.target.value)}
                      placeholder="Keterangan" className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none" />
                    <input type="text" inputMode="numeric" placeholder="0" value={row.debit} onChange={e => updateFlatRow(i, 'debit', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-right tabular-nums focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none" />
                    <input type="text" inputMode="numeric" placeholder="0" value={row.kredit} onChange={e => updateFlatRow(i, 'kredit', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-right tabular-nums focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none" />
                    <button type="button" onClick={() => removeFlatRow(i)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition text-xs font-bold mx-auto">×</button>
                  </div>
                ))}
                {flatRows.length < 50 && (
                  <button type="button" onClick={addFlatRow}
                    className="w-full mt-2 py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm font-semibold text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition">
                    + Tambah Baris ({flatRows.length}/50)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Validation Summary (shared between modes) */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="flex gap-4 text-sm">
              <span>Total Debit: <strong className="tabular-nums">{formatRupiah(totalDebit)}</strong></span>
              <span>Total Kredit: <strong className="tabular-nums">{formatRupiah(totalKredit)}</strong></span>
              {!isBalanced && <span className="text-red-600 font-bold">Selisih: {formatRupiah(selisih)}</span>}
              {isBalanced && validRowCount >= 2 && <span className="text-emerald-600 font-bold">✅ Seimbang</span>}
            </div>
            <div className="flex gap-3 flex-wrap items-center">
              <span className="text-xs text-slate-400">{validRowCount} baris valid</span>
              <button type="submit" disabled={submitting || !isBalanced || validRowCount < 2}
                className="rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting ? 'Menyimpan...' : 'Simpan Jurnal'}
              </button>
              <button type="button" onClick={handleClearForm}
                className="text-sm text-red-500 hover:text-red-700 hover:underline font-medium transition">Kosongkan</button>
            </div>
          </div>
        </form>
      )}

      {/* ── Riwayat Jurnal ────────────────────────────────────── */}
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

      {/* ── Delete confirmation modal ─────────────────────────── */}
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
                className="flex-1 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Batal</button>
              <button type="button" disabled={confirmText !== 'HAPUS' || submitting} onClick={handleDelete}
                className="flex-1 rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting ? 'Menghapus...' : 'Hapus Jurnal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky Balance Bar ────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between text-sm flex-wrap gap-2">
          <div className="flex gap-4">
            <span>Debit: <strong className="tabular-nums">{formatRupiah(totalDebit)}</strong></span>
            <span>Kredit: <strong className="tabular-nums">{formatRupiah(totalKredit)}</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{validRowCount} baris</span>
            <span className={isBalanced ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
              {isBalanced ? '✅ SEIMBANG' : `❌ SELISIH: ${formatRupiah(selisih)}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
