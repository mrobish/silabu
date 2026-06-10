import type { FastifyInstance, FastifyRequest } from 'fastify';
import { pool } from './db.js';

export default async function tenantRoutes(app: FastifyInstance) {
  // Check if current user has a tenant
  app.get('/api/tenant/profile/check', async (req: FastifyRequest) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'Unauthorized', statusCode: 401 };
    }

    try {
      const jwt = await import('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'silabu-digi-secret-2026';
      const decoded = jwt.default.verify(authHeader.slice(7), secret) as any;
      const userId = decoded.userId || decoded.id;

      const userRes = await pool.query('SELECT tenant_id, role FROM users WHERE id = $1', [userId]);
      const user = userRes.rows[0];
      
      if (!user) return { hasTenant: false, isProfileComplete: false };

      if (!user.tenant_id) {
        return { hasTenant: false, isProfileComplete: false, role: user.role };
      }

      // Check if tenant profile is complete
      const tenantRes = await pool.query(
        'SELECT id, nama_bumdes, alamat, npwp FROM tenants WHERE id = $1',
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
        role: user.role,
      };
    } catch (err: any) {
      return { error: err.message };
    }
  });
}
