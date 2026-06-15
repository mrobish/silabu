import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { requireRole } from './guards.js';
import { JWT_SECRET } from './config.js';

const requireSuperAdmin = requireRole('super_admin');

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireSuperAdmin);

  // GET /stats — dashboard stats
  app.get('/stats', async () => {
    const [users, tenants, recent] = await Promise.all([
      pool.query("SELECT COUNT(*) as total, COUNT(CASE WHEN role='bumdes' THEN 1 END) as bumdes, COUNT(CASE WHEN role='bumdes' AND last_login_at > now()-interval '7 days' THEN 1 END) as active_7d, COUNT(CASE WHEN role='bumdes' AND created_at > now()-interval '7 days' THEN 1 END) as new_7d FROM users"),
      pool.query("SELECT COUNT(*) as total, COUNT(CASE WHEN subscription_status='trial' THEN 1 END) as trial, COUNT(CASE WHEN subscription_status='active' THEN 1 END) as active, COUNT(CASE WHEN subscription_status='trial' AND trial_ends_at < now() THEN 1 END) as expired FROM tenants"),
      pool.query("SELECT id, email, nama_lengkap, role, auth_provider, is_active, last_login_at, created_at FROM users ORDER BY created_at DESC LIMIT 5"),
    ]);
    return {
      total_users: Number(users.rows[0].total),
      bumdes_users: Number(users.rows[0].bumdes),
      active_7d: Number(users.rows[0].active_7d),
      new_7d: Number(users.rows[0].new_7d),
      trial_tenants: Number(tenants.rows[0].trial),
      active_tenants: Number(tenants.rows[0].active),
      expired_tenants: Number(tenants.rows[0].expired),
      revenue: 0, // Phase 2: from payments table
      recent_users: recent.rows,
    };
  });

  // GET /users — list all users with tenant info
  app.get('/users', async () => {
    const { rows } = await pool.query(`
      SELECT u.id, u.email, u.nama_lengkap, u.role, u.auth_provider, u.is_active,
             u.last_login_at, u.created_at, u.tenant_id,
             t.nama_bumdes, t.provinsi, t.kabupaten, t.desa,
             t.subscription_status, t.trial_ends_at, t.subscription_ends_at
      FROM users u
      LEFT JOIN tenants t ON t.id = u.tenant_id
      ORDER BY u.created_at DESC
    `);
    return { users: rows };
  });

  // DELETE /users/:id — hard delete user + tenant + all tenant-owned data
  app.delete('/users/:id', async (req: FastifyRequest) => {
    const { id } = req.params as { id: string };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userRes = await client.query(
        'SELECT id, role, tenant_id FROM users WHERE id=$1 FOR UPDATE',
        [id]
      );
      const user = userRes.rows[0];
      if (!user) {
        await client.query('ROLLBACK');
        return { error: 'User tidak ditemukan' };
      }
      if (user.role === 'super_admin') {
        const currentAdminId = (req as any).auth?.userId;
        if (currentAdminId) {
          await client.query('ROLLBACK');
          return { error: 'Super Admin tidak bisa menghapus akun Super Admin lain' };
        }
        await client.query('ROLLBACK');
        return { error: 'Akun super admin tidak boleh dihapus dari menu ini' };
      }

      const tenantId = user.tenant_id;

      // Current Phase 0 tables only. Future tenant-owned tables must be deleted here first:
      // transactions, journal_entries, journal_lines, accounts, opening_balances, reports, payments, etc.
      if (tenantId) {
        await client.query('DELETE FROM tenants WHERE id=$1', [tenantId]);
      }

      // Cleanup by user id. sessions + verification_tokens also cascade, but explicit is clearer.
      await client.query('DELETE FROM sessions WHERE user_id=$1', [id]);
      await client.query('DELETE FROM verification_tokens WHERE user_id=$1 OR email=(SELECT email FROM users WHERE id=$1)', [id]);
      await client.query('UPDATE audit_logs SET user_id=NULL WHERE user_id=$1', [id]);
      await client.query('DELETE FROM users WHERE id=$1', [id]);

      await client.query('COMMIT');
      return { success: true, deleted_user_id: id, deleted_tenant_id: tenantId };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return { error: e.message };
    } finally {
      client.release();
    }
  });

  // POST /users/:id/clear-data — clear tenant-owned operational data, keep account + profile
  app.post('/users/:id/clear-data', async (req: FastifyRequest) => {
    const { id } = req.params as { id: string };
    const tenantRes = await pool.query('SELECT tenant_id FROM users WHERE id=$1', [id]);
    const tenantId = tenantRes.rows[0]?.tenant_id;
    if (!tenantId) return { error: 'User tidak punya tenant' };
    // Phase 0 has no accounting/transaction tables yet.
    // Future: delete tenant-owned operational tables here, but keep users + tenants profile.
    return { success: true, message: 'Belum ada data transaksi untuk dibersihkan' };
  });

  // POST /tenants/:id/reset-transactions — reset all transactional data for a tenant
  // Scope: journal_entries, journal_lines, fixed_assets, financial_periods, equity_details
  // Safe: chart_of_accounts, users, tenants profile, contacts, payments stay intact
  app.post('/tenants/:id/reset-transactions', async (req: FastifyRequest) => {
    const { id } = req.params as { id: string };

    // Verify tenant exists
    const tRes = await pool.query('SELECT id, nama_bumdes FROM tenants WHERE id=$1', [id]);
    if (!tRes.rowCount) return { error: 'Tenant tidak ditemukan' };
    const tenantNama = tRes.rows[0].nama_bumdes;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete in FK-safe order (child tables first)
      await client.query('DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE tenant_id=$1)', [id]);
      await client.query('DELETE FROM journal_entries WHERE tenant_id=$1', [id]);
      await client.query('DELETE FROM fixed_assets WHERE tenant_id=$1', [id]);
      await client.query('DELETE FROM financial_periods WHERE tenant_id=$1', [id]);
      await client.query('DELETE FROM equity_details WHERE tenant_id=$1', [id]);
      await client.query('DELETE FROM inventory_items WHERE tenant_id=$1', [id]);

      // Reset CoA seeded accounts to clean state (keep structure, zero out)
      // CoA itself stays — this is the key safety guarantee

      await client.query('COMMIT');

      return {
        success: true,
        message: `Semua data transaksi tenant "${tenantNama}" berhasil di-reset. CoA, profil, dan akun user tetap aman.`,
        deleted: ['journal_lines', 'journal_entries', 'fixed_assets', 'financial_periods', 'equity_details', 'inventory_items'],
        preserved: ['chart_of_accounts', 'users', 'tenants', 'contacts', 'payments'],
      };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return { error: e.message };
    } finally {
      client.release();
    }
  });

  // POST /users/:id/deactivate — toggle user active
  app.post('/users/:id/deactivate', async (req: FastifyRequest) => {
    const { id } = req.params as { id: string };
    const { active } = (req.body as any) || {};
    await pool.query('UPDATE users SET is_active=$1, updated_at=now() WHERE id=$2', [active ?? false, id]);
    return { success: true };
  });

  // POST /tutup-buku/undo — Batal Tutup Buku (Super Admin only)
  app.post('/tutup-buku/undo', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    if (!body) return reply.code(400).send({ error: 'Body request kosong' });

    const { tenantId, tahun } = body;
    if (!tenantId) return reply.code(400).send({ error: 'tenantId wajib diisi' });
    if (!tahun || tahun < 2000 || tahun > 2099) return reply.code(400).send({ error: 'Tahun tidak valid' });

    // Verify period is CLOSED
    const period = await pool.query(
      `SELECT id, status FROM financial_periods WHERE tenant_id=$1 AND tahun=$2 LIMIT 1`,
      [tenantId, tahun]
    );
    if (!period.rows.length) return reply.code(404).send({ error: `Periode ${tahun} tidak ditemukan` });
    if ((period.rows[0] as any).status !== 'CLOSED') return reply.code(400).send({ error: `Periode ${tahun} belum ditutup (status: ${(period.rows[0] as any).status})` });

    // Check if next year has transactions (safety)
    const nextYearTx = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM journal_entries WHERE tenant_id=$1 AND tahun=$2 AND tipetransaksi <> 'CLOSING'`,
      [tenantId, tahun + 1]
    );
    if ((nextYearTx.rows[0] as any).cnt > 0) {
      return reply.code(400).send({
        error: `Tahun ${tahun + 1} sudah memiliki ${(nextYearTx.rows[0] as any).cnt} transaksi. Undo closing tidak aman karena akan menyebabkan inkonsistensi saldo. Hubungi tim teknis.`,
        code: 'NEXT_YEAR_HAS_DATA'
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Delete closing journal CL-{year}1231 (cascade deletes journal_lines)
      const noJurnal = `CL-${tahun}1231`;
      const delResult = await client.query(
        `DELETE FROM journal_entries WHERE tenant_id=$1 AND no_jurnal=$2 AND tipetransaksi='CLOSING'`,
        [tenantId, noJurnal]
      );

      // 2. Revert period to OPEN
      await client.query(
        `UPDATE financial_periods SET status='OPEN', closed_at=NULL, closed_by=NULL WHERE tenant_id=$1 AND tahun=$2`,
        [tenantId, tahun]
      );

      // 3. Remove auto-created next year if it has no transactions
      await client.query(
        `DELETE FROM financial_periods WHERE tenant_id=$1 AND tahun=$2 AND status='OPEN'
         AND NOT EXISTS (SELECT 1 FROM journal_entries WHERE tenant_id=$1 AND tahun=$2)`,
        [tenantId, tahun + 1]
      );

      await client.query('COMMIT');
      return {
        success: true,
        tahun,
        noJurnal,
        journalsDeleted: delResult.rowCount,
        message: `Tutup Buku ${tahun} berhasil dibatalkan. Jurnal ${noJurnal} dihapus, periode kembali OPEN.`,
      };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ─── Impersonate: Login As User ──────────────────────────────────
  // POST /admin/users/:id/impersonate — generate temporary token as that user
  app.post('/users/:id/impersonate', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const userRes = await pool.query(
      `SELECT u.id, u.email, u.nama_lengkap, u.role, u.tenant_id,
              t.nama_bumdes
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [id]
    );
    if (!userRes.rowCount) return reply.code(404).send({ error: 'User tidak ditemukan' });
    const user = userRes.rows[0] as any;
    if (!user.tenant_id) return reply.code(400).send({ error: 'User ini tidak punya tenant' });

     const adminAuth = (req as any).auth;

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
        impersonatedBy: adminAuth.userId,
        impersonatedByName: 'Super Admin',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        nama_lengkap: user.nama_lengkap,
        role: user.role,
        tenantId: user.tenant_id,
        nama_bumdes: user.nama_bumdes,
      },
    };
  });

  // ─── Manual Subscription Override ────────────────────────────────
  // PUT /admin/users/:id/subscription — manual subscription status override
  app.put('/users/:id/subscription', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    if (!body) return reply.code(400).send({ error: 'Body request kosong' });

    const userRes = await pool.query('SELECT tenant_id FROM users WHERE id=$1', [id]);
    if (!userRes.rowCount || !(userRes.rows[0] as any).tenant_id) {
      return reply.code(404).send({ error: 'User atau tenant tidak ditemukan' });
    }
    const tenantId = (userRes.rows[0] as any).tenant_id;

    const { subscription_status, subscription_ends_at, trial_ends_at } = body;
    const updates: string[] = [];
    const params: any[] = [tenantId];
    let idx = 2;

    if (subscription_status) {
      updates.push(`subscription_status = $${idx++}`);
      params.push(subscription_status);
    }
    if (subscription_ends_at !== undefined) {
      updates.push(`subscription_ends_at = $${idx++}`);
      params.push(subscription_ends_at ? new Date(subscription_ends_at) : null);
    }
    if (trial_ends_at !== undefined) {
      updates.push(`trial_ends_at = $${idx++}`);
      params.push(trial_ends_at ? new Date(trial_ends_at) : null);
    }

    if (!updates.length) return reply.code(400).send({ error: 'Tidak ada perubahan' });

    await pool.query(
      `UPDATE tenants SET ${updates.join(', ')}, updated_at = now() WHERE id = $1`,
      params
    );

    return { success: true, message: 'Langganan berhasil diperbarui' };
  });

  // ─── Broadcast / Announcements ───────────────────────────────────
  // GET /admin/announcements — list all announcements
  app.get('/announcements', async () => {
    const r = await pool.query(
      `SELECT id, message, type, active, created_at FROM announcements ORDER BY created_at DESC`
    );
    return { announcements: r.rows };
  });

  // POST /admin/announcements — create new announcement
  app.post('/announcements', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    if (!body?.message?.trim()) return reply.code(400).send({ error: 'Pesan wajib diisi' });
    const a = (req as any).auth;

    const r = await pool.query(
      `INSERT INTO announcements (message, type, active, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id, message, type, active, created_at`,
      [body.message.trim(), body.type || 'info', body.active !== false, a.userId]
    );
    return { announcement: r.rows[0], message: 'Pengumuman berhasil dibuat' };
  });

  // PUT /admin/announcements/:id — update announcement
  app.put('/announcements/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    if (!body) return reply.code(400).send({ error: 'Body request kosong' });

    const updates: string[] = [];
    const params: any[] = [id];
    let idx = 2;

    if (body.message !== undefined) { updates.push(`message = $${idx++}`); params.push(body.message); }
    if (body.type !== undefined) { updates.push(`type = $${idx++}`); params.push(body.type); }
    if (body.active !== undefined) { updates.push(`active = $${idx++}`); params.push(body.active); }

    if (!updates.length) return reply.code(400).send({ error: 'Tidak ada perubahan' });

    await pool.query(`UPDATE announcements SET ${updates.join(', ')} WHERE id = $1`, params);
    return { success: true, message: 'Pengumuman diperbarui' };
  });

  // DELETE /admin/announcements/:id — delete announcement
  app.delete('/announcements/:id', async (req: FastifyRequest) => {
    const { id } = req.params as { id: string };
    await pool.query('DELETE FROM announcements WHERE id = $1', [id]);
    return { success: true, message: 'Pengumuman dihapus' };
  });

  // PUT /profile — update current admin's email and/or password
  app.put('/profile', async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = (req as any).auth;
    const userId = auth.userId as string;
    const body = req.body as any;
    if (!body) return reply.code(400).send({ error: 'Body request kosong' });

    const { email, current_password, new_password } = body;

    // Fetch current user
    const userRes = await pool.query('SELECT id, email, password_hash FROM users WHERE id=$1', [userId]);
    if (!userRes.rowCount) return reply.code(404).send({ error: 'User tidak ditemukan' });
    const user = userRes.rows[0] as any;

    const updates: string[] = [];
    const params: any[] = [userId];
    let idx = 2;

    // Email update
    if (email && email !== user.email) {
      const dup = await pool.query('SELECT id FROM users WHERE email=$1 AND id != $2', [email, userId]);
      if (dup.rowCount) return reply.code(409).send({ error: 'Email sudah digunakan' });
      updates.push(`email = $${idx++}`);
      params.push(email);
    }

    // Password update
    if (new_password) {
      if (!current_password) return reply.code(400).send({ error: 'Password lama wajib diisi' });
      const valid = await bcrypt.compare(current_password, user.password_hash);
      if (!valid) return reply.code(400).send({ error: 'Password lama salah' });
      const hash = await bcrypt.hash(new_password, 10);
      updates.push(`password_hash = $${idx++}`);
      params.push(hash);
    }

    if (!updates.length) return reply.code(400).send({ error: 'Tidak ada perubahan' });

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at=now() WHERE id=$1 RETURNING id, email, nama_lengkap, role, auth_provider, is_active, created_at, updated_at`,
      params
    );
    return { success: true, user: result.rows[0], message: 'Profil berhasil diperbarui' };
  });

  // POST /admins — create a new super admin account
  app.post('/admins', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    if (!body) return reply.code(400).send({ error: 'Body request kosong' });
    const { email, password, nama_lengkap } = body;
    if (!email || !password || !nama_lengkap) {
      return reply.code(400).send({ error: 'Email, password, dan nama_lengkap wajib diisi' });
    }

    // Check email uniqueness
    const dup = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (dup.rowCount) return reply.code(409).send({ error: 'Email sudah terdaftar' });

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, nama_lengkap, role, auth_provider, is_active)
       VALUES ($1, $2, $3, 'super_admin', 'email', true)
       RETURNING id, email, nama_lengkap, role, auth_provider, is_active, created_at`,
      [email, hash, nama_lengkap]
    );
    return { success: true, user: result.rows[0], message: 'Super Admin berhasil dibuat' };
  });

  // ── Pricing Config (app_settings) ──────────────────────────
  const PRICING_KEY = 'pricing_config';
  const DEFAULT_PRICING = { monthly: 100000, yearly: 1000000, trialDays: 30, discountPercent: 17, currency: 'IDR', note: '' };

  // GET /admin/pricing — public read (no auth needed for display)
  app.get('/pricing', async () => {
    const r = await pool.query('SELECT value_encrypted FROM app_settings WHERE key=$1', [PRICING_KEY]);
    if (r.rowCount && r.rows[0].value_encrypted) {
      try { return JSON.parse(r.rows[0].value_encrypted); } catch {}
    }
    return DEFAULT_PRICING;
  });

  // PUT /admin/pricing — super admin only
  app.put('/pricing', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    if (!body) return reply.code(400).send({ error: 'Body kosong' });
    const config = { ...DEFAULT_PRICING, ...body };
    if (typeof config.monthly !== 'number' || config.monthly < 0) return reply.code(400).send({ error: 'Harga bulanan tidak valid' });
    config.yearly = Math.round(config.monthly * 12 * (1 - config.discountPercent / 100));
    await pool.query(
      `INSERT INTO app_settings (key, value_encrypted, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value_encrypted=$2, updated_at=NOW()`,
      [PRICING_KEY, JSON.stringify(config)]
    );
    return { success: true, config };
  });
}
