import { useState, useEffect } from 'react';

/**
 * Fetches available accounting years from the API.
 * Returns years in descending order (newest first).
 * Falls back to [currentYear, currentYear-1, currentYear-2] if fetch fails.
 */
export function useAccountingYears(): number[] {
  const [years, setYears] = useState<number[]>(() => {
    const y = new Date().getFullYear();
    return [y, y - 1, y - 2];
  });

  useEffect(() => {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
    fetch('/api/accounting/years', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => {
        if (data.years && data.years.length > 0) {
          setYears(data.years);
        }
      })
      .catch(() => { /* fallback already set */ });
  }, []);

  return years;
}
