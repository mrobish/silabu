import type { FastifyInstance, FastifyRequest } from 'fastify';
import { pool } from './db.js';

export async function getSMTPConfig(): Promise<any> {
  const r = await pool.query("SELECT value_encrypted FROM app_settings WHERE key='smtp'");
  const row = r.rows[0];
  if (!row) return null;
  try { return JSON.parse(row.value_encrypted); } catch { return null; }
}

export async function getSetting(key: string): Promise<any> {
  const r = await pool.query('SELECT value_encrypted FROM app_settings WHERE key=$1', [key]);
  const row = r.rows[0];
  if (!row) return {};
  try { return JSON.parse(row.value_encrypted); } catch { return {}; }
}

async function putSetting(key: string, value: any) {
  await pool.query(
    `INSERT INTO app_settings (key,value_encrypted,updated_at) VALUES ($1,$2,now())
     ON CONFLICT (key) DO UPDATE SET value_encrypted=$2, updated_at=now()`,
    [key, JSON.stringify(value)]
  );
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/settings', async () => {
    const smtp = await getSetting('smtp');
    const oauth = await getSetting('oauth');
    const tripay = await getSetting('tripay');
    const security = await getSetting('security');
    return { smtp, oauth, tripay, security };
  });

  app.put('/settings/smtp', async (req: FastifyRequest) => {
    await putSetting('smtp', req.body);
    return { success: true };
  });

  app.put('/settings/oauth', async (req: FastifyRequest) => {
    await putSetting('oauth', req.body);
    return { success: true };
  });

  app.put('/settings/tripay', async (req: FastifyRequest) => {
    await putSetting('tripay', req.body);
    return { success: true };
  });

  app.put('/settings/security', async (req: FastifyRequest) => {
    await putSetting('security', req.body);
    return { success: true };
  });

  app.post('/settings/test-smtp', async (req: FastifyRequest) => {
    const { to } = req.body as any;
    if (!to) return { error: 'Email tujuan wajib diisi' };
    try {
      const smtp = await getSMTPConfig();
      if (!smtp?.host) return { error: 'SMTP belum dikonfigurasi' };
      const nodemailer = await import('nodemailer');
      const t = nodemailer.createTransport({ host: smtp.host, port: smtp.port||587, secure: smtp.secure||false, auth:{user:smtp.user,pass:smtp.pass}, tls:{rejectUnauthorized:false}, connectionTimeout:10000, greetingTimeout:8000 });
      await t.sendMail({ from: smtp.from||smtp.user, to, subject:'SILABU DIGI — Test SMTP', text:`SMTP test: ${new Date().toISOString()}` });
      return { success: true, message: `Test email terkirim ke ${to}` };
    } catch (e:any) { return { error: `SMTP error: ${e.message}` }; }
  });
}
