import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

/**
 * useDateFilter — URL-backed date range state for report pages.
 *
 * Reads `start` & `end` from URL search params. Falls back to defaults
 * (first of current year → today) when params are absent or invalid.
 *
 * Validations:
 *  1. Rejects malformed date strings (e.g. "kucing", "2026-30-99")
 *  2. Auto-swaps if start > end (inverted range)
 */

/** Check if a string is a valid YYYY-MM-DD date */
function isValidDate(s: string | null): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00');
  return !isNaN(d.getTime());
}

export function useDateFilter(defaults?: { start?: string; end?: string }) {
  const [params, setParams] = useSearchParams();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultStart = defaults?.start ?? `${new Date().getFullYear()}-01-01`;
  const defaultEnd = defaults?.end ?? today;

  // ── Celah 1: Reject invalid format (e.g. "kucing", "2026-30-99") ──
  const rawStart = params.get('start');
  const rawEnd = params.get('end');
  const safeStart = isValidDate(rawStart) ? rawStart! : defaultStart;
  const safeEnd = isValidDate(rawEnd) ? rawEnd! : defaultEnd;

  // ── Celah 2: Auto-swap if start > end (inverted range) ──
  let startDate = safeStart;
  let endDate = safeEnd;
  if (startDate > endDate) {
    // Swap — user probably entered end before start
    startDate = safeEnd;
    endDate = safeStart;
  }

  const setStartDate = useCallback(
    (d: string) => setParams(p => { p.set('start', d); return p; }, { replace: true }),
    [setParams],
  );
  const setEndDate = useCallback(
    (d: string) => setParams(p => { p.set('end', d); return p; }, { replace: true }),
    [setParams],
  );

  return { startDate, endDate, setStartDate, setEndDate };
}
