// ─── Period label generator — SILABU DIGI ─────────────────────

import { formatDateID } from './pdfFormatters';

/**
 * Generate standardized period label for PDF reports.
 *
 * Type variants:
 *   'range'    → "Periode: 1 Januari 2025 s.d. 31 Desember 2025"
 *   'snapshot' → "Per tanggal: 31 Desember 2025"
 *   'ledger'   → not used here (Buku Besar has account label too)
 */
export function formatPeriodLabel(
  type: 'range' | 'snapshot' | 'ledger',
  startDate?: string | Date,
  endDate?: string | Date,
): string {
  if (type === 'snapshot' && endDate) {
    return `Per tanggal: ${formatDateID(endDate)}`;
  }
  if (type === 'range' && startDate && endDate) {
    return `Periode: ${formatDateID(startDate)} s.d. ${formatDateID(endDate)}`;
  }
  if (type === 'ledger' && startDate && endDate) {
    return `Periode: ${formatDateID(startDate)} s.d. ${formatDateID(endDate)}`;
  }
  return '';
}
