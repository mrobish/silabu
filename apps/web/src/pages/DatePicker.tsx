import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';

// ── helpers ──────────────────────────────────────────────────────────────────
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function toDmy(ymd: string): string {
  if (!ymd || !ymd.includes('-')) return ymd;
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

function parseDmy(s: string): string | null {
  // Accept DD/MM/YYYY or D/M/YYYY — strict validation
  const sep = s.includes('/') ? '/' : s.includes('-') ? '-' : null;
  if (!sep) return null;
  const parts = s.split(sep);
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  if (y < 1900 || y > 2100) return null;
  if (m < 1 || m > 12) return null;
  // Check actual days in month
  const maxDay = new Date(y, m, 0).getDate();
  if (d < 1 || d > maxDay) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

/** Build 6×7 calendar grid for a given month */
function buildGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startDay = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (Date | null)[] = [];
  // Leading blanks
  for (let i = 0; i < startDay; i++) grid.push(null);
  // Days
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d));
  // Trailing blanks to fill 6 rows
  while (grid.length < 42) grid.push(null);
  return grid;
}

// ── component ────────────────────────────────────────────────────────────────
interface DatePickerProps {
  value: string;              // YYYY-MM-DD
  onChange: (ymd: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
  required?: boolean;
  minDate?: string | null;    // YYYY-MM-DD — dates before this are disabled (grayed out)
}

export default function DatePicker({
  value,
  onChange,
  disabled = false,
  className = '',
  placeholder = 'DD/MM/YYYY',
  id,
  required,
  minDate,
}: DatePickerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── state ──
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(() => toDmy(value));
  const [viewYear, setViewYear] = useState(() => {
    if (value) { const d = new Date(value); return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear(); }
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) { const d = new Date(value); return isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth(); }
    return new Date().getMonth();
  });

  // Track input position for portal popup
  const [popupPos, setPopupPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updatePopupPos = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setPopupPos({
        top: rect.bottom + window.scrollY + 8, // 8px gap (mt-2)
        left: rect.left + window.scrollX,
      });
    }
  }, []);

  // Sync external value → input display
  useEffect(() => {
    setInputVal(toDmy(value));
  }, [value]);

  // ── click outside to close ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // Don't close if clicking inside the wrapper (input) or the portal popup
      if (wrapperRef.current && wrapperRef.current.contains(target)) return;
      // Check if click is inside the portal popup (it's a direct child of body)
      const popup = document.querySelector('[data-datepicker-popup]');
      if (popup && popup.contains(target)) return;
      setOpen(false);
      // Validate on close
      const parsed = parseDmy(inputVal);
      if (parsed) onChange(parsed);
      else setInputVal(toDmy(value)); // revert
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, inputVal, value, onChange]);

  // Update popup position when opened
  useEffect(() => {
    if (open) {
      updatePopupPos();
      const onScroll = () => updatePopupPos();
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', onScroll);
      return () => {
        window.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', onScroll);
      };
    }
  }, [open, updatePopupPos]);

  // ── input masking: auto-insert slashes ──
  const handleInputChange = useCallback((raw: string) => {
    // Strip non-digits and slashes
    let cleaned = raw.replace(/[^\d/]/g, '');
    // Auto-insert slashes: user types "01012026" → "01/01/2026"
    const digits = cleaned.replace(/\//g, '');
    let formatted = '';
    if (digits.length > 0) formatted += digits.slice(0, 2);
    if (digits.length > 2) formatted += '/' + digits.slice(2, 4);
    if (digits.length > 4) formatted += '/' + digits.slice(4, 8);
    setInputVal(formatted);

    // Try parse when full date typed
    if (digits.length >= 8) {
      const parsed = parseDmy(formatted);
      if (parsed) {
        onChange(parsed);
        const d = new Date(parsed);
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [onChange]);

  // ── select from calendar ──
  const selectDate = useCallback((d: Date) => {
    const ymd = toYmd(d);
    onChange(ymd);
    setInputVal(toDmy(ymd));
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setOpen(false);
    inputRef.current?.focus();
  }, [onChange]);

  // ── keyboard ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setInputVal(toDmy(value));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const parsed = parseDmy(inputVal);
      if (parsed) {
        onChange(parsed);
        setOpen(false);
      }
    } else if (e.key === 'ArrowDown' && !open) {
      e.preventDefault();
      setOpen(true);
    }
  }, [inputVal, value, open, onChange]);

  // ── quick actions ──
  const setToday = useCallback(() => {
    const ymd = toYmd(new Date());
    onChange(ymd);
    setOpen(false);
  }, [onChange]);

  const setYesterday = useCallback(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const ymd = toYmd(d);
    onChange(ymd);
    setOpen(false);
  }, [onChange]);

  // ── calendar navigation ──
  const prevMonth = useCallback(() => {
    setViewMonth(m => {
      if (m === 0) { setViewYear(y => y - 1); return 11; }
      return m - 1;
    });
  }, []);
  const nextMonth = useCallback(() => {
    setViewMonth(m => {
      if (m === 11) { setViewYear(y => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const grid = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const selectedDate = value ? new Date(value + 'T00:00:00') : null;

  // ── calendar popup JSX (used for portal) ──
  const calendarPopup = open && !disabled ? (
    <div
      data-datepicker-popup
      className="fixed z-[99999] bg-white rounded-2xl shadow-xl border border-slate-200 p-3 w-[280px] animate-fade-in select-none"
      style={{
        top: popupPos.top,
        left: popupPos.left,
        animationDuration: '150ms',
      }}
      onMouseDown={e => e.preventDefault()} // prevent blur on input
    >
      {/* Quick actions */}
      <div className="flex gap-2 mb-3">
        <button type="button" onClick={setToday}
          className="flex-1 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition">
          Hari Ini
        </button>
        <button type="button" onClick={setYesterday}
          className="flex-1 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition">
          Kemarin
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span className="text-sm font-bold text-slate-800">
          {MONTHS_ID[viewMonth]} {viewYear}
        </span>
        <button type="button" onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wide py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {grid.map((d, i) => {
          if (!d) return <div key={i} />;
          const ymd = toYmd(d);
          const selected = selectedDate && isSameDay(d, selectedDate);
          const today = isToday(d);
          const tooEarly = minDate ? ymd < minDate : false;
          return (
            <button
              key={i}
              type="button"
              disabled={tooEarly}
              onClick={() => !tooEarly && selectDate(d)}
              className={`
                h-8 w-full rounded-lg text-xs font-medium transition
                ${selected
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : today
                    ? 'bg-emerald-50 text-emerald-700 font-bold ring-1 ring-emerald-200'
                    : tooEarly
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-700 hover:bg-slate-100'}
              `}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  // ── render ──
  return (
    <div ref={wrapperRef} className="relative inline-block">
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            id={id}
            type="text"
            value={inputVal}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            className={className}
            autoComplete="off"
            inputMode="numeric"
            onFocus={() => {
              if (!disabled) {
                setOpen(true);
                // Set calendar to value's month
                if (value) {
                  const d = new Date(value);
                  if (!isNaN(d.getTime())) {
                    setViewYear(d.getFullYear());
                    setViewMonth(d.getMonth());
                  }
                }
              }
            }}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              // Validate on blur
              const parsed = parseDmy(inputVal);
              if (parsed) {
                onChange(parsed);
              } else if (inputVal && inputVal.replace(/\//g, '').length > 0) {
                // Partial input — revert to current value
                setInputVal(toDmy(value));
              }
            }}
          />
          {/* Calendar icon indicator */}
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
        </div>
      </div>

      {/* Calendar popup — rendered via portal to avoid z-index stacking context issues */}
      {calendarPopup && createPortal(calendarPopup, document.body)}
    </div>
  );
}
