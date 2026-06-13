# Jurnal Umum — Master-Detail Rewrite Plan

## 🎯 Goal
Rewrite JurnalUmumPage.tsx (1,482 lines) from flat Excel-style to Master-Detail (Accurate-style)
with batch mode toggle, preserving all existing backend integrations and "sakti" features.

## 📐 Architecture

### State Structure (CRITICAL CHANGE)

```typescript
// BEFORE (flat array — each row has tanggal, no_bukti, keterangan)
interface Row {
  id: string;
  tanggal: string;      // ← moves to header
  no_bukti: string;     // ← moves to header
  keterangan: string;   // ← moves to header
  akun_id: string;
  debit: string;
  kredit: string;
  searchTerm: string;
  contact_id: string;
  inventory_item_id: string;
  qty: string;
}
const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow()]);

// AFTER (master-detail split)
interface HeaderState {
  tanggal: string;       // single value for all lines
  no_bukti: string;      // single value for all lines
  keterangan: string;    // single value for all lines
}

interface LineState {
  id: string;
  akun_id: string;
  searchTerm: string;
  debit: string;
  kredit: string;
  keterangan: string;    // per-line optional note (kept for detail)
  contact_id: string;
  inventory_item_id: string;
  qty: string;
}

const [header, setHeader] = useState<HeaderState>({ tanggal: today(), no_bukti: '', keterangan: '' });
const [lines, setLines] = useState<LineState[]>([emptyLine(), emptyLine()]);
const [batchMode, setBatchMode] = useState(false);
```

### API Payload Mapping (NO BACKEND CHANGE)

The batch API expects `{ rows: [{ tanggal, no_bukti, keterangan, akun_id, debit, kredit, ... }] }`.
We map header → each line on submit:

```typescript
const batchRows = validLines.map(line => ({
  tanggal: header.tanggal || today(),
  no_bukti: header.no_bukti,
  keterangan: header.keterangan || line.keterangan,
  akun_id: line.akun_id,
  debit: parseCurrencyInput(line.debit),
  kredit: parseCurrencyInput(line.kredit),
  contact_id: line.contact_id || undefined,
  inventory_item_id: line.inventory_item_id || undefined,
  qty: line.qty ? parseFloat(line.qty) : undefined,
}));
```

### localStorage Migration

```typescript
// OLD key: 'jurnal-batch-draft-{tenantId}'
// NEW key: 'jurnal-draft-v2-{tenantId}'

function getDraftKeyV2(): string {
  const payload = JSON.parse(atob(getToken().split('.')[1]));
  return 'jurnal-draft-v2-' + (payload.tenantId || 'unknown');
}

// On mount: clear old draft if exists
useEffect(() => {
  const oldKey = getDraftKey(); // old format
  if (localStorage.getItem(oldKey)) {
    localStorage.removeItem(oldKey);
  }
  // Also clear old jurnal-draft- key
  const legacyKey = getOldDraftKey();
  if (localStorage.getItem(legacyKey)) {
    localStorage.removeItem(legacyKey);
  }
}, []);
```

Draft shape:
```typescript
interface DraftV2 {
  version: 2;
  header: HeaderState;
  lines: LineState[];
  savedAt: string;
}
```

### Component Tree

```
JurnalUmumPage (orchestrator, 1482 → ~800 lines)
├── Error/Success/Toast banners
├── TemplateSelector (dropdown + badge)
├── ModeToggle (Master-Detail ↔ Batch)
│
├── [Master-Detail Mode]
│   ├── MasterHeader (Tanggal, No.Bukti, Keterangan) — memoized
│   └── DetailTable
│       ├── Column headers (Akun, Debit, Kredit, Aksi)
│       ├── DetailRow × N — React.memo, memoized callbacks
│       │   ├── AccountSearchDropdown — memoized
│       │   ├── Debit input (with in-cell math + 🔗 badge)
│       │   ├── Kredit input (with in-cell math + ⚡ autofill)
│       │   ├── Tag popover (contact + inventory)
│       │   └── Action buttons (+, ×)
│       └── "+ Tambah Baris" button
│
├── [Batch Mode] (legacy Excel-style, kept as-is with ghost cells etc.)
│   └── Flat table with tanggal/no_bukti/keterangan per row
│
├── BalanceSummary (Total D/K/Selisih + baris count)
├── StickyBalanceBar (bottom fixed)
├── RiwayatJurnal (table) — memoized
└── DeleteConfirmModal
```

### Performance Strategy

```typescript
// 1. Memoize DetailRow
const DetailRow = React.memo(function DetailRow({ line, index, ... }) {
  // Only re-renders when THIS line's data or index changes
});

// 2. Stable callbacks via useCallback
const updateLine = useCallback((index: number, field: keyof LineState, value: string) => {
  setLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
}, []);

// 3. Stable refs for focus management
const lineRefs = useRef<Map<string, HTMLElement | null>>(new Map());

// 4. Header changes don't re-render lines
// header state is separate, so setHeader doesn't trigger lines re-render
```

## ✅ Feature Preservation Checklist

### 1. In-cell Math (safeMathEval)
- Location: `handleCellBlur(i, 'debit'|'kredit')` 
- Status: KEEP as-is, just change `rows[i]` → `lines[i]`
- Trigger: onBlur on debit/kredit inputs

### 2. Smart Templates
- Location: `applyTemplate()`, `TEMPLATES` array, `templateLinks`
- Status: KEEP — templates now set `header.keterangan` + populate `lines[]`
- Change: `setRows(newRows)` → `setHeader({...}) + setLines(newLines)`

### 3. Validation + Auto-scroll
- Location: `handleSubmit()` validation, error state
- Status: KEEP — validate `header.tanggal` + `lines` balance
- Auto-scroll: `window.scrollTo({ top: 0, behavior: 'smooth' })` on error

### 4. Auto-Balance ⚡
- Location: `autoFillBalance(i)` 
- Status: KEEP — works on last line, fills debit or kredit with selisih

### 5. Smart Autofill (NEW)
- When user fills Debit on line 0 and clicks "+ Tambah Baris":
  - New line 1 auto-fills Kredit = same amount as line 0 Debit
  - User just needs to pick the account
- Logic in `addLine()`:
  ```typescript
  function addLine() {
    const lastFilled = lines[lines.length - 1];
    const newLine = emptyLine();
    // Smart Autofill: mirror the opposite side
    if (parseCurrencyInput(lastFilled.debit) > 0) {
      newLine.kredit = lastFilled.debit; // same amount
    } else if (parseCurrencyInput(lastFilled.kredit) > 0) {
      newLine.debit = lastFilled.kredit;
    }
    setLines(prev => [...prev, newLine]);
  }
  ```

### 6. Keyboard Tab Order
- Tab sequence: Tanggal → No.Bukti → Keterangan → [Line 0: Akun → Debit → Kredit] → [Line 1: Akun → Debit → Kredit] → ...
- Enter on Kredit → addLine() + focus new line's Akun
- No ghost cells to skip!

### 7. Drag & Drop
- In Master-Detail mode: no drag needed (lines are simple, just + and ×)
- In Batch mode: keep drag & drop as-is

### 8. Contact/Inventory Tagging
- KEEP per-line tagging via popover
- Move tag button to a dedicated column or inline with actions

### 9. Draft Auto-save
- Debounced 1s → saves `{ version: 2, header, lines, savedAt }` to localStorage
- On mount: restore from V2 key if exists

### 10. Edit Mode
- `startEdit()` loads entry → sets `editHeader` + `editLines` (separate state)
- `handleEditSubmit()` maps to `PUT /api/accounting/jurnal-umum/:id`
- Edit mode ALWAYS uses Master-Detail layout (no batch toggle)

## 📁 Files to Modify

| File | Action |
|---|---|
| `apps/web/src/pages/JurnalUmumPage.tsx` | MAJOR REWRITE |

No backend changes needed. API payload format stays the same.

## 🔀 Mode Toggle Behavior

```
[Master-Detail ◉] ← Default, clean UX
[Batch Mode ◯]   ← Excel-style for power users
```

- Toggle is a pill switch at the top of the form
- State is preserved when switching (header + lines → flat rows, and back)
- Draft auto-save works in both modes
- Submit always uses the same batch API

## ⚠️ Regression Risks & Mitigations

| Risk | Mitigation |
|---|---|
| State structure change breaks API payload | Map header+lines → batchRows on submit (same format) |
| Old localStorage draft crashes app | Clear old keys on mount, use V2 key |
| Ghost cells removal confuses users | Clean table is actually simpler; no more "click to edit" confusion |
| Template links break with new state | Adapt `templateLinks` to use line indices (same as before, just without tanggal/no_bukti fields) |
| Performance regression | React.memo + useCallback + separate header/lines state |
| Edit mode regression | Keep edit mode as separate state (`editHeader`/`editLines`), same UX pattern |

## 📊 Estimated Size

- Current: 1,482 lines, 77KB
- After rewrite: ~1,200 lines (removing ghost cell logic, simplifying row structure)
- Extractable to sub-components if needed (but keeping single file per project convention)
