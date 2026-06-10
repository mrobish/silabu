import type { FastifyInstance, FastifyRequest } from 'fastify';
import { pool } from './db.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'silabu-digi-secret-2026';

function getUserId(req: FastifyRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
    return decoded.userId || decoded.id;
  } catch { return null; }
}

export default async function tenantRoutes(app: FastifyInstance) {
  // Check if current user has a tenant
  app.get('/api/tenant/profile/check', async (req: FastifyRequest) => {
    const userId = getUserId(req);
    if (!userId) return { error: 'Unauthorized', statusCode: 401 };

    const userRes = await pool.query('SELECT tenant_id, role, email, nama_lengkap FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];
    if (!user) return { hasTenant: false, isProfileComplete: false };

    if (!user.tenant_id) {
      return { hasTenant: false, isProfileComplete: false, role: user.role, email: user.email };
    }

    const tenantRes = await pool.query(
      'SELECT id, nama_bumdes, alamat, npwp, logo_url FROM tenants WHERE id = $1',
      [user.tenant_id]
    );
    const tenant = tenantRes.rows[0];

    const requiredFields = ['nama_bumdes', 'alamat'];
    const missingFields = requiredFields.filter(f => !tenant[f]);

    return {
      hasTenant: true,
      tenantId: tenant.id,
      isProfileComplete: missingFields.length === 0,
      missingFields,
      tenant,
      role: user.role,
    };
  });

  // Create tenant profile (self-service)
  app.post('/api/tenant/profile', async (req: FastifyRequest) => {
    const userId = getUserId(req);
    if (!userId) return { error: 'Unauthorized', statusCode: 401 };

    const body = req.body as any;
    const { nama_bumdes, alamat, npwp } = body;

    if (!nama_bumdes || !alamat) {
      return { error: 'Nama BUM Desa dan Alamat wajib diisi' };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create tenant
      const tenantRes = await client.query(
        `INSERT INTO tenants (nama_bumdes, alamat, npwp, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
        [nama_bumdes, alamat, npwp || null, userId]
      );
      const tenantId = tenantRes.rows[0].id;

      // Link user to tenant
      await client.query(
        'UPDATE users SET tenant_id = $1 WHERE id = $2',
        [tenantId, userId]
      );

      await client.query('COMMIT');
      return { success: true, tenantId };
    } catch (err: any) {
      await client.query('ROLLBACK');
      return { error: err.message };
    } finally {
      client.release();
    }
  });

  // Update tenant profile
  app.put('/api/tenant/profile', async (req: FastifyRequest) => {
    const userId = getUserId(req);
    if (!userId) return { error: 'Unauthorized', statusCode: 401 };

    const userRes = await pool.query('SELECT tenant_id FROM users WHERE id = $1', [userId]);
    const tenantId = userRes.rows[0]?.tenant_id;
    if (!tenantId) return { error: 'No tenant' };

    const body = req.body as any;
    const { nama_bumdes, alamat, npwp } = body;

    await pool.query(
      `UPDATE tenants SET nama_bumdes = COALESCE($1, nama_bumdes), alamat = COALESCE($2, alamat), npwp = COALESCE($3, npwp), updated_at = now() WHERE id = $4`,
      [nama_bumdes, alamat, npwp, tenantId]
    );

    return { success: true };
  });
}
