import { FastifyInstance, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'silabu-secret-2026';
const WAHA_URL = process.env.WAHA_URL || 'http://localhost:3003';
const WAHA_KEY = process.env.WAHA_API_KEY || '***';

// ─── OTP helpers ─────────────────────────────────────────
function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}
function hashOTP(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex');
}
function sign(user: any) {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role, tenantId: user.tenant_id }, JWT_SECRET, { expiresIn: '7d' });
}
function signTemp(userId: string, email: string) {
  return jwt.sign({ userId, email, purpose: 'otp_login' }, JWT_SECRET, { expiresIn: '5m' });
}

// ─── WhatsApp sender via WAHA ────────────────────────────
async function sendWhatsApp(phone: string, text: string): Promise<boolean> {
  try {
    // Normalize: remove +, spaces, leading 0
    let num = phone.replace(/[^0-9]/g, '');
    if (num.startsWith('0')) num = '62' + num.slice(1);
    if (!num.startsWith('62')) num = '62' + num;
    const chatId = num + '@c.us';

    const resp = await fetch(`${WAHA_URL}/api/sendText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': WAHA_KEY },
      body: JSON.stringify({ session: 'default', chatId, text }),
    });
    const data = await resp.json();
    return !!data.id;
  } catch (e: any) {
    console.error('[WAHA] send failed:', e.message);
    return false;
  }
}

// ─── Email sender (reuse existing mailer) ────────────────
let sendEmailFn: ((opts: any) => Promise<any>) | null = null;
try {
  const mailer = await import('./mailer.js');
  sendEmailFn = mailer.sendEmail;
} catch { /* mailer not available */ }

// ─── Template helpers ─────────────────────────────────────
const DEFAULT_TEMPLATES = {
  whatsapp: '🔐 Kode OTP {app_name} Anda: *{otp}*\n\nBerlaku 5 menit. Jangan bagikan kode ini ke siapapun.',
  email_subject: 'Kode OTP Login {app_name}',
  email_body: '<div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:20px"><h2 style="color:#059669">🔐 Kode OTP Login</h2><p>Halo <b>{user_name}</b>,</p><p>Kode OTP Anda:</p><div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:20px;background:#f0fdf4;border-radius:12px;color:#059669">{otp}</div><p style="color:#64748b;font-size:13px">Berlaku 5 menit. Jangan bagikan kode ini ke siapapun.</p></div>',
};

async function getOTPTemplates(): Promise<typeof DEFAULT_TEMPLATES> {
  try {
    const r = await pool.query("SELECT value FROM system_settings WHERE key='otp_templates'");
    if (r.rowCount) return { ...DEFAULT_TEMPLATES, ...r.rows[0].value };
  } catch {}
  return DEFAULT_TEMPLATES;
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_: any, key: string) => vars[key] || `{${key}}`);
}

export async function sendOTPChannels(user: any, otp: string, pool: any): Promise<{ via: string }> {
  const tpl = await getOTPTemplates();
  const vars: Record<string, string> = { app_name: 'SILABU DIGI', otp, user_name: user.nama_lengkap || user.email, email: user.email };

  const waMsg = applyTemplate(tpl.whatsapp, vars);
  const emailSubject = applyTemplate(tpl.email_subject, vars);
  const emailHtml = applyTemplate(tpl.email_body, vars);

  let via = 'email';

  // Try WhatsApp first
  let phone = user.phone;
  if (!phone) {
    // Fallback: get from tenants.telpon
    const t = await pool.query('SELECT telpon FROM tenants WHERE id=$1', [user.tenant_id]);
    phone = t.rows[0]?.telpon;
  }

  if (phone) {
    const waOk = await sendWhatsApp(phone, waMsg);
    if (waOk) via = 'whatsapp';
  }

  // Always send email as fallback too
  if (sendEmailFn) {
    try {
      await sendEmailFn({ to: user.email, subject: emailSubject, html: emailHtml, text: `Kode OTP: ${otp}. Berlaku 5 menit.` });
    } catch (e: any) {
      console.error('[OTP] Email fallback failed:', e.message);
    }
  }

  return { via };
}

// ─── OTP Routes ──────────────────────────────────────────
export async function otpRoutes(app: FastifyInstance) {

  // ── Request login OTP ──
  app.post('/auth/request-login-otp', async (req: FastifyRequest) => {
    const { email, tempToken } = req.body as any;

    let userId: string;
    let userEmail: string;

    if (tempToken) {
      // Verify temp token from Google OAuth callback
      try {
        const d = jwt.verify(tempToken, JWT_SECRET) as any;
        if (d.purpose !== 'otp_login') return { error: 'Token tidak valid' };
        userId = d.userId;
        userEmail = d.email;
      } catch { return { error: 'Token kedaluwarsa atau tidak valid' }; }
    } else if (email) {
      // Direct email lookup (from login form)
      const r = await pool.query('SELECT id, email FROM users WHERE email=$1 AND is_active=true', [String(email).toLowerCase()]);
      if (!r.rowCount) return { error: 'User tidak ditemukan' };
      userId = r.rows[0].id;
      userEmail = r.rows[0].email;
    } else {
      return { error: 'Email atau token diperlukan' };
    }

    // Rate limit resend: 60 seconds
    const recentOTP = await pool.query(
      `SELECT created_at FROM verification_tokens WHERE user_id=$1 AND purpose='login_otp' ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (recentOTP.rowCount) {
      const elapsed = (Date.now() - new Date(recentOTP.rows[0].created_at).getTime()) / 1000;
      if (elapsed < 60) {
        return { error: `Tunggu ${Math.ceil(60 - elapsed)} detik sebelum mengirim ulang`, cooldown: Math.ceil(60 - elapsed) };
      }
    }

    // Generate + store OTP
    const otp = generateOTP();
    const hashed = hashOTP(otp);
    await pool.query('DELETE FROM verification_tokens WHERE user_id=$1 AND purpose=\'login_otp\' AND consumed_at IS NULL', [userId]);
    await pool.query(
      `INSERT INTO verification_tokens (user_id, email, purpose, token_hash, expires_at) VALUES ($1, $2, 'login_otp', $3, now() + interval '5 minutes')`,
      [userId, userEmail, hashed]
    );

    // Get full user for sending
    const u = await pool.query('SELECT u.*, u.phone FROM users u WHERE u.id=$1', [userId]);
    const user = u.rows[0];

    // Send via WhatsApp + Email
    const { via } = await sendOTPChannels(user, otp, pool);

    // Create temp token for verification
    const newTempToken = signTemp(userId, userEmail);

    return { requires_otp: true, tempToken: newTempToken, via, message: `OTP dikirim via ${via === 'whatsapp' ? 'WhatsApp' : 'Email'}` };
  });

  // ── Verify login OTP ──
  app.post('/auth/verify-login-otp', async (req: FastifyRequest) => {
    const { tempToken, code } = req.body as any;
    if (!tempToken || !code) return { error: 'Token dan kode OTP wajib diisi' };

    let userId: string;
    let email: string;
    try {
      const d = jwt.verify(tempToken, JWT_SECRET) as any;
      if (d.purpose !== 'otp_login') return { error: 'Token tidak valid' };
      userId = d.userId;
      email = d.email;
    } catch { return { error: 'Token kedaluwarsa. Silakan login ulang.' }; }

    // Check attempts (max 3)
    const attemptsKey = `otp_attempts_${tempToken.slice(-16)}`;
    const attemptsRow = await pool.query(
      `SELECT token_hash FROM verification_tokens WHERE user_id=$1 AND purpose='otp_attempts' AND email=$2 AND expires_at > now()`,
      [userId, attemptsKey]
    );
    const attempts = attemptsRow.rowCount || 0;
    if (attempts >= 3) {
      return { error: 'Terlalu banyak percobaan salah. Silakan login ulang.', max_attempts: true };
    }

    // Verify OTP
    const hashed = hashOTP(String(code));
    const r = await pool.query(
      `SELECT * FROM verification_tokens WHERE user_id=$1 AND purpose='login_otp' AND token_hash=$2 AND consumed_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
      [userId, hashed]
    );

    if (!r.rowCount) {
      // Record failed attempt
      await pool.query(
        `INSERT INTO verification_tokens (user_id, email, purpose, token_hash, expires_at) VALUES ($1, $2, 'otp_attempts', $3, now() + interval '5 minutes')`,
        [userId, attemptsKey, `attempt_${attempts + 1}`]
      );
      const remaining = 2 - attempts;
      return { error: `Kode OTP salah. Sisa ${remaining} percobaan.` };
    }

    // OTP valid → consume it + clean attempts
    await pool.query('UPDATE verification_tokens SET consumed_at=now() WHERE id=$1', [r.rows[0].id]);
    await pool.query('DELETE FROM verification_tokens WHERE user_id=$1 AND purpose=\'otp_attempts\'', [userId]);

    // Get full user for JWT
    const u = await pool.query(
      `SELECT id,email,nama_lengkap,role,tenant_id FROM users WHERE id=$1 AND is_active=true`,
      [userId]
    );
    if (!u.rowCount) return { error: 'User tidak ditemukan' };
    const user = u.rows[0];

    // Update last login
    await pool.query('UPDATE users SET last_login_at=now(), failed_login_count=0, locked_until=NULL WHERE id=$1', [userId]);

    // Return real JWT
    return {
      accessToken: sign(user),
      user: { id: user.id, email: user.email, nama_lengkap: user.nama_lengkap, role: user.role, tenantId: user.tenant_id },
    };
  });

  // ── Resend OTP ──
  app.post('/auth/resend-login-otp', async (req: FastifyRequest) => {
    const { tempToken } = req.body as any;
    if (!tempToken) return { error: 'Token diperlukan' };

    let userId: string;
    let email: string;
    try {
      const d = jwt.verify(tempToken, JWT_SECRET) as any;
      if (d.purpose !== 'otp_login') return { error: 'Token tidak valid' };
      userId = d.userId;
      email = d.email;
    } catch { return { error: 'Token kedaluwarsa. Silakan login ulang.' }; }

    // Rate limit
    const recent = await pool.query(
      `SELECT created_at FROM verification_tokens WHERE user_id=$1 AND purpose='login_otp' ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (recent.rowCount) {
      const elapsed = (Date.now() - new Date(recent.rows[0].created_at).getTime()) / 1000;
      if (elapsed < 60) {
        return { error: `Tunggu ${Math.ceil(60 - elapsed)} detik`, cooldown: Math.ceil(60 - elapsed) };
      }
    }

    // Generate new OTP
    const otp = generateOTP();
    const hashed = hashOTP(otp);
    await pool.query('DELETE FROM verification_tokens WHERE user_id=$1 AND purpose=\'login_otp\' AND consumed_at IS NULL', [userId]);
    await pool.query(
      `INSERT INTO verification_tokens (user_id, email, purpose, token_hash, expires_at) VALUES ($1, $2, 'login_otp', $3, now() + interval '5 minutes')`,
      [userId, email, hashed]
    );

    // Clean old attempts
    await pool.query('DELETE FROM verification_tokens WHERE user_id=$1 AND purpose=\'otp_attempts\'', [userId]);

    // Get user for sending
    const u = await pool.query('SELECT * FROM users WHERE id=$1', [userId]);
    const user = u.rows[0];
    const { via } = await sendOTPChannels(user, otp, pool);

    // New temp token
    const newTempToken = signTemp(userId, email);

    return { tempToken: newTempToken, via, message: `OTP baru dikirim via ${via === 'whatsapp' ? 'WhatsApp' : 'Email'}` };
  });

  // ── Super Admin: WhatsApp Status ──
  app.get('/admin/whatsapp/status', async (req: FastifyRequest) => {
    try {
      const resp = await fetch(`${WAHA_URL}/api/sessions/default`, {
        headers: { 'X-Api-Key': WAHA_KEY },
      });
      const session = await resp.json();
      return { connected: session.status === 'WORKING', status: session.status, engine: session.engine };
    } catch {
      return { connected: false, status: 'DISCONNECTED', error: 'WAHA tidak dapat dijangkau' };
    }
  });

  // ── Super Admin: WhatsApp QR ──
  app.get('/admin/whatsapp/qr', async (req: FastifyRequest, reply: any) => {
    try {
      const resp = await fetch(`${WAHA_URL}/api/default/auth/qr`, {
        headers: { 'X-Api-Key': WAHA_KEY },
      });
      if (!resp.ok) {
        const session = await (await fetch(`${WAHA_URL}/api/sessions/default`, { headers: { 'X-Api-Key': WAHA_KEY } })).json();
        return { status: session.status, qr: null };
      }
      const buffer = Buffer.from(await resp.arrayBuffer());
      const base64 = buffer.toString('base64');
      return { status: 'SCAN_QR_CODE', qr: `data:image/png;base64,${base64}` };
    } catch {
      return { status: 'ERROR', qr: null, error: 'WAHA tidak dapat dijangkau' };
    }
  });

  // ── Super Admin: Start/Restart WhatsApp Session ──
  app.post('/admin/whatsapp/session', async (req: FastifyRequest) => {
    try {
      await fetch(`${WAHA_URL}/api/sessions/default/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': WAHA_KEY },
        body: JSON.stringify({ name: 'default' }),
      });
      return { ok: true, message: 'Sesio WhatsApp dimulai' };
    } catch {
      return { error: 'Gagal memulai sesio WhatsApp' };
    }
  });

  // ── Super Admin: Test WhatsApp Send ──
  app.post('/admin/whatsapp/test', async (req: FastifyRequest) => {
    const { phone } = req.body as any;
    if (!phone) return { error: 'Nomor HP wajib diisi' };
    const ok = await sendWhatsApp(phone, '✅ Test WhatsApp dari SILABU DIGI berhasil!');
    return ok ? { ok: true, message: 'Pesan terkirim!' } : { error: 'Gagal mengirim pesan' };
  });

  // ── Super Admin: Save WAHA config ──
  app.post('/admin/whatsapp/config', async (req: FastifyRequest) => {
    const { waha_url, waha_api_key } = req.body as any;
    // Save to app_settings
    await pool.query(
      `INSERT INTO app_settings (key, value_encrypted) VALUES ('whatsapp_config', $1)
       ON CONFLICT (key) DO UPDATE SET value_encrypted=$1, updated_at=now()`,
      [JSON.stringify({ waha_url, waha_api_key })]
    );
    return { ok: true };
  });

  // ── Super Admin: Get OTP templates ──
  app.get('/admin/otp/templates', async () => {
    const tpl = await getOTPTemplates();
    return { templates: tpl, variables: [
      { key: '{app_name}', desc: 'Nama aplikasi (SILABU DIGI)' },
      { key: '{otp}', desc: 'Kode OTP 6 digit' },
      { key: '{user_name}', desc: 'Nama lengkap user' },
      { key: '{email}', desc: 'Email user' },
    ]};
  });

  // ── Super Admin: Save OTP templates ──
  app.post('/admin/otp/templates', async (req: FastifyRequest) => {
    const { whatsapp, email_subject, email_body } = req.body as any;
    if (!whatsapp || !email_subject || !email_body) return { error: 'Semua template wajib diisi' };

    // Validate: must contain {otp}
    if (!whatsapp.includes('{otp}') || !email_body.includes('{otp}')) {
      return { error: 'Template wajib mengandung {otp}' };
    }

    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at) VALUES ('otp_templates', $1, now())
       ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=now()`,
      [JSON.stringify({ whatsapp, email_subject, email_body })]
    );
    return { ok: true, message: 'Template berhasil disimpan' };
  });

  // ── Super Admin: Reset OTP templates to default ──
  app.post('/admin/otp/templates/reset', async () => {
    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at) VALUES ('otp_templates', $1, now())
       ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=now()`,
      [JSON.stringify(DEFAULT_TEMPLATES)]
    );
    return { ok: true, templates: DEFAULT_TEMPLATES };
  });

  // ── Super Admin: Get OTP enabled status ──
  app.get('/admin/otp/status', async () => {
    try {
      const r = await pool.query("SELECT value FROM system_settings WHERE key='otp_enabled'");
      const enabled = r.rowCount ? r.rows[0].value === true || r.rows[0].value === 'true' : false;
      return { enabled };
    } catch {
      return { enabled: false };
    }
  });

  // ── Super Admin: Toggle OTP on/off ──
  app.post('/admin/otp/toggle', async (req: FastifyRequest) => {
    const { enabled } = req.body as any;
    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at) VALUES ('otp_enabled', $1, now())
       ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=now()`,
      [JSON.stringify(!!enabled)]
    );
    return { ok: true, enabled: !!enabled };
  });
}
