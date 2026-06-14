import { useCallback } from 'react';
import DatePicker from './DatePicker';

// ── helpers ──────────────────────────────────────────────────
function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function lastOfMonth(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

function firstOfQuarter(): string {
  const d = new Date();
  const qStart = Math.floor(d.getMonth() / 3) * 3;
  return `${d.getFullYear()}-${String(qStart + 1).padStart(2, '0')}-01`;
}

function lastOfQuarter(): string {
  const d = new Date();
  const qStart = Math.floor(d.getMonth() / 3) * 3;
  const last = new Date(d.getFullYear(), qStart + 3, 0).getDate();
  return `${d.getFullYear()}-${String(qStart + 3).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

function firstOfYear(): string {
  const y = new Date().getFullYear();
  return `${y}-01-01`;
}

function lastOfYear(): string {
  const y = new Date().getFullYear();
  return `${y}-12-31`;
}

// ── component ────────────────────────────────────────────────
interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartChange: (d: string) => void;
  onEndChange: (d: string) => void;
  className?: string;
  minDate?: string | null;    // YYYY-MM-DD — disable dates before this
}

const presetBtn = 'px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap';

export default function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  className = '',
  minDate,
}: DateRangePickerProps) {
  const applyPreset = useCallback((s: string, e: string) => {
    onStartChange(s);
    onEndChange(e);
  }, [onStartChange, onEndChange]);

  return (
    <div className={className}>
      {/* Quick presets */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button type="button" onClick={() => applyPreset(firstOfMonth(), lastOfMonth())}
          className={`${presetBtn} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>
          Bulan Ini
        </button>
        <button type="button" onClick={() => applyPreset(firstOfQuarter(), lastOfQuarter())}
          className={`${presetBtn} bg-cyan-50 text-cyan-700 hover:bg-cyan-100`}>
          Kuartal Ini
        </button>
        <button type="button" onClick={() => applyPreset(firstOfYear(), lastOfYear())}
          className={`${presetBtn} bg-blue-50 text-blue-700 hover:bg-blue-100`}>
          Tahun Ini
        </button>
      </div>

      {/* Two date pickers side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Dari</label>
          <DatePicker
            value={startDate}
            onChange={onStartChange}
            minDate={minDate}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Sampai</label>
          <DatePicker
            value={endDate}
            onChange={onEndChange}
            minDate={minDate}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
          />
        </div>
      </div>
    </div>
  );
}
