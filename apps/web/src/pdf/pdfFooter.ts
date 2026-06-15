// ─── PDF Footer — SILABU DIGI ─────────────────────────────────
//
// Footer setiap halaman:
//   Kiri: Nama laporan singkat
//   Tengah: SILABU DIGI
//   Kanan: Halaman X dari Y
//
// Garis pemisah tipis di atas footer.
//

import type { jsPDF } from 'jspdf';

/**
 * Add footer to the current page. Call inside an existing page context.
 * Does NOT add a new page.
 */
export function addPdfFooter(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  margin: number,
  title: string,
  currentPage: number,
  totalPages: number,
): void {
  const fy = pageH - margin + 6;
  const fw = pageW - margin * 2;

  // Garis pemisah
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.15);
  doc.line(margin, fy - 2, pageW - margin, fy - 2);

  // Teks footer
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);

  // Kiri: nama laporan singkat
  const shortTitle = title.replace(/^LAPORAN\s+/i, '').substring(0, 40);
  doc.text(shortTitle, margin, fy + 1, { align: 'left' });

  // Tengah
  doc.text('SILABU DIGI', pageW / 2, fy + 1, { align: 'center' });

  // Kanan: Halaman X dari Y
  doc.text(`Halaman ${currentPage} dari ${totalPages}`, pageW - margin, fy + 1, { align: 'right' });
}
