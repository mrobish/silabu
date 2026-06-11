import { useState, useEffect, useRef } from 'react';

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
}

const fmt = (v: number) => 'Rp ' + Math.abs(v).toLocaleString('id-ID');

export default function ReportPrintLayout({ children, title, isOpen, onClose }: Props) {
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const [tglCetak, setTglCetak] = useState('');
  const [namaBendahara, setNamaBendahara] = useState('');
  const [namaDirektur, setNamaDirektur] = useState('');
  const printRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/tenant/profile', {
          headers: { Authorization: 'Bearer ' + token }
        });
        const data = await res.json();
        const p = data?.profile;
        if (p) {
          setTenant(p);
          const kab = p.kabupaten || '';
          const tgl = `${p.desa || p.kecamatan || ''}, ${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;
          setTglCetak(tgl);
          setNamaBendahara(p.nama_bendahara || '');
          setNamaDirektur(p.nama_direktur || '');
        }
      } catch {}
    })();
  }, [isOpen]);

  const alamat = tenant
    ? `${tenant.desa || ''}, Kec. ${tenant.kecamatan || ''}, ${tenant.kabupaten || ''}${tenant.provinsi ? ', ' + tenant.provinsi : ''}`
    : '';

  function handlePrint() {
    window.print();
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Print-only style @media */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-area { display: block !important; position: static !important; overflow: visible !important; }
          @page { size: A4; margin: 1.5cm 1.8cm; }
        }
      `}</style>

      {/* Overlay — hidden when printing */}
      <div className={`no-print fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 print-area`}
        style={{ background: 'rgba(0,0,0,0.4)' }}>
        <div ref={printRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-[210mm] max-h-[90vh] flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="no-print flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-700">Cetak {title}</h3>
            <div className="flex gap-2">
              <button onClick={handlePrint}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:shadow-lg transition-all">
                🖨 Cetak / Simpan PDF
              </button>
              <button onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-all">
                ✕ Tutup
              </button>
            </div>
          </div>

          {/* Scrollable print preview area */}
          <div className="flex-1 overflow-y-auto p-6" style={{ background: '#fff' }}>
            <div className="print-area max-w-[190mm] mx-auto" style={{ fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>
              {/* KOP SURAT */}
              <div className="text-center mb-4">
                {/* Logo placeholder */}
                <div className="flex justify-center mb-2">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-lg font-bold">
                    {tenant?.nama_bumdes?.[0] || 'B'}
                  </div>
                </div>
                <h1 className="text-lg font-bold text-slate-900 uppercase tracking-wide">{tenant?.nama_bumdes || 'BUM Desa'}</h1>
                <p className="text-[11px] text-slate-500 mt-0.5">{alamat}</p>
                {tenant?.telpon && <p className="text-[10px] text-slate-400">Telp. {tenant.telpon}</p>}
              </div>
              <hr className="border-t-2 border-slate-800 mb-3" />

              {/* JUDUL LAPORAN */}
              <h2 className="text-center font-bold text-slate-900 text-sm uppercase mb-1">{title}</h2>
              <p className="text-center text-[10px] text-slate-500 mb-4">(Dalam Rupiah)</p>

              {/* BODY — children */}
              <div className="print-body text-[11px]">
                {children}
              </div>

              {/* FOOTER — Tanda Tangan */}
              <div className="mt-8 mb-4">
                <p className="text-center text-[11px] text-slate-700 font-medium">
                  <span contentEditable suppressContentEditableWarning
                    className="border-b border-dashed border-slate-300 px-1 outline-emerald-400"
                    onBlur={e => setTglCetak(e.currentTarget.textContent || '')}
                  >{tglCetak}</span>
                </p>

                <div className="flex justify-between mt-8" style={{ maxWidth: '90%', margin: '2rem auto 0' }}>
                  {/* Left: Bendahara */}
                  <div className="text-center" style={{ width: '45%' }}>
                    <p className="text-[11px] text-slate-600">Disusun oleh,</p>
                    <p className="text-[11px] font-bold text-slate-800 mt-0.5">BENDAHARA</p>
                    <p className="text-[11px] text-slate-700 mb-1">BUM Desa {tenant?.nama_bumdes || '...'}</p>
                    <div style={{ height: '70px' }}></div>
                    <p className="text-[11px] font-semibold text-slate-800 mt-1">
                      (<span contentEditable suppressContentEditableWarning
                        className="border-b border-slate-800 px-2 outline-emerald-400"
                        onBlur={e => setNamaBendahara(e.currentTarget.textContent || '')}
                      >{namaBendahara}</span>)
                    </p>
                  </div>

                  {/* Right: Direktur */}
                  <div className="text-center" style={{ width: '45%' }}>
                    <p className="text-[11px] text-slate-600">Mengetahui,</p>
                    <p className="text-[11px] font-bold text-slate-800 mt-0.5">DIREKTUR</p>
                    <p className="text-[11px] text-slate-700 mb-1">BUM Desa {tenant?.nama_bumdes || '...'}</p>
                    <div style={{ height: '70px' }}></div>
                    <p className="text-[11px] font-semibold text-slate-800 mt-1">
                      (<span contentEditable suppressContentEditableWarning
                        className="border-b border-slate-800 px-2 outline-emerald-400"
                        onBlur={e => setNamaDirektur(e.currentTarget.textContent || '')}
                      >{namaDirektur}</span>)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
