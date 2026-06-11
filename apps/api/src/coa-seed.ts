import { pool } from './db.js';

/**
 * Default BUMDes Chart of Accounts (Kepmendesa 136 — GoI 1-7).
 * Each tuple: [kode, nama, jenisAkun, kelompok, saldoNormal, isPostable, level]
 */
type CoaRow = [string, string, string, string, 'D' | 'K', boolean, number];

const DEFAULT_COA: CoaRow[] = [
  // Gol 1 — ASET
  ['1.0.00.00', 'Aset', 'aset', 'aset_lancar', 'D', false, 1],
  ['1.1.00.00', 'Aset Lancar', 'aset', 'aset_lancar', 'D', false, 2],
  ['1.1.01.00', 'Kas dan Bank', 'aset', 'aset_lancar', 'D', false, 3],
  ['1.1.01.01', 'Kas Tunai', 'aset', 'aset_lancar', 'D', false, 4],
  ['1.1.01.02', 'Bank', 'aset', 'aset_lancar', 'D', false, 4],
  ['1.1.02.00', 'Piutang', 'aset', 'aset_lancar', 'D', false, 3],
  ['1.1.02.01', 'Piutang Usaha', 'aset', 'aset_lancar', 'D', true, 4],
  ['1.1.03.00', 'Persediaan', 'aset', 'aset_lancar', 'D', false, 3],
  ['1.1.03.01', 'Persediaan Barang Dagang', 'aset', 'aset_lancar', 'D', true, 4],
  ['1.1.04.00', 'Perlengkapan', 'aset', 'aset_lancar', 'D', false, 3],
  ['1.1.04.01', 'Perlengkapan Kantor', 'aset', 'aset_lancar', 'D', true, 4],
  ['1.1.05.00', 'Beban Dibayar Dimuka', 'aset', 'aset_lancar', 'D', false, 3],
  ['1.1.05.01', 'Beban Dibayar Dimuka', 'aset', 'aset_lancar', 'D', true, 4],
  ['1.2.00.00', 'Aset Tetap', 'aset', 'aset_tetap', 'D', false, 2],
  ['1.2.01.00', 'Aset Tetap Berwujud', 'aset', 'aset_tetap', 'D', false, 3],
  ['1.2.01.01', 'Tanah', 'aset', 'aset_tetap', 'D', true, 4],
  ['1.2.01.02', 'Bangunan', 'aset', 'aset_tetap', 'D', true, 4],
  ['1.2.01.03', 'Kendaraan', 'aset', 'aset_tetap', 'D', true, 4],
  ['1.2.01.04', 'Peralatan', 'aset', 'aset_tetap', 'D', true, 4],
  ['1.2.03.00', 'Akumulasi Penyusutan', 'aset', 'aset_tetap', 'K', false, 3],
  ['1.2.03.01', 'Akumulasi Penyusutan Bangunan', 'aset', 'aset_tetap', 'K', true, 4],
  ['1.2.03.02', 'Akumulasi Penyusutan Kendaraan', 'aset', 'aset_tetap', 'K', true, 4],
  ['1.2.03.03', 'Akumulasi Penyusutan Peralatan', 'aset', 'aset_tetap', 'K', true, 4],

  // Gol 2 — KEWAJIBAN
  ['2.0.00.00', 'Kewajiban', 'kewajiban', 'kewajiban', 'K', false, 1],
  ['2.1.00.00', 'Kewajiban Jangka Pendek', 'kewajiban', 'kewajiban', 'K', false, 2],
  ['2.1.01.00', 'Utang Usaha', 'kewajiban', 'kewajiban', 'K', false, 3],
  ['2.1.01.01', 'Utang Usaha', 'kewajiban', 'kewajiban', 'K', true, 4],
  ['2.1.02.00', 'Utang Gaji', 'kewajiban', 'kewajiban', 'K', false, 3],
  ['2.1.02.01', 'Utang Gaji', 'kewajiban', 'kewajiban', 'K', true, 4],
  ['2.1.03.00', 'Utang Pajak', 'kewajiban', 'kewajiban', 'K', false, 3],
  ['2.1.03.01', 'Utang Pajak', 'kewajiban', 'kewajiban', 'K', true, 4],

  // Gol 3 — EKUITAS
  ['3.0.00.00', 'Ekuitas', 'ekuitas', 'ekuitas', 'K', false, 1],
  ['3.1.00.00', 'Modal', 'ekuitas', 'ekuitas', 'K', false, 2],
  ['3.1.01.00', 'Penyertaan Modal', 'ekuitas', 'ekuitas', 'K', false, 3],
  ['3.1.01.01', 'Penyertaan Modal Desa', 'ekuitas', 'ekuitas', 'K', true, 4],
  ['3.3.00.00', 'Saldo Laba', 'ekuitas', 'saldo_laba', 'K', false, 2],
  ['3.3.01.00', 'Saldo Laba Tidak Dicadangkan', 'ekuitas', 'saldo_laba', 'K', false, 3],
  ['3.3.01.01', 'Saldo Laba Tidak Dicadangkan', 'ekuitas', 'saldo_laba', 'K', true, 4],
  ['3.4.00.00', 'Prive', 'ekuitas', 'prive', 'D', false, 2],
  ['3.4.01.00', 'Prive', 'ekuitas', 'prive', 'D', false, 3],
  ['3.4.01.01', 'Prive', 'ekuitas', 'prive', 'D', true, 4],
  ['3.9.00.00', 'Ikhtisar Laba Rugi', 'ekuitas', 'laba_rugi', 'K', false, 2],
  ['3.9.01.00', 'Ikhtisar Laba Rugi', 'ekuitas', 'laba_rugi', 'K', false, 3],
  ['3.9.01.01', 'Ikhtisar Laba Rugi', 'ekuitas', 'laba_rugi', 'K', true, 4],

  // Gol 4 — PENDAPATAN
  ['4.0.00.00', 'Pendapatan', 'pendapatan', 'pendapatan', 'K', false, 1],
  ['4.1.00.00', 'Pendapatan Usaha', 'pendapatan', 'pendapatan', 'K', false, 2],
  ['4.1.01.00', 'Pendapatan Jasa', 'pendapatan', 'pendapatan', 'K', false, 3],
  ['4.1.01.01', 'Pendapatan Jasa', 'pendapatan', 'pendapatan', 'K', true, 4],
  ['4.1.02.00', 'Penjualan', 'pendapatan', 'pendapatan', 'K', false, 3],
  ['4.1.02.01', 'Penjualan', 'pendapatan', 'pendapatan', 'K', true, 4],
  ['4.1.03.00', 'Potongan Penjualan', 'pendapatan', 'pendapatan', 'D', false, 3],
  ['4.1.03.01', 'Potongan Penjualan', 'pendapatan', 'pendapatan', 'D', true, 4],
  ['4.1.04.00', 'Retur Penjualan', 'pendapatan', 'pendapatan', 'D', false, 3],
  ['4.1.04.01', 'Retur Penjualan', 'pendapatan', 'pendapatan', 'D', true, 4],
  ['4.2.00.00', 'Pendapatan Operasional Lainnya', 'pendapatan', 'pendapatan', 'K', false, 2],
  ['4.2.01.00', 'Pendapatan Operasional Lainnya', 'pendapatan', 'pendapatan', 'K', false, 3],
  ['4.2.01.01', 'Pendapatan Operasional Lainnya', 'pendapatan', 'pendapatan', 'K', true, 4],

  // Gol 5 — HPP
  ['5.0.00.00', 'Harga Pokok Pendapatan', 'hpp', 'hpp', 'D', false, 1],
  ['5.1.00.00', 'HPP Barang Dagangan', 'hpp', 'hpp', 'D', false, 2],
  ['5.1.01.00', 'HPP Barang Dagangan', 'hpp', 'hpp', 'D', false, 3],
  ['5.1.01.01', 'HPP Barang Dagangan', 'hpp', 'hpp', 'D', true, 4],

  // Gol 6 — BEBAN
  ['6.0.00.00', 'Beban', 'beban', 'beban', 'D', false, 1],
  ['6.1.00.00', 'Beban Operasional', 'beban', 'beban', 'D', false, 2],
  ['6.1.01.00', 'Beban Gaji', 'beban', 'beban', 'D', false, 3],
  ['6.1.01.01', 'Beban Gaji', 'beban', 'beban', 'D', true, 4],
  ['6.1.02.00', 'Beban Listrik & Air', 'beban', 'beban', 'D', false, 3],
  ['6.1.02.01', 'Beban Listrik & Air', 'beban', 'beban', 'D', true, 4],
  ['6.1.03.00', 'Beban Telepon & Internet', 'beban', 'beban', 'D', false, 3],
  ['6.1.03.01', 'Beban Telepon & Internet', 'beban', 'beban', 'D', true, 4],
  ['6.1.04.00', 'Beban ATK & Perlengkapan', 'beban', 'beban', 'D', false, 3],
  ['6.1.04.01', 'Beban ATK & Perlengkapan', 'beban', 'beban', 'D', true, 4],
  ['6.1.05.00', 'Beban Transportasi', 'beban', 'beban', 'D', false, 3],
  ['6.1.05.01', 'Beban Transportasi', 'beban', 'beban', 'D', true, 4],
  ['6.1.06.00', 'Beban Pemeliharaan', 'beban', 'beban', 'D', false, 3],
  ['6.1.06.01', 'Beban Pemeliharaan', 'beban', 'beban', 'D', true, 4],
  ['6.1.07.00', 'Beban Penyusutan Aset Tetap', 'beban', 'beban', 'D', false, 3],
  ['6.1.07.01', 'Beban Penyusutan Aset Tetap', 'beban', 'beban', 'D', true, 4],
  ['6.2.00.00', 'Beban Lain-lain', 'beban', 'beban', 'D', false, 2],
  ['6.2.01.00', 'Beban Administrasi', 'beban', 'beban', 'D', false, 3],
  ['6.2.01.01', 'Beban Administrasi', 'beban', 'beban', 'D', true, 4],
  ['6.2.02.00', 'Beban Pajak', 'beban', 'beban', 'D', false, 3],
  ['6.2.02.01', 'Beban Pajak', 'beban', 'beban', 'D', true, 4],

  // Gol 7 — PENDAPATAN/BEBAN NON-OPERASIONAL
  ['7.0.00.00', 'Pendapatan & Beban Non-Operasional', 'pendapatan_lain', 'non_operasional', 'D', false, 1],
  ['7.1.00.00', 'Pendapatan Non-Operasional', 'pendapatan_lain', 'non_operasional', 'K', false, 2],
  ['7.1.01.00', 'Pendapatan Non-Operasional', 'pendapatan_lain', 'non_operasional', 'K', false, 3],
  ['7.1.01.01', 'Pendapatan Non-Operasional', 'pendapatan_lain', 'non_operasional', 'K', true, 4],
  ['7.2.00.00', 'Beban Non-Operasional', 'beban_lain', 'non_operasional', 'D', false, 2],
  ['7.2.01.00', 'Beban Non-Operasional', 'beban_lain', 'non_operasional', 'D', false, 3],
  ['7.2.01.01', 'Beban Non-Operasional', 'beban_lain', 'non_operasional', 'D', true, 4],
];

/**
 * Returns the parent kode for a given account kode by truncating the
 * least-significant non-zero segment. The four kode segments map to
 * levels 1..4. e.g. 1.1.01.00 (level 3) -> 1.1.00.00 (level 2).
 */
function parentKode(kode: string, level: number): string | null {
  if (level <= 1) return null;
  const parts = kode.split('.');
  // Zero out the segment at index (level-1) to climb one level up.
  // parts[0]=gol(level1), parts[1]=level2, parts[2]=level3, parts[3]=level4
  const idx = level - 1;
  const zeroed = parts.map((p, i) => {
    if (i < idx) return p;
    // first segment uses single 0, others use padded 00
    return i === 0 ? '0' : '00';
  });
  return zeroed.join('.');
}

/**
 * Seed the default Chart of Accounts for a tenant.
 * No-op if the tenant already has any CoA rows.
 */
export async function seedDefaultCoa(tenantId: string): Promise<void> {
  const existing = await pool.query(
    'SELECT 1 FROM chart_of_accounts WHERE tenant_id=$1 LIMIT 1',
    [tenantId]
  );
  if (existing.rowCount) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Map kode -> inserted id, used to resolve parent_id references.
    const idByKode = new Map<string, string>();

    for (const [kode, nama, jenisAkun, kelompok, saldoNormal, isPostable, level] of DEFAULT_COA) {
      const pk = parentKode(kode, level);
      const parentId = pk ? idByKode.get(pk) ?? null : null;
      const res = await client.query(
        `INSERT INTO chart_of_accounts
           (tenant_id, kode, nama, jenisAkun, kelompok, saldoNormal, isPostable, parent_id, isActive, level)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9)
         RETURNING id`,
        [tenantId, kode, nama, jenisAkun, kelompok, saldoNormal, isPostable, parentId, level]
      );
      idByKode.set(kode, res.rows[0].id as string);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
