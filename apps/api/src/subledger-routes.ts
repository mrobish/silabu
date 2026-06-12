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
    table: 'fixed_assets', field: 'harga_perolehan', label: 'Aset Tetap' },
  // Akumulasi Penyusutan (1.3.07.x) = Akumulasi Penyusutan (kredit, contra-aset)
  { prefixes: ['1.3.07'], table: 'fixed_assets', field: 'akumulasi_penyusutan', label: 'Akum. Penyusutan' },
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
        harga_perolehan, akumulasi_penyusutan, nilai_buku_awal, umur_manfaat_bulan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
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
        harga_perolehan=$5, akumulasi_penyusutan=$6, nilai_buku_awal=$7, umur_manfaat_bulan=$8, updated_at=now()
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

    // 3. Get current balance from ALL journal lines (not just opening balance)
    // globalValue = SUM(debit) - SUM(kredit) per akun → then take absolute as "balance"
    const balanceRes = await pool.query(
      `SELECT jl.akun_id,
              COALESCE(SUM(jl.debit), 0) AS total_debit,
              COALESCE(SUM(jl.kredit), 0) AS total_kredit
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.entry_id
       WHERE je.tenant_id = $1 AND jl.akun_id = ANY($2)
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
      const kodePrefix = info.kode.charAt(0);
      let globalValue = 0;
      if (bal) {
        // net balance = debit - kredit; for assets positive=debit, for liabilities/equity positive=kredit
        globalValue = kodePrefix === '1' ? bal.debit - bal.kredit : bal.kredit - bal.debit;
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
}
