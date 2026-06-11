import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

const JWT_SECRET = process.env['JWT_SECRET'] || 'silabu-digi-secret-2026';

export interface AuthPayload {
  userId: string;
  email: string;
  role: 'super_admin' | 'bumdes';
  tenantId: string | null;
}

/** Decode JWT. Returns payload or null if missing/invalid. No side-effects. */
export function verifyToken(req: FastifyRequest): AuthPayload | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.slice(7), JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

/** Fastify preHandler-style guard. Sets request.auth or sends 401. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const payload = verifyToken(req);
  if (!payload) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  (req as any).auth = payload;
}

/** Role check — call AFTER requireAuth. Sends 403 if mismatch. */
export function requireRole(...roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(req, reply);
    if (reply.sent) return;
    const auth: AuthPayload = (req as any).auth;
    if (!roles.includes(auth.role)) {
      reply.code(403).send({ error: 'Forbidden: role tidak sesuai' });
    }
  };
}

/** Require user has a tenant_id. Sends 403 if not. */
export async function requireTenant(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (reply.sent) return;
  const auth: AuthPayload = (req as any).auth;
  if (!auth.tenantId) {
    reply.code(403).send({ error: 'Tenant belum dibuat' });
    return;
  }
  // Optionally check tenant is active / not expired
  const r = await pool.query(
    'SELECT is_active FROM tenants WHERE id=$1',
    [auth.tenantId]
  );
  if (!r.rowCount || !r.rows[0].is_active) {
    reply.code(403).send({ error: 'Tenant tidak aktif' });
  }
}

/** SaaS access check — active if trial still running OR paid subscription still running. */
export async function isSubscriptionAccessActive(tenantId: string): Promise<boolean> {
  const r = await pool.query(
    'SELECT trial_ends_at, subscription_ends_at FROM tenants WHERE id=$1',
    [tenantId]
  );
  if (!r.rowCount) return false;
  const trialEnds = r.rows[0].trial_ends_at ? new Date(r.rows[0].trial_ends_at) : null;
  const subEnds = r.rows[0].subscription_ends_at ? new Date(r.rows[0].subscription_ends_at) : null;
  const now = new Date();
  return (!!trialEnds && trialEnds > now) || (!!subEnds && subEnds > now);
}

/** Guard that blocks mutations if trial/subscription expired. Call after requireTenant. */
export async function requireActiveTrial(req: FastifyRequest, reply: FastifyReply) {
  await requireTenant(req, reply);
  if (reply.sent) return;
  const auth: AuthPayload = (req as any).auth;
  const active = await isSubscriptionAccessActive(auth.tenantId!);
  if (!active) {
    reply.code(403).send({
      error: 'Masa trial/langganan telah berakhir',
      code: 'TRIAL_EXPIRED',
      message: 'Silakan perpanjang langganan untuk melanjutkan.'
    });
  }
}
