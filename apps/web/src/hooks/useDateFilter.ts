import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

/**
 * useDateFilter — URL-backed date range state for report pages.
 *
 * Reads `start` & `end` from URL search params. Falls back to defaults
 * (first of current year → today) when params are absent.
 * Setting dates updates the URL, so filters survive navigation, refresh,
 * and can be shared via link.
 */
export function useDateFilter(defaults?: { start?: string; end?: string }) {
  const [params, setParams] = useSearchParams();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultStart = defaults?.start ?? `${new Date().getFullYear()}-01-01`;
  const defaultEnd = defaults?.end ?? today;

  const startDate = params.get('start') || defaultStart;
  const endDate = params.get('end') || defaultEnd;

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
