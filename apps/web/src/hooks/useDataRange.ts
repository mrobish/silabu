import { useState, useEffect } from 'react';

/**
 * useDataRange — fetch min/max available data dates from /api/accounting/data-range.
 * Used by report pages to enable "Semua Data" preset and data range info.
 * Returns null values while loading, safe for downstream components.
 */
export function useDataRange() {
  const [minDate, setMinDate] = useState<string | null>(null);
  const [maxDate, setMaxDate] = useState<string | null>(null);
  const [totalEntries, setTotalEntries] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
    fetch('/api/accounting/data-range', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          if (d.minDate) setMinDate(d.minDate);
          if (d.maxDate) setMaxDate(d.maxDate);
          setTotalEntries(d.totalEntries || 0);
        }
      })
      .catch(() => {}); // silent — report pages still work without data range
  }, []);

  return { minDate, maxDate, totalEntries };
}
