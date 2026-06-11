import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
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
              parent_id AS "parentId", is_seeded AS "isSeeded", is_system_default AS "isSystemDefault", isactive AS "isActive", level
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
    const parentPrefix = parent.kode.slice(0, 6); // e.g. "1.1.01" (no trailing dot)
    const childrenRes = await pool.query(
      `SELECT kode FROM chart_of_accounts
       WHERE tenant_id=$1 AND kode LIKE $2 AND isActive=true`,
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

    const insertRes = await pool.query(
      `INSERT INTO chart_of_accounts
         (tenant_id, kode, nama, jenisAkun, kelompok, saldoNormal, isPostable, parent_id, is_seeded, is_system_default, isActive, level)
       VALUES ($1,$2,$3,$4,$5,$6,true,$7,false,false,true,4)
       RETURNING id, kode, nama, is_seeded AS "isSeeded", is_system_default AS "isSystemDefault", ispostable AS "isPostable",
                 parent_id AS "parentId", saldonormal AS "saldoNormal";`,
      [a.tenantId, newKode, String(nama).trim(),
       parent.jenisAkun, parent.kelompok, parent.saldoNormal || 'D', parent_id]
    );

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

    await pool.query('DELETE FROM chart_of_accounts WHERE id=$1', [id]);
    return { message: 'Akun berhasil dihapus' };
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

    const { tanggal, keterangan, referensi, lines } = body;

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

    // Validate debit = credit
    const totalDebit = lines.reduce((s: number, l: any) => s + parseFloat(l.debit || '0'), 0);
    const totalKredit = lines.reduce((s: number, l: any) => s + parseFloat(l.kredit || '0'), 0);
    if (Math.abs(totalDebit - totalKredit) > 0.01) {
      return reply.status(400).send({ error: `Total debit (${totalDebit}) tidak sama dengan total kredit (${totalKredit})` });
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

    // Generate no_jurnal and ensure period
    const no_jurnal = await nextJurnalNo(a.tenantId!, tahun, bulan);
    await ensurePeriod(a.tenantId!, tahun);

    // Transaction: insert entry + lines
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const entryRes = await client.query(
        `INSERT INTO journal_entries
           (tenant_id, no_jurnal, tanggal, bulan, tahun, keterangan, referensi, tipeTransaksi, isPosted, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'GENERAL',true,$8)
         RETURNING id`,
        [a.tenantId, no_jurnal, tanggal, bulan, tahun, keterangan || null, referensi || null, a.userId]
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
    if (entry.tipeTransaksi !== 'GENERAL') {
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
      if (!lock.rowCount || (lock.rows[0] as any).tipeTransaksi !== 'GENERAL' || (lock.rows[0] as any).isLocked) {
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
      `SELECT id, tipetransaksi AS "tipeTransaksi", islocked AS "isLocked"
       FROM journal_entries WHERE id=$1 AND tenant_id=$2`,
      [id, a.tenantId]
    );
    if (!existing.rowCount) return reply.status(404).send({ error: 'Jurnal tidak ditemukan' });
    const entry = existing.rows[0] as any;

    // 2. PAGAR TIPE TRANSAKSI — hanya GENERAL
    if (entry.tipeTransaksi !== 'GENERAL') {
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

    // 4. Atomic: BEGIN → hapus lines → hapus entry → COMMIT
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const lock = await client.query(
        `SELECT tipetransaksi AS "tipeTransaksi", islocked AS "isLocked"
         FROM journal_entries WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,
        [id, a.tenantId]
      );
      if (!lock.rowCount || (lock.rows[0] as any).tipeTransaksi !== 'GENERAL' || (lock.rows[0] as any).isLocked) {
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
    };
  });

  // POST /accounting/saldo-awal — simpan saldo awal sebagai jurnal OPENING_BALANCE (sekali per tenant)
  app.post('/saldo-awal', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = (req as any).auth as AuthPayload;
    const body = req.body as any;
    if (!body) return reply.status(400).send({ error: 'Body request kosong' });

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
}
