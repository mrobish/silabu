import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

function formatRupiah(v?: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
}
function formatDate(v?: string) {
  if (!v) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(v));
}
function formatDateShort(v?: string) {
  if (!v) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(v));
}

type InvoiceData = {
  id: string;
  merchant_ref: string;
  reference: string;
  amount: number;
  fee: number;
  total_amount: number;
  status: string;
  paid_at: string;
  created_at: string;
  tenant: {
    nama_bumdes: string;
    provinsi: string;
    kabupaten: string;
    kecamatan: string;
    desa: string;
    nama_direktur: string;
    nama_bendahara: string;
    npwp: string;
  };
  vendor: { nama: string; alamat: string; email: string };
  product: { name: string; period: string; price: number };
};

export default function InvoicePage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const [data, setData] = useState<InvoiceData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    fetch(`/api/subscription/invoice/${paymentId}`, { headers: { Authorization: 'Bearer ' + token } })
      .then(async r => {
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || 'Gagal memuat invoice');
        setData(j.invoice);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [paymentId]);

  if (loading) return <div style={{ padding: 40, fontFamily: 'system-ui' }}>Memuat invoice...</div>;
  if (error) return <div style={{ padding: 40, fontFamily: 'system-ui', color: '#dc2626' }}>Error: {error}</div>;
  if (!data) return null;

  const t = data.tenant;
  const v = data.vendor;
  const addr = [t.desa, t.kecamatan, t.kabupaten, t.provinsi].filter(Boolean).join(', ');

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 15mm 20mm; size: A4; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1e293b; background: #f1f5f9; }
        .invoice-wrap { max-width: 800px; margin: 20px auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden; }
        @media print { .invoice-wrap { box-shadow: none; border-radius: 0; margin: 0; max-width: 100%; } }
        .header-band { background: linear-gradient(135deg, #059669, #0891b2); color: #fff; padding: 32px 40px; }
        .header-band h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
        .header-band p { font-size: 13px; opacity: 0.85; margin-top: 4px; }
        .body { padding: 32px 40px; }
        .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #059669; margin-bottom: 10px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
        .info-box { }
        .info-box dt { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-box dd { font-size: 14px; font-weight: 600; color: #0f172a; margin-top: 2px; }
        .divider { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
        table.items { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        table.items th { background: #f8fafc; text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
        table.items td { padding: 12px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
        .total-row td { font-weight: 800; font-size: 16px; color: #059669; border-top: 2px solid #059669; border-bottom: none; padding-top: 16px; }
        .status-badge { display: inline-block; padding: 4px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; background: #dcfce7; color: #16a34a; }
        .sign-area { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; }
        .sign-box { text-align: center; }
        .sign-line { border-top: 1px solid #cbd5e1; margin-top: 60px; padding-top: 8px; }
        .sign-name { font-weight: 700; font-size: 13px; }
        .sign-role { font-size: 11px; color: #64748b; }
        .footer { background: #f8fafc; padding: 20px 40px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
        .footer-brand { font-size: 11px; color: #94a3b8; }
        .footer-brand strong { color: #059669; }
        .btn-print { display: inline-flex; align-items: center; gap: 8px; padding: 12px 28px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; border: none; transition: all 0.2s; }
        .btn-print.primary { background: linear-gradient(135deg, #059669, #0891b2); color: #fff; box-shadow: 0 4px 12px rgba(5,150,105,0.3); }
        .btn-print.primary:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(5,150,105,0.4); }
        .toolbar { display: flex; justify-content: space-between; align-items: center; padding: 16px 40px; }
      `}</style>

      <div className="no-print" style={{ background: '#f1f5f9', padding: '16px 0' }}>
        <div className="toolbar">
          <button onClick={() => window.history.back()} className="btn-print" style={{ background: '#e2e8f0', color: '#475569' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Kembali
          </button>
          <button onClick={() => window.print()} className="btn-print primary">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Cetak / Save PDF
          </button>
        </div>
      </div>

      <div className="invoice-wrap">
        <div className="header-band">
          <h1>BUKTI PEMBAYARAN</h1>
          <p>Invoice #{data.merchant_ref}</p>
        </div>

        <div className="body">
          <div className="info-grid">
            <div className="info-box">
              <p className="section-title">Penerbit Tagihan</p>
              <dt>Nama Vendor</dt>
              <dd>{v.nama}</dd>
              <dt style={{ marginTop: 8 }}>Alamat</dt>
              <dd>{v.alamat}</dd>
              <dt style={{ marginTop: 8 }}>Email</dt>
              <dd>{v.email}</dd>
            </div>
            <div className="info-box">
              <p className="section-title">Tagihan Kepada</p>
              <dt>Nama BUM Desa</dt>
              <dd>{t.nama_bumdes}</dd>
              <dt style={{ marginTop: 8 }}>Alamat</dt>
              <dd>{addr || '-'}</dd>
              {t.npwp && <><dt style={{ marginTop: 8 }}>NPWP</dt><dd>{t.npwp}</dd></>}
              <dt style={{ marginTop: 8 }}>Direktur</dt>
              <dd>{t.nama_direktur || '-'}</dd>
            </div>
          </div>

          <hr className="divider" />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <dt style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>TANGGAL TRANSAKSI</dt>
              <dd style={{ fontSize: 14, fontWeight: 600 }}>{formatDate(data.created_at)}</dd>
            </div>
            <div>
              <dt style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>TANGGAL PEMBAYARAN</dt>
              <dd style={{ fontSize: 14, fontWeight: 600 }}>{formatDate(data.paid_at)}</dd>
            </div>
            <div>
              <dt style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>STATUS</dt>
              <dd><span className="status-badge">LUNAS</span></dd>
            </div>
          </div>

          <table className="items">
            <thead>
              <tr>
                <th>Deskripsi</th>
                <th>Periode</th>
                <th style={{ textAlign: 'right' }}>Jumlah</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{data.product.name}</td>
                <td>{data.product.period}</td>
                <td style={{ textAlign: 'right' }}>{formatRupiah(data.product.price)}</td>
              </tr>
              {data.fee > 0 && (
                <tr>
                  <td style={{ color: '#64748b' }}>Biaya Layanan Payment Gateway</td>
                  <td>-</td>
                  <td style={{ textAlign: 'right', color: '#64748b' }}>{formatRupiah(data.fee)}</td>
                </tr>
              )}
              <tr className="total-row">
                <td colSpan={2}>TOTAL DIBAYAR</td>
                <td style={{ textAlign: 'right' }}>{formatRupiah(data.total_amount)}</td>
              </tr>
            </tbody>
          </table>

          <hr className="divider" />

          <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '16px 20px', marginBottom: 8 }}>
            <p style={{ fontSize: 13, color: '#166534' }}>
              <strong>Referensi Pembayaran:</strong> {data.reference || data.merchant_ref}
            </p>
            <p style={{ fontSize: 12, color: '#15803d', marginTop: 4 }}>
              Pembayaran telah diverifikasi oleh sistem. Bukti ini sah untuk lampiran LPJ BUM Desa.
            </p>
          </div>

          <div className="sign-area">
            <div className="sign-box">
              <div className="sign-line">
                <div className="sign-name">{v.nama}</div>
                <div className="sign-role">Penerbit Layanan</div>
              </div>
            </div>
            <div className="sign-box">
              <div className="sign-line">
                <div className="sign-name">{t.nama_bendahara || t.nama_direktur || 'Bendahara BUM Desa'}</div>
                <div className="sign-role">Bendahara — {t.nama_bumdes}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="footer">
          <div className="footer-brand">
            Dicetak dengan <strong>SILABU DIGI</strong> — Sistem Akuntansi BUM Desa
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            {formatDateShort(new Date().toISOString())}
          </div>
        </div>
      </div>
    </>
  );
}
