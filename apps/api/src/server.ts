import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { initDatabase, pool } from './db.js';
import { authRoutes } from './auth-routes.js';
import { registerRoutes } from './register-routes.js';
import { settingsRoutes } from './settings-routes.js';
import { adminRoutes } from './admin-routes.js';
import { subscriptionRoutes } from './subscription-routes.js';
import { tenantRoutes } from './tenant-routes.js';
import { accountingRoutes } from './accounting-routes.js';
import { subledgerRoutes } from './subledger-routes.js';
import { otpRoutes } from './otp-routes.js';

const app = Fastify({
  logger: true,
  bodyLimit: 2 * 1024 * 1024, // 2 MB — Layer 1 DoS protection (rejects oversized JSON before parsing)
});
const PORT = Number(process.env.PORT || 3010);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://silabu.ondesa.id';

await initDatabase();

await app.register(helmet);
await app.register(cors, { origin: CORS_ORIGIN, credentials: true });
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 } });
await app.register(fastifyStatic, { root: path.join('/www/wwwroot/silabudigi/uploads'), prefix: '/uploads/', decorateReply: false });

// Security headers for uploaded files — prevent browser from interpreting as HTML/SVG
app.addHook('onSend', async (request, reply, payload) => {
  if (request.url.startsWith('/uploads/')) {
    reply.header('X-Content-Type-Options', 'nosniff');
    // Force correct Content-Type based on file extension
    const ext = path.extname(request.url).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
    };
    if (contentTypes[ext]) {
      reply.header('Content-Type', contentTypes[ext]);
    } else {
      // For unknown extensions (including .svg), force download
      reply.header('Content-Type', 'application/octet-stream');
      reply.header('Content-Disposition', 'attachment');
    }
  }
  return payload;
});
await app.register(registerRoutes, { prefix: '/api/auth' });
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(settingsRoutes, { prefix: '/api/admin' });
await app.register(adminRoutes, { prefix: '/api/admin' });
await app.register(subscriptionRoutes, { prefix: '/api' });
await app.register(tenantRoutes, { prefix: '/api' });
await app.register(accountingRoutes, { prefix: '/api/accounting' });
await app.register(subledgerRoutes, { prefix: '/api/accounting' });
await app.register(otpRoutes, { prefix: '/api' });


app.get('/api/health', async () => ({
  status: 'ok',
  app: 'silabu-digi',
  timestamp: new Date().toISOString(),
}));

// Public pricing endpoint (no auth)
app.get('/api/pricing', async () => {
  const DEFAULT = { monthly: 100000, yearly: 1000000, trialDays: 30, discountPercent: 17, currency: 'IDR', note: '' };
  try {
    const r = await pool.query("SELECT value_encrypted FROM app_settings WHERE key='pricing_config'");
    if (r.rowCount && r.rows[0].value_encrypted) return JSON.parse(r.rows[0].value_encrypted);
  } catch {}
  return DEFAULT;
});

app.listen({ port: PORT, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
