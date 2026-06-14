// apps/api/src/utils/opening-balance-posting.ts
// Shared helper for posting opening balance journals (production codebase).
// Uses raw SQL with pool/client pattern.
//
// Fix #17 (R5): Atomic posting with advisory lock, idempotent response.
// Production DB already has UNIQUE (tenant_id, no_jurnal) — 'OB-001' is deterministic.
//
// Column names (production DB):
//   journal_entries: tipetransaksi (not tipe_transaksi), no_jurnal, entry_id FK in journal_lines
//   tenants: status_saldo_awal, saldo_awal_locked, saldo_awal_locked_at, saldo_awal_locked_by

import type { PoolClient } from 'pg';

export interface OpeningJournalLine {
  akun_id: string;
  debit: number;  // in rupiah (not cents)
  kredit: number;
}

export interface PostingResult {
  action: 'posted' | 'idempotent';
  entryId: string;
  noJurnal: string;
  tanggal: string;
  totalDebit: number;
  totalKredit: number;
  totalLines: number;
}

/**
 * Convert rupiah to integer cents for precise comparison.
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Validate that journal lines balance (total debit === total kredit).
 */
export function validateLinesBalance(lines: OpeningJournalLine[]): {
  isValid: boolean;
  totalDebitCents: number;
  totalKreditCents: number;
  selisihCents: number;
} {
  const totalDebitCents = lines.reduce((sum, l) => sum + toCents(l.debit), 0);
  const totalKreditCents = lines.reduce((sum, l) => sum + toCents(l.kredit), 0);
  return {
    isValid: totalDebitCents === totalKreditCents,
    totalDebitCents,
    totalKreditCents,
    selisihCents: totalDebitCents - totalKreditCents,
  };
}

/**
 * Post opening balance journal atomically.
 * 
 * Must be called with a connected PoolClient that has NOT yet started a transaction.
 * This function manages the transaction lifecycle (BEGIN/COMMIT/ROLLBACK).
 * 
 * Steps:
 * 1. BEGIN
 * 2. Advisory lock per tenant
 * 3. Check if already posted (idempotent response)
 * 4. Insert journal_entries with no_jurnal='OB-001'
 * 5. Insert journal_lines (batch)
 * 6. COMMIT
 * 
 * On unique violation (23505): returns idempotent response (concurrent request won).
 * On other errors: ROLLBACK and re-throw.
 */
export async function postOpeningJournalAtomic(
  client: PoolClient,
  tenantId: string,
  userId: string | null,
  tanggal: string,
  tahun: number,
  lines: OpeningJournalLine[],
): Promise<PostingResult> {
  const NO_JURNAL = 'OB-001';

  await client.query('BEGIN');
  try {
    // 1. Advisory lock per tenant (serialize concurrent requests)
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext('opening-balance'), hashtext($1))`,
      [tenantId]
    );

    // 2. Check if already exists (inside transaction, after lock)
    const existing = await client.query(
      `SELECT id, tanggal FROM journal_entries 
       WHERE tenant_id=$1 AND no_jurnal=$2 AND tipetransaksi='OPENING_BALANCE' 
       LIMIT 1`,
      [tenantId, NO_JURNAL]
    );

    if (existing.rowCount) {
      // Already exists — compute totals for idempotent response
      const totalsRes = await client.query(
        `SELECT COALESCE(SUM(debit),0) AS total_debit, COALESCE(SUM(kredit),0) AS total_kredit, COUNT(*) AS total_lines
         FROM journal_lines WHERE entry_id=$1`,
        [existing.rows[0].id]
      );
      const totals = totalsRes.rows[0] as any;

      await client.query('COMMIT');
      return {
        action: 'idempotent',
        entryId: existing.rows[0].id,
        noJurnal: NO_JURNAL,
        tanggal: existing.rows[0].tanggal instanceof Date
          ? existing.rows[0].tanggal.toISOString().slice(0, 10)
          : String(existing.rows[0].tanggal),
        totalDebit: Number(totals.total_debit),
        totalKredit: Number(totals.total_kredit),
        totalLines: Number(totals.total_lines),
      };
    }

    // 3. Validate lines balance
    const balance = validateLinesBalance(lines);
    if (!balance.isValid) {
      throw Object.assign(
        new Error(`Jurnal tidak balance. Debit: Rp ${(balance.totalDebitCents/100).toLocaleString('id-ID')}, Kredit: Rp ${(balance.totalKreditCents/100).toLocaleString('id-ID')}, Selisih: Rp ${(balance.selisihCents/100).toLocaleString('id-ID')}`),
        { statusCode: 400 }
      );
    }

    if (lines.length === 0) {
      throw Object.assign(
        new Error('Tidak ada baris saldo awal'),
        { statusCode: 400 }
      );
    }

    // 4. Insert journal entry
    const entryRes = await client.query(
      `INSERT INTO journal_entries (tenant_id, no_jurnal, tanggal, bulan, tahun, keterangan, tipetransaksi, isposted, islocked, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'OPENING_BALANCE',true,true,$7)
       RETURNING id, tanggal`,
      [tenantId, NO_JURNAL, tanggal, 1, tahun, 'Setup Saldo Awal', userId]
    );
    const entryId = entryRes.rows[0].id;

    // 5. Insert journal lines (batch — single multi-row INSERT)
    if (lines.length > 0) {
      const values: any[] = [];
      const placeholders: string[] = [];
      let paramIndex = 1;

      for (const l of lines) {
        if (toCents(l.debit) === 0 && toCents(l.kredit) === 0) continue;
        placeholders.push(`($${paramIndex},$${paramIndex+1},$${paramIndex+2},$${paramIndex+3},'Saldo Awal')`);
        values.push(entryId, l.akun_id, l.debit, l.kredit);
        paramIndex += 4;
      }

      if (placeholders.length > 0) {
        await client.query(
          `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit, keterangan) VALUES ${placeholders.join(',')}`,
          values
        );
      }
    }

    await client.query('COMMIT');

    return {
      action: 'posted',
      entryId,
      noJurnal: NO_JURNAL,
      tanggal,
      totalDebit: balance.totalDebitCents / 100,
      totalKredit: balance.totalKreditCents / 100,
      totalLines: lines.length,
    };
  } catch (e: any) {
    await client.query('ROLLBACK');

    // Handle unique violation → idempotent
    if (e?.code === '23505' && e?.constraint === 'journal_entries_tenant_id_no_jurnal_key') {
      // Concurrent request won — fetch its result
      const existing = await client.query(
        `SELECT id, tanggal FROM journal_entries 
         WHERE tenant_id=$1 AND no_jurnal=$2 AND tipetransaksi='OPENING_BALANCE' 
         LIMIT 1`,
        [tenantId, NO_JURNAL]
      );
      if (existing.rowCount) {
        const totalsRes = await client.query(
          `SELECT COALESCE(SUM(debit),0) AS total_debit, COALESCE(SUM(kredit),0) AS total_kredit, COUNT(*) AS total_lines
           FROM journal_lines WHERE entry_id=$1`,
          [existing.rows[0].id]
        );
        const totals = totalsRes.rows[0] as any;
        return {
          action: 'idempotent',
          entryId: existing.rows[0].id,
          noJurnal: NO_JURNAL,
          tanggal: existing.rows[0].tanggal instanceof Date
            ? existing.rows[0].tanggal.toISOString().slice(0, 10)
            : String(existing.rows[0].tanggal),
          totalDebit: Number(totals.total_debit),
          totalKredit: Number(totals.total_kredit),
          totalLines: Number(totals.total_lines),
        };
      }
    }

    throw e;
  }
}
