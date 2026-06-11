import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { initDatabase } from './db.js';
import { authRoutes } from './auth-routes.js';
import { registerRoutes } from './register-routes.js';
import { settingsRoutes } from './settings-routes.js';
import { adminRoutes } from './admin-routes.js';
import { subscriptionRoutes } from './subscription-routes.js';
import { tenantRoutes } from './tenant-routes.js';
import { accountingRoutes } from './accounting-routes.js';

const app = Fastify({ logger: true });
const PORT = Number(process.env.PORT || 3010);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://silabu.ondesa.id';

await initDatabase();

await app.register(helmet);
await app.register(cors, { origin: CORS_ORIGIN, credentials: true });
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 } });
await app.register(fastifyStatic, { root: path.join('/www/wwwroot/silabudigi/uploads'), prefix: '/uploads/', decorateReply: false });
await app.register(registerRoutes, { prefix: '/api/auth' });
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(settingsRoutes, { prefix: '/api/admin' });
await app.register(adminRoutes, { prefix: '/api/admin' });
await app.register(subscriptionRoutes, { prefix: '/api' });
await app.register(tenantRoutes, { prefix: '/api' });
await app.register(accountingRoutes, { prefix: '/api/accounting' });


app.get('/api/health', async () => ({
  status: 'ok',
  app: 'silabu-digi',
  timestamp: new Date().toISOString(),
}));

app.listen({ port: PORT, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
