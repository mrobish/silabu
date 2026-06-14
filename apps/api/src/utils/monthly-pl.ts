/**
 * Monthly Grouped P&L Helper (Fix #15 / M8)
 * 
 * Replaces 12x computeLabaRugi() calls with 1 query GROUP BY month.
 * Returns P&L data for all 12 months (0 for empty months).
 * 
 * Same accounting logic as computeLabaRugi:
 * - Exclude OPENING_BALANCE and CLOSING
 * - Use saldonormal (D/K) for sign calculation
 * - Gol 4/5/6/7 only (P&L accounts)
 */

import { pool } from '../db.js';

/** P&L per month */
export type MonthlyPL = {
  month: number;         // 1-12
  label: string;         // 'Jan'..'Des'
  pendapatan: number;    // Gol 4
  hpp: number;           // Gol 5
  bebanOperasional: number; // Gol 6
  pendapatanLain: number;   // Gol 7.1
  bebanLain: number;        // Gol 7.2
  pajak: number;            // Gol 7.3
  labaBersih: number;       // pendapatan - hpp - bebanOp + pdptLain - bebanLain - pajak
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

/**
 * Compute monthly P&L for an entire year in a SINGLE query.
 * 
 * Returns array of 12 MonthlyPL objects (Jan–Des).
 * Months without transactions have all values = 0.
 * 
 * Accounting logic identical to computeLabaRugi():
 * - Debit accounts (saldonormal='D'): saldo = debit - kredit
 * - Credit accounts (saldonormal='K'): saldo = kredit - debit
 * - Group by month from journal_entries.tanggal
 */
export async function computeLabaRugiMonthlyGrouped(
  tenantId: string,
  tahun: number
): Promise<MonthlyPL[]> {
  const startDate = `${tahun}-01-01`;
  const endDate = `${tahun}-12-31`;

  const rows = await pool.query(
    `SELECT 
       EXTRACT(MONTH FROM je.tanggal)::int AS month,
       c.kode,
       c.saldonormal,
       COALESCE(SUM(
         CASE WHEN c.saldonormal = 'D'
              THEN COALESCE(jl.debit, 0) - COALESCE(jl.kredit, 0)
              ELSE COALESCE(jl.kredit, 0) - COALESCE(jl.debit, 0)
         END
       ), 0) AS saldo
     FROM chart_of_accounts c
     JOIN journal_lines jl ON jl.akun_id = c.id
     JOIN journal_entries je ON je.id = jl.entry_id
          AND je.tenant_id = $1
          AND je.isposted = true
          AND je.tanggal >= $2
          AND je.tanggal <= $3
          AND je.tipetransaksi NOT IN ('OPENING_BALANCE', 'CLOSING')
     WHERE c.tenant_id = $1
       AND c.ispostable = true
       AND LEFT(c.kode, 1) IN ('4', '5', '6', '7')
     GROUP BY EXTRACT(MONTH FROM je.tanggal), c.kode, c.saldonormal
     ORDER BY month, c.kode`,
    [tenantId, startDate, endDate]
  );

  // Initialize 12 months with zeros
  const monthlyMap = new Map<number, {
    pendapatan: number;
    hpp: number;
    bebanOperasional: number;
    pendapatanLain: number;
    bebanLain: number;
    pajak: number;
  }>();

  for (let m = 1; m <= 12; m++) {
    monthlyMap.set(m, {
      pendapatan: 0,
      hpp: 0,
      bebanOperasional: 0,
      pendapatanLain: 0,
      bebanLain: 0,
      pajak: 0,
    });
  }

  // Aggregate by month and account group
  for (const row of rows.rows) {
    const month = row.month as number;
    const kode = (row.kode as string).replace(/\s/g, '');
    const saldo = Number(row.saldo);

    const data = monthlyMap.get(month);
    if (!data) continue;

    if (kode.startsWith('4')) {
      data.pendapatan += saldo;
    } else if (kode.startsWith('5')) {
      data.hpp += saldo;
    } else if (kode.startsWith('6')) {
      data.bebanOperasional += saldo;
    } else if (kode.startsWith('7.1')) {
      data.pendapatanLain += saldo;
    } else if (kode.startsWith('7.2')) {
      data.bebanLain += saldo;
    } else if (kode.startsWith('7.3')) {
      data.pajak += saldo;
    }
  }

  // Build result array
  const result: MonthlyPL[] = [];
  for (let m = 1; m <= 12; m++) {
    const data = monthlyMap.get(m)!;
    const labaBersih = data.pendapatan - data.hpp - data.bebanOperasional
                     + data.pendapatanLain - data.bebanLain - data.pajak;

    result.push({
      month: m,
      label: MONTH_LABELS[m - 1],
      pendapatan: data.pendapatan,
      hpp: data.hpp,
      bebanOperasional: data.bebanOperasional,
      pendapatanLain: data.pendapatanLain,
      bebanLain: data.bebanLain,
      pajak: data.pajak,
      labaBersih,
    });
  }

  return result;
}
