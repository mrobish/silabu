// ─── PrintableReportLayout — HTML Print-based Report Component ──
//
// Strategy: HTML Preview → window.print() → Save as PDF
// No jsPDF, no screenshots. Clean, selectable, lightweight PDF.
//
// Props: title, isOpen, onClose, periodLabel, accountLabel, landscape, children
//
// Uses CSS @page rules from print.css for consistent PDF output.
// Signature and kop are rendered in HTML (not injected via jsPDF).
//
// Buku Besar and Laba Rugi still use the old PdfTemplate (jsPDF-based).
// This component is for NEW reports only.
//
// ────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { TenantProfile } from '../pdf/types';
import './print.css';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

interface PrintableReportLayoutProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  periodLabel?: string;
  accountLabel?: string;
  landscape?: boolean;
  children: React.ReactNode;
}

export default function PrintableReportLayout({
  title,
  isOpen,
  onClose,
  periodLabel,
  accountLabel,
  landscape,
  children,
}: PrintableReportLayoutProps) {
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const today = new Date();
  const [tglCetak, setTglCetak] = useState(
    `${today.getDate()} ${MONTHS[today.getMonth()]} ${today.getFullYear()}`,
  );
  const [namaBendahara, setNamaBendahara] = useState('');
  const [namaDirektur, setNamaDirektur] = useState('');
  const printRef = useRef<HTMLDivElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

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
        // Silently fail
      }
    })();
  }, [isOpen]);

  // ── Handle Print ──────────────────────────────────
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // ── Build alamat ──────────────────────────────────
  const alamat = tenant
    ? `Alamat: ${tenant.desa || ''}, Kec. ${tenant.kecamatan || ''}, Kab. ${tenant.kabupaten || ''}${tenant.provinsi ? ', ' + tenant.provinsi : ''}`
    : '';

  const namaBumdes = tenant?.nama_bumdes?.toUpperCase() || 'BUM DESA';
  const noSertifikat = tenant?.nomor_sertifikat || '-';
  const npwp = tenant?.npwp || '-';

  if (!isOpen) return null;

  const pageClass = landscape ? 'print-landscape' : '';

  const content = (
    <>
      <style>{`
        @media print {
          @page {
            size: ${landscape ? 'A4 landscape' : 'A4 portrait'};
            margin: 15mm;
          }
          body { margin: 0; padding: 0; font-size: 11px; }
          .no-print { display: none !important; }
          .print-area { display: block !important; position: static !important; overflow: visible !important; }
          .print-area table { width: 100%; border-collapse: collapse; }
          .print-area td, .print-area th { padding: 2px 4px; vertical-align: top; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          .print-signature { break-inside: avoid; page-break-inside: avoid; }
        }
        .print-input-date {
          border: none; outline: none; box-shadow: none; padding: 0; background: transparent;
          font-weight: 500; text-align: center; width: auto; max-width: 280px;
          border-bottom: 1px dashed #94a3b8; padding-bottom: 1px;
        }
      `}</style>

      {/* Backdrop (no-print) */}
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
                onClick={handlePrint}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:shadow-lg transition-all whitespace-nowrap"
              >
                🖨️ Cetak / PDF
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
              className={`print-area mx-auto ${pageClass}`}
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
                    <div style={{ width: 56, height: 1 }} />
                  )}
                </div>

                <h1 className="text-lg font-bold text-slate-900 uppercase tracking-wide leading-tight">
                  {namaBumdes}
                </h1>
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
                <p className="text-center text-[11px] text-slate-700 mb-3">
                  {periodLabel}
                </p>
              )}

              {/* BODY */}
              <div className="print-body text-[11px]">{children}</div>

              {/* TANDA TANGAN */}
              <div className="print-signature mt-10 mb-6">
                <table style={{ width: '90%', margin: '0 auto' }}>
                  <tbody>
                    <tr>
                      <td className="text-center align-top" style={{ width: '42%' }}>
                      </td>
                      <td style={{ width: '16%' }}></td>
                      <td className="text-center align-top" style={{ width: '42%' }}>
                        <input
                          type="text"
                          className="print-input-date"
                          style={{ fontSize: '11px', textAlign: 'left' }}
                          value={tglCetak}
                          onChange={(e) => setTglCetak(e.target.value)}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="text-center align-top pt-1">
                        <p className="text-[11px] font-bold text-slate-600">
                          Direktur {tenant?.nama_bumdes || 'BUM Desa'}
                        </p>
                      </td>
                      <td></td>
                      <td className="text-center align-top pt-1">
                        <p className="text-[11px] font-bold text-slate-600">
                          Bendahara {tenant?.nama_bumdes || 'BUM Desa'}
                        </p>
                      </td>
                    </tr>
                    {/* Spasi untuk tanda tangan basah ~22-30mm */}
                    <tr>
                      <td style={{ height: '30mm' }}></td>
                      <td></td>
                      <td style={{ height: '30mm' }}></td>
                    </tr>
                    <tr>
                      <td className="text-center align-top">
                        <p className="text-[11px] text-slate-800 font-semibold">
                          {namaDirektur || '......'}
                        </p>
                        <div className="border-t border-slate-800 mx-auto mt-1" style={{ width: '70%', maxWidth: '120px' }} />
                      </td>
                      <td></td>
                      <td className="text-center align-top">
                        <p className="text-[11px] text-slate-800 font-semibold">
                          {namaBendahara || '......'}
                        </p>
                        <div className="border-t border-slate-800 mx-auto mt-1" style={{ width: '70%', maxWidth: '120px' }} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Footer: nomor halaman (via CSS) */}
              <div className="text-center text-[9px] text-slate-400 mt-4 print:fixed print:bottom-0 print:left-0 print:right-0 print:pb-2">
                <span className="print:inline hidden">
                  Halaman <span className="pageNumber"></span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
