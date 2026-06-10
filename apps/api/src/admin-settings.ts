import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { pool } from './db.js';
import nodemailer from 'nodemailer';

// Settings table (key-value JSON)
export async function initSettings() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
}

async function getSetting(key: string): Promise<any> {
  const r = await pool.query('SELECT value FROM app_settings WHERE key = $1', [key]);
  return r.rows[0]?.value || {};
}

async function putSetting(key: string, value: any) {
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
    [key, JSON.stringify(value)]
  );
}

export async function getSMTPConfig(): Promise<any> {
  const s = await getSetting('smtp');
  if (s.host && s.port && s.user) return s;
  // fallback to env
  const env = {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
    secure: process.env.SMTP_SECURE === 'true',
  };
  if (env.host) return env;
  return null;
}

export async function getOAuthConfig(): Promise<any> {
  return await getSetting('oauth');
}

// Routes
export default async function adminSettingsRoutes(app: FastifyInstance) {
  // GET all settings
  app.get('/api/admin/settings', async () => {
    const smtp = await getSetting('smtp');
    const oauth = await getSetting('oauth');
    return { smtp, oauth };
  });

  // PUT SMTP settings
  app.put('/api/admin/settings/smtp', async (req: FastifyRequest) => {
    const body = req.body as any;
    await putSetting('smtp', body);
    return { success: true };
  });

  // PUT OAuth settings
  app.put('/api/admin/settings/oauth', async (req: FastifyRequest) => {
    const body = req.body as any;
    await putSetting('oauth', body);
    return { success: true };
  });

  // POST test SMTP
  app.post('/api/admin/settings/test-smtp', async (req: FastifyRequest) => {
    const body = req.body as any;
    const to = body?.to;
    if (!to) return { error: 'Missing recipient email' };

    try {
      const smtp = body?.smtp || await getSMTPConfig();
      if (!smtp?.host) return { error: 'SMTP not configured' };

      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port || 587,
        secure: smtp.secure || false,
        auth: { user: smtp.user, pass: smtp.pass },
      });

      await transporter.sendMail({
        from: smtp.from || smtp.user,
        to,
        subject: 'SILABU DIGI — Test Email',
        text: `SMTP test berhasil! Waktu: ${new Date().toISOString()}`,
        html: `<p>✅ SMTP test berhasil!</p><p>Waktu: ${new Date().toISOString()}</p><p>— SILABU DIGI</p>`,
      });

      return { success: true, message: `Test email sent to ${to}` };
    } catch (err: any) {
      return { error: `SMTP error: ${err.message}` };
    }
  });
}
