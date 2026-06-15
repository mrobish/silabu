import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { pool } from './db.js';
import { requireTenant, requireActiveTrial, type AuthPayload } from './guards.js';
import { seedDefaultCoa } from './coa-seed.js';
import { validateJournalBalance, validateJournalLine } from './utils/journal-balance.js';
import { parseYmdStrict, compareYmd, isValidYmd } from './utils/date-helpers.js';
import { parseMoneyStrict, dbNumericToCents, MAX_AMOUNT } from './utils/money-helpers.js';
import { calculateHppCents, validateHppNotZero, getInventoryAverageCost } from './utils/hpp-helpers.js';
import { validateQuickTxSource, validateQuickTxTarget } from './utils/quick-tx-validation.js';
import { computeLabaRugiMonthlyGrouped } from './utils/monthly-pl.js';
import {
  validateBaseKey,
  computePayloadHash,
  deriveGroupKey,
  buildBatchLikePattern,
  sortByGroupIndex,
  IDEMPOTENCY_WINDOW,
} from './utils/batch-idempotency.js';
import { postOpeningJournalAtomic } from './utils/opening-balance-posting.js';
import { validateIdempotencyKey, processJournalIdempotency } from './utils/journal-idempotency.js';
import ExcelJS from 'exceljs';

const tenantGuard = { onRequest: [requireTenant] };
const mutationGuard = { onRequest: [requireActiveTrial] };

async function checkPeriodLock(tenantId: string, tahun: number): Promise<void> {
  const p = await pool.query(
    'SELECT id, status FROM financial_periods WHERE tenant_id=$1 AND tahun=$2 LIMIT 1',
    [tenantId, tahun]
  );
  if (p.rows.length && (p.rows[0] as any).status === 'CLOSED') {
    throw Object.assign(new Error(`Periode ${tahun} sudah ditutup. Tidak dapat mengubah data di periode ini.`), { statusCode: 403 });
  }
}

/**
 * Cek apakah tanggal transaksi >= tanggal cutoff.
 * Cutoff ditentukan oleh jurnal sistem terbaru:
 *   - OPENING_BALANCE (Saldo Awal): blokir semua transaksi SEBELUM tanggal ini
 *   - CLOSING (Tutup Buku): blokir semua transaksi PADA & SEBELUM tanggal ini
 *
 * Validasi:
 *  1. Bypass array: OPENING_BALANCE & CLOSING → jurnal sistem bisa lewat
 *  2. MAX(tanggal) dari kedua tipe → handle multi-tahun (2025 & 2026)
 *  3. NULL safe → BUM Desa baru tanpa saldo awal lolos semua
 *  4. CLOSING pakai <= (31 Des ditutup), OPENING_BALANCE pakai < (1 Jan lolos)
 *  5. Tanggal input WAJIB format YYYY-MM-DD (strict, reject "2025-9-05")
 */
async function checkCutoffDate(
  tenantId: string,
  tanggal: string,
  opts?: { tipetransaksi?: string },
): Promise<void> {
  // ① Bypass untuk Jurnal Sistem (Saldo Awal & Tutup Buku)
  const bypassTypes = ['OPENING_BALANCE', 'CLOSING'];
  if (opts?.tipetransaksi && bypassTypes.includes(opts.tipetransaksi)) return;

  // ② Strict validate tanggal format — reject "2025-9-05", "2025/09/05", "2025-02-30"
  parseYmdStrict(tanggal); // throws if invalid → caller should catch and return 400

  // ③ Query MAX gabungan — cari cutoff terbaru dari kedua tipe
  const r = await pool.query(
    `SELECT tanggal AS cutoff, tipetransaksi AS cutoff_type
     FROM journal_entries
     WHERE tenant_id=$1 AND tipetransaksi IN ('OPENING_BALANCE','CLOSING')
     ORDER BY tanggal DESC LIMIT 1`,
    [tenantId],
  );
  if (!r.rows.length) return; // ④ NULL = belum ada apa-apa → loloskan semua

  const row = r.rows[0] as any;
  const cutoff: string = row.cutoff instanceof Date
    ? row.cutoff.toISOString().slice(0, 10)
    : String(row.cutoff);
  const cutoffType: string = row.cutoff_type;

  // ⑤ Logika pemblokiran menggunakan compareYmd (integer comparison, bukan string)
  //    CLOSING (31 Des 2025) → blokir <= 31 Des (tahun sudah tutup, tidak bisa input lagi)
  //    OPENING_BALANCE (1 Jan 2026) → blokir < 1 Jan (1 Jan sendiri masih boleh)
  const cmp = compareYmd(tanggal, cutoff);
  const blocked = cutoffType === 'CLOSING'
    ? cmp <= 0   // Tutup Buku: termasuk tanggal closing
    : cmp < 0;   // Saldo Awal: sebelum tanggal opening

  if (blocked) {
    throw Object.assign(
      new Error(`Transaksi ditolak. Anda tidak bisa memasukkan transaksi pada periode yang sudah ditutup (sebelum ${cutoff}).`),
      { statusCode: 422 },
    );
  }
}

export async function accountingRoutes(app: FastifyInstance) {
  // ─── Chart of Accounts ────────────────────────────────────────────

  // GET /accounting/coa — list accounts for tenant (supports ?includeInactive=true for CoA management page)
  app.get('/coa', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const q = req.query as any;
    const includeInactive = q.includeInactive === 'true';
    const whereClause = includeInactive
      ? 'WHERE tenant_id=$1'
      : 'WHERE tenant_id=$1 AND isActive=true';
    const r = await pool.query(
      `SELECT id, tenant_id AS "tenantId", kode, nama, jenisakun AS "jenisAkun",
              kelompok, saldonormal AS "saldoNormal", ispostable AS "isPostable",
              parent_id AS "parentId", is_seeded AS "isSeeded", is_system_default AS "isSystemDefault", isactive AS "isActive", level
       FROM chart_of_accounts
       ${whereClause}
       ORDER BY kode`,
      [a.tenantId]
    );
    return { coa: r.rows };
  });

  // GET /accounting/coa/:id — single account
  app.get('/coa/:id', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const { id } = req.params as { id: string };
    const r = await pool.query(
      `SELECT id, tenant_id AS "tenantId", kode, nama, jenisakun AS "jenisAkun",
              kelompok, saldonormal AS "saldoNormal", ispostable AS "isPostable",
              parent_id AS "parentId", is_seeded AS "isSeeded", is_system_default AS "isSystemDefault", isactive AS "isActive", level
       FROM chart_of_accounts
       WHERE id=$1 AND tenant_id=$2`,
      [id, a.tenantId]
    );
    if (!r.rowCount) return { error: 'Akun tidak ditemukan' };
    return { coa: r.rows[0] };
  });

  // GET /accounting/coa/seed — seed default CoA (no-op if accounts exist)
  app.get('/coa/seed', mutationGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const existing = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM chart_of_accounts WHERE tenant_id=$1',
      [a.tenantId]
    );
    if ((existing.rows[0] as any).cnt > 0) {
      return { seeded: 0, message: 'Chart of accounts sudah ada' };
    }
    await seedDefaultCoa(a.tenantId!);
    const r = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM chart_of_accounts WHERE tenant_id=$1',
      [a.tenantId]
    );
    return { seeded: (r.rows[0] as any).cnt, message: 'Chart of accounts berhasil disimpan' };
  });

  // GET /accounting/announcements — active announcements for BUM Desa users
  app.get('/announcements', tenantGuard, async () => {
    const r = await pool.query(
      `SELECT id, message, type, active, created_at FROM announcements WHERE active = true ORDER BY created_at DESC LIMIT 10`
    );
    return { announcements: r.rows };
  });

  // GET /accounting/years — available years from financial_periods + journal entries
  app.get('/years', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    // Get years from financial_periods
    const fp = await pool.query(
      'SELECT DISTINCT tahun FROM financial_periods WHERE tenant_id=$1',
      [a.tenantId]
    );
    // Get years from journal_entries
    const je = await pool.query(
      'SELECT DISTINCT tahun FROM journal_entries WHERE tenant_id=$1',
      [a.tenantId]
    );
    // Merge + deduplicate + add current year
    const currentYear = new Date().getFullYear();
    const yearSet = new Set<number>();
    yearSet.add(currentYear);
    for (const r of fp.rows) yearSet.add((r as any).tahun);
    for (const r of je.rows) yearSet.add((r as any).tahun);
    const years = Array.from(yearSet).sort((a, b) => b - a); // descending
    return { years };
  });

  // GET /accounting/data-range — min/max tanggal from journal_entries
  // Used by frontend to smart-default date filters to the latest available data
  app.get('/data-range', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const r = await pool.query(
      `SELECT
         MIN(tanggal)::text AS min_date,
         MAX(tanggal)::text AS max_date,
         COUNT(*) AS total_entries
       FROM journal_entries
       WHERE tenant_id=$1 AND tipetransaksi <> 'OPENING_BALANCE'`,
      [a.tenantId]
    );
    const row = r.rows[0] as any;
    return {
      minDate: row.min_date || null,
      maxDate: row.max_date || null,
      totalEntries: parseInt(row.total_entries, 10) || 0,
    };
  });

  // ─── Jurnal Umum ─────────────────────────────────────────────────

  // POST /accounting/coa — create sub-akun (Level 4) under a parent (Level 3)
  app.post('/coa', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const body = req.body as any;
    if (!body) return reply.status(400).send({ error: 'Body request kosong' });

    const { parent_id, nama } = body;
    if (!parent_id) return reply.status(400).send({ error: 'parent_id wajib diisi' });
    if (!nama || !String(nama).trim()) return reply.status(400).send({ error: 'Nama akun wajib diisi' });

    // Look up parent — must be level 3, active, belong to tenant
    const parentRes = await pool.query(
      `SELECT id, kode, nama, level, jenisakun AS "jenisAkun", kelompok,
              saldonormal AS "saldoNormal" FROM chart_of_accounts
       WHERE id=$1 AND tenant_id=$2 AND isActive=true`,
      [parent_id, a.tenantId]
    );
    if (!parentRes.rowCount) return reply.status(404).send({ error: 'Induk akun tidak ditemukan' });
    const parent = parentRes.rows[0] as any;
    if (parent.level !== 3) return reply.status(400).send({ error: 'Sub-akun baru hanya bisa ditambahkan di bawah kelompok akun (Level 3)' });

    // Find max child kode number, skip .98/.99
    // MUST include inactive (soft-deleted) accounts to avoid duplicate kode
    const parentPrefix = parent.kode.slice(0, 6); // e.g. "1.1.01" (no trailing dot)
    const childrenRes = await pool.query(
      `SELECT kode FROM chart_of_accounts
       WHERE tenant_id=$1 AND kode LIKE $2`,
      [a.tenantId, parentPrefix + '.%']
    );

    let maxNum = 0;
    for (const row of childrenRes.rows) {
      const suffix = parseInt((row as any).kode.slice(-2), 10);
      if (isNaN(suffix)) continue;
      if (suffix === 98 || suffix === 99) continue; // skip Lainnya/Reserve
      if (suffix > maxNum) maxNum = suffix;
    }

    const nextNum = maxNum + 1;
    if (nextNum > 97) return reply.status(400).send({ error: 'Tidak dapat menambah sub-akun baru — batas nomor urut tercapai (maks .97)' });

    const newKode = parentPrefix + '.' + String(nextNum).padStart(2, '0');

    let insertRes;
    try {
      insertRes = await pool.query(
        `INSERT INTO chart_of_accounts
           (tenant_id, kode, nama, jenisAkun, kelompok, saldoNormal, isPostable, parent_id, is_seeded, is_system_default, isActive, level)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7,false,false,true,4)
         RETURNING id, kode, nama, is_seeded AS "isSeeded", is_system_default AS "isSystemDefault", ispostable AS "isPostable",
                   parent_id AS "parentId", saldonormal AS "saldoNormal";`,
        [a.tenantId, newKode, String(nama).trim(),
         parent.jenisAkun, parent.kelompok, parent.saldoNormal || 'D', parent_id]
      );
    } catch (e: any) {
      if (e.code === '23505') {
        return reply.status(409).send({ error: `Kode akun ${newKode} sudah ada. Silakan refresh dan coba lagi.` });
      }
      throw e;
    }

    return reply.status(201).send({ akun: insertRes.rows[0], message: 'Sub-akun berhasil ditambahkan' });
  });

  // DELETE /accounting/coa/:id — delete sub-akun buatan user
  app.delete('/coa/:id', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const { id } = req.params as { id: string };

    // Validation 1: System default / seeded check
    const akunRes = await pool.query(
      `SELECT id, kode, nama, is_seeded, is_system_default, tenant_id FROM chart_of_accounts
       WHERE id=$1 AND tenant_id=$2`,
      [id, a.tenantId]
    );
    if (!akunRes.rowCount) return reply.status(404).send({ error: 'Akun tidak ditemukan' });
    const akun = akunRes.rows[0] as any;
    if (akun.is_seeded || akun.is_system_default) return reply.status(403).send({ error: 'Akun bawaan sistem tidak dapat dihapus.', code: 'SEEDED' });

    // Validation 2: Usage check — if any journal lines reference this akun_id
    const usageRes = await pool.query(
      'SELECT 1 FROM journal_lines WHERE akun_id=$1 LIMIT 1',
      [id]
    );
    if (usageRes.rowCount) return reply.status(400).send({ error: 'Akun gagal dihapus karena sudah digunakan dalam transaksi.', code: 'IN_USE' });

    await pool.query('DELETE FROM chart_of_accounts WHERE id=$1 AND tenant_id=$2', [id, a.tenantId]);
    return { message: 'Akun berhasil dihapus' };
  });

  // PUT /accounting/coa/:id — edit nama akun (Level 4 only)
  app.put('/coa/:id', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const { id } = req.params as { id: string };
    const body = req.body as any;
    if (!body || !body.nama?.trim()) return reply.status(400).send({ error: 'Nama akun wajib diisi' });

    const akunRes = await pool.query(
      `SELECT id, kode, nama, level, tenant_id FROM chart_of_accounts WHERE id=$1 AND tenant_id=$2`,
      [id, a.tenantId]
    );
    if (!akunRes.rowCount) return reply.status(404).send({ error: 'Akun tidak ditemukan' });
    const akun = akunRes.rows[0] as any;

    // Only Level 4 (sub-akun transaksi) can be renamed
    if (akun.level < 4) return reply.status(403).send({ error: 'Hanya sub-akun (Level 4) yang dapat diubah namanya. Akun induk (Level 1–3) dilindungi.' });

    const newNama = body.nama.trim();
    if (newNama === akun.nama) return { akun: { ...akun, nama: newNama }, message: 'Nama tidak berubah' };

    await pool.query(
      'UPDATE chart_of_accounts SET nama=$1 WHERE id=$2 AND tenant_id=$3',
      [newNama, id, a.tenantId]
    );

    return { akun: { id: akun.id, kode: akun.kode, nama: newNama }, message: 'Nama akun berhasil diperbarui' };
  });

  // PATCH /accounting/coa/:id/toggle — toggle isActive (enable/disable akun)
  app.patch('/coa/:id/toggle', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const { id } = req.params as { id: string };

    const akunRes = await pool.query(
      `SELECT id, kode, nama, isactive AS "isActive", level, tenant_id FROM chart_of_accounts WHERE id=$1 AND tenant_id=$2`,
      [id, a.tenantId]
    );
    if (!akunRes.rowCount) return reply.status(404).send({ error: 'Akun tidak ditemukan' });
    const akun = akunRes.rows[0] as any;

    // Safety: if disabling, check if account has non-zero balance in any journal
    if (akun.isActive) {
      const balanceRes = await pool.query(
        `SELECT COALESCE(SUM(jl.debit),0)::numeric AS total_debit, COALESCE(SUM(jl.kredit),0)::numeric AS total_kredit
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
         WHERE jl.akun_id=$1 AND je.tenant_id=$2`,
        [id, a.tenantId]
      );
      const bal = balanceRes.rows[0] as any;
      const netBalance = parseFloat(bal.total_debit) - parseFloat(bal.total_kredit);
      // Allow disable even with balance (user may want to hide unused accounts)
      // But warn if there's activity
    }

    const newActive = !akun.isActive;
    await pool.query(
      'UPDATE chart_of_accounts SET isactive=$1 WHERE id=$2 AND tenant_id=$3',
      [newActive, id, a.tenantId]
    );

    return {
      akun: { id: akun.id, kode: akun.kode, nama: akun.nama, isActive: newActive },
      message: newActive ? `Akun "${akun.nama}" diaktifkan` : `Akun "${akun.nama}" dinonaktifkan`
    };
  });

  // Generate next no_jurnal like JU-2026-06-0001
  // queryClient: use pool.query (default) or client.query (inside transaction)
  async function nextJurnalNo(tenantId: string, tahun: number, bulan: number, customPrefix?: string, queryClient?: any): Promise<string> {
    const prefix = customPrefix || `JU-${tahun}-${String(bulan).padStart(2, '0')}-`;
    const q = queryClient || pool;
    const r = await q.query(
      `SELECT no_jurnal FROM journal_entries
       WHERE tenant_id=$1 AND no_jurnal LIKE $2
       ORDER BY no_jurnal DESC LIMIT 1`,
      [tenantId, prefix + '%']
    );
    if (!r.rowCount) return prefix + '0001';
    const last = r.rows[0].no_jurnal as string;
    const seq = last.split('-').pop() || '0000';
    const next = String(parseInt(seq, 10) + 1).padStart(4, '0');
    return prefix + next;
  }

  // Ensure financial_period row exists, create OPEN if missing
  async function ensurePeriod(tenantId: string, tahun: number): Promise<void> {
    await pool.query(
      `INSERT INTO financial_periods (tenant_id, tahun, status)
       VALUES ($1, $2, 'OPEN')
       ON CONFLICT (tenant_id, tahun) DO NOTHING`,
      [tenantId, tahun]
    );
  }

  // POST /accounting/jurnal-umum — create journal entry
  // Fix #18 (R1): Idempotency via shared helper — advisory lock + payload hash + 24h window
  app.post('/jurnal-umum', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const body = req.body as any;
    if (!body) return reply.status(400).send({ error: 'Body request kosong' });

    const { tanggal, keterangan, referensi, lines, tipeTransaksi, idempotency_key } = body;
    // Allow GENERAL (default) and ADJUSTMENT
    const journalType = (tipeTransaksi === 'ADJUSTMENT') ? 'ADJUSTMENT' : 'GENERAL';

    // Validate required fields
    if (!tanggal) return reply.status(400).send({ error: 'Tanggal wajib diisi' });
    if (!keterangan || !String(keterangan).trim()) return reply.status(400).send({ error: 'Deskripsi/keterangan wajib diisi' });
    if (!lines || !Array.isArray(lines) || lines.length < 2) {
      return reply.status(400).send({ error: 'Minimal 2 baris jurnal' });
    }
    if (lines.length > 100) {
      return reply.status(400).send({ error: 'Maksimal 100 baris per jurnal' });
    }

    // Fix #18: Validate idempotency_key format BEFORE transaction
    if (idempotency_key) {
      const keyCheck = validateIdempotencyKey(idempotency_key);
      if (!keyCheck.valid) {
        return reply.status(400).send({ error: keyCheck.error });
      }
    }

    const [tahunStr, bulanStr, _day] = (tanggal as string).split('-');
    const tahun = parseInt(tahunStr, 10);
    const bulan = parseInt(bulanStr, 10);
    if (isNaN(tahun) || isNaN(bulan) || tahun < 2000 || tahun > 2100 || bulan < 1 || bulan > 12) {
      return reply.status(400).send({ error: 'Format tanggal tidak valid (YYYY-MM-DD)' });
    }

    await checkPeriodLock(a.tenantId!, tahun);
    await checkCutoffDate(a.tenantId!, tanggal as string);

    // Validate lines and balance using centralized helper
    const akunIds = lines.map((l: any) => l.akun_id);
    const balanceResult = validateJournalBalance(lines);
    if (!balanceResult.valid) {
      return reply.status(400).send({ error: balanceResult.error, code: balanceResult.code });
    }

    // Validate all akun belong to tenant, are active, and isPostable
    const akunRows = await pool.query(
      `SELECT id, kode, ispostable AS "isPostable", isactive AS "isActive" FROM chart_of_accounts
       WHERE id = ANY($1::uuid[]) AND tenant_id=$2`,
      [akunIds, a.tenantId]
    );
    const validIds = new Set(akunRows.rows.map((r: any) => r.id));
    for (const akunId of akunIds) {
      if (!validIds.has(akunId)) return reply.status(400).send({ error: `Akun ${akunId} tidak ditemukan untuk tenant ini` });
    }
    for (const row of akunRows.rows) {
      if (!(row as any).isActive) return reply.status(400).send({ error: `Akun ${(row as any).kode} tidak aktif` });
      if (!(row as any).isPostable) return reply.status(400).send({ error: `Akun ${(row as any).kode} tidak dapat diposting` });
    }

    // Generate no_jurnal and ensure period (outside tx for serial number)
    const no_jurnal = await nextJurnalNo(a.tenantId!, tahun, bulan);
    await ensurePeriod(a.tenantId!, tahun);
    await checkPeriodLock(a.tenantId!, tahun);

    // Fix #18: Build payload for idempotency hash
    const idemPayload = { tanggal, keterangan, referensi, lines, tipeTransaksi: journalType };

    // Transaction: idempotency check + insert entry + lines
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Fix #18: Idempotency check INSIDE transaction (after advisory lock)
      let derivedKey: string | null = null;
      if (idempotency_key) {
        const idemResult = await processJournalIdempotency(client, {
          tenantId: a.tenantId!,
          endpoint: 'jurnal-umum',
          baseKey: idempotency_key,
          payload: idemPayload,
        });
        derivedKey = idemResult.derivedKey;

        if (idemResult.check.status === 'idempotent') {
          await client.query('COMMIT');
          return {
            success: true,
            idempotent: true,
            message: 'Jurnal sudah pernah dibuat.',
            jurnal: {
              id: idemResult.check.entryId,
              noJurnal: idemResult.check.noJurnal,
              tanggal: idemResult.check.tanggal,
              tipetransaksi: idemResult.check.tipetransaksi,
              lines: idemResult.check.lines,
            },
          };
        }

        if (idemResult.check.status === 'conflict') {
          await client.query('ROLLBACK');
          return reply.status(409).send({
            success: false,
            error: 'IDEMPOTENCY_KEY_CONFLICT',
            message: idemResult.check.message,
          });
        }
      }

      const entryRes = await client.query(
        `INSERT INTO journal_entries
           (tenant_id, no_jurnal, tanggal, bulan, tahun, keterangan, referensi, tipeTransaksi, isPosted, created_by, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10)
         RETURNING id, no_jurnal AS "noJurnal", tanggal, tipetransaksi`,
        [a.tenantId, no_jurnal, tanggal, bulan, tahun, keterangan || null, referensi || null, journalType, a.userId, derivedKey || null]
      );
      const entryId = entryRes.rows[0].id as string;

      for (const l of lines) {
        await client.query(
          `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit, keterangan, contact_id, inventory_item_id, qty)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [entryId, l.akun_id, String(l.debit || '0'), String(l.kredit || '0'), l.keterangan || null, l.contact_id || null, l.inventory_item_id || null, l.qty || null]
        );
      }

      await client.query('COMMIT');

      // Return the created entry with lines
      const entryLines = await pool.query(
        `SELECT id, entry_id, akun_id, debit, kredit, keterangan, contact_id, inventory_item_id, qty
         FROM journal_lines WHERE entry_id=$1 ORDER BY created_at`, [entryId]
      );

      return {
        success: true,
        jurnal: {
          id: entryRes.rows[0].id,
          noJurnal: entryRes.rows[0].noJurnal,
          tanggal: entryRes.rows[0].tanggal instanceof Date
            ? entryRes.rows[0].tanggal.toISOString().slice(0, 10)
            : String(entryRes.rows[0].tanggal).slice(0, 10),
          tipetransaksi: entryRes.rows[0].tipetransaksi,
          lines: entryLines.rows,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // POST /accounting/jurnal-umum/batch — Excel-style batch input (multiple entries at once)
  // Groups flat rows by (tanggal, no_bukti) → 1 journal entry per group
  app.post('/jurnal-umum/batch', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const body = req.body as any;
    if (!body) return reply.status(400).send({ error: 'Body request kosong' });

    const { rows, idempotency_key } = body;
    if (!rows || !Array.isArray(rows) || rows.length < 2) {
      return reply.status(400).send({ error: 'Minimal 2 baris jurnal' });
    }
    if (rows.length > 100) {
      return reply.status(400).send({ error: 'Maksimal 100 baris per batch' });
    }

    // Sanitize: remove ghost rows
    const cleanRows = rows.filter((r: any) =>
      r.akun_id && (parseFloat(r.debit || '0') > 0 || parseFloat(r.kredit || '0') > 0)
    );
    if (cleanRows.length < 2) {
      return reply.status(400).send({ error: 'Minimal 2 baris dengan akun dan nominal' });
    }

    // Validate each row using centralized helper
    for (const r of cleanRows) {
      const lineError = validateJournalLine(r);
      if (lineError) return reply.status(400).send({ error: lineError, code: 'INVALID_LINE' });
    }

    // Collect all unique akun_ids and validate
    const allAkunIds = [...new Set(cleanRows.map((r: any) => r.akun_id))];
    const akunRows = await pool.query(
      `SELECT id, kode, ispostable AS "isPostable", isactive AS "isActive" FROM chart_of_accounts
       WHERE id = ANY($1::uuid[]) AND tenant_id=$2`,
      [allAkunIds, a.tenantId]
    );
    const validAkun = new Map(akunRows.rows.map((r: any) => [r.id, r]));
    for (const akunId of allAkunIds) {
      const row: any = validAkun.get(akunId);
      if (!row) return reply.status(400).send({ error: `Akun ${akunId} tidak ditemukan` });
      if (!row.isActive) return reply.status(400).send({ error: `Akun ${row.kode} tidak aktif` });
      if (!row.isPostable) return reply.status(400).send({ error: `Akun ${row.kode} tidak dapat diposting` });
    }

    // Group rows by (tanggal, no_bukti) — each group becomes 1 journal entry
    const groups = new Map<string, any[]>();
    for (const r of cleanRows) {
      const tanggal = (r.tanggal || '').slice(0, 10);
      const noBukti = (r.no_bukti || '').trim();
      const keterangan = (r.keterangan || '').trim();
      // Group key: tanggal + no_bukti (keterangan can vary within a group, use first non-empty)
      const key = `${tanggal}__${noBukti}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }

    // Validate each group has balanced debit/kredit using centralized helper
    for (const [key, groupRows] of groups) {
      const balanceResult = validateJournalBalance(groupRows);
      if (!balanceResult.valid) {
        const tanggal = groupRows[0]?.tanggal || '?';
        const noBukti = groupRows[0]?.no_bukti || '(tanpa bukti)';
        return reply.status(400).send({
          error: `Jurnal "${noBukti}" tanggal ${tanggal}: ${balanceResult.error}`,
          code: 'GROUP_NOT_BALANCED'
        });
      }
    }

    // Validate all dates and ensure periods
    const yearBulanSet = new Set<string>();
    for (const [key, groupRows] of groups) {
      const tanggal = groupRows[0].tanggal;
      const [tahunStr, bulanStr] = tanggal.split('-');
      const tahun = parseInt(tahunStr, 10);
      const bulan = parseInt(bulanStr, 10);
      if (isNaN(tahun) || isNaN(bulan) || tahun < 2000 || tahun > 2100 || bulan < 1 || bulan > 12) {
        return reply.status(400).send({ error: `Format tanggal tidak valid: ${tanggal}` });
      }
      await checkPeriodLock(a.tenantId!, tahun);
      const yb = `${tahun}-${bulan}`;
      await checkCutoffDate(a.tenantId!, tanggal);
      if (!yearBulanSet.has(yb)) {
        await ensurePeriod(a.tenantId!, tahun);
        yearBulanSet.add(yb);
      }
    }

    // Idempotency check — prevent double submit (Fix #13: derived key per group)
    let payloadHash = '';
    if (idempotency_key) {
      // Validate base key format
      const keyValidation = validateBaseKey(idempotency_key);
      if (!keyValidation.valid) {
        return reply.status(400).send({ error: keyValidation.error, code: 'INVALID_IDEMPOTENCY_KEY' });
      }

      // Compute payload fingerprint
      payloadHash = computePayloadHash(cleanRows);

      // Find ALL entries with matching baseKey:payloadHash pattern
      const likePattern = buildBatchLikePattern(idempotency_key, payloadHash);
      const existingEntries = await pool.query(
        `SELECT id, no_jurnal AS "noJurnal", tanggal, keterangan, idempotency_key
         FROM journal_entries
         WHERE tenant_id=$1 AND idempotency_key LIKE $2 ESCAPE '\'
           AND created_at > NOW() - INTERVAL '${IDEMPOTENCY_WINDOW}'
         ORDER BY idempotency_key ASC`,
        [a.tenantId, likePattern]
      );

      if (existingEntries.rowCount && existingEntries.rowCount > 0) {
        // Found entries with this batch key — check if it's a complete batch
        const expectedGroupCount = groups.size;
        const foundCount = existingEntries.rowCount;

        if (foundCount === expectedGroupCount) {
          // Complete batch found — return idempotent response
          const entriesWithLines = await Promise.all(
            existingEntries.rows.map(async (entry: any) => {
              const lines = await pool.query(
                `SELECT * FROM journal_lines WHERE entry_id=$1 ORDER BY created_at`,
                [entry.id]
              );
              return { ...entry, lines: lines.rows };
            })
          );

          // Sort by group index (numeric, not string)
          const sortedEntries = sortByGroupIndex(entriesWithLines);

          return {
            idempotent: true,
            message: `${sortedEntries.length} jurnal sudah ada (idempotent)`,
            entries: sortedEntries,
          };
        } else {
          // Partial state detected — this is a conflict
          return reply.status(409).send({
            error: `Konflik idempotency: ditemukan ${foundCount} dari ${expectedGroupCount} entri yang diharapkan. Kemungkinan batch sebelumnya tidak lengkap atau payload berbeda.`,
            code: 'IDEMPOTENCY_CONFLICT',
            details: {
              expectedGroups: expectedGroupCount,
              foundEntries: foundCount,
              baseKey: idempotency_key,
            },
          });
        }
      }

      // Check if same base key exists with DIFFERENT payload hash (key reuse attack)
      const baseKeyOnly = idempotency_key;
      const otherPayloadEntries = await pool.query(
        `SELECT DISTINCT split_part(idempotency_key, ':', 2) AS payload_hash
         FROM journal_entries
         WHERE tenant_id=$1 
           AND idempotency_key LIKE $2 || ':%'
           AND idempotency_key NOT LIKE $3 ESCAPE '\'
           AND created_at > NOW() - INTERVAL '${IDEMPOTENCY_WINDOW}'
         LIMIT 1`,
        [a.tenantId, baseKeyOnly, likePattern]
      );

      if (otherPayloadEntries.rowCount && otherPayloadEntries.rowCount > 0) {
        return reply.status(409).send({
          error: 'Konflik idempotency key: key yang sama digunakan untuk payload yang berbeda',
          code: 'IDEMPOTENCY_KEY_CONFLICT',
          details: { baseKey: idempotency_key },
        });
      }
    }

    // Transaction: create one journal entry per group
    const client = await pool.connect();
    const createdEntries: any[] = [];
    try {
      await client.query('BEGIN');

      let groupIndex = 0;
      for (const [key, groupRows] of groups) {
        const tanggal = groupRows[0].tanggal;
        const [tahunStr, bulanStr] = tanggal.split('-');
        const tahun = parseInt(tahunStr, 10);
        const bulan = parseInt(bulanStr, 10);

        // Derive keterangan: first non-empty from rows in this group
        const keterangan = groupRows.map((r: any) => (r.keterangan || '').trim()).find(Boolean) || 'Tanpa keterangan';
        const noBukti = (groupRows[0].no_bukti || '').trim() || null;

        const no_jurnal = await nextJurnalNo(a.tenantId!, tahun, bulan);

        // Derive idempotency key for this group (Fix #13)
        const derivedKey = idempotency_key
          ? deriveGroupKey(idempotency_key, payloadHash, groupIndex)
          : null;

        const entryRes = await client.query(
          `INSERT INTO journal_entries
             (tenant_id, no_jurnal, tanggal, bulan, tahun, keterangan, referensi, tipeTransaksi, isPosted, created_by, idempotency_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'GENERAL',true,$8,$9)
           RETURNING id, no_jurnal AS "noJurnal"`,
          [a.tenantId, no_jurnal, tanggal, bulan, tahun, keterangan, noBukti, a.userId, derivedKey]
        );
        const entryId = entryRes.rows[0].id as string;
        const entryNoJurnal = entryRes.rows[0].noJurnal as string;

        for (const r of groupRows) {
          await client.query(
            `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit, keterangan, contact_id, inventory_item_id, qty)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [entryId, r.akun_id, String(r.debit || '0'), String(r.kredit || '0'), r.keterangan || null, r.contact_id || null, r.inventory_item_id || null, r.qty || null]
          );
        }

        const totalDebit = groupRows.reduce((s: number, r: any) => s + parseFloat(r.debit || '0'), 0);
        createdEntries.push({
          id: entryId,
          noJurnal: entryNoJurnal,
          tanggal,
          keterangan,
          lineCount: groupRows.length,
          total: totalDebit,
        });
        groupIndex++;
      }

      await client.query('COMMIT');
      return reply.status(201).send({
        message: `${createdEntries.length} jurnal berhasil disimpan`,
        entries: createdEntries,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // GET /accounting/jurnal-umum — list entries for tenant
  app.get('/jurnal-umum', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const q = req.query as any;
    const startDate = q.start_date || null; // YYYY-MM-DD
    const endDate = q.end_date || null;     // YYYY-MM-DD
    const tahun = q.tahun ? parseInt(q.tahun, 10) : null;
    const bulan = q.bulan ? parseInt(q.bulan, 10) : null;
    const limit = Math.min(parseInt(q.limit, 10) || 50, 200);
    const offset = parseInt(q.offset, 10) || 0;

    const conditions: string[] = ['je.tenant_id=$1', "je.tipetransaksi <> 'OPENING_BALANCE'"];
    const params: any[] = [a.tenantId];
    let paramIdx = 2;

    // Priority: start_date/end_date > tahun/bulan (backward compatible)
    if (startDate && endDate) {
      // Date range filter (strict YYYY-MM-DD format)
      const dateRe = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
        return { error: 'Format tanggal tidak valid (YYYY-MM-DD)' };
      }
      conditions.push(`je.tanggal >= $${paramIdx++}`);
      params.push(startDate);
      conditions.push(`je.tanggal <= $${paramIdx++}`);
      params.push(endDate);
    } else {
      // Legacy: filter by tahun/bulan
      if (tahun && !isNaN(tahun)) {
        conditions.push(`je.tahun=$${paramIdx++}`);
        params.push(tahun);
      }
      if (bulan && !isNaN(bulan)) {
        conditions.push(`je.bulan=$${paramIdx++}`);
        params.push(bulan);
      }
    }
    // Filter by journal type (GENERAL, ADJUSTMENT, CLOSING)
    if (q.tipeTransaksi && ['GENERAL', 'ADJUSTMENT', 'CLOSING'].includes(q.tipeTransaksi)) {
      conditions.push(`je.tipetransaksi=$${paramIdx++}`);
      params.push(q.tipeTransaksi);
    }

    const where = conditions.join(' AND ');
    const r = await pool.query(
      `SELECT je.id, je.no_jurnal AS "noJurnal", je.tanggal, je.bulan, je.tahun,
              je.keterangan, je.referensi, je.tipetransaksi AS "tipeTransaksi",
              je.isposted AS "isPosted", je.islocked AS "isLocked",
              je.created_by AS "createdBy", je.created_at AS "createdAt"
       FROM journal_entries je
       WHERE ${where}
       ORDER BY je.tanggal DESC, je.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    );

    // Fetch lines for all entries
    const entryIds = r.rows.map((row: any) => row.id);
    if (!entryIds.length) return { entries: [], jurnal: [], total: 0 };

    const linesRes = await pool.query(
      `SELECT * FROM journal_lines WHERE entry_id = ANY($1::uuid[]) ORDER BY created_at`,
      [entryIds]
    );

    // Group lines by entry_id
    const linesByEntry = new Map<string, any[]>();
    for (const row of linesRes.rows) {
      const eid = (row as any).entry_id;
      if (!linesByEntry.has(eid)) linesByEntry.set(eid, []);
      linesByEntry.get(eid)!.push(row);
    }

    const entries = r.rows.map((row: any) => ({
      ...row,
      lines: (linesByEntry.get(row.id) || []).map((l: any) => ({
        id: l.id,
        akunId: l.akun_id,
        debit: l.debit,
        kredit: l.kredit,
        keterangan: l.keterangan,
        unitUsaha: l.unit_usaha,
        contactId: l.contact_id || null,
        inventoryItemId: l.inventory_item_id || null,
        qty: l.qty || null,
      })),
    }));

    // Total count
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM journal_entries je WHERE ${where}`,
      params
    );

    return { entries, total: (countRes.rows[0] as any).total };
  });

  // GET /accounting/jurnal-umum/:id — single entry with lines
  app.get('/jurnal-umum/:id', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const { id } = req.params as { id: string };
    const r = await pool.query(
      `SELECT id, no_jurnal AS "noJurnal", tanggal, bulan, tahun,
              keterangan, referensi, tipetransaksi AS "tipeTransaksi",
              isposted AS "isPosted", islocked AS "isLocked",
              created_by AS "createdBy", created_at AS "createdAt"
       FROM journal_entries WHERE id=$1 AND tenant_id=$2`,
      [id, a.tenantId]
    );
    if (!r.rowCount) return { error: 'Jurnal tidak ditemukan' };
    const lines = await pool.query(
      `SELECT l.id, l.akun_id AS "akunId", l.debit, l.kredit, l.keterangan, l.unit_usaha AS "unitUsaha",
              l.contact_id AS "contactId", l.inventory_item_id AS "inventoryItemId", l.qty,
              c.kode AS "akunKode", c.nama AS "akunNama", c.isactive AS "akunIsActive"
       FROM journal_lines l
       LEFT JOIN chart_of_accounts c ON c.id = l.akun_id AND c.tenant_id = $2
       WHERE l.entry_id=$1 ORDER BY l.created_at`,
      [id, a.tenantId]
    );
    return { jurnal: { ...r.rows[0], lines: lines.rows } };
  });

  // PUT /accounting/jurnal-umum/:id — edit journal entry (GENERAL only, atomic)
  app.put('/jurnal-umum/:id', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const { id } = req.params as { id: string };
    const body = req.body as any;
    if (!body) return reply.status(400).send({ error: 'Body request kosong' });

    // 1. Entry must exist for this tenant
    const existing = await pool.query(
      `SELECT id, tipetransaksi AS "tipeTransaksi", islocked AS "isLocked", no_jurnal AS "noJurnal"
       FROM journal_entries WHERE id=$1 AND tenant_id=$2`,
      [id, a.tenantId]
    );
    if (!existing.rowCount) return reply.status(404).send({ error: 'Jurnal tidak ditemukan' });
    const entry = existing.rows[0] as any;

    // 2. PAGAR TIPE TRANSAKSI — hanya GENERAL yang boleh diedit
    if (!['GENERAL', 'ADJUSTMENT'].includes(entry.tipeTransaksi)) {
      return reply.status(403).send({
        error: 'Transaksi ini tidak dapat diedit dari Jurnal Umum',
        code: 'NOT_GENERAL',
        message: 'Saldo Awal (OPENING_BALANCE) hanya bisa diubah dari modul Saldo Awal.',
      });
    }

    // 3. PAGAR PERIODE TERKUNCI (untuk fitur Tutup Buku nanti)
    if (entry.isLocked) {
      return reply.status(403).send({
        error: 'Jurnal berada di periode yang sudah ditutup',
        code: 'PERIOD_LOCKED',
        message: 'Transaksi di bulan yang sudah Tutup Buku tidak dapat diedit.',
      });
    }

    const { tanggal, keterangan, referensi, lines } = body;

    // 4. Validasi field — sama persis dengan POST
    if (!tanggal) return reply.status(400).send({ error: 'Tanggal wajib diisi' });
    if (!keterangan || !String(keterangan).trim()) return reply.status(400).send({ error: 'Deskripsi/keterangan wajib diisi' });
    if (!lines || !Array.isArray(lines) || lines.length < 2) {
      return reply.status(400).send({ error: 'Minimal 2 baris jurnal' });
    }

    const [tahunStr, bulanStr, _day] = (tanggal as string).split('-');
    const tahun = parseInt(tahunStr, 10);
    const bulan = parseInt(bulanStr, 10);
    if (isNaN(tahun) || isNaN(bulan) || tahun < 2000 || tahun > 2100 || bulan < 1 || bulan > 12) {
      return reply.status(400).send({ error: 'Format tanggal tidak valid (YYYY-MM-DD)' });
    }
    await checkCutoffDate(a.tenantId!, tanggal as string, { tipetransaksi: entry.tipeTransaksi });

    // 5. Validate lines and balance using centralized helper
    const akunIds = lines.map((l: any) => l.akun_id);
    const balanceResult = validateJournalBalance(lines);
    if (!balanceResult.valid) {
      return reply.status(400).send({ error: balanceResult.error, code: balanceResult.code });
    }

    // 7. Validasi akun milik tenant, aktif, postable
    const akunRows = await pool.query(
      `SELECT id, kode, ispostable AS "isPostable", isactive AS "isActive" FROM chart_of_accounts
       WHERE id = ANY($1::uuid[]) AND tenant_id=$2`,
      [akunIds, a.tenantId]
    );
    const validIds = new Set(akunRows.rows.map((r: any) => r.id));
    for (const akunId of akunIds) {
      if (!validIds.has(akunId)) return reply.status(400).send({ error: `Akun ${akunId} tidak ditemukan untuk tenant ini` });
    }
    for (const row of akunRows.rows) {
      if (!(row as any).isActive) return reply.status(400).send({ error: `Akun ${(row as any).kode} tidak aktif` });
      if (!(row as any).isPostable) return reply.status(400).send({ error: `Akun ${(row as any).kode} tidak dapat diposting` });
    }

    // 8. Atomic: BEGIN → update header → hapus baris lama → insert baris baru → COMMIT
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Re-cek tipe transaksi di dalam transaksi (defense-in-depth terhadap race)
      const lock = await client.query(
        `SELECT tipetransaksi AS "tipeTransaksi", islocked AS "isLocked"
         FROM journal_entries WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,
        [id, a.tenantId]
      );
      if (!lock.rowCount || !['GENERAL', 'ADJUSTMENT'].includes((lock.rows[0] as any).tipeTransaksi) || (lock.rows[0] as any).isLocked) {
        await client.query('ROLLBACK');
        return reply.status(403).send({ error: 'Transaksi tidak dapat diedit', code: 'NOT_GENERAL_OR_LOCKED' });
      }

      await client.query(
        `UPDATE journal_entries SET tanggal=$1, bulan=$2, tahun=$3, keterangan=$4, referensi=$5
         WHERE id=$6 AND tenant_id=$7`,
        [tanggal, bulan, tahun, keterangan || null, referensi || null, id, a.tenantId]
      );

      // Hapus semua baris lama, insert baris baru
      await client.query(`DELETE FROM journal_lines WHERE entry_id=$1`, [id]);
      for (const l of lines) {
        await client.query(
          `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit, keterangan, contact_id, inventory_item_id, qty)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [id, l.akun_id, String(l.debit || '0'), String(l.kredit || '0'), l.keterangan || null, l.contact_id || null, l.inventory_item_id || null, l.qty || null]
        );
      }

      await client.query('COMMIT');

      const updated = await pool.query(`SELECT * FROM journal_entries WHERE id=$1`, [id]);
      const updatedLines = await pool.query(
        `SELECT * FROM journal_lines WHERE entry_id=$1 ORDER BY created_at`, [id]
      );
      return { jurnal: { ...updated.rows[0], lines: updatedLines.rows } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // DELETE /accounting/jurnal-umum/:id — delete journal entry (GENERAL only, atomic)
  app.delete('/jurnal-umum/:id', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const { id } = req.params as { id: string };

    // 1. Entry must exist for this tenant
    const existing = await pool.query(
      `SELECT id, tipetransaksi AS "tipeTransaksi", islocked AS "isLocked", tanggal
       FROM journal_entries WHERE id=$1 AND tenant_id=$2`,
      [id, a.tenantId]
    );
    if (!existing.rowCount) return reply.status(404).send({ error: 'Jurnal tidak ditemukan' });
    const entry = existing.rows[0] as any;

    // 2. PAGAR TIPE TRANSAKSI — hanya GENERAL
    if (!['GENERAL', 'ADJUSTMENT'].includes(entry.tipeTransaksi)) {
      return reply.status(403).send({
        error: 'Transaksi ini tidak dapat dihapus dari Jurnal Umum',
        code: 'NOT_GENERAL',
        message: 'Saldo Awal (OPENING_BALANCE) hanya bisa diubah dari modul Saldo Awal.',
      });
    }

    // 3. PAGAR PERIODE TERKUNCI
    if (entry.isLocked) {
      return reply.status(403).send({
        error: 'Jurnal berada di periode yang sudah ditutup',
        code: 'PERIOD_LOCKED',
        message: 'Transaksi di bulan yang sudah Tutup Buku tidak dapat dihapus.',
      });
    }
    const tglStr = (entry.tanggal instanceof Date ? entry.tanggal.toISOString().slice(0,10) : String(entry.tanggal));
    await checkPeriodLock(a.tenantId!, parseInt(tglStr.slice(0,4), 10));

    // 3b. CUTOFF CHECK — blokir delete jika tanggal entry <= cutoff
    await checkCutoffDate(a.tenantId!, tglStr);

    // 4. Atomic: BEGIN → hapus lines → hapus entry → COMMIT
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const lock = await client.query(
        `SELECT tipetransaksi AS "tipeTransaksi", islocked AS "isLocked"
         FROM journal_entries WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,
        [id, a.tenantId]
      );
      if (!lock.rowCount || !['GENERAL', 'ADJUSTMENT'].includes((lock.rows[0] as any).tipeTransaksi) || (lock.rows[0] as any).isLocked) {
        await client.query('ROLLBACK');
        return reply.status(403).send({ error: 'Transaksi tidak dapat dihapus', code: 'NOT_GENERAL_OR_LOCKED' });
      }

      await client.query(`DELETE FROM journal_lines WHERE entry_id=$1`, [id]);
      await client.query(`DELETE FROM journal_entries WHERE id=$1 AND tenant_id=$2`, [id, a.tenantId]);

      await client.query('COMMIT');
      return { success: true, deleted: id };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ─── Saldo Awal (Opening Balance) ─────────────────────────────────

  // GET /accounting/saldo-awal — akun riil (Gol 1/2/3, level 4) + status + existing values
  app.get('/saldo-awal', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;

    // Real accounts only: Golongan 1 (Aset), 2 (Kewajiban), 3 (Ekuitas), level 4, postable, active
    const akunRes = await pool.query(
      `SELECT id, kode, nama, jenisakun AS "jenisAkun", kelompok,
              saldonormal AS "saldoNormal", level
       FROM chart_of_accounts
       WHERE tenant_id=$1 AND isactive=true AND ispostable=true AND level=4
         AND substring(kode,1,1) IN ('1','2','3')
       ORDER BY kode`,
      [a.tenantId]
    );

    // Existing opening-balance journal (OPENING_BALANCE)
    const obEntry = await pool.query(
      `SELECT id, no_jurnal AS "noJurnal", tanggal, keterangan, islocked AS "isLocked", created_at AS "createdAt"
       FROM journal_entries
       WHERE tenant_id=$1 AND tipetransaksi='OPENING_BALANCE'
       ORDER BY created_at LIMIT 1`,
      [a.tenantId]
    );

    // Check status from tenants table (DRAFT / POSTED)
    const statusRes = await pool.query(
      `SELECT status_saldo_awal AS status, saldo_awal_locked_at AS posted_at,
              u.nama_lengkap AS posted_by_name
       FROM tenants t
       LEFT JOIN users u ON u.id = t.saldo_awal_locked_by
       WHERE t.id = $1`,
      [a.tenantId]
    );
    const statusRow = statusRes.rows[0] || { status: 'DRAFT', posted_at: null, posted_by_name: null };

    let existingLines: Record<string, { debit: string; kredit: string }> = {};
    let entry: any = null;
    if (obEntry.rowCount) {
      entry = obEntry.rows[0];
      const linesRes = await pool.query(
        `SELECT akun_id AS "akunId", debit, kredit FROM journal_lines WHERE entry_id=$1`,
        [entry.id]
      );
      for (const l of linesRes.rows as any[]) {
        existingLines[l.akunId] = { debit: String(l.debit), kredit: String(l.kredit) };
      }
    }

    return {
      accounts: akunRes.rows,
      isSetup: !!obEntry.rowCount,
      entry,
      existingLines,
      lockStatus: {
        status: statusRow.status || 'DRAFT',
        posted_at: statusRow.posted_at,
        posted_by_name: statusRow.posted_by_name,
      },
    };
  });

  // POST /accounting/saldo-awal — simpan saldo awal sebagai jurnal OPENING_BALANCE (sekali per tenant)
  // Fix #17 (R5): Atomic with advisory lock + idempotent response
  app.post('/saldo-awal', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const body = req.body as any;
    if (!body) return reply.status(400).send({ error: 'Body request kosong' });

    // Pre-transaction validation (non-sensitive)
    const statusCheck = await pool.query(
      `SELECT status_saldo_awal FROM tenants WHERE id = $1`,
      [a.tenantId]
    );
    if (statusCheck.rows[0]?.status_saldo_awal === 'POSTED') {
      return reply.status(403).send({ error: 'Saldo awal sudah diposting. Unpost terlebih dahulu untuk mengubah.' });
    }

    const { tanggal, lines } = body;
    if (!tanggal) return reply.status(400).send({ error: 'Tanggal cutoff wajib diisi' });
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return reply.status(400).send({ error: 'Tidak ada baris saldo awal' });
    }
    if (lines.length > 500) {
      return reply.status(400).send({ error: 'Maksimal 500 baris saldo awal' });
    }

    const [tahunStr, bulanStr] = (tanggal as string).split('-');
    const tahun = parseInt(tahunStr, 10);
    const bulan = parseInt(bulanStr, 10);
    if (isNaN(tahun) || isNaN(bulan) || tahun < 2000 || tahun > 2100 || bulan < 1 || bulan > 12) {
      return reply.status(400).send({ error: 'Format tanggal tidak valid (YYYY-MM-DD)' });
    }

    // OPENING_BALANCE tanggal = 1 Januari tahun pembukuan (bukan tanggal input user)
    const obTanggal = `${tahun}-01-01`;

    // Keep only rows with a non-zero value; validate with strict money parser
    const cleanLines: { akun_id: string; debit: number; kredit: number }[] = [];
    for (const l of lines) {
      // Skip rows where both debit and kredit are empty/zero/null/undefined
      const rawDebit = (l.debit ?? '').toString().trim();
      const rawKredit = (l.kredit ?? '').toString().trim();
      const isEmptyDebit = !rawDebit || rawDebit === '0' || rawDebit === '0.00' || rawDebit === '0,00';
      const isEmptyKredit = !rawKredit || rawKredit === '0' || rawKredit === '0.00' || rawKredit === '0,00';

      if (isEmptyDebit && isEmptyKredit) continue; // skip empty rows silently

      // Validate akun_id only for non-empty rows
      if (!l.akun_id) return reply.status(400).send({ error: 'Setiap baris dengan nominal wajib memiliki akun_id' });

      let debitCents: number;
      let kreditCents: number;
      try {
        // Use '0' for empty side, strict parse for non-empty side
        debitCents = isEmptyDebit ? 0 : parseMoneyStrict(rawDebit, 'Debit');
        kreditCents = isEmptyKredit ? 0 : parseMoneyStrict(rawKredit, 'Kredit');
      } catch (e: any) {
        return reply.status(400).send({ error: e.message });
      }

      if (debitCents === 0 && kreditCents === 0) continue; // skip zero rows
      if (debitCents > 0 && kreditCents > 0) return reply.status(400).send({ error: 'Setiap akun hanya boleh diisi salah satu: debit atau kredit' });

      cleanLines.push({ akun_id: l.akun_id, debit: debitCents / 100, kredit: kreditCents / 100 });
    }

    if (cleanLines.length === 0) {
      return reply.status(400).send({ error: 'Isi minimal satu akun dengan nilai debit atau kredit' });
    }

    // Balance check (exact integer cents)
    const totalDebitCents = cleanLines.reduce((s, l) => s + Math.round(l.debit * 100), 0);
    const totalKreditCents = cleanLines.reduce((s, l) => s + Math.round(l.kredit * 100), 0);
    if (totalDebitCents !== totalKreditCents) {
      const selisihCents = totalDebitCents - totalKreditCents;
      return reply.status(400).send({
        error: `Jurnal tidak balance. Debit: Rp ${(totalDebitCents/100).toLocaleString('id-ID')}, Kredit: Rp ${(totalKreditCents/100).toLocaleString('id-ID')}, Selisih: Rp ${(selisihCents/100).toLocaleString('id-ID')}`,
        code: 'NOT_BALANCED',
        totalDebit: totalDebitCents / 100,
        totalKredit: totalKreditCents / 100,
        selisih: selisihCents / 100,
      });
    }

    // Validate all akun: tenant-owned, active, postable, real account (Gol 1/2/3, level 4)
    const akunIds = cleanLines.map(l => l.akun_id);
    const akunRows = await pool.query(
      `SELECT id, kode, ispostable AS "isPostable", isactive AS "isActive", level
       FROM chart_of_accounts WHERE id = ANY($1::uuid[]) AND tenant_id=$2`,
      [akunIds, a.tenantId]
    );
    const valid = new Map(akunRows.rows.map((r: any) => [r.id, r]));
    for (const id of akunIds) {
      const row: any = valid.get(id);
      if (!row) return reply.status(400).send({ error: `Akun ${id} tidak ditemukan untuk tenant ini` });
      if (!row.isActive) return reply.status(400).send({ error: `Akun ${row.kode} tidak aktif` });
      if (!row.isPostable) return reply.status(400).send({ error: `Akun ${row.kode} tidak dapat diposting` });
      if (row.level !== 4 || !['1', '2', '3'].includes(String(row.kode).charAt(0))) {
        return reply.status(400).send({ error: `Akun ${row.kode} bukan akun riil (Golongan 1/2/3)` });
      }
    }

    await ensurePeriod(a.tenantId!, tahun);

    // Atomic: advisory lock + duplicate check + insert all inside transaction
    const client = await pool.connect();
    try {
      const result = await postOpeningJournalAtomic(
        client, a.tenantId!, a.userId, obTanggal, tahun, cleanLines
      );

      return reply.status(result.action === 'posted' ? 201 : 200).send({
        success: true,
        idempotent: result.action === 'idempotent',
        message: result.action === 'idempotent'
          ? 'Saldo awal sudah diposting.'
          : 'Saldo awal berhasil disimpan',
        entryId: result.entryId,
        noJurnal: result.noJurnal,
        tanggal: result.tanggal,
        tipetransaksi: 'OPENING_BALANCE',
        totalDebit: result.totalDebit,
        totalKredit: result.totalKredit,
        totalLines: result.totalLines,
      });
    } catch (e: any) {
      const status = e.statusCode || 500;
      return reply.status(status).send({ error: 'Gagal menyimpan saldo awal: ' + e.message });
    } finally {
      client.release();
    }
  });

  // DELETE /accounting/saldo-awal — reset opening balance (super_admin only)
  // Fix #20: Protection against delete when posted transactions exist
  app.delete('/saldo-awal', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;

    // Check if saldo awal is posted (locked)
    const statusCheck = await pool.query(
      `SELECT status_saldo_awal FROM tenants WHERE id = $1`,
      [a.tenantId]
    );
    if (statusCheck.rows[0]?.status_saldo_awal === 'POSTED') {
      return reply.status(403).send({ error: 'Saldo awal sudah diposting. Unpost terlebih dahulu untuk mereset.' });
    }

    const entries = await pool.query(
      `SELECT id, tanggal FROM journal_entries WHERE tenant_id=$1 AND tipetransaksi='OPENING_BALANCE'`,
      [a.tenantId]
    );
    if (!entries.rowCount) {
      return reply.status(400).send({ error: 'Belum ada saldo awal untuk direset' });
    }
    const ids = entries.rows.map((r: any) => r.id);

    // Fix #20: Check for posted transactions on or after opening balance date
    const obTanggal = entries.rows[0].tanggal instanceof Date
      ? entries.rows[0].tanggal.toISOString().slice(0, 10)
      : String(entries.rows[0].tanggal);

    const txCheck = await pool.query(
      `SELECT COUNT(*) AS cnt,
              MIN(je.tanggal) AS first_date,
              (SELECT je2.no_jurnal FROM journal_entries je2
               WHERE je2.tenant_id=$1
                 AND je2.tipetransaksi <> 'OPENING_BALANCE'
                 AND je2.isposted = true
                 AND je2.tanggal >= $2
               ORDER BY je2.tanggal, je2.created_at
               LIMIT 1) AS first_no_jurnal
       FROM journal_entries je
       WHERE je.tenant_id=$1
         AND je.tipetransaksi <> 'OPENING_BALANCE'
         AND je.isposted = true
         AND je.tanggal >= $2`,
      [a.tenantId, obTanggal]
    );
    const tx = txCheck.rows[0] as any;
    if (Number(tx.cnt) > 0) {
      const firstDate = tx.first_date instanceof Date
        ? tx.first_date.toISOString().slice(0, 10)
        : String(tx.first_date);
      return reply.status(409).send({
        error: 'Saldo awal tidak dapat dihapus karena sudah ada transaksi yang diposting pada atau setelah tanggal saldo awal.',
        code: 'OPENING_BALANCE_HAS_TRANSACTIONS',
        transactionCount: Number(tx.cnt),
        firstTransaction: {
          tanggal: firstDate,
          noJurnal: tx.first_no_jurnal || null,
        },
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // journal_lines cascade-deleted via FK ON DELETE CASCADE, but delete explicitly for clarity
      await client.query(`DELETE FROM journal_lines WHERE entry_id = ANY($1::uuid[])`, [ids]);
      await client.query(`DELETE FROM journal_entries WHERE id = ANY($1::uuid[]) AND tenant_id=$2`, [ids, a.tenantId]);
      await client.query('COMMIT');
      return { message: 'Saldo awal berhasil direset', deletedEntries: ids.length };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: 'Gagal reset saldo awal: ' + e.message });
    } finally {
      client.release();
    }
  });

  // GET /accounting/saldo-awal/lock-status — check saldo awal status (DRAFT / POSTED)
  app.get('/saldo-awal/lock-status', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const result = await pool.query(
      `SELECT status_saldo_awal AS status, saldo_awal_locked_at AS posted_at, 
              saldo_awal_locked_by AS posted_by, u.nama_lengkap AS posted_by_name
       FROM tenants t
       LEFT JOIN users u ON u.id = t.saldo_awal_locked_by
       WHERE t.id = $1`,
      [a.tenantId]
    );
    const row = result.rows[0] || {};
    return {
      status: row.status || 'DRAFT',
      posted_at: row.posted_at || null,
      posted_by: row.posted_by || null,
      posted_by_name: row.posted_by_name || null,
    };
  });

  // GET /accounting/cutoff-date — tanggal cutoff akuntansi (OPENING + CLOSING)
  app.get('/cutoff-date', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const r = await pool.query(
      `SELECT tanggal, tipetransaksi
       FROM journal_entries
       WHERE tenant_id=$1 AND tipetransaksi IN ('OPENING_BALANCE', 'CLOSING')
       ORDER BY tanggal DESC`,
      [a.tenantId]
    );

    let openingCutoff: string | null = null;
    let closingCutoff: string | null = null;

    for (const row of r.rows as any[]) {
      const tgl = row.tanggal instanceof Date ? row.tanggal.toISOString().slice(0, 10) : String(row.tanggal);
      if (row.tipetransaksi === 'OPENING_BALANCE' && !openingCutoff) openingCutoff = tgl;
      if (row.tipetransaksi === 'CLOSING' && !closingCutoff) closingCutoff = tgl;
    }

    // Effective cutoff = the one that blocks the most (latest date)
    let effectiveCutoff: string | null = null;
    let cutoffType: string | null = null;

    if (openingCutoff && closingCutoff) {
      // Both exist — compare and pick the later one
      const cmp = compareYmd(openingCutoff, closingCutoff);
      if (cmp >= 0) {
        effectiveCutoff = openingCutoff;
        cutoffType = 'OPENING_BALANCE';
      } else {
        effectiveCutoff = closingCutoff;
        cutoffType = 'CLOSING';
      }
    } else if (openingCutoff) {
      effectiveCutoff = openingCutoff;
      cutoffType = 'OPENING_BALANCE';
    } else if (closingCutoff) {
      effectiveCutoff = closingCutoff;
      cutoffType = 'CLOSING';
    }

    return {
      openingCutoff,
      closingCutoff,
      effectiveCutoff,
      cutoffType,
      // Backward compatibility
      cutoff: effectiveCutoff,
    };
  });

  // POST /accounting/saldo-awal/post — post saldo awal (set status to POSTED, prevent editing)
  // Fix #17 (R5): Advisory lock to prevent concurrent post
  app.post('/saldo-awal/post', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Advisory lock per tenant
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtext('opening-balance-post'), hashtext($1))`,
        [a.tenantId]
      );
      
      // Check if already posted (inside transaction, after lock)
      const check = await client.query(
        `SELECT status_saldo_awal FROM tenants WHERE id = $1`,
        [a.tenantId]
      );
      if (check.rows[0]?.status_saldo_awal === 'POSTED') {
        await client.query('COMMIT');
        return reply.send({ 
          success: true, 
          idempotent: true,
          message: 'Saldo awal sudah diposting', 
          status: 'POSTED' 
        });
      }
      
      // Check if saldo awal exists
      const entries = await client.query(
        `SELECT id FROM journal_entries WHERE tenant_id=$1 AND tipetransaksi='OPENING_BALANCE' LIMIT 1`,
        [a.tenantId]
      );
      if (!entries.rowCount) {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Belum ada saldo awal untuk diposting' });
      }

      // Validate journal is balanced before posting (integer cents comparison)
      const balanceCheck = await client.query(
        `SELECT COALESCE(SUM(debit),0) AS total_debit, COALESCE(SUM(kredit),0) AS total_kredit
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
         WHERE je.tenant_id=$1 AND je.tipetransaksi='OPENING_BALANCE'`,
        [a.tenantId]
      );
      const { total_debit, total_kredit } = balanceCheck.rows[0] as any;
      const totalDebitCents = dbNumericToCents(total_debit);
      const totalKreditCents = dbNumericToCents(total_kredit);
      if (totalDebitCents !== totalKreditCents) {
        const selisihCents = totalDebitCents - totalKreditCents;
        await client.query('ROLLBACK');
        return reply.status(400).send({
          error: `Jurnal tidak balance. Debit: Rp ${(totalDebitCents/100).toLocaleString('id-ID')}, Kredit: Rp ${(totalKreditCents/100).toLocaleString('id-ID')}, Selisih: Rp ${(selisihCents/100).toLocaleString('id-ID')}`,
          code: 'NOT_BALANCED',
          totalDebit: totalDebitCents / 100,
          totalKredit: totalKreditCents / 100,
          selisih: selisihCents / 100,
        });
      }
      
      // Post it (inside transaction)
      await client.query(
        `UPDATE tenants 
         SET status_saldo_awal = 'POSTED',
             saldo_awal_locked = true, 
             saldo_awal_locked_at = now(), 
             saldo_awal_locked_by = $2
         WHERE id = $1`,
        [a.tenantId, a.userId]
      );
      
      await client.query('COMMIT');
      return { success: true, message: 'Saldo awal berhasil diposting', status: 'POSTED' };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: 'Gagal posting saldo awal: ' + e.message });
    } finally {
      client.release();
    }
  });

  // POST /accounting/saldo-awal/unpost — unpost saldo awal (set status back to DRAFT, allow editing)
  // Fix #20: Atomic with advisory lock + protection against unpost when posted transactions exist
  app.post('/saldo-awal/unpost', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Advisory lock per tenant (serialize concurrent requests)
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtext('opening-balance-unpost'), hashtext($1))`,
        [a.tenantId]
      );

      // Check if actually posted
      const check = await client.query(
        `SELECT status_saldo_awal FROM tenants WHERE id = $1`,
        [a.tenantId]
      );
      if (check.rows[0]?.status_saldo_awal !== 'POSTED') {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Saldo awal tidak dalam keadaan diposting' });
      }

      // Fix #20: Get opening balance tanggal
      const obRes = await client.query(
        `SELECT tanggal FROM journal_entries
         WHERE tenant_id=$1 AND tipetransaksi='OPENING_BALANCE'
         ORDER BY created_at LIMIT 1`,
        [a.tenantId]
      );
      const obTanggal = obRes.rows[0]?.tanggal instanceof Date
        ? obRes.rows[0].tanggal.toISOString().slice(0, 10)
        : String(obRes.rows[0]?.tanggal || '');

      if (obTanggal) {
        // Fix #20: Check for posted transactions on or after opening balance date
        const txCheck = await client.query(
          `SELECT COUNT(*) AS cnt,
                  MIN(je.tanggal) AS first_date,
                  (SELECT je2.no_jurnal FROM journal_entries je2
                   WHERE je2.tenant_id=$1
                     AND je2.tipetransaksi <> 'OPENING_BALANCE'
                     AND je2.isposted = true
                     AND je2.tanggal >= $2
                   ORDER BY je2.tanggal, je2.created_at
                   LIMIT 1) AS first_no_jurnal
           FROM journal_entries je
           WHERE je.tenant_id=$1
             AND je.tipetransaksi <> 'OPENING_BALANCE'
             AND je.isposted = true
             AND je.tanggal >= $2`,
          [a.tenantId, obTanggal]
        );
        const tx = txCheck.rows[0] as any;
        if (Number(tx.cnt) > 0) {
          await client.query('ROLLBACK');
          const firstDate = tx.first_date instanceof Date
            ? tx.first_date.toISOString().slice(0, 10)
            : String(tx.first_date);
          return reply.status(409).send({
            error: 'Saldo awal tidak dapat dibuka ulang karena sudah ada transaksi yang diposting pada atau setelah tanggal saldo awal.',
            code: 'OPENING_BALANCE_HAS_TRANSACTIONS',
            transactionCount: Number(tx.cnt),
            firstTransaction: {
              tanggal: firstDate,
              noJurnal: tx.first_no_jurnal || null,
            },
          });
        }
      }

      // Unpost it (set status to DRAFT, keep backward compat boolean in sync)
      await client.query(
        `UPDATE tenants
         SET status_saldo_awal = 'DRAFT',
             saldo_awal_locked = false,
             saldo_awal_locked_at = NULL,
             saldo_awal_locked_by = NULL
         WHERE id = $1`,
        [a.tenantId]
      );

      await client.query('COMMIT');
      return { message: 'Saldo awal berhasil diunpost', status: 'DRAFT' };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: 'Gagal unpost saldo awal: ' + e.message });
    } finally {
      client.release();
    }
  });

  // GET /accounting/buku-besar — General Ledger dengan running balance
  // Query params: akun_id (required), start_date, end_date (YYYY-MM-DD)
  app.get('/buku-besar', tenantGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const q = req.query as any;
    const akunId = q.akun_id as string;
    if (!akunId) return reply.status(400).send({ error: 'Parameter akun_id wajib diisi' });

    const startDate = q.start_date || null;
    const endDate = q.end_date || null;

    // 1. Ambil info akun + saldonormal (D/K menentukan formula running balance)
    const akunRes = await pool.query(
      `SELECT id, kode, nama, saldonormal AS "saldoNormal", jenisakun AS "jenisAkun"
       FROM chart_of_accounts WHERE id=$1 AND tenant_id=$2`,
      [akunId, a.tenantId]
    );
    if (!akunRes.rowCount) return reply.status(404).send({ error: 'Akun tidak ditemukan' });
    const akun = akunRes.rows[0] as any;
    const isDebitNormal = akun.saldoNormal === 'D'; // Gol 1/5/6 → D; Gol 2/3/4 → K

    // Faktor mutasi: D-normal → +debit-kredit; K-normal → +kredit-debit
    const mutasiExpr = isDebitNormal
      ? '(COALESCE(jl.debit,0) - COALESCE(jl.kredit,0))'
      : '(COALESCE(jl.kredit,0) - COALESCE(jl.debit,0))';

    // 2. Saldo Awal Periode = SEMUA mutasi (OPENING_BALANCE + GENERAL) untuk akun ini
    //    yang terjadi SEBELUM start_date. (OB-001 tanggalnya = awal periode pembukuan)
    const saldoAwalParams: any[] = [akunId, a.tenantId];
    let saldoAwalDateClause = '';
    if (startDate) {
      saldoAwalParams.push(startDate);
      saldoAwalDateClause = ` AND je.tanggal < $${saldoAwalParams.length}`;
    } else {
      // tanpa start_date, tidak ada baris saldo awal terpisah
      saldoAwalDateClause = ' AND FALSE';
    }
    const saldoAwalRes = await pool.query(
      `SELECT COALESCE(SUM(${mutasiExpr}), 0) AS saldo
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.entry_id
       WHERE jl.akun_id = $1 AND je.tenant_id = $2 AND je.isposted = true${saldoAwalDateClause}`,
      saldoAwalParams
    );
    const saldoAwal = Number((saldoAwalRes.rows[0] as any).saldo);

    // 3. Mutasi dalam rentang + running balance via window function.
    //    Running balance = saldoAwal + cumulative sum mutasi (ORDER BY tanggal, created_at)
    const mutasiParams: any[] = [akunId, a.tenantId];
    let dateClause = '';
    if (startDate) {
      mutasiParams.push(startDate);
      dateClause += ` AND je.tanggal >= $${mutasiParams.length}`;
    }
    if (endDate) {
      mutasiParams.push(endDate);
      dateClause += ` AND je.tanggal <= $${mutasiParams.length}`;
    }
    mutasiParams.push(saldoAwal);
    const saldoAwalParamIdx = mutasiParams.length;

    const mutasiRes = await pool.query(
      `SELECT je.id AS "entryId", je.no_jurnal AS "noJurnal", je.tanggal::text AS tanggal,
              je.keterangan AS "keteranganEntry", je.referensi,
              je.tipetransaksi AS "tipeTransaksi",
              jl.debit, jl.kredit, jl.keterangan AS "keteranganLine",
              $${saldoAwalParamIdx}::numeric + SUM(${mutasiExpr})
                OVER (ORDER BY je.tanggal, je.created_at, jl.created_at
                      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "saldoBerjalan"
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.entry_id
       WHERE jl.akun_id = $1 AND je.tenant_id = $2 AND je.isposted = true${dateClause}
       ORDER BY je.tanggal, je.created_at, jl.created_at`,
      mutasiParams
    );

    const mutasi = mutasiRes.rows.map((r: any) => ({
      entryId: r.entryId,
      noJurnal: r.noJurnal,
      tanggal: r.tanggal,
      referensi: r.referensi || '',
      keterangan: r.keteranganLine || r.keteranganEntry || '',
      tipeTransaksi: r.tipeTransaksi,
      debit: Number(r.debit) || 0,
      kredit: Number(r.kredit) || 0,
      saldoBerjalan: Number(r.saldoBerjalan),
    }));

    const saldoAkhir = mutasi.length ? mutasi[mutasi.length - 1].saldoBerjalan : saldoAwal;
    const totalDebit = mutasi.reduce((s: number, m: any) => s + m.debit, 0);
    const totalKredit = mutasi.reduce((s: number, m: any) => s + m.kredit, 0);

    return {
      akun: { id: akun.id, kode: akun.kode, nama: akun.nama, saldoNormal: akun.saldoNormal },
      periode: { startDate, endDate },
      saldoAwal,
      saldoAkhir,
      totalDebit,
      totalKredit,
      mutasi,
    };
  });

  // ── Helper: hitung Laba Rugi (Golongan 4-7) untuk tenant pada periode tertentu.
  // Dipakai oleh endpoint /laba-rugi DAN disuntikkan ke /neraca sebagai Laba Berjalan.
  async function computeLabaRugi(tenantId: string, startDate: string | null, endDate: string | null) {
    const params: any[] = [tenantId];
    let dateClause = '';
    if (startDate) { params.push(startDate); dateClause += ` AND je.tanggal >= $${params.length}`; }
    if (endDate) { params.push(endDate); dateClause += ` AND je.tanggal <= $${params.length}`; }

    const rows = await pool.query(
      `SELECT c.kode, c.nama, c.saldonormal AS "saldoNormal",
              COALESCE(SUM(
                CASE WHEN c.saldonormal = 'D'
                     THEN COALESCE(m.debit,0) - COALESCE(m.kredit,0)
                     ELSE COALESCE(m.kredit,0) - COALESCE(m.debit,0)
                END
              ), 0) AS saldo
       FROM chart_of_accounts c
       LEFT JOIN (
         SELECT jl.akun_id, jl.debit, jl.kredit
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
              AND je.tenant_id = $1
             AND je.isposted = true
              AND je.tipetransaksi NOT IN ('OPENING_BALANCE', 'CLOSING')${dateClause}
       ) m ON m.akun_id = c.id
       WHERE c.tenant_id = $1 AND c.ispostable = true
             AND LEFT(c.kode,1) IN ('4','5','6','7')
       GROUP BY c.kode, c.nama, c.saldonormal
       ORDER BY c.kode`,
      params
    );

    type Akun = { kode: string; nama: string; saldoNormal: string; saldo: number };
    const akunList: Akun[] = rows.rows.map((r: any) => ({
      kode: r.kode, nama: r.nama, saldoNormal: r.saldoNormal, saldo: Number(r.saldo),
    }));

    const sumBy = (pred: (a: Akun) => boolean) =>
      akunList.filter(pred).reduce((s, x) => s + x.saldo, 0);
    const filterBy = (pred: (a: Akun) => boolean) => akunList.filter(pred);

    const pendapatanJasa = filterBy(a => a.kode.startsWith('4.1'));
    const pendapatanDagang = filterBy(a => a.kode.startsWith('4.2') || a.kode.startsWith('4.3'));
    const totalPendapatanOp = sumBy(a => a.kode.startsWith('4'));

    const hpp = filterBy(a => a.kode.startsWith('5'));
    const totalHpp = sumBy(a => a.kode.startsWith('5'));
    const labaKotor = totalPendapatanOp - totalHpp;

    const bebanOperasional = filterBy(a => a.kode.startsWith('6'));
    const totalBebanOp = sumBy(a => a.kode.startsWith('6'));
    const labaOperasional = labaKotor - totalBebanOp;

    const pendapatanLain = filterBy(a => a.kode.startsWith('7.1'));
    const totalPendapatanLain = sumBy(a => a.kode.startsWith('7.1'));
    const bebanLain = filterBy(a => a.kode.startsWith('7.2'));
    const totalBebanLain = sumBy(a => a.kode.startsWith('7.2'));
    const bebanPajak = filterBy(a => a.kode.startsWith('7.3'));
    const totalBebanPajak = sumBy(a => a.kode.startsWith('7.3'));

    const labaSebelumPajak = labaOperasional + totalPendapatanLain - totalBebanLain;
    const labaBersih = labaSebelumPajak - totalBebanPajak;

    return {
      periode: { startDate, endDate },
      pendapatanOperasional: { jasa: pendapatanJasa, dagang: pendapatanDagang, subtotal: totalPendapatanOp },
      hpp: { detail: hpp, subtotal: totalHpp },
      labaKotor,
      bebanOperasional: { detail: bebanOperasional, subtotal: totalBebanOp },
      labaOperasional,
      nonOperasional: {
        pendapatanLain: { detail: pendapatanLain, subtotal: totalPendapatanLain },
        bebanLain: { detail: bebanLain, subtotal: totalBebanLain },
      },
      labaSebelumPajak,
      pajak: { detail: bebanPajak, subtotal: totalBebanPajak },
      labaBersih,
    };
  }

  // GET /accounting/laba-rugi — Laporan Laba Rugi multi-step (Golongan 4-7)
  // Query params: start_date, end_date (YYYY-MM-DD). Exclude OPENING_BALANCE.
  app.get('/laba-rugi', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const q = req.query as any;
    return computeLabaRugi(a.tenantId as string, q.start_date || null, q.end_date || null);
  });

  // ── GET /accounting/dashboard-summary — ringkasan untuk dashboard ──
  app.get('/dashboard-summary', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const tenantId = a.tenantId as string;
    const now = new Date();
    const currentYear = now.getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const today = now.toISOString().slice(0, 10);

    // 1. Laba Rugi tahun berjalan
    const lr = await computeLabaRugi(tenantId, yearStart, today);
    const totalPemasukan = lr.pendapatanOperasional.subtotal + lr.nonOperasional.pendapatanLain.subtotal;
    const totalPengeluaran = lr.hpp.subtotal + lr.bebanOperasional.subtotal + lr.nonOperasional.bebanLain.subtotal + lr.pajak.subtotal;

    // 2. Saldo Kas (Gol 1.1.01) dari neraca
    const kasRows = await pool.query(
      `SELECT COALESCE(SUM(
         CASE WHEN c.saldonormal = 'D'
              THEN COALESCE(m.debit,0) - COALESCE(m.kredit,0)
              ELSE COALESCE(m.kredit,0) - COALESCE(m.debit,0)
         END
       ), 0) AS saldo
       FROM chart_of_accounts c
       LEFT JOIN (
         SELECT jl.akun_id, jl.debit, jl.kredit
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id AND je.tenant_id = $1
              AND je.isposted = true
              AND COALESCE(je.tipetransaksi, '') <> 'CLOSING'
       ) m ON m.akun_id = c.id
       WHERE c.tenant_id = $1 AND c.ispostable = true AND c.kode LIKE '1.1.01%'`,
      [tenantId]
    );
    const saldoKas = Number(kasRows.rows[0]?.saldo || 0);

    // 3. Jumlah transaksi bulan ini
    const txCount = await pool.query(
      `SELECT COUNT(*)::int AS count FROM journal_entries
       WHERE tenant_id=$1 AND isposted = true
         AND COALESCE(tipetransaksi, '') NOT IN ('OPENING_BALANCE', 'CLOSING')
         AND tanggal >= $2 AND tanggal <= $3`,
      [tenantId, `${currentYear}-${String(now.getMonth()+1).padStart(2,'0')}-01`, today]
    );

    // 4. Data bulanan (Jan–Des) untuk chart — Fix #15: single grouped query (bukan 12x)
    const monthlyPL = await computeLabaRugiMonthlyGrouped(tenantId, currentYear);
    const monthly = monthlyPL.map(m => ({
      month: m.label,
      pemasukan: m.pendapatan + m.pendapatanLain,
      pengeluaran: m.hpp + m.bebanOperasional + m.bebanLain + m.pajak,
    }));

    return {
      totalPemasukan,
      totalPengeluaran,
      saldoKas,
      labaBersih: lr.labaBersih,
      transaksiBulanIni: txCount.rows[0]?.count || 0,
      monthly,
    };
  });

  // GET /accounting/neraca — Laporan Neraca / Balance Sheet (snapshot as-of end_date)
  // Query param: end_date (YYYY-MM-DD). Default hari ini.
  // Aset (Gol 1) = Kewajiban (Gol 2) + Ekuitas (Gol 3) + Laba Berjalan.
  app.get('/neraca', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const q = req.query as any;
    const endDate = q.end_date || new Date().toISOString().slice(0, 10);

    // Agregasi SEMUA mutasi (termasuk OPENING_BALANCE) dari awal hingga end_date.
    // FIX: formula by golongan, bukan by saldonormal per akun.
    //   Gol 1 (Aktiva): debit - kredit → contra-asset (saldonormal K) jadi negatif, otomatis mengurangi.
    //   Gol 2/3 (Passiva): kredit - debit → contra-liability/contra-equity jadi negatif.
    // EXCLUDE CLOSING — closing hanya jurnal penutup, bukan transaksi riil.
    // Laba Berjalan dihitung terpisah dari computeLabaRugi (juga exclude CLOSING).
    const rows = await pool.query(
      `SELECT c.kode, c.nama, c.saldonormal AS "saldoNormal",
              COALESCE(SUM(
                CASE WHEN LEFT(c.kode,1) = '1'
                     THEN COALESCE(m.debit,0) - COALESCE(m.kredit,0)
                     ELSE COALESCE(m.kredit,0) - COALESCE(m.debit,0)
                END
              ), 0) AS saldo
       FROM chart_of_accounts c
       LEFT JOIN (
         SELECT jl.akun_id, jl.debit, jl.kredit
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
              AND je.tenant_id = $1
              AND je.isposted = true
              AND je.tipetransaksi <> 'CLOSING'
              AND je.tanggal <= $2
       ) m ON m.akun_id = c.id
       WHERE c.tenant_id = $1 AND c.ispostable = true
             AND LEFT(c.kode,1) IN ('1','2','3')
       GROUP BY c.kode, c.nama, c.saldonormal
       ORDER BY c.kode`,
      [a.tenantId, endDate]
    );

    type Akun = { kode: string; nama: string; saldoNormal: string; saldo: number };
    const akunList: Akun[] = rows.rows.map((r: any) => ({
      kode: r.kode, nama: r.nama, saldoNormal: r.saldoNormal, saldo: Number(r.saldo),
    }));

    const sumBy = (pred: (a: Akun) => boolean) =>
      akunList.filter(pred).reduce((s, x) => s + x.saldo, 0);
    const filterBy = (pred: (a: Akun) => boolean) => akunList.filter(pred);

    // ── AKTIVA (Golongan 1) ──
    const asetLancar = filterBy(a => a.kode.startsWith('1.1'));
    // Aset Tetap: pisah bruto (saldonormal D) vs akumulasi penyusutan (saldonormal K, kode 1.3.07.xx)
    const asetTetapBruto = filterBy(a => a.kode.startsWith('1.3') && a.saldoNormal === 'D');
    const asetTetapAkum = filterBy(a => a.kode.startsWith('1.3') && a.saldoNormal === 'K');
    const nilaiBukuAsetTetap = sumBy(a => a.kode.startsWith('1.3'));
    const asetLainnya = filterBy(a => a.kode.startsWith('1.') && !a.kode.startsWith('1.1') && !a.kode.startsWith('1.3'));
    const totalAset = sumBy(a => a.kode.startsWith('1'));

    // ── PASSIVA: Kewajiban (Golongan 2) ──
    const kewajibanPendek = filterBy(a => a.kode.startsWith('2.1'));
    const kewajibanPanjang = filterBy(a => a.kode.startsWith('2.2'));
    const totalKewajiban = sumBy(a => a.kode.startsWith('2'));

    // ── PASSIVA: Ekuitas (Golongan 3) + Laba Berjalan ──
    const ekuitasAkun = filterBy(a => a.kode.startsWith('3'));
    const totalEkuitasAkun = sumBy(a => a.kode.startsWith('3'));

    // SUNTIKAN MAUT: Laba Berjalan dari awal terbentuk tenant s/d end_date
    const lr = await computeLabaRugi(a.tenantId as string, null, endDate);
    const labaBerjalan = lr.labaBersih;

    const totalEkuitas = totalEkuitasAkun + labaBerjalan;
    const totalPassiva = totalKewajiban + totalEkuitas;

    // Validasi Emas: Total Aset === Total Passiva
    const selisih = totalAset - totalPassiva;
    const isBalanced = Math.abs(selisih) < 0.005; // toleransi pembulatan float

    return {
      asOf: endDate,
      aktiva: {
        asetLancar: { detail: asetLancar, subtotal: sumBy(a => a.kode.startsWith('1.1')) },
        asetTetap: {
          bruto: { akun: asetTetapBruto, subtotal: sumBy(a => a.kode.startsWith('1.3') && a.saldoNormal === 'D') },
          akumulasi: { akun: asetTetapAkum, subtotal: sumBy(a => a.kode.startsWith('1.3') && a.saldoNormal === 'K') },
          nilaiBuku: nilaiBukuAsetTetap,
        },
        asetLainnya: { detail: asetLainnya, subtotal: sumBy(a => a.kode.startsWith('1.') && !a.kode.startsWith('1.1') && !a.kode.startsWith('1.3')) },
        totalAset,
      },
      passiva: {
        kewajiban: {
          jangkaPendek: { detail: kewajibanPendek, subtotal: sumBy(a => a.kode.startsWith('2.1')) },
          jangkaPanjang: { detail: kewajibanPanjang, subtotal: sumBy(a => a.kode.startsWith('2.2')) },
          subtotal: totalKewajiban,
        },
        ekuitas: {
          detail: ekuitasAkun,
          labaBerjalan,
          subtotal: totalEkuitas,
        },
        totalPassiva,
      },
      isBalanced,
      selisih,
    };
  });

  // ── Laporan Perubahan Modal (Statement of Changes in Equity) ──
  // Formula: Modal Akhir = Modal Awal + Tambahan Modal + Laba Bersih - Prive/Penarikan
  // Cross-check: Modal Akhir WAJIB === Total Ekuitas di Neraca
  app.get('/perubahan-modal', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const q = req.query as any;
    const tahun = Number(q.tahun) || new Date().getFullYear();
    const startDate = q.start_date || `${tahun}-01-01`;
    const endDate = q.end_date || `${tahun}-12-31`;

    // 1. Laba Bersih dari computeLabaRugi (SUMBER TUNGGAL — anti mismatch)
    const lr = await computeLabaRugi(a.tenantId as string, startDate, endDate);
    const labaBersih = lr.labaBersih;

    // 2. Modal Awal: saldo Gol 3 dari SEMUA entries SEBELUM periode berjalan
    //    Termasuk OPENING_BALANCE (apapun tanggalnya) + jurnal umum dari tahun sebelumnya
    //    INCLUDE CLOSING historis — closing tahun lalu MENGUBAH saldo awal ekuitas
    //    (misal: closing 2025 transfer laba→saldo laba, ini harus masuk modal awal 2026)
    const modalAwalRes = await pool.query(
      `SELECT COALESCE(SUM(
         CASE WHEN c.saldonormal = 'D'
              THEN COALESCE(m.debit,0) - COALESCE(m.kredit,0)
              ELSE COALESCE(m.kredit,0) - COALESCE(m.debit,0)
         END
       ), 0) AS saldo
       FROM chart_of_accounts c
       LEFT JOIN (
         SELECT jl.akun_id, jl.debit, jl.kredit
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
              AND je.tenant_id = $1
              AND je.isposted = true
              AND (
                je.tipetransaksi = 'OPENING_BALANCE'
                OR je.tanggal < $2
              )
       ) m ON m.akun_id = c.id
       WHERE c.tenant_id = $1 AND c.ispostable = true AND LEFT(c.kode,1) = '3'`,
      [a.tenantId, startDate]
    );
    const modalAwal = Number(modalAwalRes.rows[0]?.saldo || 0);

    // 3. Mutasi Gol 3 selama tahun berjalan (EXCLUDE OPENING_BALANCE dan CLOSING)
    //    CLOSING bukan transaksi riil — hanya jurnal penutupan laba/prive ke ekuitas
    const mutasiRes = await pool.query(
      `SELECT c.kode, c.nama, c.saldonormal AS "saldoNormal",
              COALESCE(SUM(COALESCE(m.debit,0)), 0) AS total_debit,
              COALESCE(SUM(COALESCE(m.kredit,0)), 0) AS total_kredit
       FROM chart_of_accounts c
       LEFT JOIN (
         SELECT jl.akun_id, jl.debit, jl.kredit
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
              AND je.tenant_id = $1
              AND je.isposted = true
              AND je.tipetransaksi NOT IN ('OPENING_BALANCE', 'CLOSING')
              AND je.tanggal >= $2 AND je.tanggal <= $3
       ) m ON m.akun_id = c.id
       WHERE c.tenant_id = $1 AND c.ispostable = true AND LEFT(c.kode,1) = '3'
       GROUP BY c.kode, c.nama, c.saldonormal
       ORDER BY c.kode`,
      [a.tenantId, startDate, endDate]
    );

    type MutasiItem = { kode: string; nama: string; debit: number; kredit: number };
    const mutasiDetail: MutasiItem[] = mutasiRes.rows.map((r: any) => ({
      kode: r.kode, nama: r.nama,
      debit: Number(r.total_debit), kredit: Number(r.total_kredit),
    }));

    // Pisahkan: Tambahan Modal vs Prive berdasarkan KODE AKUN (bukan sign net)
    // 3.1.xx = Modal/setoran → tambahan modal (NET = kredit - debit)
    // 3.2.xx = Prive → prive (NET = debit - kredit, BISA NEGATIF = reversal)
    // 3.3.xx = Saldo Laba → excluded dari keduanya
    let tambahanModal = 0;
    let prive = 0; // NET: SUM(debit) - SUM(kredit), bisa negatif (reversal)
    const tambahanDetail: MutasiItem[] = [];
    const priveDetail: MutasiItem[] = [];

    for (const m of mutasiDetail) {
      if (m.kode.startsWith('3.2')) {
        // Akun Prive → NET = debit - kredit
        // Positif = penarikan (pengurang modal), Negatif = reversal (penambah modal)
        prive += (m.debit - m.kredit);
        priveDetail.push(m);
      } else if (m.kode.startsWith('3.1')) {
        // Akun Modal/setoran → NET = kredit - debit
        tambahanModal += (m.kredit - m.debit);
        tambahanDetail.push(m);
      }
      // 3.3.xx (Saldo Laba) → excluded dari keduanya
    }

    // 4. Modal Akhir
    //    Prive positif → pengurang. Prive negatif → penambah (reversal).
    const modalAkhir = modalAwal + tambahanModal + labaBersih - prive;

    // 5. VALIDASI EMAS: Cross-check dengan Neraca
    //    Total Ekuitas di Neraca = sum Gol 3 (exclude CLOSING) + labaBerjalan
    const neracaEkuitasRes = await pool.query(
      `SELECT COALESCE(SUM(
         CASE WHEN c.saldonormal = 'D'
              THEN COALESCE(m.debit,0) - COALESCE(m.kredit,0)
              ELSE COALESCE(m.kredit,0) - COALESCE(m.debit,0)
         END
       ), 0) AS saldo
       FROM chart_of_accounts c
       LEFT JOIN (
         SELECT jl.akun_id, jl.debit, jl.kredit
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
              AND je.tenant_id = $1
              AND je.isposted = true
              AND je.tipetransaksi <> 'CLOSING'
              AND je.tanggal <= $2
       ) m ON m.akun_id = c.id
       WHERE c.tenant_id = $1 AND c.ispostable = true AND LEFT(c.kode,1) = '3'`,
      [a.tenantId, endDate]
    );
    const neracaEkuitasAkun = Number(neracaEkuitasRes.rows[0]?.saldo || 0);
    const neracaTotalEkuitas = neracaEkuitasAkun + labaBersih;

    const selisih = Math.abs(modalAkhir - neracaTotalEkuitas);
    const isBalanced = selisih < 0.005;

    return {
      tahun,
      periode: { startDate, endDate },
      modalAwal,
      tambahanModal,
      labaBersih,
      prive,
      modalAkhir,
      // Detail
      tambahanDetail,
      priveDetail,
      labaRugi: {
        pendapatan: lr.pendapatanOperasional.subtotal + lr.nonOperasional.pendapatanLain.subtotal,
        beban: lr.hpp.subtotal + lr.bebanOperasional.subtotal + lr.nonOperasional.bebanLain.subtotal + lr.pajak.subtotal,
      },
      // Cross-check
      crossCheck: {
        neracaEkuitasAkun,
        neracaLabaBerjalan: labaBersih,
        neracaTotalEkuitas,
        perubahanModalAkhir: modalAkhir,
        selisih,
        isBalanced,
      },
    };
  });

  // ── Trail Balance (Neraca Saldo) ──
  // mode=before (default): exclude CLOSING → neraca saldo SEBELUM penutupan
  // mode=after: include CLOSING → neraca saldo SETELAH penutupan (P&L = 0)
  app.get('/neraca-saldo', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const q = req.query as any;
    const endDate = q.end_date || new Date().toISOString().slice(0, 10);
    const mode = q.mode || 'before'; // 'before' | 'after'
    const closingFilter = mode === 'after'
      ? '' // include CLOSING (post-closing: P&L accounts = 0)
      : "AND je.tipetransaksi <> 'CLOSING'"; // exclude CLOSING (pre-closing view)
    const rows = await pool.query(
      `SELECT c.kode, c.nama, c.saldonormal AS "saldoNormal",
              COALESCE(SUM(
                CASE WHEN c.saldonormal = 'D'
                     THEN COALESCE(m.debit,0) - COALESCE(m.kredit,0)
                     ELSE COALESCE(m.kredit,0) - COALESCE(m.debit,0)
                END
              ), 0) AS saldo
       FROM chart_of_accounts c
       LEFT JOIN (
         SELECT jl.akun_id, jl.debit, jl.kredit
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
              AND je.tenant_id = $1
              AND je.isposted = true
              ${closingFilter}
              AND je.tanggal <= $2
       ) m ON m.akun_id = c.id
       WHERE c.tenant_id = $1 AND c.ispostable = true
             AND LEFT(c.kode,1) IN ('1','2','3','4','5','6','7')
       GROUP BY c.kode, c.nama, c.saldonormal
       ORDER BY c.kode`,
      [a.tenantId, endDate]
    );
    type AkunTB = { kode: string; nama: string; saldoNormal: string; debit: number; kredit: number };
    const tb: AkunTB[] = rows.rows.map((r: any) => {
      const saldo = Number(r.saldo), sn = r.saldoNormal;
      let debit = 0, kredit = 0;
      if (saldo >= 0) {
        if (sn === 'D') debit = saldo; else kredit = saldo;
      } else {
        const absS = Math.abs(saldo);
        if (sn === 'D') kredit = absS; else debit = absS;
      }
      return { kode: r.kode, nama: r.nama, saldoNormal: sn, debit, kredit };
    });
    const totalDebit = tb.reduce((s, a) => s + a.debit, 0);
    const totalKredit = tb.reduce((s, a) => s + a.kredit, 0);
    const selisih = totalDebit - totalKredit;
    const isBalanced = Math.abs(selisih) < 0.005;
    return { asOf: endDate, mode, akun: tb, totalDebit, totalKredit, isBalanced, selisih };
  });

  // ── Neraca Lajur — Export Excel (8 kolom standar kertas kerja) ──
  app.get('/neraca-lajur/export', tenantGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const q = req.query as any;
    const endDate = q.end_date || new Date().toISOString().slice(0, 10);

    // Tarik semua akun Gol 1-7 dengan mutasi s/d end_date (sama persis logika Neraca Saldo)
    const rows = await pool.query(
      `SELECT c.kode, c.nama, c.saldonormal AS "saldoNormal",
              COALESCE(SUM(
                CASE WHEN c.saldonormal = 'D'
                     THEN COALESCE(m.debit,0) - COALESCE(m.kredit,0)
                     ELSE COALESCE(m.kredit,0) - COALESCE(m.debit,0)
                END
              ), 0) AS saldo
       FROM chart_of_accounts c
       LEFT JOIN (
         SELECT jl.akun_id, jl.debit, jl.kredit
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
              AND je.tenant_id = $1 AND je.isposted = true AND je.tanggal <= $2
       ) m ON m.akun_id = c.id
       WHERE c.tenant_id = $1 AND c.ispostable = true
             AND LEFT(c.kode,1) IN ('1','2','3','4','5','6','7')
       GROUP BY c.kode, c.nama, c.saldonormal
       ORDER BY c.kode`,
      [a.tenantId, endDate]
    );

    // Mapping: tentukan debit/kredit per akun (sama flip logic)
    const data = rows.rows.map((r: any) => {
      const saldo = Number(r.saldo);
      const sn = r.saldoNormal;
      const isPL = ['4', '5', '6', '7'].includes(r.kode[0]);
      const isBS = ['1', '2', '3'].includes(r.kode[0]);
      let d = 0, k = 0;
      if (saldo >= 0) {
        if (sn === 'D') d = saldo; else k = saldo;
      } else {
        const a = Math.abs(saldo);
        if (sn === 'D') k = a; else d = a;
      }
      return {
        kode: r.kode,
        nama: r.nama,
        nsD: d, nsK: k,
        lrD: isPL ? d : 0, lrK: isPL ? k : 0,
        nerD: isBS ? d : 0, nerK: isBS ? k : 0,
      };
    });

    // Total
    const sum = (fn: (d: any) => number) => data.reduce((s: number, a: any) => s + fn(a), 0);
    const totals = {
      nsD: sum(d => d.nsD), nsK: sum(d => d.nsK),
      lrD: sum(d => d.lrD), lrK: sum(d => d.lrK),
      nerD: sum(d => d.nerD), nerK: sum(d => d.nerK),
    };
    const selisihLR = Math.abs(totals.lrD - totals.lrK);
    const selisihNer = Math.abs(totals.nerD - totals.nerK);

    // Build Excel
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SILABU DIGI';
    const ws = wb.addWorksheet('Neraca Lajur', { views: [{ showGridLines: false }] });

    // Styling helper
    const font = (sz: number, bold = false) => ({ name: 'Calibri', size: sz, bold });
    const border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    const fmt = '#,##0';

    // Header row
    const headers = ['Kode Akun', 'Nama Akun', 'Neraca Saldo (D)', 'Neraca Saldo (K)', 'Laba/Rugi (D)', 'Laba/Rugi (K)', 'Neraca (D)', 'Neraca (K)'];
    const hRow = ws.addRow(headers);
    hRow.eachCell((c: any, col: number) => {
      c.font = font(11, true);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
      c.font = { ...font(11, true), color: { argb: 'FFFFFFFF' } };
      c.alignment = { horizontal: col <= 2 ? 'left' : 'right', vertical: 'middle' };
      c.border = border;
    });
    ws.addRow([]); // spacer

    // Data rows
    data.forEach((d: any) => {
      const row = ws.addRow([d.kode, d.nama, d.nsD || '', d.nsK || '', d.lrD || '', d.lrK || '', d.nerD || '', d.nerK || '']);
      row.eachCell((c: any, col: number) => {
        c.font = font(10);
        c.alignment = { horizontal: col <= 2 ? 'left' : 'right', vertical: 'middle' };
        c.border = border;
        if (col <= 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    });

    ws.addRow([]); // spacer

    // TOTAL row
    const tRow = ws.addRow(['', 'TOTAL', totals.nsD, totals.nsK, totals.lrD, totals.lrK, totals.nerD, totals.nerK]);
    tRow.eachCell((c: any, col: number) => {
      c.font = font(11, true);
      c.alignment = { horizontal: col <= 2 ? 'left' : 'right', vertical: 'middle' };
      c.border = border;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      if (col > 2) c.numFmt = fmt;
    });

    // Selisih row
    ws.addRow(['', 'Selisih', '', '', selisihLR, '', selisihNer, '']).eachCell((c: any, col: number) => {
      if (col === 5 || col === 7) c.font = font(11, true);
    });

    // Info row
    ws.addRow(['', '', '', '', '', '', '', '']);
    ws.addRow([`Neraca Lajur per ${endDate} — SILABU DIGI`, '', '', '', '', '', '', '']).eachCell((c: any) => {
      c.font = { ...font(9), italic: true, color: { argb: 'FF94A3B8' } };
    });

    // Column widths
    ws.getColumn(1).width = 14;
    ws.getColumn(2).width = 36;
    for (let i = 3; i <= 8; i++) ws.getColumn(i).width = 18;

    // Stream response
    const filename = `Neraca_Lajur_${endDate.replace(/-/g, '')}.xlsx`;
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const buf = await wb.xlsx.writeBuffer();
    reply.send(buf);
  });

  // ── Arus Kas (Cash Flow Statement) ──
  app.get('/arus-kas', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const q = req.query as any;
    const startDate = q.start_date;
    const endDate = q.end_date || new Date().toISOString().slice(0, 10);
    const tid = a.tenantId;

    // ── Kas Tahun Lalu: total Kas/Bank s/d start_date (termasuk Saldo Awal) ──
    // When start_date not provided, include OPENING_BALANCE so kasTahunLalu + flowQuery = neracaKasTotal
    const kasTahunLalu = await (async () => {
      if (!startDate) {
        // No start_date → kasTahunLalu = OPENING_BALANCE contribution to Kas/Bank
        const r = await pool.query(
          `SELECT COALESCE(SUM(CASE WHEN c.saldonormal='D' THEN m.debit-m.kredit ELSE m.kredit-m.debit END),0) AS saldo
           FROM chart_of_accounts c
           LEFT JOIN (
             SELECT jl.akun_id, SUM(jl.debit) AS debit, SUM(jl.kredit) AS kredit
             FROM journal_lines jl
             JOIN journal_entries je ON je.id=jl.entry_id AND je.tenant_id=$1
               AND je.isposted = true
               AND je.tipetransaksi = 'OPENING_BALANCE'
             GROUP BY jl.akun_id
           ) m ON m.akun_id=c.id
           WHERE c.tenant_id=$1 AND c.ispostable=true AND (c.kode LIKE '1.1.01%' OR c.kode LIKE '1.1.02%')`,
          [tid]
        );
        return Number(r.rows[0]?.saldo || 0);
      }
      const r = await pool.query(
        `SELECT COALESCE(SUM(CASE WHEN c.saldonormal='D' THEN m.debit-m.kredit ELSE m.kredit-m.debit END),0) AS saldo
         FROM chart_of_accounts c
         LEFT JOIN (
           SELECT jl.akun_id, SUM(jl.debit) AS debit, SUM(jl.kredit) AS kredit
           FROM journal_lines jl
           JOIN journal_entries je ON je.id=jl.entry_id AND je.tenant_id=$1
             AND je.isposted = true
             AND (je.tanggal < $2 AND je.tipetransaksi <> 'CLOSING' OR je.tipetransaksi = 'OPENING_BALANCE')
           GROUP BY jl.akun_id
         ) m ON m.akun_id=c.id
         WHERE c.tenant_id=$1 AND c.ispostable=true AND (c.kode LIKE '1.1.01%' OR c.kode LIKE '1.1.02%')`,
        [tid, startDate]
      );
      return Number(r.rows[0]?.saldo || 0);
    })();

    // ── Analisis akun lawan per jurnal (FIXED: net per entry + primary contra) ──
    // Bug fix: jurnal 4 baris (Kas/Pendapatan/HPP/Persediaan) sebelumnya double-count
    // Persediaan K sebagai "masuk". Sekarang: hitung net kas per entry, atribusikan
    // ke primary contra (contra dengan jumlah terbesar yang sesuai arah kas).
    const flowQuery = await pool.query(
      `WITH kas_entries AS (
        SELECT DISTINCT je.id AS entry_id, je.tanggal
        FROM journal_lines jl
        JOIN chart_of_accounts c ON c.id=jl.akun_id AND (c.kode LIKE '1.1.01%' OR c.kode LIKE '1.1.02%')
        JOIN journal_entries je ON je.id=jl.entry_id AND je.tenant_id=$1 AND je.isposted = true AND je.tanggal>=$2 AND je.tanggal<=$3 AND je.tipetransaksi NOT IN ('OPENING_BALANCE','CLOSING')
      ),
      kas_net AS (
        SELECT ke.entry_id, ke.tanggal,
               COALESCE(SUM(jl.debit),0) AS kas_debit,
               COALESCE(SUM(jl.kredit),0) AS kas_kredit,
               COALESCE(SUM(jl.debit),0) - COALESCE(SUM(jl.kredit),0) AS net
        FROM kas_entries ke
        JOIN journal_lines jl ON jl.entry_id=ke.entry_id
        JOIN chart_of_accounts c ON c.id=jl.akun_id AND (c.kode LIKE '1.1.01%' OR c.kode LIKE '1.1.02%')
        GROUP BY ke.entry_id, ke.tanggal
      ),
      contra AS (
        SELECT ke.entry_id,
               contra.kode, contra.nama,
               COALESCE(contra_line.debit,0) AS d, COALESCE(contra_line.kredit,0) AS k
        FROM kas_entries ke
        JOIN journal_lines contra_line ON contra_line.entry_id=ke.entry_id
        JOIN chart_of_accounts contra ON contra.id=contra_line.akun_id AND NOT (contra.kode LIKE '1.1.01%' OR contra.kode LIKE '1.1.02%')
      ),
      primary_contra AS (
        SELECT DISTINCT ON (c.entry_id)
          c.entry_id, c.kode, c.nama
        FROM contra c
        JOIN kas_net kn ON kn.entry_id=c.entry_id
        WHERE (kn.net > 0 AND c.k > 0) OR (kn.net < 0 AND c.d > 0)
        ORDER BY c.entry_id, GREATEST(c.d, c.k) DESC
      )
      SELECT pc.kode, pc.nama,
             SUM(CASE WHEN kn.net > 0 THEN kn.net ELSE 0 END) AS masuk,
             SUM(CASE WHEN kn.net < 0 THEN -kn.net ELSE 0 END) AS keluar
      FROM primary_contra pc
      JOIN kas_net kn ON kn.entry_id=pc.entry_id
      WHERE kn.net != 0
      GROUP BY pc.kode, pc.nama
      ORDER BY pc.kode`,
      [tid, startDate || '1970-01-01', endDate]
    );

    // ── Klasifikasi per aktivitas (Fix #23: documented + 1.4 added) ──
    // Klasifikasi berdasarkan prefix kode akun lawan kas (Kepmendesa 136):
    //   Operasi   = akun lancar operasional + pendapatan/beban
    //              Gol 1.1.03 (piutang), 1.1.05 (persediaan), 1.1.06 (biaya dimuka),
    //              Gol 4 (pendapatan), 5 (HPP), 6 (beban), 7 (luar biasa)
    //   Investasi = aset lain-lain, aset tetap, aset tak berwujud
    //              Gol 1.2, 1.3, 1.4
    //   Pendanaan = kewajiban dan ekuitas (termasuk prive)
    //              Gol 2, 3
    // Kas/bank (1.1.01, 1.1.02) adalah source — tidak masuk klasifikasi.
    type FlowItem = { kode: string; nama: string; masuk: number; keluar: number; net: number };
    const ops: FlowItem[] = [];
    const inv: FlowItem[] = [];
    const dana: FlowItem[] = [];

    for (const r of flowQuery.rows) {
      const item: FlowItem = {
        kode: r.kode, nama: r.nama,
        masuk: Number(r.masuk), keluar: Number(r.keluar),
        net: Number(r.masuk) - Number(r.keluar),
      };
      // Operasi: Gol 1.1.03 (piutang), 1.1.05 (persediaan), 1.1.06 (biaya dimuka), 4, 5, 6, 7
      // Investasi: Gol 1.2 (aset lain), 1.3 (aset tetap), 1.4 (aset tak berwujud)
      // Pendanaan: Gol 2 (kewajiban), 3 (ekuitas/prive)
      const g = r.kode[0];
      const sub2 = r.kode.slice(0, 3);
      if (sub2 === '1.2' || sub2 === '1.3' || sub2 === '1.4') {
        inv.push(item);
      } else if (g === '2' || g === '3') {
        dana.push(item);
      } else {
        // sisa: termasuk Gol 1.1.03, 1.1.05, 4, 5, 6, 7
        ops.push(item);
      }
    }

    const sumNet = (arr: FlowItem[]) => arr.reduce((s, i) => s + i.net, 0);
    const sumMasuk = (arr: FlowItem[]) => arr.reduce((s, i) => s + i.masuk, 0);
    const sumKeluar = (arr: FlowItem[]) => arr.reduce((s, i) => s + i.keluar, 0);

    const oNet = sumNet(ops), iNet = sumNet(inv), dNet = sumNet(dana);
    const totalNetFlow = oNet + iNet + dNet;
    const kasBerjalan = kasTahunLalu + totalNetFlow;

    // ── Validasi dengan Neraca (Kas/Bank) ──
    // Include OPENING_BALANCE regardless of tanggal (may be dated before first transaction)
    const neracaKas = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN c.saldonormal='D' THEN m.debit-m.kredit ELSE m.kredit-m.debit END),0) AS saldo
       FROM chart_of_accounts c
       LEFT JOIN (
         SELECT jl.akun_id, SUM(jl.debit) AS debit, SUM(jl.kredit) AS kredit
         FROM journal_lines jl
         JOIN journal_entries je ON je.id=jl.entry_id AND je.tenant_id=$1
           AND je.isposted = true
           AND ((je.tanggal<= $2 AND je.tipetransaksi <> 'CLOSING') OR je.tipetransaksi = 'OPENING_BALANCE')
         GROUP BY jl.akun_id
       ) m ON m.akun_id=c.id
       WHERE c.tenant_id=$1 AND c.ispostable=true AND (c.kode LIKE '1.1.01%' OR c.kode LIKE '1.1.02%')`,
      [tid, endDate]
    );
    const neracaKasTotal = Number(neracaKas.rows[0]?.saldo || 0);
    const cocok = Math.abs(kasBerjalan - neracaKasTotal) < 0.005;

    return {
      periode: { startDate, endDate },
      aktivitasOperasi: { detail: ops, totalMasuk: sumMasuk(ops), totalKeluar: sumKeluar(ops), net: oNet },
      aktivitasInvestasi: { detail: inv, totalMasuk: sumMasuk(inv), totalKeluar: sumKeluar(inv), net: iNet },
      aktivitasPendanaan: { detail: dana, totalMasuk: sumMasuk(dana), totalKeluar: sumKeluar(dana), net: dNet },
      kasTahunLalu,
      kasBerjalan,
      validasiNeraca: { neracaKasTotal, cocok },
    };
  });

  // ── CALK Detail (Catatan Atas Laporan Keuangan) ──
  app.get('/calk-details', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const q = req.query as any;
    const endDate = q.end_date || new Date().toISOString().slice(0, 10);
    const tid = a.tenantId;

    // Helper: saldo akhir per akun (saldonormal aware)
    async function akunSaldo(kodeLike: string, label: string) {
      const r = await pool.query(
        `SELECT c.kode, c.nama,
                COALESCE(SUM(CASE WHEN c.saldonormal='D' THEN m.debit-m.kredit ELSE m.kredit-m.debit END),0) AS saldo
         FROM chart_of_accounts c
         LEFT JOIN (
           SELECT jl.akun_id, SUM(jl.debit) AS debit, SUM(jl.kredit) AS kredit
           FROM journal_lines jl JOIN journal_entries je ON je.id=jl.entry_id AND je.tenant_id=$1 AND je.isposted = true AND je.tanggal<=$2 AND je.tipetransaksi <> 'CLOSING'
           GROUP BY jl.akun_id
         ) m ON m.akun_id=c.id
         WHERE c.tenant_id=$1 AND c.ispostable=true AND ${kodeLike}
         GROUP BY c.kode, c.nama ORDER BY c.kode`,
        [tid, endDate]
      );
      return r.rows.map((x: any) => ({ kode: x.kode, nama: x.nama, saldo: Number(x.saldo) }));
    }

    // 1. Kas & Setara Kas (Gol 1.1.01 + 1.1.02)
    const kas = await akunSaldo(`(c.kode LIKE '1.1.01%' OR c.kode LIKE '1.1.02%')`, 'kas');

    // 2. Rincian Piutang — contacts (pelanggan) + saldo per akun piutang
    const piutang = await pool.query(
      `SELECT c.nama, c.saldo_awal, c.saldo_awal_tipe, coa.kode AS akun_kode, coa.nama AS akun_nama
       FROM contacts c JOIN chart_of_accounts coa ON coa.id=c.akun_id
       WHERE c.tenant_id=$1 AND c.tipe='pelanggan' ORDER BY c.nama`,
      [tid]
    );

    // 3. Rincian Persediaan — inventory_items
    const persediaan = await pool.query(
      `SELECT i.nama, i.kode, i.satuan, i.qty_awal, i.harga_satuan, i.saldo_awal, coa.kode AS akun_kode
       FROM inventory_items i JOIN chart_of_accounts coa ON coa.id=i.akun_id
       WHERE i.tenant_id=$1 ORDER BY i.nama`,
      [tid]
    );

    // 4. Rincian Aset Tetap — fixed_assets (perolehan, akumulasi, nilai buku)
    const asetTetap = await pool.query(
      `SELECT f.nama, f.kategori, f.tanggal_perolehan, f.harga_perolehan,
              f.akumulasi_penyusutan, f.nilai_buku_awal, f.umur_manfaat_bulan,
              coa.kode AS akun_kode
       FROM fixed_assets f JOIN chart_of_accounts coa ON coa.id=f.akun_id
       WHERE f.tenant_id=$1 ORDER BY f.kategori, f.nama`,
      [tid]
    );

    // 5. Rincian Utang — contacts (supplier)
    const utang = await pool.query(
      `SELECT c.nama, c.saldo_awal, c.saldo_awal_tipe, coa.kode AS akun_kode, coa.nama AS akun_nama
       FROM contacts c JOIN chart_of_accounts coa ON coa.id=c.akun_id
       WHERE c.tenant_id=$1 AND c.tipe='supplier' ORDER BY c.nama`,
      [tid]
    );

    // 6. Rincian Ekuitas — equity_details
    const ekuitas = await pool.query(
      `SELECT e.sumber, e.tahun_penerimaan, e.keterangan, e.saldo_awal,
              coa.kode AS akun_kode, coa.nama AS akun_nama
       FROM equity_details e JOIN chart_of_accounts coa ON coa.id=e.akun_id
       WHERE e.tenant_id=$1 ORDER BY e.tahun_penerimaan`,
      [tid]
    );

    // 7. Rincian Pendapatan & Beban — akun level (Gol 4-7)
    const labaRugi = await akunSaldo(`LEFT(c.kode,1) IN ('4','5','6','7')`, 'laba-rugi');

    return {
      asOf: endDate,
      kas,
      piutang: piutang.rows.map((r: any) => ({
        nama: r.nama, saldo_awal: Number(r.saldo_awal), tipe: r.saldo_awal_tipe,
        akun: `${r.akun_kode} ${r.akun_nama}`,
      })),
      persediaan: persediaan.rows.map((r: any) => ({
        nama: r.nama, kode: r.kode, satuan: r.satuan,
        qty_awal: Number(r.qty_awal), harga_satuan: Number(r.harga_satuan), saldo_awal: Number(r.saldo_awal),
        akun_kode: r.akun_kode,
      })),
      asetTetap: asetTetap.rows.map((r: any) => ({
        nama: r.nama, kategori: r.kategori, tanggal_perolehan: r.tanggal_perolehan,
        harga_perolehan: Number(r.harga_perolehan),
        akumulasi_penyusutan: Number(r.akumulasi_penyusutan),
        nilai_buku_awal: Number(r.nilai_buku_awal),
        umur_manfaat_bulan: r.umur_manfaat_bulan,
        akun_kode: r.akun_kode,
      })),
      utang: utang.rows.map((r: any) => ({
        nama: r.nama, saldo_awal: Number(r.saldo_awal), tipe: r.saldo_awal_tipe,
        akun: `${r.akun_kode} ${r.akun_nama}`,
      })),
      ekuitas: ekuitas.rows.map((r: any) => ({
        sumber: r.sumber, tahun: r.tahun_penerimaan, keterangan: r.keterangan,
        saldo_awal: Number(r.saldo_awal), akun: `${r.akun_kode} ${r.akun_nama}`,
      })),
      labaRugi: labaRugi.filter((r: any) => Number(r.saldo) !== 0).map((r: any) => ({
        kode: r.kode, nama: r.nama, saldo: Number(r.saldo),
      })),
    };
  });

  // ── Aset Tetap (Manajemen Aset & Inventaris) ──
  const KATEGORI_COA: Record<string, { kode: string; nama: string; akumKode?: string; bebanKode?: string }> = {
    Kendaraan: { kode: '1.3.02.01', nama: 'Kendaraan', akumKode: '1.3.07.01', bebanKode: '6.1.07.02' },
    Komputer: { kode: '1.3.03.01', nama: 'Peralatan dan Mesin', akumKode: '1.3.07.02', bebanKode: '6.1.07.03' },
    Meubelair: { kode: '1.3.04.01', nama: 'Meubelair', akumKode: '1.3.07.03', bebanKode: '6.1.07.04' },
    Bangunan: { kode: '1.3.05.01', nama: 'Gedung dan Bangunan', akumKode: '1.3.07.04', bebanKode: '6.1.07.05' },
    Tanah: { kode: '1.3.01.01', nama: 'Tanah' },
    'Peralatan/Mesin': { kode: '1.3.03.01', nama: 'Peralatan dan Mesin', akumKode: '1.3.07.02', bebanKode: '6.1.07.03' },
    Lainnya: { kode: '1.3.99.99', nama: 'Aset Tetap Lainnya', akumKode: '1.3.07.02', bebanKode: '6.1.07.03' },
  };

  // GET /aset-tetap — daftar aset + nilai buku
  app.get('/aset-tetap', tenantGuard, async (_req: FastifyRequest) => {
    const a = (_req as any).auth as AuthPayload;
    const rows = await pool.query(
      `SELECT id, nama, kategori, harga_perolehan, akumulasi_penyusutan, nilai_buku_awal,
              umur_manfaat_bulan, tanggal_perolehan, created_at
       FROM fixed_assets WHERE tenant_id=$1 ORDER BY created_at DESC`,
      [a.tenantId]
    );
    const now = new Date();
    return {
      data: rows.rows.map((r: any) => {
        const bulanTerpakai = Math.floor((now.getTime() - new Date(r.tanggal_perolehan).getTime()) / (30.4375 * 86400000));
        const bulanTersisa = Math.max(0, (r.umur_manfaat_bulan || 0) - bulanTerpakai);
        const totalSusut = Number(r.akumulasi_penyusutan || 0);
        const nilaiBuku = Number(r.harga_perolehan) - totalSusut;
        const persenHidup = r.umur_manfaat_bulan ? Math.max(0, Math.min(100, Math.round((bulanTersisa / r.umur_manfaat_bulan) * 100))) : 100;
        const habis = bulanTersisa <= 0 && r.umur_manfaat_bulan > 0;
        return {
          id: r.id, nama: r.nama, kategori: r.kategori,
          hargaPerolehan: Number(r.harga_perolehan),
          akumulasiPenyusutan: totalSusut,
          nilaiBuku, nilaiBukuAwal: Number(r.nilai_buku_awal || 0),
          umurManfaatBulan: r.umur_manfaat_bulan,
          bulanTerpakai, bulanTersisa,
          tanggalPerolehan: r.tanggal_perolehan?.toISOString?.()?.slice(0, 10) || r.tanggal_perolehan,
          persenHidup, habis,
        };
      }),
    };
  });

  // GET /aset-tetap/kas-accounts — daftar akun Kas/Bank
  app.get('/aset-tetap/kas-accounts', tenantGuard, async (_req: FastifyRequest) => {
    const a = (_req as any).auth as AuthPayload;
    const rows = await pool.query(
      `SELECT id, kode, nama FROM chart_of_accounts
       WHERE tenant_id=$1 AND ispostable=true AND (kode LIKE '1.1.01%' OR kode LIKE '1.1.02%') ORDER BY kode`,
      [a.tenantId]
    );
    return { data: rows.rows.map((r: any) => ({ id: r.id, kode: r.kode, nama: r.nama })) };
  });

  // POST /aset-tetap — tambah aset + auto jurnal
  app.post('/aset-tetap', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const b = req.body as any;
    if (!b.nama || !b.kategori || !b.tanggal_perolehan || !b.harga_perolehan || !b.umur_manfaat_bulan || !b.sumber_dana_id) {
      return reply.code(400).send({ error: 'Semua field wajib diisi' });
    }
    const cat = KATEGORI_COA[b.kategori];
    if (!cat) return reply.code(400).send({ error: 'Kategori tidak valid' });
    await checkPeriodLock(a.tenantId!, parseInt(b.tanggal_perolehan.slice(0,4), 10));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Cari akun aset & akun sumber dana
      const assetAcc = await client.query(
        `SELECT id FROM chart_of_accounts WHERE tenant_id=$1 AND kode=$2 AND ispostable=true LIMIT 1`,
        [a.tenantId, cat.kode]
      );
      if (!assetAcc.rows.length) return reply.code(400).send({ error: 'Akun aset tidak ditemukan' });
      const assetId = assetAcc.rows[0].id;

      // 2. Insert fixed_assets
      const now = new Date();
      const fa = await client.query(
        `INSERT INTO fixed_assets (tenant_id, nama, kategori, akun_id, tanggal_perolehan, harga_perolehan, umur_manfaat_bulan, nilai_buku_awal, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$6,$8,$8) RETURNING id`,
        [a.tenantId, b.nama, b.kategori, assetId, b.tanggal_perolehan, b.harga_perolehan, b.umur_manfaat_bulan, now]
      );
      const asetId = fa.rows[0].id;

      // 3. Auto-buat jurnal: Debit Aset — Kredit Kas/Bank
      const noJurnal = `BELI-${b.kategori.toUpperCase().slice(0, 3)}-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${asetId.slice(0, 8)}`;
      const tgl = new Date(b.tanggal_perolehan);
      const bulan = tgl.getMonth() + 1;
      const tahun = tgl.getFullYear();
      const je = await client.query(
        `INSERT INTO journal_entries (tenant_id, tanggal, bulan, tahun, no_jurnal, keterangan, isposted, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7) RETURNING id`,
        [a.tenantId, b.tanggal_perolehan, bulan, tahun, noJurnal, `Pembelian ${b.nama} (${b.kategori})`, now]
      );
      const entryId = je.rows[0].id;

      await client.query(
        `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit)
         VALUES ($1,$2,$3,0), ($1,$4,0,$3)`,
        [entryId, assetId, b.harga_perolehan, b.sumber_dana_id]
      );

      await client.query('COMMIT');
      return { success: true, id: asetId, noJurnal };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  // GET /aset-tetap/candidates — daftar jurnal aset tetap yg belum terdaftar
  app.get('/aset-tetap/candidates', tenantGuard, async (_req: FastifyRequest) => {
    const a = (_req as any).auth as AuthPayload;
    // Cari debit journal_line akun 1.3.x.x (aset tetap) yang belum terdaftar
    const rows = await pool.query(
      `SELECT jl.id AS journal_line_id, je.id AS journal_entry_id,
              je.no_jurnal, je.tanggal, je.keterangan AS jurnal_keterangan,
              jl.debit, c.id AS akun_id, c.kode AS akun_kode, c.nama AS akun_nama
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.entry_id
       JOIN chart_of_accounts c ON c.id = jl.akun_id AND c.tenant_id = je.tenant_id
       WHERE je.tenant_id = $1
         AND je.isposted = true
         AND jl.debit > 0
         AND c.kode LIKE '1.3.%'
         AND c.kode NOT LIKE '1.3.00.%'
         AND c.kode NOT LIKE '1.3.06.%'
         AND c.kode NOT LIKE '1.3.07.%'
         AND c.ispostable = true
         AND COALESCE(je.tipetransaksi, '') NOT IN ('OPENING_BALANCE', 'CLOSING')
         AND NOT EXISTS (
           SELECT 1 FROM fixed_assets fa
           WHERE fa.tenant_id = $1 AND fa.source_journal_line_id = jl.id
         )
       ORDER BY je.tanggal DESC, je.no_jurnal`,
      [a.tenantId]
    );
    return {
      data: rows.rows.map((r: any) => ({
        journalLineId: r.journal_line_id,
        journalEntryId: r.journal_entry_id,
        noJurnal: r.no_jurnal,
        tanggal: r.tanggal?.toISOString?.()?.slice(0, 10) || r.tanggal,
        jurnalKeterangan: r.jurnal_keterangan,
        debit: Number(r.debit),
        akunId: r.akun_id,
        akunKode: r.akun_kode,
        akunNama: r.akun_nama,
      })),
      count: rows.rowCount,
    };
  });

  // POST /aset-tetap/from-journal — daftarkan aset tetap dari jurnal yang sudah ada
  app.post('/aset-tetap/from-journal', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const b = req.body as any;

    // Validasi field wajib
    if (!b.journal_line_id || !b.nama || !b.kategori || !b.umur_manfaat_bulan) {
      return reply.code(400).send({ error: 'Field wajib: journal_line_id, nama, kategori, umur_manfaat_bulan' });
    }

    const cat = KATEGORI_COA[b.kategori];
    if (b.kategori !== 'Peralatan/Mesin' && !cat) {
      return reply.code(400).send({ error: 'Kategori tidak valid' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Validasi journal_line milik tenant, posted, debit aset tetap, belum terdaftar
      const jl = await client.query(
        `SELECT jl.id, jl.debit, jl.entry_id, je.tanggal,
                c.id AS akun_id, c.kode AS akun_kode
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
         JOIN chart_of_accounts c ON c.id = jl.akun_id AND c.tenant_id = je.tenant_id
         WHERE jl.id = $1
           AND je.tenant_id = $2
           AND je.isposted = true
           AND jl.debit > 0
           AND c.kode LIKE '1.3.%'
           AND c.kode NOT LIKE '1.3.00.%'
           AND c.kode NOT LIKE '1.3.06.%'
           AND c.kode NOT LIKE '1.3.07.%'
           AND c.ispostable = true
           AND COALESCE(je.tipetransaksi, '') NOT IN ('OPENING_BALANCE', 'CLOSING')`,
        [b.journal_line_id, a.tenantId]
      );
      if (!jl.rows.length) {
        return reply.code(400).send({ error: 'Journal line tidak valid atau bukan aset tetap' });
      }

      // 2. Cek duplicate protection
      const existing = await client.query(
        `SELECT id FROM fixed_assets WHERE tenant_id=$1 AND source_journal_line_id=$2 LIMIT 1`,
        [a.tenantId, b.journal_line_id]
      );
      if (existing.rows.length) {
        return reply.code(409).send({ error: 'Journal line ini sudah terdaftar sebagai aset tetap' });
      }

      // 3. Cari akun aset (gunakan akun dari jurnal)
      const assetAccId = jl.rows[0].akun_id;

      // 4. Cek period lock berdasarkan tanggal dari jurnal
      const tglJurnal = jl.rows[0].tanggal;
      const tahunJurnal = new Date(tglJurnal).getFullYear();
      await checkPeriodLock(a.tenantId!, tahunJurnal);

      // 5. Insert fixed_assets — Phase 1: harga_perolehan locked ke debit journal_line
      const now = new Date();
      const nilaiPerolehan = Number(jl.rows[0].debit);
      const tanggalPerolehan = b.tanggal_perolehan || jl.rows[0].tanggal.toISOString().slice(0, 10);
      const fa = await client.query(
        `INSERT INTO fixed_assets
          (tenant_id, nama, kategori, akun_id, tanggal_perolehan, harga_perolehan,
           umur_manfaat_bulan, nilai_buku_awal, source_journal_entry_id, source_journal_line_id,
           created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$6,$8,$9,$10,$10)
         RETURNING id`,
        [
          a.tenantId, b.nama, b.kategori, assetAccId,
          tanggalPerolehan, nilaiPerolehan,
          b.umur_manfaat_bulan,
          jl.rows[0].entry_id, b.journal_line_id,
          now,
        ]
      );
      const asetId = fa.rows[0].id;

      await client.query('COMMIT');
      return { success: true, id: asetId, message: 'Aset tetap berhasil didaftarkan dari jurnal' };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  // POST /aset-tetap/depreciate — jalankan penyusutan bulanan
  // Fix #3: sequential no_jurnal, duplicate protection, proper errors, DB transaction
  app.post('/aset-tetap/depreciate', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const now = new Date();
    const tanggal = now.toISOString().slice(0, 10);
    const tahun = now.getFullYear();
    const bulan = now.getMonth() + 1;
    const susutPrefix = `SUSUT-${tahun}-${String(bulan).padStart(2, '0')}-`;

    // Cari aset aktif (belum habis menyusut)
    const assets = await pool.query(
      `SELECT fa.id, fa.nama, fa.kategori, fa.akun_id, fa.harga_perolehan, fa.umur_manfaat_bulan, fa.akumulasi_penyusutan
       FROM fixed_assets fa
       WHERE fa.tenant_id=$1 AND (fa.akumulasi_penyusutan IS NULL OR fa.akumulasi_penyusutan < fa.harga_perolehan)
             AND fa.umur_manfaat_bulan > 0`,
      [a.tenantId]
    );

    if (!assets.rowCount) {
      return reply.status(400).send({ error: 'Tidak ada aset yang perlu disusutkan' });
    }

    type DepResult = { nama: string; noJurnal?: string; susut: number; ok: boolean; error?: string };
    const results: DepResult[] = [];

    for (const as of assets.rows) {
      const cat = KATEGORI_COA[as.kategori];
      if (!cat || !cat.akumKode || !cat.bebanKode) {
        results.push({ nama: as.nama, susut: 0, ok: false, error: `Kategori '${as.kategori}' tidak punya akun akumulasi/beban` });
        continue;
      }

      const akumAcc = await pool.query(
        `SELECT id FROM chart_of_accounts WHERE tenant_id=$1 AND kode=$2 AND ispostable=true LIMIT 1`,
        [a.tenantId, cat.akumKode]
      );
      const bebanAcc = await pool.query(
        `SELECT id FROM chart_of_accounts WHERE tenant_id=$1 AND kode=$2 AND ispostable=true LIMIT 1`,
        [a.tenantId, cat.bebanKode]
      );
      if (!akumAcc.rows.length) {
        results.push({ nama: as.nama, susut: 0, ok: false, error: `Akun akumulasi penyusutan ${cat.akumKode} tidak ditemukan` });
        continue;
      }
      if (!bebanAcc.rows.length) {
        results.push({ nama: as.nama, susut: 0, ok: false, error: `Akun beban penyusutan ${cat.bebanKode} tidak ditemukan` });
        continue;
      }

      const susut = Math.round(Number(as.harga_perolehan) / Number(as.umur_manfaat_bulan));
      if (susut <= 0) {
        results.push({ nama: as.nama, susut: 0, ok: false, error: 'Nilai penyusutan tidak valid (0 atau negatif)' });
        continue;
      }

      const nilaiTersisa = Number(as.harga_perolehan) - Number(as.akumulasi_penyusutan || 0);
      const aktualSusut = Math.min(susut, Math.max(0, nilaiTersisa));
      if (aktualSusut <= 0) {
        results.push({ nama: as.nama, susut: 0, ok: false, error: 'Aset sudah habis disusutkan' });
        continue;
      }

      // Proteksi LAYER 1: SELECT check untuk error message yang jelas
      const bulanKe = Math.floor((Number(as.akumulasi_penyusutan || 0) / susut)) + 1;
      const keterangan = `Penyusutan ${as.nama} - Bulan ke-${bulanKe}`;
      const deprRef = `ASSET_DEPR:${as.id}`;
      const existingDepr = await pool.query(
        `SELECT ad.id, je.no_jurnal FROM asset_depreciations ad
         JOIN journal_entries je ON je.id = ad.journal_entry_id
         WHERE ad.tenant_id=$1 AND ad.asset_id=$2 AND ad.tahun=$3 AND ad.bulan=$4`,
        [a.tenantId, as.id, tahun, bulan]
      );
      if (existingDepr.rowCount && existingDepr.rowCount > 0) {
        results.push({ nama: as.nama, susut: 0, ok: false, error: `Sudah didepresiasi bulan ${bulan}/${tahun} (${existingDepr.rows[0].no_jurnal})` });
        continue;
      }

      // Generate sequential no_jurnal (with retry for concurrency safety)
      const client = await pool.connect();
      const MAX_RETRIES = 3;
      let success = false;
      for (let attempt = 0; attempt < MAX_RETRIES && !success; attempt++) {
        const noJurnal = await nextJurnalNo(a.tenantId!, tahun, bulan, susutPrefix);
        try {
          await client.query('BEGIN');
          const je = await client.query(
            `INSERT INTO journal_entries (tenant_id, tanggal, bulan, tahun, no_jurnal, keterangan, referensi, isposted, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8) RETURNING id`,
            [a.tenantId, tanggal, bulan, tahun, noJurnal, keterangan, deprRef, now]
          );
          await client.query(
            `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit)
             VALUES ($1,$2,$3,0), ($1,$4,0,$3)`,
            [je.rows[0].id, bebanAcc.rows[0].id, aktualSusut, akumAcc.rows[0].id]
          );
          await client.query(
            `UPDATE fixed_assets SET akumulasi_penyusutan = COALESCE(akumulasi_penyusutan, 0) + $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`,
            [aktualSusut, now, as.id, a.tenantId]
          );
          // Proteksi LAYER 2: DB UNIQUE constraint — blocks race condition
          await client.query(
            `INSERT INTO asset_depreciations (tenant_id, asset_id, tahun, bulan, journal_entry_id, amount)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [a.tenantId, as.id, tahun, bulan, je.rows[0].id, aktualSusut]
          );
          await client.query('COMMIT');
          results.push({ nama: as.nama, noJurnal, susut: aktualSusut, ok: true });
          success = true;
        } catch (e: any) {
          await client.query('ROLLBACK');
          // asset_depreciations UNIQUE violation → already depreciated (race condition caught!)
          if (e.code === '23505' && e.constraint === 'asset_depreciations_tenant_id_asset_id_tahun_bulan_key') {
            results.push({ nama: as.nama, susut: 0, ok: false, error: `Sudah didepresiasi bulan ${bulan}/${tahun} (race condition blocked)` });
            success = true; // stop retrying
            continue;
          }
          // no_jurnal collision → retry with new number
          if (e.code === '23505' && attempt < MAX_RETRIES - 1) {
            continue;
          }
          const msg = e.code === '23505' ? 'Duplikat no_jurnal — gagal setelah 3 percobaan' : e.message || 'Error database';
          results.push({ nama: as.nama, susut: aktualSusut, ok: false, error: msg });
          success = true; // stop retrying
        }
      }
      client.release();
    }

    const success = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    if (failed > 0) {
      return reply.status(207).send({ results, total: results.length, success, failed });
    }
    return { results, total: results.length, success, failed: 0 };
  });

  // ── CRON: Depresiasi bulanan (internal — localhost only) ──
  app.post('/cron/depreciate', async (req: FastifyRequest, reply: FastifyReply) => {
    const ip = req.ip || (req as any).connection?.remoteAddress || '';
    if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
      return reply.code(403).send({ error: 'Forbidden — localhost only' });
    }
    const tenants = await pool.query('SELECT id FROM tenants WHERE is_active=true');
    const allResults: any[] = [];
    const now = new Date();
    const tanggal = now.toISOString().slice(0, 10);
    const tahun = now.getFullYear();
    const bulan = now.getMonth() + 1;

    for (const t of tenants.rows) {
      const assets = await pool.query(
        `SELECT fa.id, fa.nama, fa.kategori, fa.harga_perolehan, fa.umur_manfaat_bulan,
                COALESCE(fa.akumulasi_penyusutan,0) AS akumulasi_penyusutan
         FROM fixed_assets fa
         WHERE fa.tenant_id=$1
           AND COALESCE(fa.akumulasi_penyusutan,0) < fa.harga_perolehan
           AND fa.umur_manfaat_bulan > 0`,
        [t.id]
      );

      const KATEGORI_COA_LOCAL: Record<string, { akumKode?: string; bebanKode?: string }> = {
        Kendaraan: { akumKode: '1.3.07.01', bebanKode: '6.1.07.02' },
        Komputer: { akumKode: '1.3.07.02', bebanKode: '6.1.07.03' },
        Meubelair: { akumKode: '1.3.07.03', bebanKode: '6.1.07.04' },
        Bangunan: { akumKode: '1.3.07.04', bebanKode: '6.1.07.05' },
        Tanah: {},
        Lainnya: { akumKode: '1.3.07.02', bebanKode: '6.1.07.03' },
      };

      const susutPrefix = `SUSUT-${tahun}-${String(bulan).padStart(2, '0')}-`;

      for (const as of assets.rows) {
        const cat = KATEGORI_COA_LOCAL[as.kategori];
        if (!cat?.akumKode || !cat?.bebanKode) {
          allResults.push({ tenant: t.id.slice(0,8), aset: as.nama, error: `Kategori '${as.kategori}' tidak punya akun` });
          continue;
        }

        const akumAcc = await pool.query(
          `SELECT id FROM chart_of_accounts WHERE tenant_id=$1 AND kode=$2 AND ispostable=true LIMIT 1`, [t.id, cat.akumKode]
        );
        const bebanAcc = await pool.query(
          `SELECT id FROM chart_of_accounts WHERE tenant_id=$1 AND kode=$2 AND ispostable=true LIMIT 1`, [t.id, cat.bebanKode]
        );
        if (!akumAcc.rows.length || !bebanAcc.rows.length) {
          allResults.push({ tenant: t.id.slice(0,8), aset: as.nama, error: `Akun ${cat.akumKode}/${cat.bebanKode} tidak ditemukan` });
          continue;
        }

        const susut = Math.round(Number(as.harga_perolehan) / Number(as.umur_manfaat_bulan));
        const nilaiTersisa = Number(as.harga_perolehan) - Number(as.akumulasi_penyusutan);
        const aktualSusut = Math.min(susut, Math.max(0, nilaiTersisa));
        if (aktualSusut <= 0) continue;

        // Proteksi LAYER 1: SELECT check
        const deprRef = `ASSET_DEPR:${as.id}`;
        const existingDepr = await pool.query(
          `SELECT ad.id, je.no_jurnal FROM asset_depreciations ad
           JOIN journal_entries je ON je.id = ad.journal_entry_id
           WHERE ad.tenant_id=$1 AND ad.asset_id=$2 AND ad.tahun=$3 AND ad.bulan=$4`,
          [t.id, as.id, tahun, bulan]
        );
        if (existingDepr.rowCount && existingDepr.rowCount > 0) {
          allResults.push({ tenant: t.id.slice(0,8), aset: as.nama, skip: `sudah didepresiasi (${existingDepr.rows[0].no_jurnal})` });
          continue;
        }

        const bulanKe = Math.floor((Number(as.akumulasi_penyusutan) / susut)) + 1;
        const keterangan = `Penyusutan ${as.nama} - Bulan ke-${bulanKe}`;

        // Concurrency-safe: retry on no_jurnal collision
        const client = await pool.connect();
        const MAX_RETRIES = 3;
        let ok = false;
        for (let attempt = 0; attempt < MAX_RETRIES && !ok; attempt++) {
          const noJurnal = await nextJurnalNo(t.id, tahun, bulan, susutPrefix);
          try {
            await client.query('BEGIN');
            const je = await client.query(
              `INSERT INTO journal_entries (tenant_id, tanggal, bulan, tahun, no_jurnal, keterangan, referensi, isposted, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8) RETURNING id`,
              [t.id, tanggal, bulan, tahun, noJurnal, keterangan, deprRef, now]
            );
            await client.query(
              `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit)
               VALUES ($1,$2,$3,0), ($1,$4,0,$3)`,
              [je.rows[0].id, bebanAcc.rows[0].id, aktualSusut, akumAcc.rows[0].id]
            );
            await client.query(
              `UPDATE fixed_assets SET akumulasi_penyusutan = COALESCE(akumulasi_penyusutan, 0) + $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`,
              [aktualSusut, now, as.id, t.id]
            );
            // Proteksi LAYER 2: DB UNIQUE constraint
            await client.query(
              `INSERT INTO asset_depreciations (tenant_id, asset_id, tahun, bulan, journal_entry_id, amount)
               VALUES ($1,$2,$3,$4,$5,$6)`,
              [t.id, as.id, tahun, bulan, je.rows[0].id, aktualSusut]
            );
            await client.query('COMMIT');
            allResults.push({ tenant: t.id.slice(0,8), aset: as.nama, noJurnal, susut: aktualSusut });
            ok = true;
          } catch (e: any) {
            await client.query('ROLLBACK');
            if (e.code === '23505' && e.constraint === 'asset_depreciations_tenant_id_asset_id_tahun_bulan_key') {
              allResults.push({ tenant: t.id.slice(0,8), aset: as.nama, skip: 'race condition blocked' });
              ok = true; continue;
            }
            if (e.code === '23505' && attempt < MAX_RETRIES - 1) continue;
            const msg = e.code === '23505' ? 'Duplikat no_jurnal — gagal setelah retry' : e.message;
            allResults.push({ tenant: t.id.slice(0,8), aset: as.nama, error: msg });
            ok = true;
          }
        }
        client.release();
      }
    }
    return { ran: now.toISOString(), total: allResults.length, results: allResults };
  });

  // ── Tutup Buku Tahunan ──
  // GET /tutup-buku/periods — daftar periode
  app.get('/tutup-buku/periods', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const r = await pool.query(
      `SELECT id, tahun, status, closed_at
       FROM financial_periods WHERE tenant_id=$1 ORDER BY tahun`,
      [a.tenantId]
    );
    return { periods: r.rows };
  });

  // POST /tutup-buku — jurnal penutup + lock periode (Fix #16: Opsi D — advisory lock + idempotent)
  app.post('/tutup-buku', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const { tahun } = req.body as { tahun: number };
    const b = req.body as any;
    const year = tahun || b?.tahun;
    if (!year || year < 2000 || year > 2099) return reply.code(400).send({ error: 'Tahun tidak valid' });
    const tid = a.tenantId!;

    // Fix #16: ALL database operations inside transaction with advisory lock
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Advisory lock: serialize per tenant+tahun (not global)
      // This blocks parallel requests until this transaction commits/rollbacks
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtext('tutup-buku'), hashtext($1 || ':' || $2))`,
        [tid, String(year)]
      );

      // Check tahun sebelumnya — harus sudah ditutup
      if (year > 2000) {
        const prev = await client.query(
          `SELECT id, status FROM financial_periods WHERE tenant_id=$1 AND tahun=$2 LIMIT 1`,
          [tid, year - 1]
        );
        if (prev.rows.length && (prev.rows[0] as any).status !== 'CLOSED') {
          await client.query('ROLLBACK');
          return reply.code(400).send({ error: `Tahun ${year - 1} masih OPEN. Tutup buku tahun sebelumnya dulu!` });
        }
      }

      // Check current period + FOR UPDATE (row lock)
      // Ensure row exists first (create if not)
      await client.query(
        `INSERT INTO financial_periods (tenant_id, tahun, status)
         VALUES ($1, $2, 'OPEN')
         ON CONFLICT (tenant_id, tahun) DO NOTHING`,
        [tid, year]
      );
      const cur = await client.query(
        `SELECT id, status FROM financial_periods WHERE tenant_id=$1 AND tahun=$2 FOR UPDATE`,
        [tid, year]
      );
      const periodStatus = (cur.rows[0] as any).status;

      // If already CLOSED → idempotent response
      if (periodStatus === 'CLOSED') {
        // Find the existing closing entry
        const closingEntry = await client.query(
          `SELECT id, no_jurnal AS "noJurnal", tanggal, keterangan
           FROM journal_entries
           WHERE tenant_id=$1 AND tipetransaksi='CLOSING' AND tahun=$2
           LIMIT 1`,
          [tid, year]
        );

        if (closingEntry.rowCount) {
          // Normal case: period CLOSED and closing entry exists
          const lines = await client.query(
            `SELECT * FROM journal_lines WHERE entry_id=$1 ORDER BY created_at`,
            [closingEntry.rows[0].id]
          );
          await client.query('ROLLBACK'); // Read-only, no changes needed
          return {
            success: true,
            idempotent: true,
            message: `Periode ${year} sudah ditutup.`,
            closingEntry: {
              ...closingEntry.rows[0],
              lines: lines.rows,
            },
          };
        } else {
          // Abnormal: period CLOSED but no closing entry → data inconsistency
          await client.query('ROLLBACK');
          return reply.code(409).send({
            error: `Data inconsistency: periode ${year} sudah CLOSED tetapi jurnal penutup tidak ditemukan. Hubungi admin.`,
            code: 'CLOSING_ENTRY_MISSING',
          });
        }
      }

      // Period is OPEN → proceed with closing
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      // Hitung saldo akhir Gol 4-7 per 31 Des (P&L)
      const pnL = await client.query(
        `SELECT ca.id, ca.kode, ca.nama, ca.saldonormal,
                COALESCE(SUM(
                  CASE WHEN ca.saldonormal='D' THEN jl.debit - jl.kredit
                       ELSE jl.kredit - jl.debit END
                ), 0) AS saldo
         FROM journal_lines jl
         JOIN journal_entries je ON je.id=jl.entry_id
         JOIN chart_of_accounts ca ON ca.id=jl.akun_id AND ca.tenant_id=$1
         WHERE je.tenant_id=$1 AND je.isposted = true AND je.tanggal >= $2 AND je.tanggal <= $3
           AND je.tipetransaksi NOT IN ('OPENING_BALANCE', 'CLOSING')
           AND LEFT(ca.kode,1) IN ('4','5','6','7')
         GROUP BY ca.id, ca.kode, ca.nama, ca.saldonormal
         HAVING COALESCE(SUM(
           CASE WHEN ca.saldonormal='D' THEN jl.debit - jl.kredit
                ELSE jl.kredit - jl.debit END
         ), 0) != 0
         ORDER BY ca.kode`,
        [tid, startDate, endDate]
      );

      // Hitung saldo Prive (Gol 3.2.x)
      const priveQuery = await client.query(
        `SELECT ca.id, ca.kode, ca.nama, ca.saldonormal,
                COALESCE(SUM(
                  CASE WHEN ca.saldonormal='D' THEN jl.debit - jl.kredit
                       ELSE jl.kredit - jl.debit END
                ), 0) AS saldo
         FROM journal_lines jl
         JOIN journal_entries je ON je.id=jl.entry_id
         JOIN chart_of_accounts ca ON ca.id=jl.akun_id AND ca.tenant_id=$1
         WHERE je.tenant_id=$1 AND je.isposted = true AND je.tanggal >= $2 AND je.tanggal <= $3
           AND je.tipetransaksi NOT IN ('OPENING_BALANCE', 'CLOSING')
           AND ca.kode LIKE '3.2%'
         GROUP BY ca.id, ca.kode, ca.nama, ca.saldonormal
         HAVING COALESCE(SUM(
           CASE WHEN ca.saldonormal='D' THEN jl.debit - jl.kredit
                ELSE jl.kredit - jl.debit END
         ), 0) != 0
         ORDER BY ca.kode`,
        [tid, startDate, endDate]
      );

      if (!pnL.rows.length && !priveQuery.rows.length) {
        await client.query('ROLLBACK');
        return reply.code(400).send({ error: 'Tidak ada saldo akun Laba/Rugi atau Prive yang perlu ditutup.' });
      }

      // Hitung Laba Bersih
      let totalPendapatan = 0, totalBeban = 0;
      for (const r of pnL.rows) {
        const saldo = Number((r as any).saldo);
        if (String((r as any).kode).startsWith('4')) {
          totalPendapatan += saldo;
        } else {
          totalBeban += saldo;
        }
      }
      const labaBersih = totalPendapatan - totalBeban;

      // Cari akun Laba Ditahan (3.3.01.01)
      const labaDitahan = await client.query(
        `SELECT id FROM chart_of_accounts WHERE tenant_id=$1 AND kode='3.3.01.01' AND ispostable=true LIMIT 1`,
        [tid]
      );
      if (!labaDitahan.rows.length) {
        await client.query('ROLLBACK');
        return reply.code(400).send({ error: 'Akun Saldo Laba Tidak Dicadangkan (3.3.01.01) tidak ditemukan. Seed CoA dulu.' });
      }
      const labaDitahanId = (labaDitahan.rows[0] as any).id;

      // Buat jurnal penutup
      const noJurnal = `CL-${year}1231`;
      const keterangan = `Jurnal Penutup Tahun ${year}`;
      const je = await client.query(
        `INSERT INTO journal_entries (tenant_id, tanggal, bulan, tahun, no_jurnal, keterangan, tipetransaksi, isposted, created_at)
         VALUES ($1, $2, 12, $3, $4, $5, 'CLOSING', true, $6) RETURNING id`,
        [tid, endDate, year, noJurnal, keterangan, new Date()]
      );
      const jeId = je.rows[0].id;

      // Zeroing P&L: balik saldo masing-masing akun
      const lines: { akunId: string; debit: number; kredit: number }[] = [];
      let totalDebit = 0, totalKredit = 0;
      for (const r of pnL.rows) {
        const saldo = Number((r as any).saldo);
        if (saldo !== 0) {
          if (saldo > 0) {
            if ((r as any).saldonormal === 'D') {
              lines.push({ akunId: (r as any).id, debit: 0, kredit: saldo });
              totalKredit += saldo;
            } else {
              lines.push({ akunId: (r as any).id, debit: saldo, kredit: 0 });
              totalDebit += saldo;
            }
          } else {
            if ((r as any).saldonormal === 'D') {
              lines.push({ akunId: (r as any).id, debit: Math.abs(saldo), kredit: 0 });
              totalDebit += Math.abs(saldo);
            } else {
              lines.push({ akunId: (r as any).id, debit: 0, kredit: Math.abs(saldo) });
              totalKredit += Math.abs(saldo);
            }
          }
        }
      }

      // Zeroing Prive (Gol 3.2.x)
      let totalPrive = 0;
      for (const r of priveQuery.rows) {
        const saldo = Number((r as any).saldo);
        if (saldo !== 0) {
          if (saldo > 0) {
            lines.push({ akunId: (r as any).id, debit: 0, kredit: saldo });
            totalKredit += saldo;
            totalPrive += saldo;
          } else {
            lines.push({ akunId: (r as any).id, debit: Math.abs(saldo), kredit: 0 });
            totalDebit += Math.abs(saldo);
            totalPrive += saldo;
          }
        }
      }

      // Net ke Saldo Laba
      const netToSaldoLaba = labaBersih - totalPrive;
      if (netToSaldoLaba > 0) {
        lines.push({ akunId: labaDitahanId, debit: 0, kredit: netToSaldoLaba });
        totalKredit += netToSaldoLaba;
      } else if (netToSaldoLaba < 0) {
        lines.push({ akunId: labaDitahanId, debit: Math.abs(netToSaldoLaba), kredit: 0 });
        totalDebit += Math.abs(netToSaldoLaba);
      }

      // Balance check — integer cents
      const balanceResult = validateJournalBalance(lines as any);
      if (!balanceResult.valid) {
        await client.query('ROLLBACK');
        return reply.code(500).send({ error: `Jurnal penutup tidak balance: ${balanceResult.error}` });
      }

      // INSERT lines
      for (const l of lines) {
        await client.query(
          `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit) VALUES ($1,$2,$3,$4)`,
          [jeId, l.akunId, l.debit, l.kredit]
        );
      }

      // Update period → CLOSED
      await client.query(
        `UPDATE financial_periods SET status='CLOSED', closed_at=$3, closed_by=NULL
         WHERE tenant_id=$1 AND tahun=$2`,
        [tid, year, new Date()]
      );

      // Auto-create next year
      await client.query(
        `INSERT INTO financial_periods (tenant_id, tahun, status)
         VALUES ($1, $2, 'OPEN')
         ON CONFLICT (tenant_id, tahun) DO NOTHING`,
        [tid, year + 1]
      );

      await client.query('COMMIT');
      return {
        success: true,
        tahun: year,
        noJurnal,
        totalAkunPnL: pnL.rows.length,
        totalAkunPrive: priveQuery.rows.length,
        totalPendapatan,
        totalBeban,
        labaBersih,
        totalPrive,
        netToSaldoLaba,
        message: `Tutup buku ${year} berhasil. Laba bersih Rp ${labaBersih.toLocaleString('id-ID')}${totalPrive > 0 ? `, Prive Rp ${totalPrive.toLocaleString('id-ID')}` : ''} → Saldo Laba Rp ${netToSaldoLaba.toLocaleString('id-ID')}.`,
      };
    } catch (e: any) {
      // Rollback aborted transaction first (safe even if already aborted)
      await client.query('ROLLBACK').catch(() => {});
      
      // Safety net: catch unique constraint violation on no_jurnal
      if (e.code === '23505' && e.constraint?.includes('no_jurnal')) {
        // Double-submit caught by unique constraint → try to return idempotent response
        try {
          const closingEntry = await pool.query(
            `SELECT id, no_jurnal AS "noJurnal", tanggal, keterangan
             FROM journal_entries
             WHERE tenant_id=$1 AND tipetransaksi='CLOSING' AND tahun=$2
             LIMIT 1`,
            [tid, year]
          );
          if (closingEntry.rowCount) {
            const lines = await pool.query(
              `SELECT * FROM journal_lines WHERE entry_id=$1 ORDER BY created_at`,
              [closingEntry.rows[0].id]
            );
            return {
              success: true,
              idempotent: true,
              message: `Periode ${year} sudah ditutup (detected via unique constraint).`,
              closingEntry: {
                ...closingEntry.rows[0],
                lines: lines.rows,
              },
            };
          }
        } catch { /* fall through to generic error */ }
        return reply.code(409).send({
          error: `Tutup buku ${year} sudah dilakukan (duplikat terdeteksi).`,
          code: 'CLOSING_DUPLICATE',
        });
      }
      return reply.code(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ─── TRANSAKSI CEPAT (Guided Transactions) ──────────────────
  // POST /accounting/transaksi/quick — Auto-jurnal for guided transactions
  // Fix #18 (R1): Idempotency via shared helper — advisory lock + payload hash + 24h window
  app.post('/transaksi/quick', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const b = req.body as any;

    // Validate required fields
    if (!b.tipe || !b.tanggal || !b.nominal || !b.sumber_akun_id) {
      return reply.code(400).send({ error: 'tipe, tanggal, nominal, dan sumber_akun_id wajib' });
    }

    // Fix #18: Validate idempotency_key format BEFORE transaction
    const idempotency_key = b.idempotency_key || null;
    if (idempotency_key) {
      const keyCheck = validateIdempotencyKey(idempotency_key);
      if (!keyCheck.valid) {
        return reply.code(400).send({ error: keyCheck.error });
      }
    }

    const tipe = b.tipe as string;
    const tanggal = b.tanggal as string;
    const nominal = parseFloat(b.nominal);
    const sumberAkunId = b.sumber_akun_id as string;
    const keterangan = b.keterangan || '';
    const contactId = b.contact_id || null;
    const inventoryItemId = b.inventory_item_id || null;
    const qty = b.qty ? parseFloat(b.qty) : null;

    if (isNaN(nominal) || nominal <= 0) {
      return reply.code(400).send({ error: 'Nominal harus lebih dari 0' });
    }

    // Parse tanggal (strict YYYY-MM-DD validation)
    let parsedDate;
    try {
      parsedDate = parseYmdStrict(tanggal);
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
    const tahun = parsedDate.year;
    const bulan = parsedDate.month;

    // Determine target akun based on transaction type
    let targetAkunKode = '';
    let tipeTransaksi = 'GENERAL';
    let desc = keterangan;

    switch (tipe) {
      case 'uang_masuk':
        // Uang Masuk: Debit Kas/Bank, Credit [source account]
        // sumber_akun_id = Kas/Bank, target_akun_id = source (Pendapatan/Piutang/Utang/Modal)
        if (!b.target_akun_id) return reply.code(400).send({ error: 'Akun sumber penerimaan wajib dipilih' });
        if (!desc) desc = 'Penerimaan kas';
        break;
      case 'uang_keluar':
        // Uang Keluar: Debit [destination], Credit Kas/Bank
        // sumber_akun_id = Kas/Bank, target_akun_id = destination (Beban/Utang/Persediaan/Aset/Prive)
        if (!b.target_akun_id) return reply.code(400).send({ error: 'Akun tujuan pengeluaran wajib dipilih' });
        if (!desc) desc = 'Pengeluaran kas';
        break;
      case 'bayar_utang':
        targetAkunKode = '2.1.01'; // Utang Usaha
        if (!contactId) return reply.code(400).send({ error: 'Supplier wajib dipilih' });
        if (!desc) desc = 'Pembayaran utang';
        break;
      case 'terima_piutang':
        targetAkunKode = '1.1.03'; // Piutang Usaha
        if (!contactId) return reply.code(400).send({ error: 'Pelanggan wajib dipilih' });
        if (!desc) desc = 'Penerimaan piutang';
        break;
      case 'beli_persediaan':
        targetAkunKode = '1.1.05'; // Persediaan
        if (!inventoryItemId) return reply.code(400).send({ error: 'Barang wajib dipilih' });
        if (!qty || qty <= 0) return reply.code(400).send({ error: 'Jumlah barang wajib diisi' });
        if (!desc) desc = 'Pembelian persediaan';
        break;
      case 'jual_persediaan':
        targetAkunKode = '1.1.05'; // Persediaan
        if (!inventoryItemId) return reply.code(400).send({ error: 'Barang wajib dipilih' });
        if (!qty || qty <= 0) return reply.code(400).send({ error: 'Jumlah barang wajib diisi' });
        if (!desc) desc = 'Penjualan persediaan';
        break;
      default:
        return reply.code(400).send({ error: 'Tipe transaksi tidak valid' });
    }

    // Find target akun by kode prefix
    const targetRes = await pool.query(
      `SELECT id, kode, nama FROM chart_of_accounts 
       WHERE tenant_id=$1 AND kode LIKE $2 AND isactive=true AND ispostable=true
       ORDER BY kode LIMIT 1`,
      [a.tenantId, targetAkunKode + '%']
    );
    if (!targetRes.rowCount) {
      return reply.code(400).send({ error: `Akun ${targetAkunKode} tidak ditemukan atau tidak aktif` });
    }
    const targetAkun = targetRes.rows[0];

    // Validate sumber akun (Fix #14: strict validation)
    const sumberValidation = await validateQuickTxSource(sumberAkunId, a.tenantId!);
    if (!sumberValidation.ok) {
      return reply.code(400).send({ error: sumberValidation.error });
    }

    // Validate target akun for uang_masuk/uang_keluar (Fix #14)
    if ((tipe === 'uang_masuk' || tipe === 'uang_keluar') && b.target_akun_id) {
      const targetValidation = await validateQuickTxTarget(b.target_akun_id, a.tenantId!, tipe);
      if (!targetValidation.ok) {
        return reply.code(400).send({ error: targetValidation.error });
      }
    }

    await checkPeriodLock(a.tenantId!, tahun);
    await checkCutoffDate(a.tenantId!, tanggal);
    await ensurePeriod(a.tenantId!, tahun);

    // Fix #18: Build payload for idempotency hash
    const idemPayload = { tipe, tanggal, nominal, sumber_akun_id: sumberAkunId, keterangan, contact_id: contactId, inventory_item_id: inventoryItemId, qty, target_akun_id: b.target_akun_id };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Fix #18: Idempotency check INSIDE transaction (after advisory lock)
      let derivedKey: string | null = null;
      if (idempotency_key) {
        const idemResult = await processJournalIdempotency(client, {
          tenantId: a.tenantId!,
          endpoint: 'transaksi-quick',
          baseKey: idempotency_key,
          payload: idemPayload,
        });
        derivedKey = idemResult.derivedKey;

        if (idemResult.check.status === 'idempotent') {
          await client.query('COMMIT');
          return reply.code(200).send({
            success: true,
            idempotent: true,
            message: 'Transaksi sudah pernah dibuat.',
            entry: {
              id: idemResult.check.entryId,
              noJurnal: idemResult.check.noJurnal,
              tanggal: idemResult.check.tanggal,
              tipetransaksi: idemResult.check.tipetransaksi,
              lines: idemResult.check.lines,
            },
          });
        }

        if (idemResult.check.status === 'conflict') {
          await client.query('ROLLBACK');
          return reply.code(409).send({
            success: false,
            error: 'IDEMPOTENCY_KEY_CONFLICT',
            message: idemResult.check.message,
          });
        }
      }

      const no_jurnal = await nextJurnalNo(a.tenantId!, tahun, bulan);

      // Create journal entry (Fix #18: store derived key)
      const entryRes = await client.query(
        `INSERT INTO journal_entries
           (tenant_id, no_jurnal, tanggal, bulan, tahun, keterangan, tipeTransaksi, isPosted, created_by, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,'GENERAL',true,$7,$8)
         RETURNING id, no_jurnal AS "noJurnal"`,
        [a.tenantId, no_jurnal, tanggal, bulan, tahun, desc, a.userId, derivedKey]
      );
      const entryId = entryRes.rows[0].id;

      // Create journal lines based on transaction type
      // Debit/Kredit logic:
      // - bayar_utang: Debit Utang (kurangi hutang), Credit Kas/Bank (kurangi kas)
      // - terima_piutang: Debit Kas/Bank (tambah kas), Credit Piutang (kurangi piutang)
      // - beli_persediaan: Debit Persediaan (tambah stok), Credit Kas/Bank (kurangi kas)
      // - jual_persediaan: 4 lines (Kas←Pendapatan + HPP←Persediaan)

      let line1Debit = '0', line1Kredit = '0', line2Debit = '0', line2Kredit = '0';
      let line1AkunId = '', line2AkunId = '';
      let line1ContactId = null, line1InventoryItemId = null, line1Qty = null;
      let line2ContactId = null, line2InventoryItemId = null, line2Qty = null;

      const nominalStr = String(nominal);

      // For jual_persediaan: collect extra lines to insert after line1 & line2
      const extraLines: Array<{ akunId: string; debit: string; kredit: string; ket: string; invId: string | null; qty: string | null }> = [];

      switch (tipe) {
        case 'uang_masuk':
          // Debit Kas/Bank (uang masuk), Credit source account
          line1AkunId = sumberAkunId; line1Debit = nominalStr; line1Kredit = '0';
          line2AkunId = b.target_akun_id; line2Debit = '0'; line2Kredit = nominalStr;
          break;
        case 'uang_keluar':
          // Debit destination account, Credit Kas/Bank (uang keluar)
          line1AkunId = b.target_akun_id; line1Debit = nominalStr; line1Kredit = '0';
          line2AkunId = sumberAkunId; line2Debit = '0'; line2Kredit = nominalStr;
          break;
        case 'bayar_utang':
          // Debit Utang (kurangi hutang), Credit Kas/Bank
          line1AkunId = targetAkun.id; line1Debit = nominalStr; line1Kredit = '0';
          line1ContactId = contactId;
          line2AkunId = sumberAkunId; line2Debit = '0'; line2Kredit = nominalStr;
          break;
        case 'terima_piutang':
          // Debit Kas/Bank, Credit Piutang (kurangi piutang)
          line1AkunId = sumberAkunId; line1Debit = nominalStr; line1Kredit = '0';
          line2AkunId = targetAkun.id; line2Debit = '0'; line2Kredit = nominalStr;
          line2ContactId = contactId;
          break;
        case 'beli_persediaan':
          // Debit Persediaan (tambah stok), Credit Kas/Bank
          line1AkunId = targetAkun.id; line1Debit = nominalStr; line1Kredit = '0';
          line1InventoryItemId = inventoryItemId; line1Qty = String(qty);
          line2AkunId = sumberAkunId; line2Debit = '0'; line2Kredit = nominalStr;
          break;
        case 'jual_persediaan':
          // 4 lines: Kas(D) + Pendapatan(K) + HPP(D) + Persediaan(K)
          {
            // Find Pendapatan & HPP accounts dynamically
            const [pendAkun, hppAkun] = await Promise.all([
              findAccountByRole(a.tenantId!, 'PENDAPATAN_PENJUALAN'),
              findAccountByRole(a.tenantId!, 'HPP'),
            ]);
            if (!pendAkun) return reply.code(400).send({ error: 'Akun Pendapatan Penjualan tidak ditemukan. Aktifkan akun di Golongan 4.' });
            if (!hppAkun) return reply.code(400).send({ error: 'Akun HPP tidak ditemukan. Aktifkan akun di Golongan 5.' });

            // Calculate HPP (moving average) from inventory — FIX #12 (M6): integer cents
            let hppTotalStr = '0';
            if (inventoryItemId) {
              // FIX #12+Concurrency: Lock inventory_items master row FIRST
              const lockRes = await client.query(
                'SELECT id FROM inventory_items WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
                [inventoryItemId, a.tenantId]
              );
              if (!lockRes.rowCount) {
                await client.query('ROLLBACK');
                return reply.code(400).send({ error: 'Barang tidak ditemukan' });
              }

              // NOW safe to calculate stock — we hold the lock
              const stockRes = await client.query(
                `SELECT
                   COALESCE(SUM(CASE WHEN jl.debit > 0 THEN jl.qty ELSE 0 END), 0) -
                   COALESCE(SUM(CASE WHEN jl.kredit > 0 THEN jl.qty ELSE 0 END), 0) AS stok
                 FROM journal_lines jl
                 JOIN journal_entries je ON jl.entry_id = je.id AND je.isposted = true AND je.tenant_id = $2
                 WHERE jl.inventory_item_id = $1`,
                [inventoryItemId, a.tenantId]
              );
              const stokSekarang = Number(stockRes.rows[0].stok) || 0;
              if ((qty || 1) > stokSekarang) {
                await client.query('ROLLBACK');
                return reply.code(400).send({
                  error: `Stok tidak mencukupi. Stok tersedia: ${stokSekarang}, qty diminta: ${qty || 1}.`,
                });
              }

              // Fix #21: Calculate HPP from remaining inventory as of transaction date
              const avgResult = await getInventoryAverageCost(client, inventoryItemId, a.tenantId!, tanggal);
              const totalCostCents = avgResult.totalCostCents;
              const totalQty = avgResult.totalQty;

              if (totalQty <= 0 || totalCostCents <= 0) {
                await client.query('ROLLBACK');
                return reply.code(400).send({
                  error: `Stok/HPP tidak cukup untuk menghitung harga pokok persediaan. totalCostCents=${totalCostCents}, totalQty=${totalQty}. Periksa data persediaan masuk.`,
                });
              }

              if (totalQty > 0 && totalCostCents > 0) {
                const hppResult = calculateHppCents(totalCostCents / 100, totalQty, qty || 1);
                validateHppNotZero(hppResult.hppTotalCents, desc || 'item');
                hppTotalStr = hppResult.hppTotalStr;
              }
            }

            // Line 1: Kas (D) — harga jual
            line1AkunId = sumberAkunId; line1Debit = nominalStr; line1Kredit = '0';
            // Line 2: Pendapatan (K) — harga jual
            line2AkunId = pendAkun.id; line2Debit = '0'; line2Kredit = nominalStr;
            // Line 3: HPP (D) — harga modal
            extraLines.push({ akunId: hppAkun.id, debit: hppTotalStr, kredit: '0', ket: 'HPP ' + desc, invId: null, qty: null });
            // Line 4: Persediaan (K) — harga modal + qty
            extraLines.push({ akunId: targetAkun.id, debit: '0', kredit: hppTotalStr, ket: 'HPP ' + desc, invId: inventoryItemId || null, qty: qty ? String(qty) : null });
          }
          break;
      }

      // Insert line 1 (Debit side)
      await client.query(
        `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit, keterangan, contact_id, inventory_item_id, qty)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [entryId, line1AkunId, line1Debit, line1Kredit, desc, line1ContactId, line1InventoryItemId, line1Qty]
      );

      // Insert line 2 (Kredit side)
      await client.query(
        `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit, keterangan, contact_id, inventory_item_id, qty)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [entryId, line2AkunId, line2Debit, line2Kredit, desc, line2ContactId, line2InventoryItemId, line2Qty]
      );

      // Insert extra lines (for jual_persediaan: HPP + Persediaan)
      for (const line of extraLines) {
        await client.query(
          `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit, keterangan, inventory_item_id, qty)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [entryId, line.akunId, line.debit, line.kredit, line.ket, line.invId, line.qty]
        );
      }

      await client.query('COMMIT');

      return reply.code(201).send({
        success: true,
        message: 'Transaksi berhasil disimpan',
        entry: {
          id: entryId,
          noJurnal: entryRes.rows[0].noJurnal,
          tanggal,
          tipetransaksi: 'GENERAL',
          lines: [], // lines available via GET /jurnal-umum/:id
        },
      });
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ── Dynamic account finder (resolves account by semantic role, not hardcoded kode) ──
  type AccountRole = 'PENDAPATAN_PENJUALAN' | 'HPP' | 'PERSEDIAAN';

  async function findAccountByRole(tenantId: string, role: AccountRole): Promise<{ id: string; kode: string; nama: string } | null> {
    let query: string;
    switch (role) {
      case 'PENDAPATAN_PENJUALAN':
        // Find first active postable Level 4 under kelompok penjualan_barang_dagangan (4.2.x),
        // fallback to pendapatan_jasa (4.1.x), fallback to any pendapatan
        query = `SELECT id, kode, nama FROM chart_of_accounts
          WHERE tenant_id=$1 AND level=4 AND isactive=true AND ispostable=true
            AND (kelompok='penjualan_barang_dagangan' OR kelompok='pendapatan_jasa' OR jenisAkun='pendapatan')
          ORDER BY CASE kelompok
            WHEN 'penjualan_barang_dagangan' THEN 1
            WHEN 'pendapatan_jasa' THEN 2
            ELSE 3 END, kode LIMIT 1`;
        break;
      case 'HPP':
        // Find first active postable Level 4 under kelompok hpp_barang_dagangan (5.1.x),
        // fallback to hpp_barang_jadi, fallback to any hpp
        query = `SELECT id, kode, nama FROM chart_of_accounts
          WHERE tenant_id=$1 AND level=4 AND isactive=true AND ispostable=true
            AND (kelompok='hpp_barang_dagangan' OR kelompok='hpp_barang_jadi' OR jenisAkun='hpp')
          ORDER BY CASE kelompok
            WHEN 'hpp_barang_dagangan' THEN 1
            WHEN 'hpp_barang_jadi' THEN 2
            ELSE 3 END, kode LIMIT 1`;
        break;
      case 'PERSEDIAAN':
        // Find first active postable Level 4 under 1.1.05.x (Persediaan)
        query = `SELECT id, kode, nama FROM chart_of_accounts
          WHERE tenant_id=$1 AND level=4 AND isactive=true AND ispostable=true
            AND kode LIKE '1.1.05.%'
          ORDER BY kode LIMIT 1`;
        break;
    }
    const r = await pool.query(query, [tenantId]);
    return r.rowCount ? r.rows[0] : null;
  }

  // ─── MINI POS PENJUALAN ─────────────────────────────────────
  // GET /accounting/penjualan/stock-check — current stock for all inventory items
  app.get('/penjualan/stock-check', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const r = await pool.query(
      `SELECT ii.id, ii.nama, ii.kode, ii.satuan, ii.harga_satuan AS "hargaSatuan",
        COALESCE(SUM(CASE WHEN jl.debit > 0 THEN jl.qty ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN jl.kredit > 0 THEN jl.qty ELSE 0 END), 0) AS stok
       FROM inventory_items ii
       LEFT JOIN (
         SELECT jl.inventory_item_id, jl.debit, jl.kredit, jl.qty
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
           AND je.isposted = true
           AND je.tenant_id = $1
       ) jl ON jl.inventory_item_id = ii.id
       WHERE ii.tenant_id = $1
       GROUP BY ii.id, ii.nama, ii.kode, ii.satuan, ii.harga_satuan
       ORDER BY ii.kode`,
      [a.tenantId]
    );
    return { items: r.rows };
  });

  // POST /accounting/penjualan — Mini POS sales transaction
  // Fix #18 (R1): Idempotency via shared helper — advisory lock + payload hash + 24h window
  app.post('/penjualan', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const b = req.body as any;

    if (!b.items || !Array.isArray(b.items) || b.items.length === 0) {
      return reply.code(400).send({ error: 'items wajib diisi dan tidak boleh kosong' });
    }
    if (b.items.length > 50) {
      return reply.code(400).send({ error: 'Maksimal 50 item per transaksi' });
    }
    if (!b.kas_akun_id) {
      return reply.code(400).send({ error: 'kas_akun_id wajib dipilih' });
    }
    if (!b.tanggal) {
      return reply.code(400).send({ error: 'tanggal wajib diisi' });
    }

    // Fix #18: Validate idempotency_key format BEFORE transaction
    const idempotency_key = b.idempotency_key || null;
    if (idempotency_key) {
      const keyCheck = validateIdempotencyKey(idempotency_key);
      if (!keyCheck.valid) {
        return reply.code(400).send({ error: keyCheck.error });
      }
    }

    const tanggal = b.tanggal as string;
    const kasAkunId = b.kas_akun_id as string;
    const keterangan = b.keterangan || 'Penjualan POS';

    // Parse tanggal (strict YYYY-MM-DD validation)
    let parsedDate;
    try {
      parsedDate = parseYmdStrict(tanggal);
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
    const tahun = parsedDate.year;
    const bulan = parsedDate.month;

    // Validate kas akun
    const kasRes = await pool.query(
      'SELECT id, kode, nama FROM chart_of_accounts WHERE id=$1 AND tenant_id=$2',
      [kasAkunId, a.tenantId]
    );
    if (!kasRes.rowCount) {
      return reply.code(400).send({ error: 'Akun kas/bank tidak ditemukan' });
    }

    // Find required accounts dynamically (by semantic role, not hardcoded kode)
    const [pendapatanAkun, hppAkun, persediaanAkun] = await Promise.all([
      findAccountByRole(a.tenantId!, 'PENDAPATAN_PENJUALAN'),
      findAccountByRole(a.tenantId!, 'HPP'),
      findAccountByRole(a.tenantId!, 'PERSEDIAAN'),
    ]);

    if (!pendapatanAkun) return reply.code(400).send({ error: 'Akun Pendapatan Penjualan tidak ditemukan. Aktifkan akun di Golongan 4 (Pendapatan) melalui Pengaturan CoA.' });
    if (!hppAkun) return reply.code(400).send({ error: 'Akun HPP tidak ditemukan. Aktifkan akun di Golongan 5 (HPP) melalui Pengaturan CoA.' });
    if (!persediaanAkun) return reply.code(400).send({ error: 'Akun Persediaan (1.1.05.01) tidak ditemukan. Aktifkan akun melalui Pengaturan CoA.' });

    const pendapatanAkunId = pendapatanAkun.id;
    const hppAkunId = hppAkun.id;
    const persediaanAkunId = persediaanAkun.id;

    // Validate items basic fields (BEFORE transaction — fast, no race condition)
    for (const item of b.items) {
      if (!item.inventory_item_id || !item.qty || item.qty <= 0 || !item.harga_jual || item.harga_jual <= 0) {
        return reply.code(400).send({ error: 'Setiap item wajib memiliki inventory_item_id, qty > 0, dan harga_jual > 0' });
      }
      if (!Number.isInteger(item.qty) || !Number.isFinite(item.qty)) {
        return reply.code(400).send({ error: `qty harus bilangan bulat positif, diterima: ${item.qty}` });
      }
    }

    // Sort items by inventory_item_id for consistent lock ordering (prevent deadlocks)
    const sortedItems = [...b.items].sort((a: any, b: any) =>
      String(a.inventory_item_id).localeCompare(String(b.inventory_item_id))
    );

    await checkPeriodLock(a.tenantId!, tahun);
    await checkCutoffDate(a.tenantId!, tanggal);
    await ensurePeriod(a.tenantId!, tahun);

    // FIX #12+Concurrency: ALL stock checks + journal creation in ONE atomic transaction
    // Fix #18: Build payload for idempotency hash
    const idemPayload = { tanggal, kas_akun_id: kasAkunId, keterangan, items: sortedItems.map((i: any) => ({ inventory_item_id: i.inventory_item_id, qty: i.qty, harga_jual: i.harga_jual })) };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Fix #18: Idempotency check INSIDE transaction (after advisory lock)
      let derivedKey: string | null = null;
      if (idempotency_key) {
        const idemResult = await processJournalIdempotency(client, {
          tenantId: a.tenantId!,
          endpoint: 'penjualan',
          baseKey: idempotency_key,
          payload: idemPayload,
        });
        derivedKey = idemResult.derivedKey;

        if (idemResult.check.status === 'idempotent') {
          await client.query('COMMIT');
          return reply.code(200).send({
            success: true,
            idempotent: true,
            message: 'Penjualan sudah pernah dibuat.',
            entry: {
              id: idemResult.check.entryId,
              noJurnal: idemResult.check.noJurnal,
              tanggal: idemResult.check.tanggal,
              tipetransaksi: idemResult.check.tipetransaksi,
              lines: idemResult.check.lines,
            },
          });
        }

        if (idemResult.check.status === 'conflict') {
          await client.query('ROLLBACK');
          return reply.code(409).send({
            success: false,
            error: 'IDEMPOTENCY_KEY_CONFLICT',
            message: idemResult.check.message,
          });
        }
      }

      const no_jurnal = await nextJurnalNo(a.tenantId!, tahun, bulan);

      // Validate items, check stock WITH LOCK, calculate HPP — INSIDE transaction
      const itemDetails: Array<{
        inventory_item_id: string;
        nama: string;
        qty: number;
        harga_jual: number;
        hpp: number;
        hpp_total_cents: number;
        stok_sekarang: number;
        stok_sesudah: number;
      }> = [];

      let totalPenjualan = 0;
      let totalHppCents = 0;

      for (const item of sortedItems) {
        // FIX #12+Concurrency: Lock inventory_items master row FIRST
        // This serializes all sales for the same item across concurrent transactions.
        // SELECT FOR UPDATE on master row blocks until other transaction commits.
        const lockRes = await client.query(
          'SELECT id, nama FROM inventory_items WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
          [item.inventory_item_id, a.tenantId]
        );
        if (!lockRes.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(400).send({ error: `Barang dengan id ${item.inventory_item_id} tidak ditemukan` });
        }
        const itemName = lockRes.rows[0].nama;

        // NOW safe to calculate stock — we hold the lock on inventory_items
        const stockRes = await client.query(
          `SELECT
             COALESCE(SUM(CASE WHEN jl.debit > 0 THEN jl.qty ELSE 0 END), 0) -
             COALESCE(SUM(CASE WHEN jl.kredit > 0 THEN jl.qty ELSE 0 END), 0) AS stok
           FROM journal_lines jl
           JOIN journal_entries je ON jl.entry_id = je.id AND je.isposted = true AND je.tenant_id = $2
           WHERE jl.inventory_item_id = $1`,
          [item.inventory_item_id, a.tenantId]
        );
        const stokSekarang = Number(stockRes.rows[0].stok) || 0;
        const stokSesudah = stokSekarang - item.qty;

        // Block overselling
        if (stokSesudah < 0) {
          await client.query('ROLLBACK');
          return reply.code(400).send({
            error: `Stok tidak mencukupi untuk "${itemName}". Stok tersedia: ${stokSekarang}, qty diminta: ${item.qty}.`,
          });
        }

        // Calculate HPP using integer cents helper
        let hpp = 0;
        let hppTotalCents = 0;
        // Fix #21: Calculate HPP from remaining inventory as of transaction date
        const avgResult = await getInventoryAverageCost(client, item.inventory_item_id, a.tenantId!, tanggal);
        const totalCostCents = avgResult.totalCostCents;
        const totalQty = avgResult.totalQty;

        if (totalQty > 0 && totalCostCents > 0) {
          const hppResult = calculateHppCents(totalCostCents / 100, totalQty, item.qty);
          hpp = hppResult.hppPerUnitCents / 100;
          hppTotalCents = hppResult.hppTotalCents;
          validateHppNotZero(hppTotalCents, itemName);
        } else if (totalQty <= 0 || totalCostCents <= 0) {
          await client.query('ROLLBACK');
          return reply.code(400).send({
            error: `Stok/HPP tidak cukup untuk "${itemName}": totalCostCents=${totalCostCents}, totalQty=${totalQty}. Periksa data persediaan masuk.`,
          });
        }

        itemDetails.push({
          inventory_item_id: item.inventory_item_id,
          nama: itemName,
          qty: item.qty,
          harga_jual: item.harga_jual,
          hpp,
          hpp_total_cents: hppTotalCents,
          stok_sekarang: stokSekarang,
          stok_sesudah: stokSesudah,
        });

        totalPenjualan += item.qty * item.harga_jual;
        totalHppCents += hppTotalCents;
      }

      const totalHpp = totalHppCents / 100;
      const labaKotor = totalPenjualan - totalHpp;

      // Create journal entry (Fix #18: store derived key)
      const entryRes = await client.query(
        `INSERT INTO journal_entries
           (tenant_id, no_jurnal, tanggal, bulan, tahun, keterangan, tipeTransaksi, isPosted, created_by, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,'SALES',true,$7,$8)
         RETURNING id, no_jurnal AS "noJurnal"`,
        [a.tenantId, no_jurnal, tanggal, bulan, tahun, keterangan, a.userId, derivedKey]
      );
      const entryId = entryRes.rows[0].id;

      // Insert journal lines per item
      for (const detail of itemDetails) {
        const itemTotal = detail.qty * detail.harga_jual;
        // FIX #12: Use hppTotalCents from calculation (not qty * hpp rounded)
        const itemHppCents = detail.hpp_total_cents ?? Math.round(detail.qty * detail.hpp * 100);
        const itemHppStr = (itemHppCents / 100).toFixed(2);

        // Line 1: Debit Kas (aggregated per item selling price)
        await client.query(
          `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit, keterangan, inventory_item_id, qty)
           VALUES ($1,$2,$3,'0',$4,NULL,NULL)`,
          [entryId, kasAkunId, String(itemTotal), `Penjualan ${detail.nama}`]
        );

        // Line 2: Kredit Pendapatan
        await client.query(
          `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit, keterangan, inventory_item_id, qty)
           VALUES ($1,$2,'0',$3,$4,NULL,NULL)`,
          [entryId, pendapatanAkunId, String(itemTotal), `Penjualan ${detail.nama}`]
        );

        // Line 3: Debit HPP
        await client.query(
          `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit, keterangan, inventory_item_id, qty)
           VALUES ($1,$2,$3,'0',$4,NULL,NULL)`,
          [entryId, hppAkunId, itemHppStr, `HPP ${detail.nama}`]
        );

        // Line 4: Kredit Persediaan (with inventory_item_id and qty)
        await client.query(
          `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit, keterangan, inventory_item_id, qty)
           VALUES ($1,$2,'0',$3,$4,$5,$6)`,
          [entryId, persediaanAkunId, itemHppStr, `HPP ${detail.nama}`, detail.inventory_item_id, String(detail.qty)]
        );
      }

      await client.query('COMMIT');

      return reply.code(201).send({
        success: true,
        entry: {
          id: entryId,
          noJurnal: entryRes.rows[0].noJurnal,
          tanggal,
          tipetransaksi: 'SALES',
        },
        items: itemDetails.map(d => ({
          nama: d.nama,
          qty: d.qty,
          harga_jual: d.harga_jual,
          hpp: d.hpp,
          stok_sesudah: d.stok_sesudah,
        })),
        total_penjualan: totalPenjualan,
        total_hpp: totalHpp,
        laba_kotor: labaKotor,
      });
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ── Guided Auto-Fix: Detect sales journals without HPP ──
  app.get('/fix-missing-hpp/scan', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const tid = a.tenantId;

    // Find journal entries that have Pendapatan Penjualan (Gol 4.2) but NO HPP (Gol 5) lines
    const broken = await pool.query(
      `SELECT je.id, je.no_jurnal, je.tanggal, je.keterangan,
              SUM(CASE WHEN c_pend.kode LIKE '4.%' THEN jl_pend.kredit ELSE 0 END) AS total_penjualan,
              SUM(CASE WHEN c_pend.kode LIKE '4.%' THEN jl_pend.debit ELSE 0 END) AS total_return
       FROM journal_entries je
       JOIN journal_lines jl_pend ON jl_pend.entry_id = je.id
       JOIN chart_of_accounts c_pend ON c_pend.id = jl_pend.akun_id
       WHERE je.tenant_id = $1
         AND je.isposted = true
         AND c_pend.kode LIKE '4.2%'
         AND NOT EXISTS (
           SELECT 1 FROM journal_lines jl_hpp
           JOIN chart_of_accounts c_hpp ON c_hpp.id = jl_hpp.akun_id
           WHERE jl_hpp.entry_id = je.id AND c_hpp.kode LIKE '5.%'
         )
       GROUP BY je.id, je.no_jurnal, je.tanggal, je.keterangan
       ORDER BY je.tanggal ASC, je.created_at ASC`,
      [tid]
    );

    if (!broken.rowCount) {
      return { issues: [], message: 'Semua transaksi penjualan sudah memiliki HPP ✅' };
    }

    const issues = broken.rows.map((r: any) => ({
      entry_id: r.id,
      no_jurnal: r.no_jurnal,
      tanggal: r.tanggal,
      keterangan: r.keterangan,
      total_penjualan: Number(r.total_penjualan) - Number(r.total_return),
    }));

    return {
      issues,
      message: `Ditemukan ${issues.length} transaksi penjualan tanpa catatan HPP`,
    };
  });

  // ── Guided Auto-Fix: Execute HPP correction (2-phase: pre-validate → atomic insert) ──
  app.post('/fix-missing-hpp/execute', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const tid = a.tenantId!;
    const { entry_ids } = req.body as any;

    // ── Input validation ──
    if (!entry_ids || !Array.isArray(entry_ids) || entry_ids.length === 0) {
      return reply.code(400).send({ error: 'entry_ids wajib diisi (array tidak boleh kosong)' });
    }
    if (entry_ids.length > 50) {
      return reply.code(400).send({ error: `Maksimal 50 entry per request. Anda mengirim ${entry_ids.length}.` });
    }

    // UUID validation per entry
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const eid of entry_ids) {
      if (typeof eid !== 'string' || !uuidRegex.test(eid)) {
        return reply.code(400).send({ error: `entry_id tidak valid: "${eid}"` });
      }
    }

    // Deduplicate entry_ids
    const uniqueIds = [...new Set(entry_ids)];

    // Fix #21: Sort entries chronologically before processing (tanggal ASC, created_at ASC)
    // This ensures older sales get HPP calculated first, making inventory state correct for later entries
    const sortRes = await pool.query(
      `SELECT id FROM journal_entries
       WHERE id = ANY($1::uuid[]) AND tenant_id = $2
       ORDER BY tanggal ASC, created_at ASC`,
      [uniqueIds, tid]
    );
    const sortedIds = sortRes.rows.map((r: any) => r.id);
    // Append any IDs not found in DB (will be caught as FAILED in validation loop)
    const sortedAllIds = [...sortedIds, ...uniqueIds.filter((id: string) => !sortedIds.includes(id))];

    // Find required accounts (outside transaction — read-only)
    const [hppAkun, persediaanAkun] = await Promise.all([
      findAccountByRole(tid!, 'HPP'),
      findAccountByRole(tid!, 'PERSEDIAAN'),
    ]);
    if (!hppAkun) return reply.code(400).send({ error: 'Akun HPP tidak ditemukan. Silakan buat akun HPP terlebih dahulu.' });
    if (!persediaanAkun) return reply.code(400).send({ error: 'Akun Persediaan tidak ditemukan. Silakan buat akun Persediaan terlebih dahulu.' });

    // ══════════════════════════════════════════════════════════════
    // FASE 1: PRE-VALIDASI (tanpa transaksi, read-only queries)
    // ══════════════════════════════════════════════════════════════
    type PreValidatedEntry = {
      entryId: string;
      orig: any;
      hppDetails: Array<{ debitCents: number; kreditCents: number; inventory_item_id: string | null; qty: number }>;
      totalHppCents: number;
    };

    const fixable: PreValidatedEntry[] = [];
    const results: Array<{ entry_id: string; no_jurnal: string; status: string; message: string }> = [];

    for (const entryId of sortedAllIds) {
      // 1. Validate entry exists, belongs to tenant, is posted
      const origRes = await pool.query(
        `SELECT je.id, je.no_jurnal, je.tanggal, je.bulan, je.tahun, je.keterangan
         FROM journal_entries je
         WHERE je.id=$1 AND je.tenant_id=$2 AND je.isposted=true`,
        [entryId, tid]
      );
      if (!origRes.rowCount) {
        results.push({ entry_id: entryId, no_jurnal: '-', status: 'FAILED', message: 'Entry tidak ditemukan atau bukan milik tenant aktif' });
        continue;
      }
      const orig = origRes.rows[0];

      // 2. Check if already has HPP lines
      const hasHpp = await pool.query(
        `SELECT 1 FROM journal_lines jl
         JOIN chart_of_accounts c ON c.id = jl.akun_id
         WHERE jl.entry_id=$1 AND c.kode LIKE '5.%'`,
        [entryId]
      );
      if (hasHpp.rowCount) {
        results.push({ entry_id: entryId, no_jurnal: orig.no_jurnal, status: 'SKIP', message: 'Sudah punya HPP — tidak perlu koreksi' });
        continue;
      }

      // 3. Duplicate correction check via referensi
      const dupCheck = await pool.query(
        `SELECT id FROM journal_entries
         WHERE tenant_id=$1 AND referensi=$2 AND tipeTransaksi='KOREKSI_HPP'
         LIMIT 1`,
        [tid, `KOREKSI_HPP:${entryId}`]
      );
      if (dupCheck.rowCount) {
        results.push({ entry_id: entryId, no_jurnal: orig.no_jurnal, status: 'SKIP', message: 'Koreksi HPP sudah pernah dibuat sebelumnya (duplikat dicegah)' });
        continue;
      }

      // 4. Get revenue lines with inventory_item_id
      const revenueLines = await pool.query(
        `SELECT jl.id, jl.kredit, jl.debit, jl.inventory_item_id, jl.qty, c.kode
         FROM journal_lines jl
         JOIN chart_of_accounts c ON c.id = jl.akun_id
         WHERE jl.entry_id=$1 AND c.kode LIKE '4.2%'`,
        [entryId]
      );

      if (!revenueLines.rowCount) {
        results.push({ entry_id: entryId, no_jurnal: orig.no_jurnal, status: 'FAILED', message: 'Tidak ditemukan baris pendapatan penjualan (4.2.x)' });
        continue;
      }

      // 5. Calculate HPP per item (NO estimate — must have valid inventory data)
      let totalHppCents = 0;
      const hppDetails: Array<{ debitCents: number; kreditCents: number; inventory_item_id: string | null; qty: number }> = [];
      let hasValidHpp = false;
      let needsManualReview = false;
      const manualReviewReasons: string[] = [];

      for (const rl of revenueLines.rows) {
        const netRevenueCents = Math.round((Number(rl.kredit) - Number(rl.debit)) * 100);
        if (netRevenueCents <= 0) continue;

        if (!rl.inventory_item_id) {
          needsManualReview = true;
          manualReviewReasons.push(`Baris ${rl.id}: item persediaan tidak terhubung ke inventory`);
          continue;
        }

        // Fix #21: Calculate HPP from remaining inventory as of entry's tanggal (not today)
        const entryTanggal = orig.tanggal instanceof Date
          ? orig.tanggal.toISOString().slice(0, 10)
          : String(orig.tanggal);
        const avgResult = await getInventoryAverageCost(pool, rl.inventory_item_id, tid, entryTanggal);
        const totalCostCents = avgResult.totalCostCents;
        const totalQty = avgResult.totalQty;

        if (totalQty <= 0 || totalCostCents <= 0) {
          needsManualReview = true;
          manualReviewReasons.push(`Baris ${rl.id}: tidak ada data persediaan masuk untuk menghitung HPP (s/d ${entryTanggal})`);
          continue;
        }

        // FIX #12: Use shared helper for consistent integer cents calculation
        const qtyToReduce = Number(rl.qty) || 1;
        let hppTotalCents = 0;
        try {
          const hppResult = calculateHppCents(totalCostCents / 100, totalQty, Math.round(qtyToReduce));
          hppTotalCents = hppResult.hppTotalCents;
          validateHppNotZero(hppTotalCents, `baris ${rl.id}`);
        } catch (e: any) {
          needsManualReview = true;
          manualReviewReasons.push(`Baris ${rl.id}: ${e.message}`);
          continue;
        }

        totalHppCents += hppTotalCents;
        hppDetails.push({
          debitCents: hppTotalCents,
          kreditCents: hppTotalCents,
          inventory_item_id: rl.inventory_item_id,
          qty: qtyToReduce,
        });
        hasValidHpp = true;
      }

      // If no valid HPP could be calculated → FAILED/NEED_MANUAL_REVIEW
      if (!hasValidHpp || totalHppCents <= 0) {
        results.push({
          entry_id: entryId,
          no_jurnal: orig.no_jurnal,
          status: needsManualReview ? 'NEED_MANUAL_REVIEW' : 'FAILED',
          message: needsManualReview
            ? `HPP tidak bisa dihitung otomatis: ${manualReviewReasons.join('; ')}`
            : 'Tidak ada HPP yang perlu dikoreksi',
        });
        continue;
      }

      // Entry valid → masuk daftar fixable
      fixable.push({ entryId, orig, hppDetails, totalHppCents });
    }

    // ══════════════════════════════════════════════════════════════
    // FASE 2: KEPUTUSAN — tolak semua jika ada FAILED/NEED_MANUAL_REVIEW
    // ══════════════════════════════════════════════════════════════
    const hasBlockers = results.some(r => r.status === 'FAILED' || r.status === 'NEED_MANUAL_REVIEW');

    if (hasBlockers) {
      // Return 400 — TIDAK ADA perubahan data, semua ditolak
      const failed = results.filter(r => r.status === 'FAILED' || r.status === 'NEED_MANUAL_REVIEW');
      return reply.code(400).send({
        success: false,
        blocked: true,
        message: `Koreksi HPP dibatalkan. ${failed.length} entry bermasalah — perbaiki dulu sebelum koreksi otomatis.`,
        summary: {
          fixable: fixable.length,
          skipped: results.filter(r => r.status === 'SKIP').length,
          blocked: failed.length,
        },
        results,
      });
    }

    // Jika tidak ada entry yang perlu dikoreksi (semua SKIP)
    if (fixable.length === 0) {
      return {
        success: true,
        summary: { fixed: 0, skipped: results.filter(r => r.status === 'SKIP').length, blocked: 0 },
        results,
        message: 'Semua entry sudah dikoreksi sebelumnya (SKIP). Tidak ada perubahan baru.',
      };
    }

    // ══════════════════════════════════════════════════════════════
    // FASE 3: TRANSAKSI — hanya entry yang sudah tervalidasi
    // ══════════════════════════════════════════════════════════════
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const entry of fixable) {
        const { entryId, orig, hppDetails, totalHppCents } = entry;

        // Create correction journal
        const now = new Date();
        const corrTanggal = now.toISOString().slice(0, 10);
        const corrBulan = now.getMonth() + 1;
        const corrTahun = now.getFullYear();
        const corrNoJurnal = await nextJurnalNo(tid!, corrTahun, corrBulan, undefined, client);
        const referensi = `KOREKSI_HPP:${entryId}`;

        const corrEntry = await client.query(
          `INSERT INTO journal_entries
             (tenant_id, no_jurnal, tanggal, bulan, tahun, keterangan, tipeTransaksi, isPosted, created_by, referensi)
           VALUES ($1,$2,$3,$4,$5,$6,'KOREKSI_HPP',true,$7,$8)
           RETURNING id`,
          [tid, corrNoJurnal, corrTanggal, corrBulan, corrTahun,
           `Koreksi HPP otomatis — referensi ${orig.no_jurnal} (${orig.keterangan})`, a.userId, referensi]
        );
        const corrEntryId = corrEntry.rows[0].id;

        // Insert debit HPP + credit Persediaan for each detail
        for (const detail of hppDetails) {
          const debitStr = (detail.debitCents / 100).toFixed(2);
          const kreditStr = (detail.kreditCents / 100).toFixed(2);

          // Debit HPP
          await client.query(
            `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit, keterangan, inventory_item_id, qty)
             VALUES ($1,$2,$3,'0.00',$4,NULL,NULL)`,
            [corrEntryId, hppAkun.id, debitStr, `Koreksi HPP — referensi ${orig.no_jurnal}`]
          );

          // Kredit Persediaan
          await client.query(
            `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit, keterangan, inventory_item_id, qty)
             VALUES ($1,$2,'0.00',$3,$4,$5,$6)`,
            [corrEntryId, persediaanAkun.id, kreditStr,
             `Koreksi HPP — referensi ${orig.no_jurnal}`,
             detail.inventory_item_id || null, String(detail.qty)]
          );
        }

        // Balance validation (integer cents)
        const balanceCheck = await client.query(
          `SELECT COALESCE(SUM(debit), 0) AS total_debit, COALESCE(SUM(kredit), 0) AS total_kredit
           FROM journal_lines WHERE entry_id=$1`,
          [corrEntryId]
        );
        const debitCents = Math.round(Number(balanceCheck.rows[0].total_debit) * 100);
        const kreditCents = Math.round(Number(balanceCheck.rows[0].total_kredit) * 100);
        if (debitCents !== kreditCents) {
          throw new Error(`Jurnal koreksi tidak balance! Debit ${(debitCents/100).toFixed(2)} ≠ Kredit ${(kreditCents/100).toFixed(2)}`);
        }

        results.push({
          entry_id: entryId,
          no_jurnal: orig.no_jurnal,
          status: 'FIXED',
          message: `HPP Rp ${(totalHppCents/100).toLocaleString('id-ID')} → Jurnal ${corrNoJurnal}`,
        });
      }

      // COMMIT — semua atau tidak sama sekali
      await client.query('COMMIT');
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({
        error: 'Koreksi HPP dibatalkan (rollback). Tidak ada perubahan yang tersimpan.',
        detail: e.message,
      });
    } finally {
      client.release();
    }

    // ── Summary response ──
    const fixed = results.filter(r => r.status === 'FIXED');
    const skipped = results.filter(r => r.status === 'SKIP');

    return {
      success: true,
      summary: {
        fixed: fixed.length,
        skipped: skipped.length,
        blocked: 0,
      },
      results,
      message: `Koreksi selesai: ${fixed.length} diperbaiki, ${skipped.length} dilewati`,
    };
  });
}
