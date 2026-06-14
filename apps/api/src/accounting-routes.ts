import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { pool } from './db.js';
import { requireTenant, requireActiveTrial, type AuthPayload } from './guards.js';
import { seedDefaultCoa } from './coa-seed.js';
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
  async function nextJurnalNo(tenantId: string, tahun: number, bulan: number): Promise<string> {
    const prefix = `JU-${tahun}-${String(bulan).padStart(2, '0')}-`;
    const r = await pool.query(
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

    const [tahunStr, bulanStr, _day] = (tanggal as string).split('-');
    const tahun = parseInt(tahunStr, 10);
    const bulan = parseInt(bulanStr, 10);
    if (isNaN(tahun) || isNaN(bulan) || tahun < 2000 || tahun > 2100 || bulan < 1 || bulan > 12) {
      return reply.status(400).send({ error: 'Format tanggal tidak valid (YYYY-MM-DD)' });
    }

    await checkPeriodLock(a.tenantId!, tahun);

    // Validate each line
    const akunIds = lines.map((l: any) => l.akun_id);
    for (const l of lines) {
      const debit = parseFloat(l.debit || '0');
      const kredit = parseFloat(l.kredit || '0');
      if (isNaN(debit) || isNaN(kredit)) return reply.status(400).send({ error: 'Debit/kredit harus angka' });
      if (debit < 0 || kredit < 0) return reply.status(400).send({ error: 'Debit/kredit tidak boleh negatif' });
      if (debit === 0 && kredit === 0) return reply.status(400).send({ error: 'Setiap baris harus memiliki debit atau kredit' });
      if (debit > 0 && kredit > 0) return reply.status(400).send({ error: 'Satu baris hanya boleh debit ATAU kredit, tidak keduanya' });
    }

    // Validate debit = credit (zero tolerance — satu perak pun ditolak)
    const totalDebit = lines.reduce((s: number, l: any) => s + Math.round(parseFloat(l.debit || '0') * 100), 0) / 100;
    const totalKredit = lines.reduce((s: number, l: any) => s + Math.round(parseFloat(l.kredit || '0') * 100), 0) / 100;
    if (totalDebit !== totalKredit) {
      return reply.status(400).send({ error: `Total debit (${totalDebit.toLocaleString('id-ID')}) tidak sama dengan total kredit (${totalKredit.toLocaleString('id-ID')})` });
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

    // Idempotency check — prevent double submit
    if (idempotency_key) {
      const dup = await pool.query(
        `SELECT id, no_jurnal AS "noJurnal", tanggal, keterangan FROM journal_entries
         WHERE tenant_id=$1 AND idempotency_key=$2 AND created_at > NOW() - INTERVAL '10 minutes'
         LIMIT 1`,
        [a.tenantId, idempotency_key]
      );
      if (dup.rowCount) {
        const existingLines = await pool.query(
          `SELECT * FROM journal_lines WHERE entry_id=$1 ORDER BY created_at`, [dup.rows[0].id]
        );
        return { idempotent: true, jurnal: { ...dup.rows[0], lines: existingLines.rows } };
      }
    }

    // Generate no_jurnal and ensure period
    const no_jurnal = await nextJurnalNo(a.tenantId!, tahun, bulan);
    await ensurePeriod(a.tenantId!, tahun);
    await checkPeriodLock(a.tenantId!, tahun);

    // Transaction: insert entry + lines
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const entryRes = await client.query(
        `INSERT INTO journal_entries
           (tenant_id, no_jurnal, tanggal, bulan, tahun, keterangan, referensi, tipeTransaksi, isPosted, created_by, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10)
         RETURNING id`,
        [a.tenantId, no_jurnal, tanggal, bulan, tahun, keterangan || null, referensi || null, journalType, a.userId, idempotency_key || null]
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
      const entry = await pool.query(
        `SELECT * FROM journal_entries WHERE id=$1`, [entryId]
      );
      const entryLines = await pool.query(
        `SELECT * FROM journal_lines WHERE entry_id=$1 ORDER BY created_at`, [entryId]
      );

      return { jurnal: { ...entry.rows[0], lines: entryLines.rows } };
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

    // Sanitize: remove ghost rows
    const cleanRows = rows.filter((r: any) =>
      r.akun_id && (parseFloat(r.debit || '0') > 0 || parseFloat(r.kredit || '0') > 0)
    );
    if (cleanRows.length < 2) {
      return reply.status(400).send({ error: 'Minimal 2 baris dengan akun dan nominal' });
    }

    // Validate each row
    for (const r of cleanRows) {
      const debit = parseFloat(r.debit || '0');
      const kredit = parseFloat(r.kredit || '0');
      if (isNaN(debit) || isNaN(kredit)) return reply.status(400).send({ error: 'Debit/kredit harus angka' });
      if (debit < 0 || kredit < 0) return reply.status(400).send({ error: 'Debit/kredit tidak boleh negatif' });
      if (debit > 0 && kredit > 0) return reply.status(400).send({ error: 'Satu baris hanya boleh debit ATAU kredit' });
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

    // Validate each group has balanced debit/kredit
    for (const [key, groupRows] of groups) {
      const gDebit = groupRows.reduce((s: number, r: any) => s + parseFloat(r.debit || '0'), 0);
      const gKredit = groupRows.reduce((s: number, r: any) => s + parseFloat(r.kredit || '0'), 0);
      const gDebitRounded = Math.round(gDebit * 100) / 100;
      const gKreditRounded = Math.round(gKredit * 100) / 100;
      if (gDebitRounded !== gKreditRounded) {
        const tanggal = groupRows[0]?.tanggal || '?';
        const noBukti = groupRows[0]?.no_bukti || '(tanpa bukti)';
        return reply.status(400).send({
          error: `Jurnal "${noBukti}" tanggal ${tanggal} tidak balance. Debit: ${gDebitRounded.toLocaleString('id-ID')}, Kredit: ${gKreditRounded.toLocaleString('id-ID')}`,
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
      if (!yearBulanSet.has(yb)) {
        await ensurePeriod(a.tenantId!, tahun);
        yearBulanSet.add(yb);
      }
    }

    // Idempotency check — prevent double submit
    if (idempotency_key) {
      const dup = await pool.query(
        `SELECT id, no_jurnal AS "noJurnal", tanggal, keterangan FROM journal_entries
         WHERE tenant_id=$1 AND idempotency_key=$2 AND created_at > NOW() - INTERVAL '10 minutes'
         LIMIT 1`,
        [a.tenantId, idempotency_key]
      );
      if (dup.rowCount) {
        const existingLines = await pool.query(
          `SELECT * FROM journal_lines WHERE entry_id=$1 ORDER BY created_at`, [dup.rows[0].id]
        );
        return { idempotent: true, jurnal: { ...dup.rows[0], lines: existingLines.rows } };
      }
    }

    // Transaction: create one journal entry per group
    const client = await pool.connect();
    const createdEntries: any[] = [];
    try {
      await client.query('BEGIN');

      let isFirstGroup = true;
      for (const [key, groupRows] of groups) {
        const tanggal = groupRows[0].tanggal;
        const [tahunStr, bulanStr] = tanggal.split('-');
        const tahun = parseInt(tahunStr, 10);
        const bulan = parseInt(bulanStr, 10);

        // Derive keterangan: first non-empty from rows in this group
        const keterangan = groupRows.map((r: any) => (r.keterangan || '').trim()).find(Boolean) || 'Tanpa keterangan';
        const noBukti = (groupRows[0].no_bukti || '').trim() || null;

        const no_jurnal = await nextJurnalNo(a.tenantId!, tahun, bulan);

        const entryRes = await client.query(
          `INSERT INTO journal_entries
             (tenant_id, no_jurnal, tanggal, bulan, tahun, keterangan, referensi, tipeTransaksi, isPosted, created_by, idempotency_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'GENERAL',true,$8,$9)
           RETURNING id, no_jurnal AS "noJurnal"`,
          [a.tenantId, no_jurnal, tanggal, bulan, tahun, keterangan, noBukti, a.userId, isFirstGroup ? (idempotency_key || null) : null]
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
        isFirstGroup = false;
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
    const tahun = q.tahun ? parseInt(q.tahun, 10) : null;
    const bulan = q.bulan ? parseInt(q.bulan, 10) : null;
    const limit = Math.min(parseInt(q.limit, 10) || 50, 200);
    const offset = parseInt(q.offset, 10) || 0;

    const conditions: string[] = ['je.tenant_id=$1', "je.tipetransaksi <> 'OPENING_BALANCE'"];
    const params: any[] = [a.tenantId];
    let paramIdx = 2;

    if (tahun && !isNaN(tahun)) {
      conditions.push(`je.tahun=$${paramIdx++}`);
      params.push(tahun);
    }
    if (bulan && !isNaN(bulan)) {
      conditions.push(`je.bulan=$${paramIdx++}`);
      params.push(bulan);
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
      `SELECT l.id, l.akun_id AS "akunId", l.debit, l.kredit, l.keterangan, l.unit_usaha AS "unitUsaha"
       FROM journal_lines l WHERE l.entry_id=$1 ORDER BY l.created_at`,
      [id]
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

    // 5. Validasi per baris — XOR (hanya satu sisi), non-negatif, angka
    const akunIds = lines.map((l: any) => l.akun_id);
    for (const l of lines) {
      const debit = parseFloat(l.debit || '0');
      const kredit = parseFloat(l.kredit || '0');
      if (isNaN(debit) || isNaN(kredit)) return reply.status(400).send({ error: 'Debit/kredit harus angka' });
      if (debit < 0 || kredit < 0) return reply.status(400).send({ error: 'Debit/kredit tidak boleh negatif' });
      if (debit === 0 && kredit === 0) return reply.status(400).send({ error: 'Setiap baris harus memiliki debit atau kredit' });
      if (debit > 0 && kredit > 0) return reply.status(400).send({ error: 'Satu baris hanya boleh debit ATAU kredit, tidak keduanya' });
    }

    // 6. Validasi Math.round debit = kredit
    const totalDebit = lines.reduce((s: number, l: any) => s + parseFloat(l.debit || '0'), 0);
    const totalKredit = lines.reduce((s: number, l: any) => s + parseFloat(l.kredit || '0'), 0);
    if (Math.abs(totalDebit - totalKredit) > 0.01) {
      return reply.status(400).send({ error: `Total debit (${totalDebit}) tidak sama dengan total kredit (${totalKredit})` });
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
          `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit, keterangan)
           VALUES ($1,$2,$3,$4,$5)`,
          [id, l.akun_id, String(l.debit || '0'), String(l.kredit || '0'), l.keterangan || null]
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
  app.post('/saldo-awal', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const body = req.body as any;
    if (!body) return reply.status(400).send({ error: 'Body request kosong' });

    // Check if saldo awal is posted (locked)
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

    const [tahunStr, bulanStr] = (tanggal as string).split('-');
    const tahun = parseInt(tahunStr, 10);
    const bulan = parseInt(bulanStr, 10);
    if (isNaN(tahun) || isNaN(bulan) || tahun < 2000 || tahun > 2100 || bulan < 1 || bulan > 12) {
      return reply.status(400).send({ error: 'Format tanggal tidak valid (YYYY-MM-DD)' });
    }

    // Block duplicate — opening balance only once per tenant
    const existing = await pool.query(
      `SELECT id FROM journal_entries WHERE tenant_id=$1 AND tipetransaksi='OPENING_BALANCE' LIMIT 1`,
      [a.tenantId]
    );
    if (existing.rowCount) {
      return reply.status(400).send({ error: 'Saldo awal sudah pernah disimpan. Gunakan reset untuk mengubah.', code: 'ALREADY_SETUP' });
    }

    // Keep only rows with a non-zero value; validate cents-safe + single side
    const cleanLines: { akun_id: string; debit: number; kredit: number }[] = [];
    for (const l of lines) {
      const debit = Math.round((parseFloat(l.debit || '0') || 0) * 100) / 100;
      const kredit = Math.round((parseFloat(l.kredit || '0') || 0) * 100) / 100;
      if (isNaN(debit) || isNaN(kredit)) return reply.status(400).send({ error: 'Debit/kredit harus angka' });
      if (debit < 0 || kredit < 0) return reply.status(400).send({ error: 'Debit/kredit tidak boleh negatif' });
      if (debit === 0 && kredit === 0) continue; // skip empty rows
      if (debit > 0 && kredit > 0) return reply.status(400).send({ error: 'Setiap akun hanya boleh diisi salah satu: debit atau kredit' });
      cleanLines.push({ akun_id: l.akun_id, debit, kredit });
    }

    if (cleanLines.length === 0) {
      return reply.status(400).send({ error: 'Isi minimal satu akun dengan nilai debit atau kredit' });
    }

    // Balance check (cents-safe)
    const totalDebitCents = cleanLines.reduce((s, l) => s + Math.round(l.debit * 100), 0);
    const totalKreditCents = cleanLines.reduce((s, l) => s + Math.round(l.kredit * 100), 0);
    if (totalDebitCents !== totalKreditCents) {
      const selisih = (totalDebitCents - totalKreditCents) / 100;
      return reply.status(400).send({ error: `Jurnal tidak balance. Selisih: ${selisih}`, code: 'NOT_BALANCED', selisih });
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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const entryRes = await client.query(
        `INSERT INTO journal_entries (tenant_id, no_jurnal, tanggal, bulan, tahun, keterangan, tipetransaksi, isposted, islocked, created_by)
         VALUES ($1,'OB-001',$2,$3,$4,$5,'OPENING_BALANCE',true,true,$6)
         RETURNING id, no_jurnal AS "noJurnal", tanggal`,
        [a.tenantId, tanggal, bulan, tahun, 'Setup Saldo Awal', a.userId]
      );
      const entryId = (entryRes.rows[0] as any).id;
      for (const l of cleanLines) {
        await client.query(
          `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit, keterangan)
           VALUES ($1,$2,$3,$4,'Saldo Awal')`,
          [entryId, l.akun_id, l.debit, l.kredit]
        );
      }
      await client.query('COMMIT');
      return reply.status(201).send({
        message: 'Saldo awal berhasil disimpan',
        entryId,
        noJurnal: 'OB-001',
        totalLines: cleanLines.length,
      });
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: 'Gagal menyimpan saldo awal: ' + e.message });
    } finally {
      client.release();
    }
  });

  // DELETE /accounting/saldo-awal — reset opening balance (super_admin only)
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
      `SELECT id FROM journal_entries WHERE tenant_id=$1 AND tipetransaksi='OPENING_BALANCE'`,
      [a.tenantId]
    );
    if (!entries.rowCount) {
      return reply.status(400).send({ error: 'Belum ada saldo awal untuk direset' });
    }
    const ids = entries.rows.map((r: any) => r.id);

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

  // POST /accounting/saldo-awal/post — post saldo awal (set status to POSTED, prevent editing)
  app.post('/saldo-awal/post', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    
    // Check if already posted
    const check = await pool.query(
      `SELECT status_saldo_awal FROM tenants WHERE id = $1`,
      [a.tenantId]
    );
    if (check.rows[0]?.status_saldo_awal === 'POSTED') {
      return reply.status(400).send({ error: 'Saldo awal sudah diposting' });
    }
    
    // Check if saldo awal exists
    const entries = await pool.query(
      `SELECT id FROM journal_entries WHERE tenant_id=$1 AND tipetransaksi='OPENING_BALANCE' LIMIT 1`,
      [a.tenantId]
    );
    if (!entries.rowCount) {
      return reply.status(400).send({ error: 'Belum ada saldo awal untuk diposting' });
    }

    // Validate journal is balanced before posting
    const balanceCheck = await pool.query(
      `SELECT COALESCE(SUM(debit),0) AS total_debit, COALESCE(SUM(kredit),0) AS total_kredit
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.entry_id
       WHERE je.tenant_id=$1 AND je.tipetransaksi='OPENING_BALANCE'`,
      [a.tenantId]
    );
    const { total_debit, total_kredit } = balanceCheck.rows[0];
    if (parseFloat(total_debit) !== parseFloat(total_kredit)) {
      return reply.status(400).send({ error: 'Jurnal tidak balance. Periksa kembali debit dan kredit.' });
    }
    
    // Post it (set status to POSTED, keep backward compat boolean in sync)
    await pool.query(
      `UPDATE tenants 
       SET status_saldo_awal = 'POSTED',
           saldo_awal_locked = true, 
           saldo_awal_locked_at = now(), 
           saldo_awal_locked_by = $2
       WHERE id = $1`,
      [a.tenantId, a.userId]
    );
    
    return { message: 'Saldo awal berhasil diposting', status: 'POSTED' };
  });

  // POST /accounting/saldo-awal/unpost — unpost saldo awal (set status back to DRAFT, allow editing)
  app.post('/saldo-awal/unpost', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    
    // Check if actually posted
    const check = await pool.query(
      `SELECT status_saldo_awal FROM tenants WHERE id = $1`,
      [a.tenantId]
    );
    if (check.rows[0]?.status_saldo_awal !== 'POSTED') {
      return reply.status(400).send({ error: 'Saldo awal tidak dalam keadaan diposting' });
    }
    
    // Unpost it (set status to DRAFT, keep backward compat boolean in sync)
    await pool.query(
      `UPDATE tenants 
       SET status_saldo_awal = 'DRAFT',
           saldo_awal_locked = false, 
           saldo_awal_locked_at = NULL, 
           saldo_awal_locked_by = NULL
       WHERE id = $1`,
      [a.tenantId]
    );
    
    return { message: 'Saldo awal berhasil diunpost', status: 'DRAFT' };
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
       WHERE jl.akun_id = $1 AND je.tenant_id = $2${saldoAwalDateClause}`,
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
       WHERE jl.akun_id = $1 AND je.tenant_id = $2${dateClause}
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
              AND je.tipetransaksi <> 'OPENING_BALANCE'${dateClause}
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
       ) m ON m.akun_id = c.id
       WHERE c.tenant_id = $1 AND c.ispostable = true AND c.kode LIKE '1.1.01%'`,
      [tenantId]
    );
    const saldoKas = Number(kasRows.rows[0]?.saldo || 0);

    // 3. Jumlah transaksi bulan ini
    const txCount = await pool.query(
      `SELECT COUNT(*)::int AS count FROM journal_entries
       WHERE tenant_id=$1 AND tipetransaksi <> 'OPENING_BALANCE'
         AND tanggal >= $2 AND tanggal <= $3`,
      [tenantId, `${currentYear}-${String(now.getMonth()+1).padStart(2,'0')}-01`, today]
    );

    // 4. Data bulanan (Jan–Des) untuk chart — pemasukan vs pengeluaran per bulan
    const monthly: Array<{ month: string; pemasukan: number; pengeluaran: number }> = [];
    for (let m = 1; m <= 12; m++) {
      const ms = `${currentYear}-${String(m).padStart(2,'0')}-01`;
      const me = new Date(currentYear, m, 0).toISOString().slice(0, 10);
      const mLR = await computeLabaRugi(tenantId, ms, me);
      monthly.push({
        month: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][m-1],
        pemasukan: mLR.pendapatanOperasional.subtotal + mLR.nonOperasional.pendapatanLain.subtotal,
        pengeluaran: mLR.hpp.subtotal + mLR.bebanOperasional.subtotal + mLR.nonOperasional.bebanLain.subtotal + mLR.pajak.subtotal,
      });
    }

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
    //    + CLOSING dari tahun sebelumnya (Laba Ditahan / Retained Earnings)
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
              AND (
                je.tipetransaksi = 'OPENING_BALANCE'
                OR je.tanggal < $2
              )
       ) m ON m.akun_id = c.id
       WHERE c.tenant_id = $1 AND c.ispostable = true AND LEFT(c.kode,1) = '3'`,
      [a.tenantId, startDate]
    );
    const modalAwal = Number(modalAwalRes.rows[0]?.saldo || 0);

    // 3. Mutasi Gol 3 selama tahun berjalan (EXCLUDE OPENING_BALANCE only)
    //    Termasuk CLOSING — karena CLOSING mentransfer Laba ke Saldo Laba (Gol 3),
    //    dan Laba Rugi (computeLabaRugi) sudah memasukkan efek CLOSING,
    //    jadi CLOSING credit ke Saldo Laba harus masuk Tambahan Modal agar balanced.
    //    Tambahan Modal = kredit bersih positif pada akun Gol 3
    //    Prive/Penarikan = debit bersih pada akun Gol 3
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
              AND je.tipetransaksi <> 'OPENING_BALANCE'
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

    // Pisahkan: Tambahan Modal (kredit > 0, net positive) vs Prive (debit > 0)
    let tambahanModal = 0;
    let prive = 0;
    const tambahanDetail: MutasiItem[] = [];
    const priveDetail: MutasiItem[] = [];

    for (const m of mutasiDetail) {
      const net = m.kredit - m.debit;
      if (net > 0) {
        tambahanModal += net;
        tambahanDetail.push(m);
      } else if (m.debit > 0) {
        prive += m.debit;
        priveDetail.push(m);
      }
    }

    // 4. Modal Akhir
    const modalAkhir = modalAwal + tambahanModal + labaBersih - prive;

    // 5. VALIDASI EMAS: Cross-check dengan Neraca
    //    Total Ekuitas di Neraca = sum Gol 3 + labaBerjalan
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
  app.get('/neraca-saldo', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const q = req.query as any;
    const endDate = q.end_date || new Date().toISOString().slice(0, 10);
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
    return { asOf: endDate, akun: tb, totalDebit, totalKredit, isBalanced, selisih };
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
              AND je.tenant_id = $1 AND je.tanggal <= $2
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
    const kasTahunLalu = await (async () => {
      if (!startDate) return 0;
      const r = await pool.query(
        `SELECT COALESCE(SUM(CASE WHEN c.saldonormal='D' THEN m.debit-m.kredit ELSE m.kredit-m.debit END),0) AS saldo
         FROM chart_of_accounts c
         LEFT JOIN (
           SELECT jl.akun_id, SUM(jl.debit) AS debit, SUM(jl.kredit) AS kredit
           FROM journal_lines jl
           JOIN journal_entries je ON je.id=jl.entry_id AND je.tenant_id=$1
             AND (je.tanggal < $2 AND je.tipetransaksi <> 'CLOSING' OR je.tipetransaksi = 'OPENING_BALANCE')
           GROUP BY jl.akun_id
         ) m ON m.akun_id=c.id
         WHERE c.tenant_id=$1 AND c.ispostable=true AND (c.kode LIKE '1.1.01%' OR c.kode LIKE '1.1.02%')`,
        [tid, startDate]
      );
      return Number(r.rows[0]?.saldo || 0);
    })();

    // ── Analisis akun lawan per jurnal ──
    // Cari semua entry di rentang waktu yang punya baris Kas/Bank.
    // Untuk setiap garis Kas (D=penerimaan, K=pengeluaran), lihat baris akun lawan dalam entry yg sama.
    // Kelompokkan berdasarkan golongan akun lawan.
    const flowQuery = await pool.query(
      `WITH kas_entries AS (
        SELECT DISTINCT je.id AS entry_id, je.tanggal
        FROM journal_lines jl
        JOIN chart_of_accounts c ON c.id=jl.akun_id AND (c.kode LIKE '1.1.01%' OR c.kode LIKE '1.1.02%')
        JOIN journal_entries je ON je.id=jl.entry_id AND je.tenant_id=$1 AND je.tanggal>=$2 AND je.tanggal<=$3 AND je.tipetransaksi NOT IN ('OPENING_BALANCE','CLOSING')
      ),
      kas_lines AS (
        SELECT ke.entry_id, ke.tanggal,
               COALESCE(SUM(jl.debit),0) AS kas_debit,
               COALESCE(SUM(jl.kredit),0) AS kas_kredit
        FROM kas_entries ke
        JOIN journal_lines jl ON jl.entry_id=ke.entry_id
        JOIN chart_of_accounts c ON c.id=jl.akun_id AND (c.kode LIKE '1.1.01%' OR c.kode LIKE '1.1.02%')
        GROUP BY ke.entry_id, ke.tanggal
      ),
      contra AS (
        SELECT ke.entry_id, ke.tanggal,
               contra.kode, contra.nama, contra.saldonormal,
               COALESCE(contra_line.debit,0) AS d, COALESCE(contra_line.kredit,0) AS k
        FROM kas_entries ke
        JOIN journal_lines contra_line ON contra_line.entry_id=ke.entry_id
        JOIN chart_of_accounts contra ON contra.id=contra_line.akun_id AND NOT (contra.kode LIKE '1.1.01%' OR contra.kode LIKE '1.1.02%')
      )
      SELECT c.kode, c.nama,
             SUM(CASE WHEN kl.kas_debit>0 THEN c.k ELSE 0 END) AS masuk,
             SUM(CASE WHEN kl.kas_kredit>0 THEN c.d ELSE 0 END) AS keluar
      FROM contra c
      JOIN kas_lines kl ON kl.entry_id=c.entry_id
      GROUP BY c.kode, c.nama
      ORDER BY c.kode`,
      [tid, startDate || '1970-01-01', endDate]
    );

    // ── Klasifikasi per aktivitas ──
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
      // Operasi: Gol 1.1.03 (piutang), 1.1.05 (persediaan), 4, 5, 6, 7
      // Investasi: Gol 1.3
      // Pendanaan: Gol 2, 3
      const g = r.kode[0];
      const sub2 = r.kode.slice(0, 3);
      if (sub2 === '1.3' || sub2 === '1.2') {
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
    const neracaKas = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN c.saldonormal='D' THEN m.debit-m.kredit ELSE m.kredit-m.debit END),0) AS saldo
       FROM chart_of_accounts c
       LEFT JOIN (
         SELECT jl.akun_id, SUM(jl.debit) AS debit, SUM(jl.kredit) AS kredit
         FROM journal_lines jl
         JOIN journal_entries je ON je.id=jl.entry_id AND je.tenant_id=$1 AND je.tanggal<= $2 AND je.tipetransaksi <> 'CLOSING'
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
           FROM journal_lines jl JOIN journal_entries je ON je.id=jl.entry_id AND je.tenant_id=$1 AND je.tanggal<=$2 AND je.tipetransaksi <> 'CLOSING'
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

  // POST /aset-tetap/depreciate — jalankan penyusutan bulanan
  app.post('/aset-tetap/depreciate', mutationGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    // Cari aset aktif (belum habis menyusut)
    const assets = await pool.query(
      `SELECT fa.id, fa.nama, fa.kategori, fa.akun_id, fa.harga_perolehan, fa.umur_manfaat_bulan, fa.akumulasi_penyusutan
       FROM fixed_assets fa
       WHERE fa.tenant_id=$1 AND (fa.akumulasi_penyusutan IS NULL OR fa.akumulasi_penyusutan < fa.harga_perolehan)
             AND fa.umur_manfaat_bulan > 0`,
      [a.tenantId]
    );

    const results: { nama: string; susut: number; ok: boolean }[] = [];
    const now = new Date();

    for (const as of assets.rows) {
      const cat = KATEGORI_COA[as.kategori];
      if (!cat || !cat.akumKode || !cat.bebanKode) continue;

      const akumAcc = await pool.query(
        `SELECT id FROM chart_of_accounts WHERE tenant_id=$1 AND kode=$2 LIMIT 1`,
        [a.tenantId, cat.akumKode]
      );
      const bebanAcc = await pool.query(
        `SELECT id FROM chart_of_accounts WHERE tenant_id=$1 AND kode=$2 LIMIT 1`,
        [a.tenantId, cat.bebanKode]
      );
      if (!akumAcc.rows.length || !bebanAcc.rows.length) continue;

      const susut = Math.round(Number(as.harga_perolehan) / Number(as.umur_manfaat_bulan));
      if (susut <= 0) continue;

      const nilaiTersisa = Number(as.harga_perolehan) - Number(as.akumulasi_penyusutan || 0);
      const aktualSusut = Math.min(susut, Math.max(0, nilaiTersisa));
      if (aktualSusut <= 0) continue;

      const bulanKe = Math.floor((Number(as.akumulasi_penyusutan || 0) / susut)) + 1;
      const keterangan = `Penyusutan ${as.nama} - Bulan ke-${bulanKe}`;
      const noJurnal = `SUSUT-${as.kategori.slice(0, 3).toUpperCase()}-${now.toISOString().slice(2, 10).replace(/-/g, '')}`;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const je = await client.query(
          `INSERT INTO journal_entries (tenant_id, tanggal, bulan, tahun, no_jurnal, keterangan, isposted, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,true,$7) RETURNING id`,
          [a.tenantId, now.toISOString().slice(0, 10), now.getMonth()+1, now.getFullYear(), noJurnal, keterangan, now]
        );
        await client.query(
          `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit)
           VALUES ($1,$2,$3,0), ($1,$4,0,$3)`,
          [je.rows[0].id, bebanAcc.rows[0].id, aktualSusut, akumAcc.rows[0].id]
        );
        // Update akumulasi_penyusutan
        await client.query(
          `UPDATE fixed_assets SET akumulasi_penyusutan = COALESCE(akumulasi_penyusutan, 0) + $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`,
          [aktualSusut, now, as.id, a.tenantId]
        );
        await client.query('COMMIT');
        results.push({ nama: as.nama, susut, ok: true });
      } catch (e) {
        await client.query('ROLLBACK');
        results.push({ nama: as.nama, susut, ok: false });
      } finally {
        client.release();
      }
    }

    return { results, total: results.length, success: results.filter(r => r.ok).length };
  });

  // ── CRON: Depresiasi bulanan (internal — localhost only) ──
  app.post('/cron/depreciate', async (req: FastifyRequest, reply: FastifyReply) => {
    const ip = req.ip || (req as any).connection?.remoteAddress || '';
    if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
      return reply.code(403).send({ error: 'Forbidden — localhost only' });
    }
    // Dapatkan semua tenant
    const tenants = await pool.query('SELECT id FROM tenants WHERE is_active=true');
    const allResults: any[] = [];
    const now = new Date();

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

      for (const as of assets.rows) {
        const cat = KATEGORI_COA_LOCAL[as.kategori];
        if (!cat?.akumKode || !cat?.bebanKode) continue;

        const akumAcc = await pool.query(
          `SELECT id FROM chart_of_accounts WHERE tenant_id=$1 AND kode=$2 LIMIT 1`, [t.id, cat.akumKode]
        );
        const bebanAcc = await pool.query(
          `SELECT id FROM chart_of_accounts WHERE tenant_id=$1 AND kode=$2 LIMIT 1`, [t.id, cat.bebanKode]
        );
        if (!akumAcc.rows.length || !bebanAcc.rows.length) continue;

        const susut = Math.round(Number(as.harga_perolehan) / Number(as.umur_manfaat_bulan));
        const nilaiTersisa = Number(as.harga_perolehan) - Number(as.akumulasi_penyusutan);
        const aktualSusut = Math.min(susut, Math.max(0, nilaiTersisa));
        if (aktualSusut <= 0) continue;

        const bulanKe = Math.floor((Number(as.akumulasi_penyusutan) / susut)) + 1;
        const keterangan = `Penyusutan ${as.nama} - Bulan ke-${bulanKe}`;
        const noJurnal = `SUSUT-${as.kategori.slice(0, 3).toUpperCase()}-${now.toISOString().slice(2, 10).replace(/-/g, '')}`;

        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const je = await client.query(
            `INSERT INTO journal_entries (tenant_id, tanggal, bulan, tahun, no_jurnal, keterangan, isposted, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,true,$7) RETURNING id`,
            [t.id, now.toISOString().slice(0, 10), now.getMonth()+1, now.getFullYear(), noJurnal, keterangan, now]
          );
          await client.query(
            `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit)
             VALUES ($1,$2,$3,0), ($1,$4,0,$3)`,
            [je.rows[0].id, bebanAcc.rows[0].id, aktualSusut, akumAcc.rows[0].id]
          );
          await client.query(
            `UPDATE fixed_assets SET akumulasi_penyusutan = akumulasi_penyusutan + $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`,
            [aktualSusut, now, as.id, t.id]
          );
          await client.query('COMMIT');
          allResults.push({ tenant: t.id.slice(0,8), aset: as.nama, susut: aktualSusut });
        } catch (e: any) {
          await client.query('ROLLBACK');
          const msg = e.code === '23505' ? 'SKIP — sudah ada' : e.message;
          allResults.push({ tenant: t.id.slice(0,8), aset: as.nama, susut: aktualSusut, error: msg });
        } finally {
          client.release();
        }
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

  // POST /tutup-buku — jurnal penutup + lock periode
  app.post('/tutup-buku', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const { tahun } = req.body as { tahun: number };
    const b = req.body as any;
    const year = tahun || b?.tahun;
    if (!year || year < 2000 || year > 2099) return reply.code(400).send({ error: 'Tahun tidak valid' });
    const tid = a.tenantId!;

    // Cek tahun sebelumnya — harus sudah ditutup
    if (year > 2000) {
      const prev = await pool.query(
        `SELECT id, status FROM financial_periods WHERE tenant_id=$1 AND tahun=$2 LIMIT 1`,
        [tid, year - 1]
      );
      if (prev.rows.length && (prev.rows[0] as any).status !== 'CLOSED') {
        return reply.code(400).send({ error: `Tahun ${year - 1} masih OPEN. Tutup buku tahun sebelumnya dulu!` });
      }
    }

    // Cek periode ini — jika sudah CLOSED, tolak
    const cur = await pool.query(
      `SELECT id, status FROM financial_periods WHERE tenant_id=$1 AND tahun=$2 LIMIT 1`,
      [tid, year]
    );
    if (cur.rows.length && (cur.rows[0] as any).status === 'CLOSED') {
      return reply.code(400).send({ error: `Periode ${year} sudah ditutup.` });
    }

    // Hitung saldo akhir Gol 4-7 per 31 Des (P&L)
    const endDate = `${year}-12-31`;
    const pnL = await pool.query(
      `SELECT ca.id, ca.kode, ca.nama, ca.saldonormal,
              COALESCE(SUM(
                CASE WHEN ca.saldonormal='D' THEN jl.debit - jl.kredit
                     ELSE jl.kredit - jl.debit END
              ), 0) AS saldo
       FROM journal_lines jl
       JOIN journal_entries je ON je.id=jl.entry_id
       JOIN chart_of_accounts ca ON ca.id=jl.akun_id AND ca.tenant_id=$1
       WHERE je.tenant_id=$1 AND je.tanggal <= $2
         AND LEFT(ca.kode,1) IN ('4','5','6','7')
       GROUP BY ca.id, ca.kode, ca.nama, ca.saldonormal
       HAVING COALESCE(SUM(
         CASE WHEN ca.saldonormal='D' THEN jl.debit - jl.kredit
              ELSE jl.kredit - jl.debit END
       ), 0) != 0
       ORDER BY ca.kode`,
      [tid, endDate]
    );

    // Hitung saldo Prive (Gol 3.2.x — Pengambilan oleh Pemilik) per 31 Des
    const priveQuery = await pool.query(
      `SELECT ca.id, ca.kode, ca.nama, ca.saldonormal,
              COALESCE(SUM(
                CASE WHEN ca.saldonormal='D' THEN jl.debit - jl.kredit
                     ELSE jl.kredit - jl.debit END
              ), 0) AS saldo
       FROM journal_lines jl
       JOIN journal_entries je ON je.id=jl.entry_id
       JOIN chart_of_accounts ca ON ca.id=jl.akun_id AND ca.tenant_id=$1
       WHERE je.tenant_id=$1 AND je.tanggal <= $2
         AND ca.kode LIKE '3.2%'
       GROUP BY ca.id, ca.kode, ca.nama, ca.saldonormal
       HAVING COALESCE(SUM(
         CASE WHEN ca.saldonormal='D' THEN jl.debit - jl.kredit
              ELSE jl.kredit - jl.debit END
       ), 0) != 0
       ORDER BY ca.kode`,
      [tid, endDate]
    );

    if (!pnL.rows.length && !priveQuery.rows.length) {
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

    // Cari akun Laba Ditahan (Saldo Laba Tidak Dicadangkan — 3.3.01.01)
    // FIX: tambah ispostable=true agar tidak salah pilih 3.3.01.00 (parent, not postable)
    const labaDitahan = await pool.query(
      `SELECT id FROM chart_of_accounts WHERE tenant_id=$1 AND kode='3.3.01.01' AND ispostable=true LIMIT 1`,
      [tid]
    );
    if (!labaDitahan.rows.length) {
      return reply.code(400).send({ error: 'Akun Saldo Laba Tidak Dicadangkan (3.3.01.01) tidak ditemukan. Seed CoA dulu.' });
    }
    const labaDitahanId = (labaDitahan.rows[0] as any).id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

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
            // Saldo positif = debit (beban) → kredit-kan, kredit (pendapatan) → debit-kan
            if ((r as any).saldonormal === 'D') {
              lines.push({ akunId: (r as any).id, debit: 0, kredit: saldo });
              totalKredit += saldo;
            } else {
              lines.push({ akunId: (r as any).id, debit: saldo, kredit: 0 });
              totalDebit += saldo;
            }
          } else {
            // Saldo negatif → flip
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

      // Zeroing Prive (Gol 3.2.x): credit to zero, debit Saldo Laba
      let totalPrive = 0;
      for (const r of priveQuery.rows) {
        const saldo = Number((r as any).saldo);
        if (saldo !== 0) {
          // Prive has saldoNormal='D' (debit). To zero: credit it.
          if (saldo > 0) {
            lines.push({ akunId: (r as any).id, debit: 0, kredit: saldo });
            totalKredit += saldo;
            totalPrive += saldo;
          } else {
            // Negative Prive (unusual) → debit to zero
            lines.push({ akunId: (r as any).id, debit: Math.abs(saldo), kredit: 0 });
            totalDebit += Math.abs(saldo);
            totalPrive += saldo; // negative
          }
        }
      }

      // Net ke Saldo Laba: laba bersih dikurangi Prive
      const netToSaldoLaba = labaBersih - totalPrive;
      if (netToSaldoLaba > 0) {
        lines.push({ akunId: labaDitahanId, debit: 0, kredit: netToSaldoLaba });
        totalKredit += netToSaldoLaba;
      } else if (netToSaldoLaba < 0) {
        lines.push({ akunId: labaDitahanId, debit: Math.abs(netToSaldoLaba), kredit: 0 });
        totalDebit += Math.abs(netToSaldoLaba);
      }

      // Balance check
      if (Math.abs(totalDebit - totalKredit) > 1) {
        await client.query('ROLLBACK');
        return reply.code(500).send({ error: `Jurnal penutup tidak balance: D=${totalDebit} ≠ K=${totalKredit}` });
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
        `INSERT INTO financial_periods (tenant_id, tahun, status, closed_at, closed_by)
         VALUES ($1, $2, 'CLOSED', $3, NULL)
         ON CONFLICT (tenant_id, tahun) DO UPDATE SET status='CLOSED', closed_at=$3, closed_by=NULL`,
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
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ─── TRANSAKSI CEPAT (Guided Transactions) ──────────────────
  // POST /accounting/transaksi/quick — Auto-jurnal for guided transactions
  app.post('/transaksi/quick', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const b = req.body as any;

    // Validate required fields
    if (!b.tipe || !b.tanggal || !b.nominal || !b.sumber_akun_id) {
      return reply.code(400).send({ error: 'tipe, tanggal, nominal, dan sumber_akun_id wajib' });
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

    // Parse tanggal
    const [tahunStr, bulanStr] = tanggal.split('-');
    const tahun = parseInt(tahunStr, 10);
    const bulan = parseInt(bulanStr, 10);
    if (isNaN(tahun) || isNaN(bulan)) {
      return reply.code(400).send({ error: 'Format tanggal tidak valid' });
    }

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

    // Validate sumber akun exists
    const sumberRes = await pool.query(
      `SELECT id, kode, nama FROM chart_of_accounts WHERE id=$1 AND tenant_id=$2`,
      [sumberAkunId, a.tenantId]
    );
    if (!sumberRes.rowCount) {
      return reply.code(400).send({ error: 'Akun sumber tidak ditemukan' });
    }

    await checkPeriodLock(a.tenantId!, tahun);
    await ensurePeriod(a.tenantId!, tahun);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const no_jurnal = await nextJurnalNo(a.tenantId!, tahun, bulan);

      // Create journal entry
      const entryRes = await client.query(
        `INSERT INTO journal_entries
           (tenant_id, no_jurnal, tanggal, bulan, tahun, keterangan, tipeTransaksi, isPosted, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'GENERAL',true,$7)
         RETURNING id, no_jurnal AS "noJurnal"`,
        [a.tenantId, no_jurnal, tanggal, bulan, tahun, desc, a.userId]
      );
      const entryId = entryRes.rows[0].id;

      // Create journal lines based on transaction type
      // Debit/Kredit logic:
      // - bayar_utang: Debit Utang (kurangi hutang), Credit Kas/Bank (kurangi kas)
      // - terima_piutang: Debit Kas/Bank (tambah kas), Credit Piutang (kurangi piutang)
      // - beli_persediaan: Debit Persediaan (tambah stok), Credit Kas/Bank (kurangi kas)
      // - jual_persediaan: Debit Kas/Bank (tambah kas), Credit Persediaan (kurangi stok)

      let line1Debit = '0', line1Kredit = '0', line2Debit = '0', line2Kredit = '0';
      let line1AkunId = '', line2AkunId = '';
      let line1ContactId = null, line1InventoryItemId = null, line1Qty = null;
      let line2ContactId = null, line2InventoryItemId = null, line2Qty = null;

      const nominalStr = String(nominal);

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
          // Debit Kas/Bank, Credit Persediaan (kurangi stok)
          line1AkunId = sumberAkunId; line1Debit = nominalStr; line1Kredit = '0';
          line2AkunId = targetAkun.id; line2Debit = '0'; line2Kredit = nominalStr;
          line2InventoryItemId = inventoryItemId; line2Qty = String(qty);
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

      await client.query('COMMIT');

      return reply.code(201).send({
        success: true,
        message: 'Transaksi berhasil disimpan',
        entry: {
          id: entryId,
          noJurnal: entryRes.rows[0].noJurnal,
          tanggal,
          tipe,
          nominal,
          keterangan: desc,
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
       LEFT JOIN journal_lines jl ON jl.inventory_item_id = ii.id
       LEFT JOIN journal_entries je ON jl.entry_id = je.id AND je.isposted = true AND je.tenant_id = ii.tenant_id
       WHERE ii.tenant_id = $1
       GROUP BY ii.id, ii.nama, ii.kode, ii.satuan, ii.harga_satuan
       ORDER BY ii.kode`,
      [a.tenantId]
    );
    return { items: r.rows };
  });

  // POST /accounting/penjualan — Mini POS sales transaction
  app.post('/penjualan', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const b = req.body as any;

    if (!b.items || !Array.isArray(b.items) || b.items.length === 0) {
      return reply.code(400).send({ error: 'items wajib diisi dan tidak boleh kosong' });
    }
    if (!b.kas_akun_id) {
      return reply.code(400).send({ error: 'kas_akun_id wajib dipilih' });
    }
    if (!b.tanggal) {
      return reply.code(400).send({ error: 'tanggal wajib diisi' });
    }

    const tanggal = b.tanggal as string;
    const kasAkunId = b.kas_akun_id as string;
    const keterangan = b.keterangan || 'Penjualan POS';

    // Parse tanggal
    const [tahunStr, bulanStr] = tanggal.split('-');
    const tahun = parseInt(tahunStr, 10);
    const bulan = parseInt(bulanStr, 10);
    if (isNaN(tahun) || isNaN(bulan)) {
      return reply.code(400).send({ error: 'Format tanggal tidak valid' });
    }

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

    // Validate items and compute stock/HPP for each
    const itemDetails: Array<{
      inventory_item_id: string;
      nama: string;
      qty: number;
      harga_jual: number;
      hpp: number;
      stok_sekarang: number;
      stok_sesudah: number;
      is_negative: boolean;
    }> = [];

    let totalPenjualan = 0;
    let totalHpp = 0;

    for (const item of b.items) {
      if (!item.inventory_item_id || !item.qty || item.qty <= 0 || !item.harga_jual || item.harga_jual <= 0) {
        return reply.code(400).send({ error: 'Setiap item wajib memiliki inventory_item_id, qty > 0, dan harga_jual > 0' });
      }

      // Get item name
      const itemRes = await pool.query(
        'SELECT id, nama FROM inventory_items WHERE id=$1 AND tenant_id=$2',
        [item.inventory_item_id, a.tenantId]
      );
      if (!itemRes.rowCount) {
        return reply.code(400).send({ error: `Barang dengan id ${item.inventory_item_id} tidak ditemukan` });
      }

      // Calculate current stock
      const stockRes = await pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN jl.debit > 0 THEN jl.qty ELSE 0 END), 0) -
           COALESCE(SUM(CASE WHEN jl.kredit > 0 THEN jl.qty ELSE 0 END), 0) AS stok
         FROM journal_lines jl
         JOIN journal_entries je ON jl.entry_id = je.id AND je.isposted = true AND je.tenant_id = $2
         WHERE jl.inventory_item_id = $1`,
        [item.inventory_item_id, a.tenantId]
      );
      const stokSekarang = Number(stockRes.rows[0].stok) || 0;

      // Calculate HPP (moving average): total debit cost / total debit qty for this item
      const hppRes = await pool.query(
        `SELECT
           COALESCE(SUM(jl.debit), 0) AS total_cost,
           COALESCE(SUM(CASE WHEN jl.debit > 0 THEN jl.qty ELSE 0 END), 0) AS total_qty
         FROM journal_lines jl
         JOIN journal_entries je ON jl.entry_id = je.id AND je.isposted = true AND je.tenant_id = $2
         WHERE jl.inventory_item_id = $1`,
        [item.inventory_item_id, a.tenantId]
      );
      const totalCost = Number(hppRes.rows[0].total_cost) || 0;
      const totalQty = Number(hppRes.rows[0].total_qty) || 0;
      const hpp = totalQty > 0 ? Math.round(totalCost / totalQty) : 0;

      const stokSesudah = stokSekarang - item.qty;
      const isNegative = stokSesudah < 0;

      itemDetails.push({
        inventory_item_id: item.inventory_item_id,
        nama: itemRes.rows[0].nama,
        qty: item.qty,
        harga_jual: item.harga_jual,
        hpp,
        stok_sekarang: stokSekarang,
        stok_sesudah: stokSesudah,
        is_negative: isNegative,
      });

      totalPenjualan += item.qty * item.harga_jual;
      totalHpp += item.qty * hpp;
    }

    const labaKotor = totalPenjualan - totalHpp;

    await checkPeriodLock(a.tenantId!, tahun);
    await ensurePeriod(a.tenantId!, tahun);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const no_jurnal = await nextJurnalNo(a.tenantId!, tahun, bulan);

      // Create journal entry with tipetransaksi='SALES'
      const entryRes = await client.query(
        `INSERT INTO journal_entries
           (tenant_id, no_jurnal, tanggal, bulan, tahun, keterangan, tipeTransaksi, isPosted, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'SALES',true,$7)
         RETURNING id, no_jurnal AS "noJurnal"`,
        [a.tenantId, no_jurnal, tanggal, bulan, tahun, keterangan, a.userId]
      );
      const entryId = entryRes.rows[0].id;

      // Insert journal lines per item
      for (const detail of itemDetails) {
        const itemTotal = detail.qty * detail.harga_jual;
        const itemHppTotal = detail.qty * detail.hpp;

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
          [entryId, hppAkunId, String(itemHppTotal), `HPP ${detail.nama}`]
        );

        // Line 4: Kredit Persediaan (with inventory_item_id and qty)
        await client.query(
          `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit, keterangan, inventory_item_id, qty)
           VALUES ($1,$2,'0',$3,$4,$5,$6)`,
          [entryId, persediaanAkunId, String(itemHppTotal), `HPP ${detail.nama}`, detail.inventory_item_id, String(detail.qty)]
        );
      }

      await client.query('COMMIT');

      return reply.code(201).send({
        success: true,
        entry: {
          id: entryId,
          noJurnal: entryRes.rows[0].noJurnal,
          tanggal,
          keterangan,
        },
        items: itemDetails.map(d => ({
          nama: d.nama,
          qty: d.qty,
          harga_jual: d.harga_jual,
          hpp: d.hpp,
          stok_sesudah: d.stok_sesudah,
          is_negative: d.is_negative,
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
}
