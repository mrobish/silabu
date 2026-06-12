import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

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
              <button onClick={() => window.print()}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:shadow-lg transition-all whitespace-nowrap">
                🖨 Cetak / PDF
              </button>
              <button onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-all whitespace-nowrap">
                ✕ Tutup
              </button>
            </div>
          </div>

          {/* Scrollable preview */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6" style={{ background: '#fff' }}>
            <div className="print-area mx-auto" style={{
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
                <div className="flex justify-between" style={{ maxWidth: '90%', margin: '0 auto' }}>
                  {/* Direktur — kiri */}
                  <div className="text-center" style={{ width: '42%' }}>
                    <p className="text-[11px] text-slate-600">Mengetahui,</p>
                    <p className="text-[11px] font-bold text-slate-800 mt-0.5">DIREKTUR</p>
                    <p className="text-[11px] text-slate-700 mb-1">{tenant?.nama_bumdes || 'BUM Desa'}</p>
                    <div style={{ height: '56px' }} />
                    <input type="text" className="print-input"
                      value={namaDirektur} onChange={e => setNamaDirektur(e.target.value)} />
                  </div>

                  {/* Bendahara — kanan, titimangsa di atas */}
                  <div className="text-center" style={{ width: '42%' }}>
                    <input type="text" className="print-input-date"
                      value={tglCetak} onChange={e => setTglCetak(e.target.value)} />
                    <p className="text-[11px] font-bold text-slate-800 mt-1">BENDAHARA</p>
                    <p className="text-[11px] text-slate-700 mb-1">{tenant?.nama_bumdes || 'BUM Desa'}</p>
                    <div style={{ height: '56px' }} />
                    <input type="text" className="print-input"
                      value={namaBendahara} onChange={e => setNamaBendahara(e.target.value)} />
                  </div>
                </div>
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
