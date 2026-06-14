/**
 * Quick Transaction Validation (Fix #14 / M10)
 * 
 * Validates sumber_akun_id and target_akun_id for POST /transaksi/quick
 * using database fields (jenisakun, kelompok) instead of hardcoded kode prefixes.
 * 
 * Design: Opsi B — strict validation per transaction type.
 */

import { pool } from '../db.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Kas/Bank account kode prefixes */
const KAS_BANK_PREFIXES = ['1.1.01', '1.1.02', '1.1.04', '1.1.06', '1.1.11'];

/** Blocked kelompok (always blocked for quick transactions) */
const BLOCKED_KELOMPOK = new Set([
  'saldo_laba',           // 3.3.xx — Saldo Laba
  'ikhtisar_laba_rugi',   // Ikhtisar Laba Rugi
  'rk_pusat',             // RK Pusat
]);

/** Blocked kode prefixes (system accounts) */
const BLOCKED_KODE_PREFIXES = ['3.4.', '3.8.', '3.9.'];

/**
 * Allowed target account types per transaction type.
 * Uses jenisakun from chart_of_accounts.
 */
const ALLOWED_TARGET_JENIS: Record<string, Set<string>> = {
  uang_masuk: new Set([
    'pendapatan',       // 4.xx — Pendapatan usaha
    'pendapatan_lain',  // 6.xx — Pendapatan lain-lain
    'kewajiban',        // 2.1.xx — Penerimaan pinjaman
    'ekuitas',          // 3.1.xx — Modal disetor (not saldo_laba)
    'aset',             // 1.1.03 — Piutang (penerimaan piutang)
  ]),
  uang_keluar: new Set([
    'beban',            // 5.xx — Beban operasional
    'beban_lain',       // Beban lain-lain
    'beban_pajak',      // Pajak
    'hpp',              // HPP
    'kewajiban',        // 2.1.xx — Pembayaran utang
    'aset',             // 1.1.05, 1.3.xx — Persediaan, Aset
    'ekuitas',          // 3.2.xx — Prive (hanya pengambilan_pemilik)
  ]),
};

/**
 * Blocked kelompok per transaction type.
 * Even if jenisakun is allowed, certain kelompok are blocked.
 */
const BLOCKED_TARGET_KELOMPOK_PER_TIPE: Record<string, Set<string>> = {
  uang_masuk: new Set([
    'pengambilan_pemilik', // 3.2.xx — Prive (tidak untuk uang_masuk)
    'beban',               // Block beban utama
    'beban_operasional',
    'beban_pemasaran',
    'beban_adum',
    'beban_lain',
    'beban_pajak',
    'hpp',
    'hpp_barang_dagangan',
    'hpp_barang_jadi',
    'hpp_produksi',
    'pajak',
  ]),
  uang_keluar: new Set([
    'pendapatan',             // Block pendapatan utama
    'pendapatan_jasa',
    'pendapatan_lain',
    'penjualan_barang_dagangan',
    'penjualan_barang_jadi',
    'modal_donasi',           // Block modal disetor (bukan untuk keluar)
    'modal_pemilik',
  ]),
};

// ── Validation Functions ──────────────────────────────────────────────────────

/**
 * Check if account kode is Kas/Bank.
 */
export function isKasBankKode(kode: string): boolean {
  const clean = kode.replace(/\s/g, '');
  return KAS_BANK_PREFIXES.some(prefix => clean.startsWith(prefix));
}

/**
 * Check if account is blocked system account.
 */
export function isBlockedSystemAccount(kode: string, kelompok: string): boolean {
  const clean = kode.replace(/\s/g, '');
  if (BLOCKED_KELOMPOK.has(kelompok)) return true;
  if (BLOCKED_KODE_PREFIXES.some(prefix => clean.startsWith(prefix))) return true;
  return false;
}

/**
 * Validate account exists, active, postable, belongs to tenant.
 * Returns account row or error message.
 */
export async function validateAccount(
  akunId: string,
  tenantId: string,
  label: string // e.g. "sumber" or "target"
): Promise<{ ok: true; account: any } | { ok: false; error: string }> {
  // UUID format check
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(akunId)) {
    return { ok: false, error: `Akun ${label} tidak valid (format ID tidak benar)` };
  }

  const res = await pool.query(
    `SELECT id, kode, nama, jenisakun, kelompok, saldonormal, ispostable, isactive, level
     FROM chart_of_accounts
     WHERE id=$1 AND tenant_id=$2`,
    [akunId, tenantId]
  );

  if (!res.rowCount) {
    return { ok: false, error: `Akun ${label} tidak ditemukan` };
  }

  const akun = res.rows[0];

  if (!akun.isactive) {
    return { ok: false, error: `Akun ${label} "${akun.kode} — ${akun.nama}" tidak aktif` };
  }

  if (!akun.ispostable) {
    return { ok: false, error: `Akun ${label} "${akun.kode} — ${akun.nama}" tidak dapat diposting (akun header)` };
  }

  return { ok: true, account: akun };
}

/**
 * Validate source account (sumber_akun_id) for quick transaction.
 * Must be: Kas/Bank, active, postable, belongs to tenant.
 */
export async function validateQuickTxSource(
  sumberAkunId: string,
  tenantId: string
): Promise<{ ok: true; account: any } | { ok: false; error: string }> {
  // Basic validation
  const basic = await validateAccount(sumberAkunId, tenantId, 'sumber');
  if (!basic.ok) return basic;

  const akun = basic.account;

  // Must be Kas/Bank
  if (!isKasBankKode(akun.kode)) {
    return {
      ok: false,
      error: `Akun sumber harus akun Kas/Bank aktif. "${akun.kode} — ${akun.nama}" bukan akun Kas/Bank.`,
    };
  }

  return { ok: true, account: akun };
}

/**
 * Validate target account (target_akun_id) for quick transaction.
 * Must be: active, postable, belongs to tenant, matches transaction type.
 */
export async function validateQuickTxTarget(
  targetAkunId: string,
  tenantId: string,
  tipe: 'uang_masuk' | 'uang_keluar'
): Promise<{ ok: true; account: any } | { ok: false; error: string }> {
  // Basic validation
  const basic = await validateAccount(targetAkunId, tenantId, 'target');
  if (!basic.ok) return basic;

  const akun = basic.account;
  const tipeLabel = tipe === 'uang_masuk' ? 'uang masuk' : 'uang keluar';

  // Check blocked system accounts (always blocked)
  if (isBlockedSystemAccount(akun.kode, akun.kelompok)) {
    if (akun.kelompok === 'saldo_laba') {
      return {
        ok: false,
        error: `Akun Saldo Laba tidak boleh dipakai di Transaksi Cepat`,
      };
    }
    return {
      ok: false,
      error: `Akun "${akun.kode} — ${akun.nama}" adalah akun sistem dan tidak boleh dipakai di Transaksi Cepat`,
    };
  }

  // Check jenisakun is allowed for this transaction type
  const allowedJenis = ALLOWED_TARGET_JENIS[tipe];
  if (!allowedJenis.has(akun.jenisakun)) {
    return {
      ok: false,
      error: `Akun "${akun.kode} — ${akun.nama}" (${akun.jenisakun}) tidak sesuai untuk transaksi ${tipeLabel}`,
    };
  }

  // Check kelompok is not blocked for this transaction type
  const blockedKelompok = BLOCKED_TARGET_KELOMPOK_PER_TIPE[tipe];
  if (blockedKelompok.has(akun.kelompok)) {
    return {
      ok: false,
      error: `Akun "${akun.kode} — ${akun.nama}" (${akun.kelompok}) tidak sesuai untuk transaksi ${tipeLabel}`,
    };
  }

  // Additional check: ekuitas for uang_keluar must be pengambilan_pemilik (Prive)
  if (tipe === 'uang_keluar' && akun.jenisakun === 'ekuitas' && akun.kelompok !== 'pengambilan_pemilik') {
    return {
      ok: false,
      error: `Akun "${akun.kode} — ${akun.nama}" bukan akun Prive. Untuk uang keluar, akun ekuitas harus berupa Prive (pengambilan pemilik).`,
    };
  }

  // Additional check: ekuitas for uang_masuk must NOT be pengambilan_pemilik
  if (tipe === 'uang_masuk' && akun.jenisakun === 'ekuitas' && akun.kelompok === 'pengambilan_pemilik') {
    return {
      ok: false,
      error: `Akun Prive tidak boleh dipakai untuk uang masuk`,
    };
  }

  return { ok: true, account: akun };
}

/**
 * Get allowed target account prefixes for display/debugging.
 * Returns human-readable description.
 */
export function getAllowedTargetDescription(tipe: 'uang_masuk' | 'uang_keluar'): string {
  if (tipe === 'uang_masuk') {
    return 'Pendapatan, Piutang, Utang (penerimaan pinjaman), Modal disetor';
  }
  return 'Beban, HPP, Persediaan, Aset, Utang (pembayaran), Prive';
}
