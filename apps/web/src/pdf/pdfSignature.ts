// ─── PDF Signature (Tanda Tangan) — SILABU DIGI ───────────────
//
// TTD hanya di halaman terakhir laporan.
//
// Format:
//   Mengetahui,                           [Nama Desa], [Tanggal Cetak]
//   Direktur [Nama BUM Desa]              Disusun oleh,
//                                          Bendahara [Nama BUM Desa]
//
//   [spasi untuk tanda tangan]
//
//   [Nama Direktur]                        [Nama Bendahara BUM Desa]
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

  // Left column — Mengetahui
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Mengetahui,', sigLeftX, y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Direktur ${namaBumdes}`, sigLeftX, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(namaBumdes, sigLeftX, y + 9);

  // Signature line left
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.3);
  doc.line(sigLeftX, y + 24, sigLeftX + colW, y + 24);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(namaDir, sigLeftX, y + 28);

  // Right column — Titimangsa + Bendahara
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(tglCetak, sigRightX, y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Disusun oleh,', sigRightX, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Bendahara ${namaBumdes}`, sigRightX, y + 9);

  // Signature line right
  doc.line(sigRightX, y + 24, sigRightX + colW, y + 24);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(namaBen, sigRightX, y + 28);

  return y + 38;
}
