import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type TenantProfile = {
  nama_bumdes: string;
  provinsi?: string;
  kabupaten?: string;
  kecamatan?: string;
  desa?: string;
  tahun_berdiri?: number;
  telpon?: string;
  nama_direktur?: string;
  nama_bendahara?: string;
  logo_url?: string;
};

interface Props {
  children: React.ReactNode;
  title: string;
  isOpen: boolean;
  onClose: () => void;
  periodLabel?: string;
  landscape?: boolean;
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function ReportPrintLayout({ children, title, isOpen, onClose, periodLabel, landscape }: Props) {
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const today = new Date();
  const [tglCetak, setTglCetak] = useState(`${today.getDate()} ${MONTHS[today.getMonth()]} ${today.getFullYear()}`);
  const [namaBendahara, setNamaBendahara] = useState('');
  const [namaDirektur, setNamaDirektur] = useState('');
  const printRef = useRef<HTMLDivElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const handleGeneratePdf = async () => {
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

      // Helper: add text with auto-wrap
      const addText = (text: string, fontSize: number, style: 'normal' | 'bold' = 'normal', align: 'left' | 'center' | 'right' = 'left', color: [number, number, number] = [30, 41, 59]) => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', style);
        pdf.setTextColor(color[0], color[1], color[2]);
        const lines = pdf.splitTextToSize(text, contentW);
        lines.forEach((line: string) => {
          if (y > pageH - margin - 10) {
            pdf.addPage();
            y = margin;
          }
          if (align === 'center') {
            pdf.text(line, pageW / 2, y, { align: 'center' });
          } else if (align === 'right') {
            pdf.text(line, pageW - margin, y, { align: 'right' });
          } else {
            pdf.text(line, margin, y);
          }
          y += fontSize * 0.45;
        });
      };

      const addGap = (mm: number) => { y += mm; };
      const addLine = (thickness: number = 0.5) => {
        if (y > pageH - margin - 10) { pdf.addPage(); y = margin; }
        pdf.setDrawColor(30, 41, 59);
        pdf.setLineWidth(thickness);
        pdf.line(margin, y, pageW - margin, y);
        y += 2;
      };

      // === KOP SURAT ===
      const namaBumdes = tenant?.nama_bumdes || 'BUM DESA';
      addText(namaBumdes.toUpperCase(), 16, 'bold', 'center', [15, 23, 42]);
      addGap(2);
      const alamat = tenant
        ? `${tenant.desa || ''}, Kec. ${tenant.kecamatan || ''}, ${tenant.kabupaten || ''}`
        : '';
      addText(alamat, 9, 'normal', 'center', [100, 116, 139]);
      if (tenant?.telpon) {
        addText(`Telp. ${tenant.telpon}`, 8, 'normal', 'center', [148, 163, 184]);
      }
      addGap(4);
      addLine(0.8);
      addLine(1.2);
      addGap(4);

      // === JUDUL ===
      addText(title.toUpperCase(), 12, 'bold', 'center', [15, 23, 42]);
      if (periodLabel) {
        addGap(1);
        addText(periodLabel, 9, 'normal', 'center', [71, 85, 105]);
      }
      addGap(1);
      addText('(Dalam Rupiah)', 8, 'normal', 'center', [148, 163, 184]);
      addGap(6);

      // === Parse content from DOM ===
      const bodyEl = printAreaRef.current.querySelector('.print-body');
      if (bodyEl) {
        // Look for tables first
        const tables = bodyEl.querySelectorAll('table');
        if (tables.length > 0) {
          tables.forEach(table => {
            const headers: string[][] = [];
            const rows: string[][] = [];

            table.querySelectorAll('thead tr').forEach(tr => {
              const row: string[] = [];
              tr.querySelectorAll('th').forEach(th => row.push(th.textContent?.trim() || ''));
              if (row.length > 0) headers.push(row);
            });

            table.querySelectorAll('tbody tr').forEach(tr => {
              const row: string[] = [];
              tr.querySelectorAll('td').forEach(td => row.push(td.textContent?.trim() || ''));
              if (row.length > 0) rows.push(row);
            });

            // If no thead, treat first row as header
            if (headers.length === 0 && rows.length > 0) {
              headers.push(rows.shift()!);
            }

            autoTable(pdf, {
              head: headers,
              body: rows,
              startY: y,
              margin: { left: margin, right: margin },
              styles: {
                fontSize: 9,
                cellPadding: 2,
                textColor: [30, 41, 59],
                lineColor: [203, 213, 225],
                lineWidth: 0.1,
              },
              headStyles: {
                fillColor: [241, 245, 249],
                textColor: [15, 23, 42],
                fontStyle: 'bold',
                fontSize: 9,
              },
              alternateRowStyles: {
                fillColor: [248, 250, 252],
              },
              columnStyles: headers[0]?.reduce((acc, _, i) => {
                // Right-align last column (usually amounts)
                if (i === headers[0].length - 1) {
                  acc[i] = { halign: 'right', fontStyle: 'normal' };
                }
                return acc;
              }, {} as Record<number, any>) || {},
              didParseCell: (data) => {
                // Bold for rows containing "Modal Akhir", "TOTAL", "Laba Bersih", etc.
                const cellText = data.cell.raw?.toString() || '';
                if (cellText.includes('Modal Akhir') || cellText.includes('TOTAL') || cellText.includes('Laba Bersih') || cellText.includes('Modal Awal')) {
                  data.cell.styles.fontStyle = 'bold';
                }
                // Highlight summary rows
                if (cellText.includes('Modal Akhir')) {
                  data.cell.styles.fillColor = [209, 250, 229];
                  data.cell.styles.textColor = [5, 46, 22];
                }
                // Red for negative amounts
                if (data.section === 'body' && data.column.index === data.table.columns.length - 1) {
                  const val = cellText.replace(/[^\d,-]/g, '');
                  if (val.startsWith('-') || val.startsWith('(') || cellText.includes('(Rp')) {
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
          textContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) { addGap(3); return; }
            if (trimmed.includes('TOTAL') || trimmed.includes('Modal Akhir') || trimmed.includes('Modal Awal')) {
              addText(trimmed, 10, 'bold');
            } else {
              addText(trimmed, 9);
            }
            addGap(1);
          });
        }
      }

      // === SIGNATURE ===
      addGap(15);
      const sigY = y;
      const sigColW = contentW * 0.42;
      const sigLeftX = margin;
      const sigRightX = pageW - margin - sigColW;
      const sigCenterGap = margin + contentW * 0.5;

      // Left signature
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text('Mengetahui,', sigLeftX, sigY);

      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59);
      pdf.text('DIREKTUR', sigLeftX, sigY + 5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text(namaBumdes, sigLeftX, sigY + 9);

      // Signature line left
      pdf.setDrawColor(30, 41, 59);
      pdf.setLineWidth(0.3);
      pdf.line(sigLeftX, sigY + 24, sigLeftX + sigColW, sigY + 24);

      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59);
      pdf.text(namaDirektur || '________________', sigLeftX, sigY + 28);

      // Right signature
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text(tglCetak, sigRightX, sigY);

      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59);
      pdf.text('BENDAHARA', sigRightX, sigY + 5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text(namaBumdes, sigRightX, sigY + 9);

      // Signature line right
      pdf.line(sigRightX, sigY + 24, sigRightX + sigColW, sigY + 24);

      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59);
      pdf.text(namaBendahara || '________________', sigRightX, sigY + 28);

      // === BRANDING ===
      y = Math.max(sigY + 38, y + 10);
      if (y > pageH - margin) { pdf.addPage(); y = margin; }
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(148, 163, 184);
      pdf.text('Dicetak dengan SILABU DIGI — Sistem Akuntansi BUM Desa', pageW / 2, y, { align: 'center' });

      // Save
      const fileName = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF generation failed:', err);
      window.print();
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
        const res = await fetch('/api/tenant/profile', { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        const p = data?.profile;
        if (p) {
          setTenant(p);
          setTglCetak(`${p.desa || p.kecamatan || ''}, ${today.getDate()} ${MONTHS[today.getMonth()]} ${today.getFullYear()}`);
          setNamaBendahara(p.nama_bendahara || '');
          setNamaDirektur(p.nama_direktur || '');
        }
      } catch {}
    })();
  }, [isOpen]);

  const alamat = tenant
    ? `${tenant.desa || ''}, Kec. ${tenant.kecamatan || ''}, ${tenant.kabupaten || ''}${tenant.provinsi ? ', ' + tenant.provinsi : ''}`
    : '';

  if (!isOpen) return null;

  const pageStyle = landscape ? 'A4 landscape' : 'A4';

  const content = (
    <>
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-area { display: block !important; position: static !important; overflow: visible !important; }
          .print-area input { border: none !important; outline: none !important; box-shadow: none !important; padding: 0 !important; background: transparent !important; font-weight: inherit !important; }
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
        .print-branding {
          margin-top: 20px;
          padding-top: 8px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .print-branding img { width: 14px; height: 14px; opacity: 0.35; }
        .print-branding p { font-size: 8px; color: #94a3b8; letter-spacing: 0.03em; }
        .print-branding strong { color: #64748b; font-weight: 600; }
      `}</style>

      {/* Backdrop */}
      <div className="no-print fixed inset-0 z-[9999] bg-black/50 sm:flex sm:items-center sm:justify-center sm:p-4"
        onClick={onClose}>
        {/* Modal — full-screen on mobile, centered on desktop */}
        <div ref={printRef}
          className="no-print relative z-[10000] bg-white flex flex-col h-full sm:h-auto sm:rounded-2xl sm:shadow-2xl sm:overflow-hidden"
          style={{ maxWidth: landscape ? '297mm' : '210mm', maxHeight: '100vh', ...(typeof window !== 'undefined' && window.innerWidth >= 640 ? { maxHeight: '92vh' } : {}) }}
          onClick={e => e.stopPropagation()}>
          {/* Toolbar — always visible at top */}
          <div className="no-print flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
            <h3 className="text-sm font-semibold text-slate-700 truncate">Cetak {title}</h3>
            <div className="flex gap-2 shrink-0">
              <button onClick={handleGeneratePdf} disabled={generating}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:shadow-lg transition-all whitespace-nowrap disabled:opacity-50">
                {generating ? '⏳ Generating...' : '📄 Cetak / PDF'}
              </button>
              <button onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-all whitespace-nowrap">
                ✕ Tutup
              </button>
            </div>
          </div>

          {/* Scrollable preview */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6" style={{ background: '#fff' }}>
            <div ref={printAreaRef} className="print-area mx-auto" style={{
              fontFamily: "'Segoe UI', 'Arial', sans-serif",
              maxWidth: landscape ? '277mm' : '190mm',
            }}>
              {/* KOP SURAT */}
              <div className="text-center mb-3">
                <div className="flex justify-center mb-1.5">
                  {tenant?.logo_url
                    ? <img src={tenant.logo_url} alt="Logo" className="w-14 h-14 object-contain" />
                    : <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-lg font-bold">
                        {tenant?.nama_bumdes?.[0] || 'B'}
                      </div>
                  }
                </div>
                <h1 className="text-[16px] font-bold text-slate-900 uppercase tracking-wide leading-tight">{tenant?.nama_bumdes || 'BUM DESA'}</h1>
                <p className="text-[11px] text-slate-600 mt-0.5">{alamat}</p>
                {tenant?.telpon && <p className="text-[10px] text-slate-400">Telp. {tenant.telpon}</p>}
              </div>
              <div className="border-b-2 border-slate-900 mb-2" />
              <div className="border-b-[3px] border-slate-900 mb-3" />

              {/* JUDUL + PERIODE */}
              <h2 className="text-center font-bold text-slate-900 text-[13px] uppercase mb-0.5">{title}</h2>
              {periodLabel && <p className="text-center text-[11px] text-slate-700 mb-0.5">{periodLabel}</p>}
              <p className="text-center text-[10px] text-slate-400 mb-3">(Dalam Rupiah)</p>

              {/* BODY */}
              <div className="print-body text-[11px]">{children}</div>

              {/* FOOTER — Tanda Tangan */}
              <div className="mt-8 mb-4">
                <table style={{ width: '90%', margin: '0 auto' }}>
                  <tbody>
                    <tr>
                      <td className="text-center" style={{ width: '42%', verticalAlign: 'top' }}>
                        <p className="text-[11px] text-slate-600">Mengetahui,</p>
                      </td>
                      <td style={{ width: '16%' }}></td>
                      <td className="text-center" style={{ width: '42%', verticalAlign: 'top' }}>
                        <input type="text" className="print-input-date"
                          value={tglCetak} onChange={e => setTglCetak(e.target.value)} />
                      </td>
                    </tr>
                    <tr>
                      <td className="text-center" style={{ verticalAlign: 'top' }}>
                        <p className="text-[11px] font-bold text-slate-800 mt-0.5">DIREKTUR</p>
                        <p className="text-[11px] text-slate-700">{tenant?.nama_bumdes || 'BUM Desa'}</p>
                      </td>
                      <td></td>
                      <td className="text-center" style={{ verticalAlign: 'top' }}>
                        <p className="text-[11px] font-bold text-slate-800 mt-0.5">BENDAHARA</p>
                        <p className="text-[11px] text-slate-700">{tenant?.nama_bumdes || 'BUM Desa'}</p>
                      </td>
                    </tr>
                    <tr>
                      <td className="text-center" style={{ paddingTop: '56px', verticalAlign: 'bottom' }}>
                        <input type="text" className="print-input"
                          value={namaDirektur} onChange={e => setNamaDirektur(e.target.value)} />
                      </td>
                      <td></td>
                      <td className="text-center" style={{ paddingTop: '56px', verticalAlign: 'bottom' }}>
                        <input type="text" className="print-input"
                          value={namaBendahara} onChange={e => setNamaBendahara(e.target.value)} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Branding footer */}
              <div className="print-branding">
                <img src="/logo.png" alt="" />
                <p>Dicetak dengan <strong>SILABU DIGI</strong> — Sistem Akuntansi BUM Desa</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
