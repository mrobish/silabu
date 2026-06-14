import { useState, useEffect } from 'react';

/**
 * Fetch the accounting cutoff date (OPENING_BALANCE tanggal) for the current tenant.
 * Returns null if no opening balance exists yet.
 */
export function useCutoffDate(): string | null {
  const [cutoff, setCutoff] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
    fetch('/api/accounting/cutoff-date', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.cutoff) setCutoff(d.cutoff); })
      .catch(() => {});
  }, []);

  return cutoff;
}
