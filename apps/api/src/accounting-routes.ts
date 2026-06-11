import type { FastifyInstance, FastifyRequest } from 'fastify';
import { pool } from './db.js';
import { requireTenant, requireActiveTrial, type AuthPayload } from './guards.js';
import { seedDefaultCoa } from './coa-seed.js';

const tenantGuard = { onRequest: [requireTenant] };
const mutationGuard = { onRequest: [requireActiveTrial] };

export async function accountingRoutes(app: FastifyInstance) {
  // ─── Chart of Accounts ────────────────────────────────────────────

  // GET /accounting/coa — list active accounts for tenant
  app.get('/coa', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const r = await pool.query(
      `SELECT id, tenant_id AS "tenantId", kode, nama, jenisakun AS "jenisAkun",
              kelompok, saldonormal AS "saldoNormal", ispostable AS "isPostable",
              parent_id AS "parentId", isactive AS "isActive", level
       FROM chart_of_accounts
       WHERE tenant_id=$1 AND isActive=true
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
              parent_id AS "parentId", isactive AS "isActive", level
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

  // ─── Jurnal Umum ─────────────────────────────────────────────────

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
  app.post('/jurnal-umum', mutationGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const body = req.body as any;
    if (!body) return { error: 'Body request kosong' };

    const { tanggal, keterangan, lines } = body;

    // Validate required fields
    if (!tanggal) return { error: 'Tanggal wajib diisi' };
    if (!lines || !Array.isArray(lines) || lines.length < 2) {
      return { error: 'Minimal 2 baris jurnal' };
    }

    const [tahunStr, bulanStr, _day] = (tanggal as string).split('-');
    const tahun = parseInt(tahunStr, 10);
    const bulan = parseInt(bulanStr, 10);
    if (isNaN(tahun) || isNaN(bulan) || tahun < 2000 || tahun > 2100 || bulan < 1 || bulan > 12) {
      return { error: 'Format tanggal tidak valid (YYYY-MM-DD)' };
    }

    // Validate each line
    const akunIds = lines.map((l: any) => l.akun_id);
    for (const l of lines) {
      const debit = parseFloat(l.debit || '0');
      const kredit = parseFloat(l.kredit || '0');
      if (isNaN(debit) || isNaN(kredit)) return { error: 'Debit/kredit harus angka' };
      if (debit < 0 || kredit < 0) return { error: 'Debit/kredit tidak boleh negatif' };
      if (debit === 0 && kredit === 0) return { error: 'Setiap baris harus memiliki debit atau kredit' };
    }

    // Validate debit = credit
    const totalDebit = lines.reduce((s: number, l: any) => s + parseFloat(l.debit || '0'), 0);
    const totalKredit = lines.reduce((s: number, l: any) => s + parseFloat(l.kredit || '0'), 0);
    if (Math.abs(totalDebit - totalKredit) > 0.01) {
      return { error: `Total debit (${totalDebit}) tidak sama dengan total kredit (${totalKredit})` };
    }

    // Validate all akun belong to tenant, are active, and isPostable
    const akunRows = await pool.query(
      `SELECT id, kode, ispostable AS "isPostable", isactive AS "isActive" FROM chart_of_accounts
       WHERE id = ANY($1::uuid[]) AND tenant_id=$2`,
      [akunIds, a.tenantId]
    );
    const validIds = new Set(akunRows.rows.map((r: any) => r.id));
    for (const akunId of akunIds) {
      if (!validIds.has(akunId)) return { error: `Akun ${akunId} tidak ditemukan untuk tenant ini` };
    }
    for (const row of akunRows.rows) {
      if (!(row as any).isActive) return { error: `Akun ${(row as any).kode} tidak aktif` };
      if (!(row as any).isPostable) return { error: `Akun ${(row as any).kode} tidak dapat diposting` };
    }

    // Generate no_jurnal and ensure period
    const no_jurnal = await nextJurnalNo(a.tenantId!, tahun, bulan);
    await ensurePeriod(a.tenantId!, tahun);

    // Transaction: insert entry + lines
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const entryRes = await client.query(
        `INSERT INTO journal_entries
           (tenant_id, no_jurnal, tanggal, bulan, tahun, keterangan, tipeTransaksi, isPosted, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'jurnal_umum',true,$7)
         RETURNING id`,
        [a.tenantId, no_jurnal, tanggal, bulan, tahun, keterangan || null, a.userId]
      );
      const entryId = entryRes.rows[0].id as string;

      for (const l of lines) {
        await client.query(
          `INSERT INTO journal_lines (entry_id, akun_id, debit, kredit, keterangan)
           VALUES ($1,$2,$3,$4,$5)`,
          [entryId, l.akun_id, String(l.debit || '0'), String(l.kredit || '0'), l.keterangan || null]
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

  // GET /accounting/jurnal-umum — list entries for tenant
  app.get('/jurnal-umum', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const q = req.query as any;
    const tahun = q.tahun ? parseInt(q.tahun, 10) : null;
    const bulan = q.bulan ? parseInt(q.bulan, 10) : null;
    const limit = Math.min(parseInt(q.limit, 10) || 50, 200);
    const offset = parseInt(q.offset, 10) || 0;

    const conditions: string[] = ['je.tenant_id=$1'];
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

    const where = conditions.join(' AND ');
    const r = await pool.query(
      `SELECT je.id, je.no_jurnal AS "noJurnal", je.tanggal, je.bulan, je.tahun,
              je.keterangan, je.tipetransaksi AS "tipeTransaksi",
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
              keterangan, tipetransaksi AS "tipeTransaksi",
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
}
