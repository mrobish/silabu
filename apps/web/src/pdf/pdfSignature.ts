// ─── PDF Signature (Tanda Tangan) — SILABU DIGI ───────────────
//
// Grid koordinat tetap — tidak pakai text flow dinamis.
//
// Layout:
//   Kiri:                              Kanan:
//   (kosong)                           Cikapinis, 15 Juni 2026
//   Direktur BUM Desa ...              Bendahara BUM Desa ...
//                                       (ruang tanda tangan ~30mm)
//   [Nama Direktur]                    [Nama Bendahara]
//   ──────────────────────             ──────────────────────
//
// Semua Y pakai anchor sigY + offset tetap.
// Direktur dan Bendahara SEJAJAR.
// Nama kiri/kanan SEJAJAR.
// Garis kiri/kanan SEJAJAR + panjang SAMA.
//
// Jika nama kosong → "................................"
//

import type { jsPDF } from 'jspdf';
import type { TenantProfile } from './types';

/**
 * Add signature block to the PDF at the given Y position.
 * Grid-based layout with fixed coordinates.
 * Signature only appears on the LAST page (call once after all content).
 */
export function addPdfSignature(
  doc: jsPDF,
  tenant: TenantProfile | null,
  pageW: number,
  pageH: number,
  margin: number,
  y: number,
): number {
  // ── Reserved height ────────────────────────────
  const SIGNATURE_HEIGHT = 52; // mm total height needed
  const FOOTER_MARGIN = 12;   // mm space before footer

  // Check if remaining space is enough
  if (y + SIGNATURE_HEIGHT > pageH - margin - FOOTER_MARGIN) {
    doc.addPage();
    y = margin;
  }

  // ── Grid coordinates ───────────────────────────
  const sigY = y + 6;             // buffer from table
  const leftX = margin;           // 15mm
  const rightX = pageW / 2 + 10;  // kanan: tengah + 10mm gap
  const colWidth = (pageW - margin - margin - 20) / 2; // lebar kolom sama

  // Y offsets (semua anchor dari sigY)
  const dateY = sigY;             // titimangsa — kanan atas, berdiri sendiri
  const roleY = sigY + 7;         // Direktur / Bendahara — sejajar
  const nameY = sigY + 36;        // nama — ~29mm gap dari role
  const lineY = nameY + 4;        // garis — sejajar

  // ── Data ───────────────────────────────────────
  const today = new Date();
  const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const tglCetak = `${tenant?.desa || ''}, ${today.getDate()} ${MONTHS[today.getMonth()]} ${today.getFullYear()}`;
  const namaBumdes = tenant?.nama_bumdes || 'BUM Desa';
  const namaDir = tenant?.nama_direktur || '................................';
  const namaBen = tenant?.nama_bendahara || '................................';

  // ── Right: Titimangsa (baris sendiri di atas) ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(tglCetak, rightX, dateY, { align: 'left' });

  // ── Left: Direktur ─────────────────────────────
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  // Wrap if needed
  const dirText = `Direktur ${namaBumdes}`;
  const dirLines = doc.splitTextToSize(dirText, colWidth);
  const benText = `Bendahara ${namaBumdes}`;
  const benLines = doc.splitTextToSize(benText, colWidth);

  // Sejajarkan LAST line kiri dan kanan
  const dirN = dirLines.length;
  const benN = benLines.length;
  const maxN = Math.max(dirN, benN);
  const lineH = 4.5; // line height at 9pt
  const dirOff = (maxN - dirN) * lineH;
  const benOff = (maxN - benN) * lineH;
  doc.text(dirLines, leftX, roleY + dirOff);
  doc.text(benLines, rightX, roleY + benOff);

  // ── Nama (sejajar, di atas garis) ──────────────
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(namaDir, leftX, nameY);
  doc.text(namaBen, rightX, nameY);

  // ── Garis (sejajar, panjang sama) ──────────────
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.4);
  doc.line(leftX, lineY, leftX + colWidth, lineY);
  doc.line(rightX, lineY, rightX + colWidth, lineY);

  return y + SIGNATURE_HEIGHT;
}
