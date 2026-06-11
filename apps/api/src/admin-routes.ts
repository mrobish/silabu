import type { FastifyInstance, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'silabu-digi-secret-2026';

function verifyAdmin(req: FastifyRequest): { userId: string; role: string } | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const d = jwt.verify(auth.slice(7), JWT_SECRET) as any;
    if (d.role !== 'super_admin') return null;
    return { userId: d.userId, role: d.role };
  } catch { return null; }
}

export async function adminRoutes(app: FastifyInstance) {

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

  // DELETE /users/:id — delete user + their tenant
  app.delete('/users/:id', async (req: FastifyRequest) => {
    const { id } = req.params as { id: string };
    const admin = verifyAdmin(req);
    if (!admin) return { error: 'Unauthorized' };
    try {
      // Delete tenant first (no cascade on tenant.id = user.tenant_id)
      await pool.query('DELETE FROM tenants WHERE created_by=$1', [id]);
      // Delete user (cascade: sessions, verification_tokens; audit_logs: SET NULL)
      await pool.query('DELETE FROM users WHERE id=$1 AND role=$2', [id, 'bumdes']);
      return { success: true };
    } catch (e: any) {
      return { error: e.message };
    }
  });

  // POST /users/:id/deactivate — toggle user active
  app.post('/users/:id/deactivate', async (req: FastifyRequest) => {
    const { id } = req.params as { id: string };
    const { active } = (req.body as any) || {};
    const admin = verifyAdmin(req);
    if (!admin) return { error: 'Unauthorized' };
    await pool.query('UPDATE users SET is_active=$1, updated_at=now() WHERE id=$2', [active ?? false, id]);
    return { success: true };
  });

  // POST /users/:id/clear-data — clear tenant data (future: transactions, journals, etc.)
  app.post('/users/:id/clear-data', async (req: FastifyRequest) => {
    const { id } = req.params as { id: string };
    const admin = verifyAdmin(req);
    if (!admin) return { error: 'Unauthorized' };
    const tenantRes = await pool.query('SELECT tenant_id FROM users WHERE id=$1', [id]);
    const tenantId = tenantRes.rows[0]?.tenant_id;
    if (!tenantId) return { error: 'User tidak punya tenant' };
    // Phase 2: delete transactions, journal_lines, etc.
    return { success: true, message: 'Data tenant berhasil di-clear (Phase 2)' };
  });
}
