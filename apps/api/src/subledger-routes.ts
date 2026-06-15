// Sub-Ledger Master Data & Reconciliation Routes
// Contacts, Inventory Items, Fixed Assets — independen dari jurnal/CoA existing

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { pool } from './db.js';
import { requireTenant, requireActiveTrial, type AuthPayload } from './guards.js';

const tenantGuard = { onRequest: [requireTenant] };
const mutationGuard = { onRequest: [requireActiveTrial] };

// ─── Subledger type mapping (kode prefix → source table) ─────────
// Digunakan oleh endpoint rekonsiliasi untuk menentukan tabel mana
// yang menjadi sumber rincian untuk suatu akun CoA.
const SUBLEDGER_MAP: { prefixes: string[]; table: string; field: string; label: string; where?: string }[] = [
  { prefixes: ['1.1.05'], table: 'inventory_items', field: 'saldo_awal', label: 'Persediaan' },
  { prefixes: ['1.1.03'], table: 'contacts', field: 'saldo_awal', label: 'Piutang',
    where: "tipe='pelanggan' AND saldo_awal_tipe='debit'" },
  { prefixes: ['2.1.01'], table: 'contacts', field: 'saldo_awal', label: 'Utang',
    where: "tipe='supplier' AND saldo_awal_tipe='kredit'" },
  // Aset Tetap (1.3.x, kecuali 1.3.07 Akum Penyusutan) = Harga Perolehan (debit)
  { prefixes: ['1.3.01', '1.3.02', '1.3.03', '1.3.04', '1.3.05', '1.3.06', '1.3.99'],
    table: 'fixed_assets', field: 'harga_perolehan', label: 'Aset Tetap',
    where: "is_saldo_awal = true" },
  // Akumulasi Penyusutan (1.3.07.x) = Akumulasi Penyusutan AWAL (kredit, contra-aset)
  // MUST use akumulasi_penyusutan_awal (static column) not akumulasi_penyusutan (dynamic)
  { prefixes: ['1.3.07'], table: 'fixed_assets', field: 'akumulasi_penyusutan_awal', label: 'Akum. Penyusutan',
    where: "is_saldo_awal = true" },
  { prefixes: ['3'], table: 'equity_details', field: 'saldo_awal', label: 'Modal / Ekuitas' },
];

function getSubledgerForKode(kode: string): typeof SUBLEDGER_MAP[0] | null {
  for (const entry of SUBLEDGER_MAP) {
    if (entry.prefixes.some(p => kode.startsWith(p))) return entry;
  }
  return null;
}

export async function subledgerRoutes(app: FastifyInstance) {
  const getToken = (req: FastifyRequest) => ((req as any).auth as AuthPayload);

  // ─── HELPERS ──────────────────────────────────────────────────
  function postBody(req: FastifyRequest) {
    // Ambil body as any (Fastify raw JSON)
    return (req as any).body as Record<string, any>;
  }

  // ─── CONTACTS ─────────────────────────────────────────────────
  app.get('/contacts', tenantGuard, async (req: FastifyRequest) => {
    const a = getToken(req);
    const { tipe } = req.query as { tipe?: string };
    let sql = `SELECT id, tenant_id AS "tenantId", nama, tipe, telepon, alamat,
                     akun_id AS "akunId", saldo_awal AS "saldoAwal",
                     saldo_awal_tipe AS "saldoAwalTipe", created_at AS "createdAt", updated_at AS "updatedAt"
              FROM contacts WHERE tenant_id=$1`;
    const params: any[] = [a.tenantId];
    if (tipe) { sql += ' AND tipe=$2'; params.push(tipe); }
    sql += ' ORDER BY nama';
    const r = await pool.query(sql, params);
    return { contacts: r.rows };
  });

  app.post('/contacts', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = getToken(req);
    const b = postBody(req);
    if (!b.nama || !b.tipe || !b.akun_id) return reply.status(400).send({ error: 'nama, tipe, dan akun_id wajib' });
    if (!['supplier', 'pelanggan'].includes(b.tipe))
      return reply.status(400).send({ error: 'tipe harus supplier atau pelanggan' });
    if (!['debit', 'kredit'].includes(b.saldo_awal_tipe || 'debit'))
      return reply.status(400).send({ error: 'saldo_awal_tipe harus debit atau kredit' });
    const r = await pool.query(
      `INSERT INTO contacts (tenant_id, nama, tipe, telepon, alamat, akun_id, saldo_awal, saldo_awal_tipe)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, nama, tipe, saldo_awal AS "saldoAwal", saldo_awal_tipe AS "saldoAwalTipe"`,
      [a.tenantId, b.nama, b.tipe, b.telepon || '', b.alamat || '', b.akun_id, b.saldo_awal || 0, b.saldo_awal_tipe || 'debit']
    );
    return reply.code(201).send({ contact: r.rows[0] });
  });

  app.put('/contacts/:id', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = getToken(req);
    const { id } = req.params as { id: string };
    const b = postBody(req);
    const cek = await pool.query('SELECT id FROM contacts WHERE id=$1 AND tenant_id=$2', [id, a.tenantId]);
    if (!cek.rowCount) return reply.status(404).send({ error: 'Kontak tidak ditemukan' });
    const r = await pool.query(
      `UPDATE contacts SET nama=$1, tipe=$2, telepon=$3, alamat=$4, akun_id=$5,
        saldo_awal=$6, saldo_awal_tipe=$7, updated_at=now()
       WHERE id=$8 AND tenant_id=$9
       RETURNING id, nama, tipe, saldo_awal AS "saldoAwal"`,
      [b.nama, b.tipe, b.telepon || '', b.alamat || '', b.akun_id, b.saldo_awal || 0, b.saldo_awal_tipe || 'debit', id, a.tenantId]
    );
    return { contact: r.rows[0] };
  });

  app.delete('/contacts/:id', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = getToken(req);
    const { id } = req.params as { id: string };
    const cek = await pool.query('SELECT id FROM contacts WHERE id=$1 AND tenant_id=$2', [id, a.tenantId]);
    if (!cek.rowCount) return reply.status(404).send({ error: 'Kontak tidak ditemukan' });
    await pool.query('DELETE FROM contacts WHERE id=$1', [id]);
    return { success: true };
  });

  // ─── INVENTORY ITEMS ──────────────────────────────────────────
  app.get('/inventory-items', tenantGuard, async (req: FastifyRequest) => {
    const a = getToken(req);
    const r = await pool.query(
      `SELECT id, tenant_id AS "tenantId", nama, kode, satuan,
              akun_id AS "akunId", qty_awal AS "qtyAwal",
              harga_satuan AS "hargaSatuan", saldo_awal AS "saldoAwal",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM inventory_items WHERE tenant_id=$1 ORDER BY nama`,
      [a.tenantId]
    );
    return { items: r.rows };
  });

  app.post('/inventory-items', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = getToken(req);
    const b = postBody(req);
    if (!b.nama || !b.akun_id) return reply.status(400).send({ error: 'nama dan akun_id wajib' });
    const qty = Number(b.qty_awal || 0);
    const harga = Number(b.harga_satuan || 0);
    const saldo = qty * harga;
    const r = await pool.query(
      `INSERT INTO inventory_items (tenant_id, nama, kode, satuan, akun_id, qty_awal, harga_satuan, saldo_awal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, nama, qty_awal AS "qtyAwal", harga_satuan AS "hargaSatuan", saldo_awal AS "saldoAwal"`,
      [a.tenantId, b.nama, b.kode || '', b.satuan || '', b.akun_id, qty, harga, saldo]
    );
    return reply.code(201).send({ item: r.rows[0] });
  });

  app.put('/inventory-items/:id', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = getToken(req);
    const { id } = req.params as { id: string };
    const b = postBody(req);
    const cek = await pool.query('SELECT id FROM inventory_items WHERE id=$1 AND tenant_id=$2', [id, a.tenantId]);
    if (!cek.rowCount) return reply.status(404).send({ error: 'Barang tidak ditemukan' });
    const qty = Number(b.qty_awal || 0);
    const harga = Number(b.harga_satuan || 0);
    const saldo = qty * harga;
    const r = await pool.query(
      `UPDATE inventory_items SET nama=$1, kode=$2, satuan=$3, akun_id=$4,
        qty_awal=$5, harga_satuan=$6, saldo_awal=$7, updated_at=now()
       WHERE id=$8 AND tenant_id=$9
       RETURNING id, nama, qty_awal AS "qtyAwal", harga_satuan AS "hargaSatuan", saldo_awal AS "saldoAwal"`,
      [b.nama, b.kode || '', b.satuan || '', b.akun_id, qty, harga, saldo, id, a.tenantId]
    );
    return { item: r.rows[0] };
  });

  app.delete('/inventory-items/:id', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = getToken(req);
    const { id } = req.params as { id: string };
    const cek = await pool.query('SELECT id FROM inventory_items WHERE id=$1 AND tenant_id=$2', [id, a.tenantId]);
    if (!cek.rowCount) return reply.status(404).send({ error: 'Barang tidak ditemukan' });
    await pool.query('DELETE FROM inventory_items WHERE id=$1', [id]);
    return { success: true };
  });

  // ─── FIXED ASSETS ─────────────────────────────────────────────
  app.get('/fixed-assets', tenantGuard, async (req: FastifyRequest) => {
    const a = getToken(req);
    const r = await pool.query(
      `SELECT id, tenant_id AS "tenantId", nama, kategori,
              akun_id AS "akunId", tanggal_perolehan AS "tanggalPerolehan",
              harga_perolehan AS "hargaPerolehan", akumulasi_penyusutan AS "akumulasiPenyusutan",
              nilai_buku_awal AS "nilaiBukuAwal", umur_manfaat_bulan AS "umurManfaatBulan",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM fixed_assets WHERE tenant_id=$1 ORDER BY nama`,
      [a.tenantId]
    );
    return { assets: r.rows };
  });

  app.post('/fixed-assets', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = getToken(req);
    const b = postBody(req);
    if (!b.nama || !b.akun_id) return reply.status(400).send({ error: 'nama dan akun_id wajib' });
    const harga = Number(b.harga_perolehan || 0);
    const akumulasi = Number(b.akumulasi_penyusutan || 0);
    const nilaiBuku = harga - akumulasi;
    const r = await pool.query(
      `INSERT INTO fixed_assets (tenant_id, nama, kategori, akun_id, tanggal_perolehan,
        harga_perolehan, akumulasi_penyusutan, nilai_buku_awal, umur_manfaat_bulan,
        is_saldo_awal, akumulasi_penyusutan_awal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$7)
       RETURNING id, nama, kategori, harga_perolehan AS "hargaPerolehan",
                 akumulasi_penyusutan AS "akumulasiPenyusutan", nilai_buku_awal AS "nilaiBukuAwal"`,
      [a.tenantId, b.nama, b.kategori || 'lainnya', b.akun_id, b.tanggal_perolehan || null,
       harga, akumulasi, nilaiBuku, b.umur_manfaat_bulan || null]
    );
    return reply.code(201).send({ asset: r.rows[0] });
  });

  app.put('/fixed-assets/:id', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = getToken(req);
    const { id } = req.params as { id: string };
    const b = postBody(req);
    const cek = await pool.query('SELECT id FROM fixed_assets WHERE id=$1 AND tenant_id=$2', [id, a.tenantId]);
    if (!cek.rowCount) return reply.status(404).send({ error: 'Aset tidak ditemukan' });
    const harga = Number(b.harga_perolehan || 0);
    const akumulasi = Number(b.akumulasi_penyusutan || 0);
    const nilaiBuku = harga - akumulasi;
    const r = await pool.query(
      `UPDATE fixed_assets SET nama=$1, kategori=$2, akun_id=$3, tanggal_perolehan=$4,
        harga_perolehan=$5, akumulasi_penyusutan=$6, akumulasi_penyusutan_awal=$6,
        nilai_buku_awal=$7, umur_manfaat_bulan=$8, updated_at=now()
       WHERE id=$9 AND tenant_id=$10
       RETURNING id, nama, harga_perolehan AS "hargaPerolehan",
                 akumulasi_penyusutan AS "akumulasiPenyusutan", nilai_buku_awal AS "nilaiBukuAwal"`,
      [b.nama, b.kategori || 'lainnya', b.akun_id, b.tanggal_perolehan || null,
       harga, akumulasi, nilaiBuku, b.umur_manfaat_bulan || null, id, a.tenantId]
    );
    return { asset: r.rows[0] };
  });

  app.delete('/fixed-assets/:id', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = getToken(req);
    const { id } = req.params as { id: string };
    const cek = await pool.query('SELECT id FROM fixed_assets WHERE id=$1 AND tenant_id=$2', [id, a.tenantId]);
    if (!cek.rowCount) return reply.status(404).send({ error: 'Aset tidak ditemukan' });
    await pool.query('DELETE FROM fixed_assets WHERE id=$1', [id]);
    return { success: true };
  });

  // ─── EQUITY DETAILS (Rincian Modal / Ekuitas) ─────────────────
  app.get('/equity-details', tenantGuard, async (req: FastifyRequest) => {
    const a = getToken(req);
    const r = await pool.query(
      `SELECT id, tenant_id AS "tenantId", sumber, tahun_penerimaan AS "tahunPenerimaan",
              keterangan, akun_id AS "akunId", saldo_awal AS "saldoAwal",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM equity_details WHERE tenant_id=$1 ORDER BY tahun_penerimaan, sumber`,
      [a.tenantId]
    );
    return { equities: r.rows };
  });

  app.post('/equity-details', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = getToken(req);
    const b = postBody(req);
    if (!b.akun_id) return reply.status(400).send({ error: 'akun_id wajib' });
    if (!b.tahun_penerimaan) return reply.status(400).send({ error: 'tahun_penerimaan wajib' });
    const tahun = parseInt(b.tahun_penerimaan, 10);
    if (isNaN(tahun) || tahun < 2000 || tahun > 2100)
      return reply.status(400).send({ error: 'tahun_penerimaan tidak valid (2000-2100)' });
    if (!['Pemerintah Desa', 'Masyarakat', 'Lainnya'].includes(b.sumber || 'Lainnya'))
      return reply.status(400).send({ error: 'sumber harus Pemerintah Desa, Masyarakat, atau Lainnya' });
    const r = await pool.query(
      `INSERT INTO equity_details (tenant_id, sumber, tahun_penerimaan, keterangan, akun_id, saldo_awal)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, sumber, tahun_penerimaan AS "tahunPenerimaan", saldo_awal AS "saldoAwal"`,
      [a.tenantId, b.sumber || 'Lainnya', tahun, b.keterangan || '', b.akun_id, b.saldo_awal || 0]
    );
    return reply.code(201).send({ equity: r.rows[0] });
  });

  app.put('/equity-details/:id', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = getToken(req);
    const { id } = req.params as { id: string };
    const b = postBody(req);
    const cek = await pool.query('SELECT id FROM equity_details WHERE id=$1 AND tenant_id=$2', [id, a.tenantId]);
    if (!cek.rowCount) return reply.status(404).send({ error: 'Rincian modal tidak ditemukan' });
    const tahun = parseInt(b.tahun_penerimaan, 10);
    if (isNaN(tahun) || tahun < 2000 || tahun > 2100)
      return reply.status(400).send({ error: 'tahun_penerimaan tidak valid (2000-2100)' });
    if (!['Pemerintah Desa', 'Masyarakat', 'Lainnya'].includes(b.sumber || 'Lainnya'))
      return reply.status(400).send({ error: 'sumber harus Pemerintah Desa, Masyarakat, atau Lainnya' });
    const r = await pool.query(
      `UPDATE equity_details SET sumber=$1, tahun_penerimaan=$2, keterangan=$3, akun_id=$4,
        saldo_awal=$5, updated_at=now()
       WHERE id=$6 AND tenant_id=$7
       RETURNING id, sumber, tahun_penerimaan AS "tahunPenerimaan", saldo_awal AS "saldoAwal"`,
      [b.sumber || 'Lainnya', tahun, b.keterangan || '', b.akun_id, b.saldo_awal || 0, id, a.tenantId]
    );
    return { equity: r.rows[0] };
  });

  app.delete('/equity-details/:id', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = getToken(req);
    const { id } = req.params as { id: string };
    const cek = await pool.query('SELECT id FROM equity_details WHERE id=$1 AND tenant_id=$2', [id, a.tenantId]);
    if (!cek.rowCount) return reply.status(404).send({ error: 'Rincian modal tidak ditemukan' });
    await pool.query('DELETE FROM equity_details WHERE id=$1', [id]);
    return { success: true };
  });

  // ─── RECONCILIATION ───────────────────────────────────────────
  app.get('/rincian-saldo/reconciliation', tenantGuard, async (req: FastifyRequest) => {
    const a = getToken(req);

    // 1. Collect ALL accounts that have subledger data (inventory, contacts, assets, equity)
    const subledgerAccounts = new Map<string, { kode: string; nama: string; label: string; rincianValue: number; detailCount: number }>();

    for (const entry of SUBLEDGER_MAP) {
      // First, find all CoA accounts matching the prefixes
      const prefixConditions = entry.prefixes.map((p, i) => `c.kode LIKE $${i + 2}`).join(' OR ');
      const prefixParams = entry.prefixes.map(p => p + '%');
      
      const coaSql = `SELECT c.id FROM chart_of_accounts c WHERE c.tenant_id = $1 AND c.isactive = true AND (${prefixConditions})`;
      const coaRes = await pool.query(coaSql, [a.tenantId, ...prefixParams]);
      const matchingAkunIds = coaRes.rows.map((r: any) => r.id);
      
      if (matchingAkunIds.length === 0) continue;
      
      // For Akum. Penyusutan (1.3.07.x): sum akumulasi_penyusutan from ALL fixed_assets
      // because harga_perolehan and akumulasi_penyusutan are stored in the same row
      // but linked to different CoA accounts (aset tetap vs akum penyusutan)
      const isAkumPenyusutan = entry.prefixes.some(p => p.startsWith('1.3.07'));
      
      let sql: string;
      let params: any[];
      
      if (isAkumPenyusutan && entry.table === 'fixed_assets') {
        // Sum akumulasi_penyusutan from ALL fixed_assets for this tenant
        sql = `SELECT $2::uuid AS akun_id, COALESCE(SUM(${entry.field}), 0) AS total, COUNT(*) AS cnt
               FROM ${entry.table}
               WHERE tenant_id=$1`;
        params = [a.tenantId, matchingAkunIds[0]]; // Use first matching akun_id as placeholder
      } else {
        // Normal: sum from fixed_assets WHERE akun_id matches
        sql = `SELECT akun_id, COALESCE(SUM(${entry.field}), 0) AS total, COUNT(*) AS cnt
               FROM ${entry.table}
               WHERE tenant_id=$1 AND akun_id = ANY($2)`;
        params = [a.tenantId, matchingAkunIds];
        if (entry.where) {
          sql += ` AND ${entry.where}`;
        }
        sql += ' GROUP BY akun_id';
      }
      
      const sumRes = await pool.query(sql, params);

      for (const row of sumRes.rows as any[]) {
        const existing = subledgerAccounts.get(row.akun_id);
        if (existing) {
          existing.rincianValue += Number(row.total);
          existing.detailCount += Number(row.cnt);
        } else {
          subledgerAccounts.set(row.akun_id, {
            kode: '', nama: '', label: entry.label,
            rincianValue: Number(row.total), detailCount: Number(row.cnt),
          });
        }
      }
    }

    if (subledgerAccounts.size === 0) return { accounts: [] };

    // 2. Get CoA info for these accounts
    const akunIds = [...subledgerAccounts.keys()];
    const coaRes = await pool.query(
      `SELECT id, kode, nama FROM chart_of_accounts WHERE id = ANY($1)`,
      [akunIds]
    );
    for (const coa of coaRes.rows as any[]) {
      const entry = subledgerAccounts.get(coa.id);
      if (entry) { entry.kode = coa.kode; entry.nama = coa.nama; }
    }

    // 3. Get balance from OPENING_BALANCE journal entries ONLY
    // This ensures Recon Badge validates Saldo Awal cut-off, not operational transactions
    const balanceRes = await pool.query(
      `SELECT jl.akun_id,
              COALESCE(SUM(jl.debit), 0) AS total_debit,
              COALESCE(SUM(jl.kredit), 0) AS total_kredit
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.entry_id
       WHERE je.tenant_id = $1 AND jl.akun_id = ANY($2)
         AND je.tipetransaksi = 'OPENING_BALANCE'
       GROUP BY jl.akun_id`,
      [a.tenantId, akunIds]
    );

    const balanceMap = new Map<string, { debit: number; kredit: number }>();
    for (const row of balanceRes.rows as any[]) {
      balanceMap.set(row.akun_id, { debit: Number(row.total_debit), kredit: Number(row.total_kredit) });
    }

    // 4. Build reconciliation results
    const results: any[] = [];
    for (const [akunId, info] of subledgerAccounts) {
      const bal = balanceMap.get(akunId);
      // For subledger comparison, use the balance side that matches saldo normal
      // Assets (1.x) = debit side, Liabilities (2.x)/Equity (3.x) = kredit side
      // EXCEPTION: Contra-asset (1.3.07.x Akum. Penyusutan) = kredit side (normal balance kredit)
      const isContraAsset = info.kode.startsWith('1.3.07');
      let globalValue = 0;
      if (bal) {
        if (isContraAsset) {
          // Contra-asset: normal balance = kredit, so use kredit - debit
          globalValue = bal.kredit - bal.debit;
        } else {
          // Normal: assets=debit, liabilities/equity=kredit
          globalValue = info.kode.charAt(0) === '1' ? bal.debit - bal.kredit : bal.kredit - bal.debit;
        }
      }
      const selisih = globalValue - info.rincianValue;
      results.push({
        akunId,
        kode: info.kode,
        namaAkun: info.nama,
        subledgerType: info.label,
        globalValue,
        rincianValue: info.rincianValue,
        selisih,
        detailCount: info.detailCount,
        status: Math.abs(selisih) < 1 ? 'MATCHED' : 'UNMATCHED',
      });
    }

    results.sort((a: any, b: any) => a.kode.localeCompare(b.kode));
    return { accounts: results };
  });

  // ─── BUKU PEMBANTU (Subsidiary Ledger) ───────────────────────
  // GET /buku-pembantu/utang — Utang per supplier
  app.get('/buku-pembantu/utang', tenantGuard, async (req: FastifyRequest) => {
    const a = getToken(req);
    const q = req.query as any;
    const contactId = q.contact_id || null;
    const startDate = q.start_date || null;
    const endDate = q.end_date || null;

    // Get all suppliers
    const contactsRes = await pool.query(
      `SELECT c.id, c.nama, c.telepon, c.alamat, c.saldo_awal AS "saldoAwal", c.saldo_awal_tipe AS "saldoAwalTipe",
              coa.id AS "akunId", coa.kode AS "akunKode", coa.nama AS "akunNama"
       FROM contacts c
       JOIN chart_of_accounts coa ON coa.id = c.akun_id
       WHERE c.tenant_id=$1 AND c.tipe='supplier'
       ORDER BY c.nama`,
      [a.tenantId]
    );

    const results: any[] = [];
    for (const contact of contactsRes.rows as any[]) {
      if (contactId && contact.id !== contactId) continue;

      // Get journal lines for this contact
      let lineSql = `
        SELECT je.tanggal, je.no_jurnal AS "noJurnal", je.keterangan AS "entryKeterangan",
               je.referensi, je.tipetransaksi AS "tipeTransaksi",
               jl.debit, jl.kredit, jl.keterangan AS "lineKeterangan"
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entry_id
        WHERE je.tenant_id=$1 AND jl.contact_id=$2`;
      const lineParams: any[] = [a.tenantId, contact.id];
      let paramIdx = 3;
      if (startDate) { lineSql += ` AND je.tanggal >= $${paramIdx++}`; lineParams.push(startDate); }
      if (endDate) { lineSql += ` AND je.tanggal <= $${paramIdx++}`; lineParams.push(endDate); }
      lineSql += ' ORDER BY je.tanggal, je.created_at';

      const linesRes = await pool.query(lineSql, lineParams);

      // Calculate running balance
      const saldoAwal = Number(contact.saldoAwal);
      const isDebitNormal = contact.saldoAwalTipe === 'debit';
      let running = isDebitNormal ? saldoAwal : -saldoAwal;
      const transactions = linesRes.rows.map((l: any) => {
        running += Number(l.debit) - Number(l.kredit);
        return {
          tanggal: l.tanggal,
          noJurnal: l.noJurnal,
          keterangan: l.lineKeterangan || l.entryKeterangan,
          referensi: l.referensi,
          tipeTransaksi: l.tipeTransaksi,
          debit: Number(l.debit),
          kredit: Number(l.kredit),
          saldo: running,
        };
      });

      results.push({
        contactId: contact.id,
        nama: contact.nama,
        telepon: contact.telepon,
        alamat: contact.alamat,
        akunKode: contact.akunKode,
        akunNama: contact.akunNama,
        saldoAwal,
        saldoAkhir: running,
        transactions,
      });
    }

    return { data: results };
  });

  // GET /buku-pembantu/piutang — Piutang per pelanggan
  app.get('/buku-pembantu/piutang', tenantGuard, async (req: FastifyRequest) => {
    const a = getToken(req);
    const q = req.query as any;
    const contactId = q.contact_id || null;
    const startDate = q.start_date || null;
    const endDate = q.end_date || null;

    const contactsRes = await pool.query(
      `SELECT c.id, c.nama, c.telepon, c.alamat, c.saldo_awal AS "saldoAwal", c.saldo_awal_tipe AS "saldoAwalTipe",
              coa.id AS "akunId", coa.kode AS "akunKode", coa.nama AS "akunNama"
       FROM contacts c
       JOIN chart_of_accounts coa ON coa.id = c.akun_id
       WHERE c.tenant_id=$1 AND c.tipe='pelanggan'
       ORDER BY c.nama`,
      [a.tenantId]
    );

    const results: any[] = [];
    for (const contact of contactsRes.rows as any[]) {
      if (contactId && contact.id !== contactId) continue;

      let lineSql = `
        SELECT je.tanggal, je.no_jurnal AS "noJurnal", je.keterangan AS "entryKeterangan",
               je.referensi, je.tipetransaksi AS "tipeTransaksi",
               jl.debit, jl.kredit, jl.keterangan AS "lineKeterangan"
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entry_id
        WHERE je.tenant_id=$1 AND jl.contact_id=$2`;
      const lineParams: any[] = [a.tenantId, contact.id];
      let paramIdx = 3;
      if (startDate) { lineSql += ` AND je.tanggal >= $${paramIdx++}`; lineParams.push(startDate); }
      if (endDate) { lineSql += ` AND je.tanggal <= $${paramIdx++}`; lineParams.push(endDate); }
      lineSql += ' ORDER BY je.tanggal, je.created_at';

      const linesRes = await pool.query(lineSql, lineParams);

      const saldoAwal = Number(contact.saldoAwal);
      let running = saldoAwal; // Piutang = debit normal
      const transactions = linesRes.rows.map((l: any) => {
        running += Number(l.debit) - Number(l.kredit);
        return {
          tanggal: l.tanggal,
          noJurnal: l.noJurnal,
          keterangan: l.lineKeterangan || l.entryKeterangan,
          referensi: l.referensi,
          tipeTransaksi: l.tipeTransaksi,
          debit: Number(l.debit),
          kredit: Number(l.kredit),
          saldo: running,
        };
      });

      results.push({
        contactId: contact.id,
        nama: contact.nama,
        telepon: contact.telepon,
        alamat: contact.alamat,
        akunKode: contact.akunKode,
        akunNama: contact.akunNama,
        saldoAwal,
        saldoAkhir: running,
        transactions,
      });
    }

    return { data: results };
  });

  // GET /buku-pembantu/persediaan — Persediaan per item
  app.get('/buku-pembantu/persediaan', tenantGuard, async (req: FastifyRequest) => {
    const a = getToken(req);
    const q = req.query as any;
    const itemId = q.item_id || null;
    const startDate = q.start_date || null;
    const endDate = q.end_date || null;

    const itemsRes = await pool.query(
      `SELECT i.id, i.nama, i.kode, i.satuan, i.qty_awal AS "qtyAwal", i.harga_satuan AS "hargaSatuan",
              i.saldo_awal AS "saldoAwal",
              coa.id AS "akunId", coa.kode AS "akunKode", coa.nama AS "akunNama"
       FROM inventory_items i
       JOIN chart_of_accounts coa ON coa.id = i.akun_id
       WHERE i.tenant_id=$1
       ORDER BY i.nama`,
      [a.tenantId]
    );

    const results: any[] = [];
    for (const item of itemsRes.rows as any[]) {
      if (itemId && item.id !== itemId) continue;

      let lineSql = `
        SELECT je.tanggal, je.no_jurnal AS "noJurnal", je.keterangan AS "entryKeterangan",
               je.referensi, je.tipetransaksi AS "tipeTransaksi",
               jl.debit, jl.kredit, jl.keterangan AS "lineKeterangan", jl.qty
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entry_id
        WHERE je.tenant_id=$1 AND jl.inventory_item_id=$2`;
      const lineParams: any[] = [a.tenantId, item.id];
      let paramIdx = 3;
      if (startDate) { lineSql += ` AND je.tanggal >= $${paramIdx++}`; lineParams.push(startDate); }
      if (endDate) { lineSql += ` AND je.tanggal <= $${paramIdx++}`; lineParams.push(endDate); }
      lineSql += ' ORDER BY je.tanggal, je.created_at';

      const linesRes = await pool.query(lineSql, lineParams);

      const saldoAwal = Number(item.saldoAwal);
      const qtyAwal = Number(item.qtyAwal);
      let running = saldoAwal; // Persediaan = debit normal
      let qtyRunning = qtyAwal; // Running quantity
      const transactions = linesRes.rows.map((l: any) => {
        const debit = Number(l.debit);
        const kredit = Number(l.kredit);
        const lineQty = l.qty ? Number(l.qty) : 0;
        running += debit - kredit;
        // Debit = barang masuk (qty +), Kredit = barang keluar (qty -)
        if (debit > 0) qtyRunning += lineQty;
        else if (kredit > 0) qtyRunning -= lineQty;
        return {
          tanggal: l.tanggal,
          noJurnal: l.noJurnal,
          keterangan: l.lineKeterangan || l.entryKeterangan,
          referensi: l.referensi,
          tipeTransaksi: l.tipeTransaksi,
          debit,
          kredit,
          qty: lineQty,
          qtyMasuk: debit > 0 ? lineQty : 0,
          qtyKeluar: kredit > 0 ? lineQty : 0,
          saldo: running,
          qtySaldo: qtyRunning,
        };
      });

      results.push({
        itemId: item.id,
        nama: item.nama,
        kode: item.kode,
        satuan: item.satuan,
        qtyAwal: Number(item.qtyAwal),
        hargaSatuan: Number(item.hargaSatuan),
        akunKode: item.akunKode,
        akunNama: item.akunNama,
        saldoAwal,
        saldoAkhir: running,
        qtyAkhir: qtyRunning,
        transactions,
      });
    }

    return { data: results };
  });

  // ─── LOCAL HELPERS ────────────────────────────────────────────
  async function checkPeriodLockLocal(tenantId: string, tahun: number): Promise<void> {
    const p = await pool.query(
      'SELECT id, status FROM financial_periods WHERE tenant_id=$1 AND tahun=$2 LIMIT 1',
      [tenantId, tahun]
    );
    if (p.rows.length && (p.rows[0] as any).status === 'CLOSED') {
      throw Object.assign(
        new Error(`Periode ${tahun} sudah ditutup. Tidak dapat mengubah data di periode ini.`),
        { statusCode: 403 }
      );
    }
  }

  // ─── PERSEDIAAN — Journal Linking ────────────────────────────
  // GET /persediaan/journal-candidates — find unlinked inventory journal lines
  app.get('/persediaan/journal-candidates', tenantGuard, async (req: FastifyRequest) => {
    const a = getToken(req);
    const r = await pool.query(
      `SELECT je.id AS "entryId", je.no_jurnal AS "noJurnal", je.tanggal,
              je.keterangan, je.tipetransaksi AS "tipeTransaksi",
              jl.id AS "lineId",
              c.kode AS "akunKode", c.nama AS "akunNama",
              jl.debit, jl.kredit, jl.qty,
              CASE WHEN jl.debit > 0 THEN true ELSE false END AS "isMasuk"
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.entry_id
       JOIN chart_of_accounts c ON c.id = jl.akun_id AND c.tenant_id = je.tenant_id
       WHERE je.tenant_id = $1
         AND je.isposted = true
         AND c.kode LIKE '1.1.05.%'
         AND c.ispostable = true
         AND (jl.debit > 0 OR jl.kredit > 0)
         AND jl.inventory_item_id IS NULL
         AND (jl.qty IS NULL OR jl.qty = 0)
         AND COALESCE(je.tipetransaksi, '') NOT IN ('OPENING_BALANCE', 'CLOSING')
       ORDER BY je.tanggal, je.no_jurnal`,
      [a.tenantId]
    );
    return { candidates: r.rows };
  });

  // POST /persediaan/link-journal-line — link a journal line to inventory
  // Safety: this ONLY updates inventory_item_id + qty — never touches debit/kredit/akun
  app.post('/persediaan/link-journal-line', mutationGuard, async (req: FastifyRequest, reply: FastifyReply) => {
    const a = getToken(req);
    const b = postBody(req);
    const journalLineId = b.journal_line_id as string;

    // ── 1. Validate basic fields ──────────────────────────────
    if (!journalLineId) return reply.status(400).send({ error: 'journal_line_id wajib' });

    const qtyNum = Number(b.qty);
    if (!qtyNum || qtyNum <= 0 || !Number.isFinite(qtyNum)) {
      return reply.status(400).send({ error: 'qty harus > 0' });
    }
    const qtyStr = String(qtyNum);

    const mode = b.mode as string;
    if (!['select', 'create'].includes(mode)) {
      return reply.status(400).send({ error: 'mode harus select atau create' });
    }

    // ── 2. Determine item_id ──────────────────────────────────
    let inventoryItemId = b.inventory_item_id as string | null;

    if (mode === 'create') {
      // Stok masuk only — user can create new item from purchase journal
    } else {
      // mode === 'select'
      if (!inventoryItemId) return reply.status(400).send({ error: 'inventory_item_id wajib untuk mode select' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // ── 3. Lock journal_line FOR UPDATE and validate ────────
      const lineRes = await client.query(
        `SELECT jl.id, jl.entry_id, jl.akun_id, jl.debit, jl.kredit,
                jl.inventory_item_id, jl.qty,
                je.tenant_id, je.isposted, je.tanggal, je.tahun, je.bulan,
                je.tipetransaksi,
                c.kode AS akun_kode, c.ispostable
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
         JOIN chart_of_accounts c ON c.id = jl.akun_id AND c.tenant_id = je.tenant_id
         WHERE jl.id = $1
         FOR UPDATE OF jl`,
        [journalLineId]
      );
      if (!lineRes.rowCount) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Baris jurnal tidak ditemukan' });
      }
      const line = lineRes.rows[0];

      // ── 4. Tenant ownership ──────────────────────────────────
      if (line.tenant_id !== a.tenantId) {
        await client.query('ROLLBACK');
        return reply.status(403).send({ error: 'Akses ditolak' });
      }

      // ── 5. Must be posted ────────────────────────────────────
      if (!line.isposted) {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Jurnal belum diposting' });
      }

      // ── 6. Must be inventory account (1.1.05.x) ──────────────
      if (!line.akun_kode.startsWith('1.1.05.') || !line.ispostable) {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Baris jurnal bukan akun persediaan yang dapat diposting' });
      }

      // ── 7. Must not already be linked ─────────────────────────
      if (line.inventory_item_id) {
        await client.query('ROLLBACK');
        return reply.status(409).send({ error: 'Baris jurnal ini sudah terhubung ke stok' });
      }
      if (line.qty && Number(line.qty) > 0) {
        await client.query('ROLLBACK');
        return reply.status(409).send({ error: 'Baris jurnal ini sudah memiliki qty' });
      }

      // ── 8. Must have amount (debit > 0 or kredit > 0) ──────
      const debitAmt = Number(line.debit) || 0;
      const kreditAmt = Number(line.kredit) || 0;
      const isMasuk = debitAmt > 0;
      const nilaiTotal = Math.max(debitAmt, kreditAmt);
      if (nilaiTotal <= 0) {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Baris jurnal tidak memiliki nominal' });
      }

      // ── 9. Period lock check ──────────────────────────────────
      const tahun = Number(line.tahun);
      if (tahun > 0) {
        await checkPeriodLockLocal(a.tenantId!, tahun);
      }

      // ── 10. Mode: select vs create ───────────────────────────
      // Stok KELUAR (kredit > 0): ONLY select mode — no create allowed
      if (!isMasuk && mode === 'create') {
        await client.query('ROLLBACK');
        return reply.status(400).send({
          error: 'Stok keluar (kredit) tidak boleh membuat item baru. Pilih item existing atau hubungkan pembelian terlebih dahulu.'
        });
      }

      if (mode === 'select') {
        // Verify item exists and belongs to tenant
        const itemRes = await client.query(
          `SELECT id, nama, akun_id FROM inventory_items WHERE id=$1 AND tenant_id=$2`,
          [inventoryItemId, a.tenantId]
        );
        if (!itemRes.rowCount) {
          await client.query('ROLLBACK');
          return reply.status(404).send({ error: 'Item persediaan tidak ditemukan' });
        }
        const item = itemRes.rows[0];

        // Akun must match between item and journal line
        if (item.akun_id !== line.akun_id) {
          await client.query('ROLLBACK');
          return reply.status(400).send({
            error: `Akun item "${item.nama}" (${item.akun_id}) tidak cocok dengan akun jurnal. Hanya item dengan akun yang sama dapat dipilih.`
          });
        }
      }

      // ── 11. Stock check for stok KELUAR ──────────────────────
      if (!isMasuk && mode === 'select') {
        const stockRes = await client.query(
          `SELECT COALESCE(SUM(CASE WHEN jl2.debit > 0 THEN jl2.qty ELSE 0 END), 0) -
                  COALESCE(SUM(CASE WHEN jl2.kredit > 0 THEN jl2.qty ELSE 0 END), 0) AS stok
           FROM journal_lines jl2
           JOIN journal_entries je2 ON jl2.entry_id = je2.id AND je2.isposted = true AND je2.tenant_id = $2
           WHERE jl2.inventory_item_id = $1`,
          [inventoryItemId, a.tenantId]
        );
        const stokTersedia = Number(stockRes.rows[0]?.stok) || 0;
        if (qtyNum > stokTersedia) {
          await client.query('ROLLBACK');
          return reply.status(400).send({
            error: `Stok tidak mencukupi. Tersedia: ${stokTersedia.toLocaleString('id-ID')}, diminta: ${qtyNum.toLocaleString('id-ID')}. Hubungkan pembelian terlebih dahulu.`
          });
        }
      }

      // ── 12. Mode 'create': insert new inventory item ─────────
      if (mode === 'create') {
        const nama = (b.nama as string || '').trim();
        if (!nama) {
          await client.query('ROLLBACK');
          return reply.status(400).send({ error: 'Nama barang wajib diisi untuk membuat item baru' });
        }
        const kode = (b.kode as string || '').trim();
        const satuan = (b.satuan as string || '').trim();

        const hargaSatuanCreate = nilaiTotal / qtyNum;
        const newItemRes = await client.query(
          `INSERT INTO inventory_items (tenant_id, nama, kode, satuan, akun_id, qty_awal, harga_satuan, saldo_awal)
           VALUES ($1, $2, $3, $4, $5, 0, $6, 0)
           RETURNING id, nama, kode, satuan`,
          [a.tenantId, nama, kode || null, satuan || null, line.akun_id, String(hargaSatuanCreate)]
        );
        inventoryItemId = newItemRes.rows[0].id;
      }

      // ── 13. Calculate harga_satuan (for response) ────────────
      const hargaSatuan = nilaiTotal / qtyNum;

      // ── 14. UPDATE journal_lines — ONLY metadata columns ────
      await client.query(
        `UPDATE journal_lines SET inventory_item_id = $1, qty = $2 WHERE id = $3`,
        [inventoryItemId, qtyStr, journalLineId]
      );

      await client.query('COMMIT');

      return {
        success: true,
        lineId: journalLineId,
        inventoryItemId,
        qty: qtyNum,
        hargaSatuan,
        nilaiTotal,
        isMasuk,
        keterangan: isMasuk ? 'Stok masuk dari jurnal pembelian' : 'Stok keluar dari jurnal penjualan',
      };
    } catch (e: any) {
      await client.query('ROLLBACK');
      if (e.statusCode) {
        return reply.status(e.statusCode).send({ error: e.message });
      }
      throw e;
    } finally {
      client.release();
    }
  });
}
