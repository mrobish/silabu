import type { FastifyInstance, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from './db.js';
import { sendEmail, buildResetLinkEmail } from './mailer.js';
import { verifyTurnstile } from './turnstile.js';

function hashToken(token: string) { return crypto.createHash('sha256').update(token).digest('hex'); }
function reqIp(req: FastifyRequest) { return req.ip || (req.headers['x-forwarded-for'] as string) || ''; }

export async function authRoutes(app: FastifyInstance) {
  // captcha-config public endpoint
  app.get('/captcha-config', async () => {
    const { getSecuritySettings } = await import('./turnstile.js');
    const cfg = await getSecuritySettings();
    return { provider: 'turnstile', siteKey: cfg.turnstile_site_key || '', enabled: !!cfg.turnstile_site_key };
  });

  // forgot-password
  app.post('/forgot-password', async (req: FastifyRequest) => {
    const { email, captchaToken } = req.body as any;
    const cap = await verifyTurnstile(captchaToken, reqIp(req));
    if (!cap.success) return { error: cap.error };
    const e = String(email || '').toLowerCase();
    const r = await pool.query('SELECT * FROM users WHERE email=$1 AND is_active=true', [e]);
    const user = r.rows[0];
    if (user && user.password_hash) {
      const token = crypto.randomBytes(32).toString('hex');
      const APP_URL = process.env.APP_URL || 'https://silabu.ondesa.id';
      await pool.query(`INSERT INTO verification_tokens (user_id,email,purpose,token_hash,expires_at) VALUES ($1,$2,'reset_password',$3,now()+interval '1 hour')`, [user.id, user.email, hashToken(token)]);
      const link = `${APP_URL}/reset-password?token=${token}`;
      const mail = buildResetLinkEmail(link);
      await sendEmail({ to: user.email, subject: mail.subject, text: mail.text, html: mail.html });
    }
    return { success: true, message: 'Jika email terdaftar, link reset sudah dikirim.' };
  });

  // reset-password
  app.post('/reset-password', async (req: FastifyRequest) => {
    const { token, password } = req.body as any;
    if (!token) return { error: 'Token tidak valid' };
    if (String(password || '').length < 8) return { error: 'Password minimal 8 karakter' };
    const h = hashToken(token);
    const r = await pool.query(`SELECT * FROM verification_tokens WHERE token_hash=$1 AND purpose='reset_password' AND consumed_at IS NULL AND expires_at > now()`, [h]);
    if (!r.rowCount) return { error: 'Token tidak valid atau sudah kedaluwarsa' };
    const v = r.rows[0];
    const passHash = await bcrypt.hash(password, 12);
    await pool.query('UPDATE users SET password_hash=$1, updated_at=now() WHERE id=$2', [passHash, v.user_id]);
    await pool.query('UPDATE verification_tokens SET consumed_at=now() WHERE id=$1', [v.id]);
    return { success: true };
  });
}
