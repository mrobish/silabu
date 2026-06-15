// ─── PDF Header (Kop Surat) — SILABU DIGI ─────────────────────
//
// Renders standardized kop surat on the FIRST page only:
//
//                           [LOGO]
//
//                      NAMA BUM DESA
//                         NAMA DESA
// Nomor Sertifikat Badan Hukum: [nomor]
// NPWP: [nomor]
// Alamat: [alamat lengkap]
// ═══════════════════════════════════════════════
//

import type { jsPDF } from 'jspdf';
import type { TenantProfile } from './types';

/** Maximum Y before page break */
const MAX_Y_RATIO = 0.85;

/** Render kop surat on first page. Returns the Y position after the kop + double line. */
export function addPdfHeader(
  doc: jsPDF,
  tenant: TenantProfile | null,
  pageW: number,
  margin: number,
  _landscape: boolean,
): { y: number; logoY: number } {
  const pageH = doc.internal.pageSize.getHeight();
  let y = margin;

  // ── Helper: add centered text with auto-wrap ──────
  const addCenter = (text: string, fontSize: number, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = [30, 41, 59]) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', style);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, pageW - margin * 2);
    for (const line of lines) {
      if (y > pageH * MAX_Y_RATIO) {
        doc.addPage();
        y = margin;
      }
      doc.text(String(line), pageW / 2, y, { align: 'center' });
      y += fontSize * 0.45;
    }
  };

  const logoY = y;

  // ── Logo (center) ─────────────────────────────────
  if (tenant?.logo_url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    // We can't load image synchronously in jsPDF context — will be loaded
    // in the component and passed via a base64 cache. For now, reserve space.
    // Logo will be injected by the component via addImageToPage.
    y += 18; // reserve ~18mm for logo
  }

  // ── Nama BUM Desa (uppercase bold) ────────────────
  addCenter(tenant?.nama_bumdes?.toUpperCase() || 'BUM DESA', 13, 'bold', [15, 23, 42]);
  y += 2;

  // ── Nomor Sertifikat Badan Hukum ──────────────────
  const noSertifikat = tenant?.nomor_sertifikat || '-';
  addCenter(`Nomor Sertifikat Badan Hukum: ${noSertifikat}`, 8, 'normal', [71, 85, 105]);
  y += 1;

  // ── NPWP ──────────────────────────────────────────
  const npwp = tenant?.npwp || '-';
  addCenter(`NPWP: ${npwp}`, 8, 'normal', [71, 85, 105]);
  y += 1;

  // ── Alamat lengkap ────────────────────────────────
  const parts: string[] = [];
  const t = tenant;
  if (t) {
    parts.push(`Alamat: ${t.desa || ''}`);
    parts.push(`Kec. ${t.kecamatan || ''}`);
    parts.push(`Kab. ${t.kabupaten || ''}`);
    if (t.provinsi) parts.push(t.provinsi);
  }
  const alamat = parts.length > 1 ? parts.join(', ') : 'Alamat: -';
  addCenter(alamat, 8, 'normal', [71, 85, 105]);
  y += 3;

  // ── Double line ───────────────────────────────────
  if (y > pageH * MAX_Y_RATIO) {
    doc.addPage();
    y = margin;
  }
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(1.2);
  doc.line(margin, y, pageW - margin, y);
  y += 1.5;
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  return { y, logoY };
}
