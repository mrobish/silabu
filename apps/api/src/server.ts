import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { initDatabase } from './db.js';
import { authRoutes } from './auth-routes.js';
import adminSettingsRoutes, { initSettings } from './admin-settings.js';

const app = Fastify({ logger: true });
const PORT = Number(process.env.PORT || 3010);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://silabu.ondesa.id';

await initDatabase();
await initSettings();

await app.register(helmet);
await app.register(cors, { origin: CORS_ORIGIN, credentials: true });
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
await app.register(authRoutes, { prefix: '/api' });
await app.register(adminSettingsRoutes);

app.get('/api/health', async () => ({ status: 'ok', app: 'silabu-digi', timestamp: new Date().toISOString() }));

app.get('/api/auth/capabilities', async () => ({
  emailPassword: true,
  googleOAuth: true,
  emailVerification: ['otp', 'magic_link'],
  resetPassword: true,
  refreshTokenRotation: true,
  accountLinking: true,
  roles: ['super_admin', 'karyawan_admin', 'bumdes'],
}));

app.listen({ port: PORT, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
