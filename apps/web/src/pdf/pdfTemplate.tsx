// ─── PdfTemplate — Main orchestrator — SILABU DIGI ────────────
//
// Drop-in replacement for ReportPrintLayout with modularized header,
// footer, signature, and formatter helpers.
//
// Props: title, isOpen, onClose, periodLabel, accountLabel, landscape, children
//
// Renders:
//   1. HTML preview modal (kop + judul + isi + ttd)
//   2. PDF generation via jsPDF (modular helpers)
//

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TenantProfile, PdfTemplateProps } from './types';
import { formatDateID } from './pdfFormatters';
import { addPdfHeader } from './pdfHeader';
import { addPdfFooter } from './pdfFooter';
import { addPdfSignature } from './pdfSignature';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function PdfTemplate({
  title,
  isOpen,
  onClose,
  periodLabel,
  accountLabel,
  landscape,
  children,
}: PdfTemplateProps) {
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const today = new Date();
  const [tglCetak, setTglCetak] = useState(
    `${today.getDate()} ${MONTHS[today.getMonth()]} ${today.getFullYear()}`,
  );
  const [namaBendahara, setNamaBendahara] = useState('');
  const [namaDirektur, setNamaDirektur] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  // ── Fetch tenant profile ───────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
        const res = await fetch('/api/tenant/profile', {
          headers: { Authorization: 'Bearer ' + token },
        });
        const data = await res.json();
        const p = data?.profile;
        if (p) {
          setTenant(p);
          setTglCetak(
            `${p.desa || ''}, ${today.getDate()} ${MONTHS[today.getMonth()]} ${today.getFullYear()}`,
          );
          setNamaBendahara(p.nama_bendahara || '');
          setNamaDirektur(p.nama_direktur || '');
        }
      } catch {
        // Silently fail — template works without profile
      }
    })();
  }, [isOpen]);

  // ── Pre-load logo to base64 for PDF ────────────────
  useEffect(() => {
    if (!isOpen || !tenant?.logo_url) {
      setLogoDataUrl(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 80;
      canvas.height = img.naturalHeight || 80;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        setLogoDataUrl(canvas.toDataURL('image/png'));
      }
    };
    img.onerror = () => setLogoDataUrl(null);
    img.src = tenant.logo_url;
  }, [isOpen, tenant?.logo_url]);

  // ── Generate PDF ────────────────────────────────────
  const handleGeneratePdf = useCallback(async () => {
    if (!printAreaRef.current) return;
    setGenerating(true);
    try {
      const pdf = new jsPDF({
        orientation: landscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageW = landscape ? 297 : 210;
      const pageH = landscape ? 210 : 297;
      const margin = 15;
      const contentW = pageW - margin * 2;
      let y = margin;

      // ── Helper: add centered title ──────────────
      const addTitle = (text: string, fontSize: number, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = [30, 41, 59]) => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', style);
        pdf.setTextColor(color[0], color[1], color[2]);
        const lines = pdf.splitTextToSize(text, contentW);
        for (const line of lines) {
          if (y > pageH - margin - 10) {
            pdf.addPage();
            y = margin;
          }
          pdf.text(String(line), pageW / 2, y, { align: 'center' });
          y += fontSize * 0.45;
        }
      };

      // ── Page number tracking ────────────────────
      const pageCount = (pdf as any).internal.getNumberOfPages();
      let totalPages = pageCount || 1;

      // ── Kop surat (first page only) ─────────────
      const headerResult = addPdfHeader(pdf as any, tenant, pageW, margin, !!landscape);
      y = headerResult.y;

      // If logo was loaded, inject it at the reserved position
      if (logoDataUrl && tenant?.logo_url) {
        const logoSize = 14;
        const logoX = pageW / 2 - logoSize / 2;
        try {
          pdf.addImage(logoDataUrl, 'PNG', logoX, margin, logoSize, logoSize);
          y = Math.max(y, margin + logoSize + 2);
        } catch {
          // Logo injection failed — skip
        }
      }

      // ── Judul dokumen ───────────────────────────
      addTitle(title.toUpperCase(), 12, 'bold', [15, 23, 42]);

      // ── Subtitle: Nama Akun (Buku Besar) ────────
      if (accountLabel) {
        addTitle(accountLabel, 9, 'normal', [30, 41, 59]);
        y += 1;
      }

      // ── Periode ─────────────────────────────────
      if (periodLabel) {
        addTitle(periodLabel, 9, 'normal', [71, 85, 105]);
        y += 1;
      }

      // ── "(Dalam Rupiah)" ─────────────────────────
      addTitle('(Dalam Rupiah)', 8, 'normal', [148, 163, 184]);
      y += 5;

      // ── Parse table from DOM ────────────────────
      const bodyEl = printAreaRef.current.querySelector('.print-body');
      if (bodyEl) {
        const tables = bodyEl.querySelectorAll('table');
        if (tables.length > 0) {
          tables.forEach((table) => {
            const headers: string[][] = [];
            const rows: string[][] = [];

            table.querySelectorAll('thead tr').forEach((tr) => {
              const row: string[] = [];
              tr.querySelectorAll('th').forEach((th) =>
                row.push(th.textContent?.trim() || ''),
              );
              if (row.length > 0) headers.push(row);
            });

            table.querySelectorAll('tbody tr').forEach((tr) => {
              const row: string[] = [];
              tr.querySelectorAll('td').forEach((td) =>
                row.push(td.textContent?.trim() || ''),
              );
              if (row.length > 0) rows.push(row);
            });

            if (headers.length === 0 && rows.length > 0) {
              headers.push(rows.shift()!);
            }

            autoTable(pdf, {
              head: headers,
              body: rows,
              startY: y,
              margin: { left: margin, right: margin },
              styles: {
                fontSize: 8.5,
                cellPadding: 1.5,
                textColor: [30, 41, 59],
                lineColor: [203, 213, 225],
                lineWidth: 0.1,
              },
              headStyles: {
                fillColor: [241, 245, 249],
                textColor: [15, 23, 42],
                fontStyle: 'bold',
                fontSize: 8.5,
              },
              alternateRowStyles: {
                fillColor: [248, 250, 252],
              },
              columnStyles: headers[0]?.reduce(
                (acc, _, i) => {
                  // Right-align last 3 columns (amounts)
                  if (i >= headers[0].length - 3) {
                    acc[i] = { halign: 'right', fontStyle: 'normal' };
                  }
                  return acc;
                },
                {} as Record<number, any>,
              ) || {},
              didParseCell: (data) => {
                const cellText = data.cell.raw?.toString() || '';
                if (
                  cellText.includes('Total') ||
                  cellText.includes('TOTAL') ||
                  cellText.includes('Saldo Akhir') ||
                  cellText.includes('Saldo Awal') ||
                  cellText.includes('Subtotal')
                ) {
                  data.cell.styles.fontStyle = 'bold';
                }
                // Green highlight for final balance
                if (cellText.includes('Saldo Akhir')) {
                  data.cell.styles.fillColor = [209, 250, 229];
                  data.cell.styles.textColor = [5, 46, 22];
                }
                // Red for negative
                if (data.section === 'body' && data.column.index >= data.table.columns.length - 3) {
                  const val = cellText.replace(/[^\d,-]/g, '');
                  if (val.startsWith('(') || val.startsWith('-')) {
                    data.cell.styles.textColor = [220, 38, 38];
                  }
                }
              },
            });
            y = (pdf as any).lastAutoTable?.finalY + 6 || y + 20;
          });
        } else {
          // No table — render as text
          const textContent = bodyEl.textContent || '';
          textContent.split('\n').forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) { y += 3; return; }
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            const lns = pdf.splitTextToSize(trimmed, contentW);
            for (const ln of lns) {
              if (y > pageH - margin - 10) { pdf.addPage(); y = margin; }
              pdf.text(String(ln), margin, y);
              y += 4;
            }
          });
        }
      }

      // ── Tanda tangan (only on last page) ────────
      y = addPdfSignature(pdf, tenant, pageW, pageH, margin, y);

      // ── Footer (every page) ──────────────────────
      const finalPageNum = (pdf as any).internal.getNumberOfPages();
      for (let i = 1; i <= finalPageNum; i++) {
        pdf.setPage(i);
        const h = pdf.internal.pageSize.getHeight();
        addPdfFooter(pdf, pageW, h, margin, title, i, finalPageNum);
      }

      // ── Save ────────────────────────────────────
      const fileName = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF generation failed:', err);
      window.print();
    } finally {
      setGenerating(false);
    }
  }, [title, periodLabel, accountLabel, landscape, tenant, logoDataUrl]);

  // ── Build alamat ───────────────────────────────────
  const alamat = tenant
    ? `Alamat: ${tenant.desa || ''}, Kec. ${tenant.kecamatan || ''}, Kab. ${tenant.kabupaten || ''}${tenant.provinsi ? ', ' + tenant.provinsi : ''}`
    : '';

  const namaBumdes = tenant?.nama_bumdes?.toUpperCase() || 'BUM DESA';
  const namaDesa = tenant?.desa || '';
  const noSertifikat = tenant?.nomor_sertifikat || '-';
  const npwp = tenant?.npwp || '-';

  if (!isOpen) return null;

  const pageStyle = landscape ? 'A4 landscape' : 'A4';

  const content = (
    <>
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-area { display: block !important; position: static !important; overflow: visible !important; }
          .print-area table { width: 100%; border-collapse: collapse; }
          .print-area td { padding: 1px 0; vertical-align: top; }
          @page { size: ${pageStyle}; margin: 1.5cm 1.8cm; }
        }
        .print-input {
          border: none; outline: none; box-shadow: none; padding: 0; background: transparent;
          font-weight: bold; text-align: center; width: 100%;
          border-bottom: 1px solid #1e293b; padding-bottom: 1px;
        }
        .print-input-date {
          border: none; outline: none; box-shadow: none; padding: 0; background: transparent;
          font-weight: 500; text-align: center; width: auto; max-width: 280px;
          border-bottom: 1px dashed #94a3b8; padding-bottom: 1px;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="no-print fixed inset-0 z-[9999] bg-black/50 sm:flex sm:items-center sm:justify-center sm:p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          ref={printRef}
          className="no-print relative z-[10000] bg-white flex flex-col h-full sm:h-auto sm:rounded-2xl sm:shadow-2xl sm:overflow-hidden"
          style={{
            maxWidth: landscape ? '297mm' : '210mm',
            maxHeight: '100vh',
            ...(typeof window !== 'undefined' && window.innerWidth >= 640 ? { maxHeight: '92vh' } : {}),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Toolbar */}
          <div className="no-print flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
            <h3 className="text-sm font-semibold text-slate-700 truncate">
              Cetak {title}
            </h3>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleGeneratePdf}
                disabled={generating}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:shadow-lg transition-all whitespace-nowrap disabled:opacity-50"
              >
                {generating ? '⏳ Generating...' : '📄 Cetak / PDF'}
              </button>
              <button
                onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-all whitespace-nowrap"
              >
                ✕ Tutup
              </button>
            </div>
          </div>

          {/* Scrollable preview */}
          <div
            className="flex-1 overflow-y-auto p-4 sm:p-6"
            style={{ background: '#fff' }}
          >
            <div
              ref={printAreaRef}
              className="print-area mx-auto"
              style={{
                fontFamily: "'Segoe UI', 'Arial', sans-serif",
                maxWidth: landscape ? '277mm' : '190mm',
              }}
            >
              {/* KOP SURAT */}
              <div className="text-center">
                {/* Logo tengah */}
                <div className="flex justify-center mb-2">
                  {tenant?.logo_url ? (
                    <img
                      src={tenant.logo_url}
                      alt="Logo"
                      className="w-14 h-14 object-contain print:w-14 print:h-14"
                    />
                  ) : (
                    <div style={{ width: 56, height: 1 }} /> /* empty space */
                  )}
                </div>

                <h1 className="text-lg font-bold text-slate-900 uppercase tracking-wide leading-tight">
                  {namaBumdes}
                </h1>
                {namaDesa && (
                  <p className="text-base font-bold text-slate-800 mt-0.5">{namaDesa}</p>
                )}
                <p className="text-[10px] text-slate-600 mt-1">
                  Nomor Sertifikat Badan Hukum: {noSertifikat}
                </p>
                <p className="text-[10px] text-slate-600">
                  NPWP: {npwp}
                </p>
                <p className="text-[10px] text-slate-600">{alamat}</p>
              </div>

              {/* Garis batas ganda */}
              <div className="border-b-4 border-double border-gray-800 my-3" />

              {/* JUDUL */}
              <h2 className="text-center font-bold text-slate-900 text-sm uppercase mb-0.5">
                {title}
              </h2>
              {accountLabel && (
                <p className="text-center text-[11px] text-slate-700 mb-0.5">
                  {accountLabel}
                </p>
              )}
              {periodLabel && (
                <p className="text-center text-[11px] text-slate-700 mb-0.5">
                  {periodLabel}
                </p>
              )}
              <p className="text-center text-[10px] text-slate-400 mb-3">
                (Dalam Rupiah)
              </p>

              {/* BODY */}
              <div className="print-body text-[11px]">{children}</div>

              {/* TANDA TANGAN */}
              <div className="mt-8 mb-4 print:break-inside-avoid">
                <table style={{ width: '90%', margin: '0 auto' }}>
                  <tbody>
                    <tr>
                      <td className="text-center align-top" style={{ width: '42%' }}>
                        <p className="text-[11px] text-slate-600">Mengetahui,</p>
                      </td>
                      <td style={{ width: '16%' }}></td>
                      <td className="text-center align-top" style={{ width: '42%' }}>
                        <input
                          type="text"
                          className="print-input-date"
                          value={tglCetak}
                          onChange={(e) => setTglCetak(e.target.value)}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="text-center align-top">
                        <p className="text-[11px] font-bold text-slate-800 mt-0.5">
                          Direktur {tenant?.nama_bumdes || 'BUM Desa'}
                        </p>
                      </td>
                      <td></td>
                      <td className="text-center align-top">
                        <p className="text-[11px] font-bold text-slate-800 mt-0.5">
                          Disusun oleh,
                        </p>
                        <p className="text-[11px] text-slate-700">
                          Bendahara {tenant?.nama_bumdes || 'BUM Desa'}
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="text-center align-bottom"
                        style={{ paddingTop: '56px' }}
                      >
                        <input
                          type="text"
                          className="print-input"
                          value={namaDirektur}
                          onChange={(e) => setNamaDirektur(e.target.value)}
                        />
                      </td>
                      <td></td>
                      <td
                        className="text-center align-bottom"
                        style={{ paddingTop: '56px' }}
                      >
                        <input
                          type="text"
                          className="print-input"
                          value={namaBendahara}
                          onChange={(e) => setNamaBendahara(e.target.value)}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Branding footer */}
              <div className="flex items-center justify-center gap-1.5 pt-2 border-t border-slate-200">
                <p className="text-[7px] text-slate-400">
                  Dicetak dengan <strong className="text-slate-500">SILABU DIGI</strong> — Sistem Akuntansi BUM Desa
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
