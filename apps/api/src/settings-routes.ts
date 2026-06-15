import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { pool } from './db.js';
import { requireRole } from './guards.js';
import { encryptJSON, decryptJSON } from './crypto-settings.js';

const requireSuperAdmin = requireRole('super_admin');
const guard = { onRequest: [requireSuperAdmin] };

// ── Secret field definitions per settings group ────────────────
// Each entry: [fieldKey, hasFlagName]
const SECRET_FIELDS: Record<string, string[][]> = {
  smtp:     [['pass', 'hasPass']],
  oauth:    [['googleClientSecret', 'hasGoogleClientSecret']],
  tripay:   [['apiKey', 'hasApiKey'], ['secretKey', 'hasSecretKey']],
  security: [['turnstile_secret_key', 'hasTurnstileSecretKey']],
};

/** Mask secret fields: replace value with '' and add hasXxx flag. */
function maskSecrets(groupKey: string, obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const fields = SECRET_FIELDS[groupKey];
  if (!fields) return obj;
  const masked = { ...obj };
  for (const [field, flag] of fields) {
    masked[flag] = !!masked[field]; // true if secret exists
    masked[field] = '';             // always empty in response
  }
  return masked;
}

/** Merge incoming PUT body with existing DB value, preserving secrets if not provided. */
function mergeWithExisting(groupKey: string, incoming: any, existing: any): any {
  if (!existing || typeof existing !== 'object') return incoming;
  if (!incoming || typeof incoming !== 'object') return incoming;

  const fields = SECRET_FIELDS[groupKey];
  const secretKeys = fields ? fields.map(f => f[0]) : [];
  const merged = { ...incoming };

  for (const sk of secretKeys) {
    // If incoming secret is empty/undefined/'' or looks like a masked placeholder → keep existing
    const val = merged[sk];
    if (!val || val === '' || (typeof val === 'string' && val.startsWith('****'))) {
      merged[sk] = existing[sk]; // preserve old secret
    }
    // Otherwise: new value provided → keep it (will be encrypted on save)
  }

  return merged;
}

export async function getSMTPConfig(): Promise<any> {
  const r = await pool.query("SELECT value_encrypted FROM app_settings WHERE key='smtp'");
  return decryptJSON(r.rows[0]?.value_encrypted);
}

export async function getSetting(key: string): Promise<any> {
  const r = await pool.query('SELECT value_encrypted FROM app_settings WHERE key=$1', [key]);
  return decryptJSON(r.rows[0]?.value_encrypted);
}

async function putSetting(key: string, value: any) {
  await pool.query(
    `INSERT INTO app_settings (key,value_encrypted,updated_at) VALUES ($1,$2,now())
     ON CONFLICT (key) DO UPDATE SET value_encrypted=$2, updated_at=now()`,
    [key, encryptJSON(value)]
  );
}

/** Save setting with secret-preserving merge. */
async function putSettingMerge(groupKey: string, incoming: any) {
  const existing = await getSetting(groupKey);
  const merged = mergeWithExisting(groupKey, incoming, existing);
  await putSetting(groupKey, merged);
  return merged;
}

export async function settingsRoutes(app: FastifyInstance) {
  // GET /settings — returns all settings with secrets masked
  app.get('/settings', guard, async () => {
    const smtp = maskSecrets('smtp', await getSetting('smtp'));
    const oauth = maskSecrets('oauth', await getSetting('oauth'));
    const tripay = maskSecrets('tripay', await getSetting('tripay'));
    const security = maskSecrets('security', await getSetting('security'));
    return { smtp, oauth, tripay, security };
  });

  // PUT /settings/smtp — partial update, preserves secrets
  app.put('/settings/smtp', guard, async (req: FastifyRequest) => {
    await putSettingMerge('smtp', req.body);
    return { success: true };
  });

  // PUT /settings/oauth — partial update, preserves secrets
  app.put('/settings/oauth', guard, async (req: FastifyRequest) => {
    await putSettingMerge('oauth', req.body);
    return { success: true };
  });

  // PUT /settings/tripay — partial update, preserves secrets
  app.put('/settings/tripay', guard, async (req: FastifyRequest) => {
    await putSettingMerge('tripay', req.body);
    return { success: true };
  });

  // PUT /settings/security — partial update, preserves secrets
  app.put('/settings/security', guard, async (req: FastifyRequest) => {
    await putSettingMerge('security', req.body);
    return { success: true };
  });

  app.post('/settings/test-smtp', guard, async (req: FastifyRequest) => {
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
