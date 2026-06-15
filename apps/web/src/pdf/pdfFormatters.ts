// ─── Format helpers for PdfTemplate — SILABU DIGI ─────────────

export const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** Format date string/Date to "1 Januari 2025" (Indonesia) */
export function formatDateID(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Format number to "1.234.567" (dot-separated thousands, Indonesia) */
export function formatRupiah(n: number): string {
  return Math.abs(n).toLocaleString('id-ID');
}

/** Format number with negative indicator — returns text + neg flag */
export function formatRupiahNeg(n: number): { text: string; neg: boolean } {
  if (n === 0) return { text: '0', neg: false };
  const neg = n < 0;
  return { text: formatRupiah(n), neg };
}

/** Format number to "Rp 1.234.567" or "(Rp 1.234.567)" */
export function formatRupiahFull(n: number): string {
  if (n < 0) return `(Rp ${formatRupiah(n)})`;
  return `Rp ${formatRupiah(n)}`;
}

/** Shorter version of formatRupiahFull — no "Rp" prefix */
export function fmtPrint(n: number): string {
  if (n < 0) return `(${formatRupiah(n)})`;
  return formatRupiah(n);
}

/** Format raw number string or number to display */
export function parseAndFormat(val: number | string | null | undefined): string {
  if (val == null) return '';
  const n = typeof val === 'string' ? Number(val) : val;
  if (isNaN(n) || n === 0) return '';
  return formatRupiahFull(n);
}
