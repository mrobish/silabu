// ─── PDF Signature (Tanda Tangan) — SILABU DIGI ───────────────
//
// TTD hanya di halaman terakhir laporan.
//
// Format (nama di ATAS garis):
//   Direktur [Nama BUM Desa]              [Nama Desa], [Tanggal Cetak]
//                                          Bendahara [Nama BUM Desa]
//
//   [Nama Direktur]                        [Nama Bendahara]
//   ──────────────────────                 ──────────────────────
//
// Jika nama kosong → "................................"
//

import type { jsPDF } from 'jspdf';
import type { TenantProfile } from './types';
import { MONTHS } from './pdfFormatters';

/**
 * Add signature block to the PDF at the given Y position.
 * Assumes y is already positioned after the main content.
 * Returns the final Y position after signature.
 */
export function addPdfSignature(
  doc: jsPDF,
  tenant: TenantProfile | null,
  pageW: number,
  pageH: number,
  margin: number,
  y: number,
): number {
  const colW = (pageW - margin * 2) * 0.42;
  const sigLeftX = margin;
  const sigRightX = pageW - margin - colW;
  const sigCenterGap = margin + (pageW - margin * 2) * 0.5;

  // ── Check if we need a new page ─────────────────
  const sigSpace = 38; // mm needed for signature block
  if (y + sigSpace > pageH - margin) {
    doc.addPage();
    y = margin;
  }

  // ── Tanggal cetak ───────────────────────────────
  const today = new Date();
  const tglCetak = `${tenant?.desa || ''}, ${today.getDate()} ${MONTHS[today.getMonth()]} ${today.getFullYear()}`;
  const namaBumdes = tenant?.nama_bumdes || 'BUM Desa';
  const namaDir = tenant?.nama_direktur || '................................';
  const namaBen = tenant?.nama_bendahara || '................................';

  // Left column — Direktur
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text(`Direktur ${namaBumdes}`, sigLeftX, y);

  // Nama di atas garis
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(namaDir, sigLeftX, y + 10);

  // Signature line left (di bawah nama)
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.3);
  doc.line(sigLeftX, y + 13, sigLeftX + colW, y + 13);

  // Right column — Titimangsa + Bendahara
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(tglCetak, sigRightX, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Bendahara ${namaBumdes}`, sigRightX, y + 10);

  // Nama di atas garis
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(namaBen, sigRightX, y + 18);

  // Signature line right (di bawah nama)
  doc.line(sigRightX, y + 21, sigRightX + colW, y + 21);

  return y + 28;
}
