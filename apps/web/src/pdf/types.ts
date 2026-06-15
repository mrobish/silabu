// ─── Types for PdfTemplate system — SILABU DIGI ────────────────

export interface TenantProfile {
  nama_bumdes: string;
  provinsi?: string;
  kabupaten?: string;
  kecamatan?: string;
  desa?: string;
  tahun_berdiri?: number;
  telpon?: string;
  npwp?: string;
  nomor_sertifikat?: string;
  nomor_perdes?: string;
  logo_url?: string;
  nama_direktur?: string;
  nama_bendahara?: string;
}

export interface PdfTemplateProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  periodLabel?: string;
  accountLabel?: string;
  landscape?: boolean;
  children: React.ReactNode;
}
