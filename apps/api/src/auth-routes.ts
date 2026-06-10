import type { FastifyInstance, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from './db.js';
import { sendEmail, buildVerifyLinkEmail, buildResetLinkEmail } from './mailer.js';
import { verifyTurnstile, getSecuritySettings } from './turnstile.js';

const JWT_SECRET = process.env.JWT_SECRET || 'silabu-digi-secret-2026';
const APP_URL = process.env.APP_URL || 'https://silabu.ondesa.id';

function sign(user: any) {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role, tenantId: user.tenant_id }, JWT_SECRET, { expiresIn: '7d' });
}
function hashToken(token: string) { return crypto.createHash('sha256').update(token).digest('hex'); }
function reqIp(req: FastifyRequest) { return req.ip || (req.headers['x-forwarded-for'] as string) || ''; }

export async function authRoutes(app: FastifyInstance) {
  app.get('/captcha-config', async () => {
    const cfg = await getSecuritySettings();
    return { provider: 'turnstile', siteKey: cfg.turnstile_site_key || '', enabled: !!cfg.turnstile_site_key };
  });

  app.post('/register', async (req: FastifyRequest) => {
    const b = req.body as any;
    const required = ['email','password','confirmPassword','nama_lengkap','nama_bumdes','provinsi','kabupaten','kecamatan','desa','tahun_berdiri','nama_penasihat','nama_direktur','nama_sekretaris','nama_bendahara','nama_pengawas_1'];
    for (const f of required) if (!b[f]) return { error: `${f} wajib diisi` };
    if (b.password !== b.confirmPassword) return { error: 'Password tidak sama' };
    if (String(b.password).length < 8) return { error: 'Password minimal 8 karakter' };
    const cap = await verifyTurnstile(b.captchaToken, reqIp(req));
    if (!cap.success) return { error: cap.error };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const exists = await client.query('SELECT id FROM users WHERE email=$1', [String(b.email).toLowerCase()]);
      if (exists.rowCount) throw new Error('Email sudah terdaftar');

      const passHash = await bcrypt.hash(b.password, 12);
      const userRes = await client.query(
        `INSERT INTO users (email,password_hash,nama_lengkap,role,auth_provider) VALUES ($1,$2,$3,'bumdes','email') RETURNING *`,
        [String(b.email).toLowerCase(), passHash, b.nama_lengkap]
      );
      const user = userRes.rows[0];

      const tenantRes = await client.query(
        `INSERT INTO tenants (nama_bumdes,provinsi,kabupaten,kecamatan,desa,tahun_berdiri,npwp,nama_penasihat,nama_direktur,nama_sekretaris,nama_bendahara,nama_pengawas_1,nama_pengawas_2,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [b.nama_bumdes,b.provinsi,b.kabupaten,b.kecamatan,b.desa,Number(b.tahun_berdiri),b.npwp||null,b.nama_penasihat,b.nama_direktur,b.nama_sekretaris,b.nama_bendahara,b.nama_pengawas_1,b.nama_pengawas_2||null,user.id]
      );
      const tenantId = tenantRes.rows[0].id;
      await client.query('UPDATE users SET tenant_id=$1 WHERE id=$2', [tenantId, user.id]);

      const token = crypto.randomBytes(32).toString('hex');
      await client.query(`INSERT INTO verification_tokens (user_id,email,purpose,token_hash,expires_at) VALUES ($1,$2,'verify_email',$3,now()+interval '24 hours')`, [user.id, user.email, hashToken(token)]);
      await client.query('COMMIT');

      const link = `${APP_URL}/verify-email?token=${token}`;
      const email = buildVerifyLinkEmail(link);
      await sendEmail({ to: user.email, subject: email.subject, text: email.text, html: email.html });
      return { success: true, message: 'Registrasi berhasil. Cek email untuk verifikasi.', tenantId };
    } catch (e:any) {
      await client.query('ROLLBACK');
      return { error: e.message };
    } finally { client.release(); }
  });

  app.get('/verify-email', async (req: FastifyRequest) => {
    const token = (req.query as any).token;
    if (!token) return { error: 'Token tidak valid' };
    const h = hashToken(token);
    const r = await pool.query(`SELECT * FROM verification_tokens WHERE token_hash=$1 AND purpose='verify_email' AND consumed_at IS NULL AND expires_at > now()`, [h]);
    if (!r.rowCount) return { error: 'Token tidak valid atau sudah kedaluwarsa' };
    const v = r.rows[0];
    await pool.query('UPDATE users SET email_verified_at=now(), updated_at=now() WHERE id=$1', [v.user_id]);
    await pool.query('UPDATE verification_tokens SET consumed_at=now() WHERE id=$1', [v.id]);
    return { success: true };
  });

  app.post('/login', async (req: FastifyRequest) => {
    const { email, password, captchaToken } = req.body as any;
    const cap = await verifyTurnstile(captchaToken, reqIp(req));
    if (!cap.success) return { error: cap.error };
    const r = await pool.query('SELECT * FROM users WHERE email=$1 AND is_active=true', [String(email||'').toLowerCase()]);
    const user = r.rows[0];
    if (!user || !user.password_hash) return { error: 'Email atau password salah' };
    const ok = await bcrypt.compare(password || '', user.password_hash);
    if (!ok) return { error: 'Email atau password salah' };
    if (!user.email_verified_at && user.role !== 'super_admin') return { error: 'Email belum diverifikasi' };
    await pool.query('UPDATE users SET last_login_at=now() WHERE id=$1', [user.id]);
    return { accessToken: sign(user), user: { id:user.id,email:user.email,nama_lengkap:user.nama_lengkap,role:user.role,tenantId:user.tenant_id } };
  });

  app.get('/me', async (req: FastifyRequest) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return { error: 'Unauthorized' };
    try {
      const d = jwt.verify(auth.slice(7), JWT_SECRET) as any;
      const r = await pool.query(`SELECT u.id,u.email,u.nama_lengkap,u.role,u.tenant_id,t.nama_bumdes,t.trial_ends_at,t.subscription_ends_at,t.subscription_status,t.plan FROM users u LEFT JOIN tenants t ON t.id=u.tenant_id WHERE u.id=$1`, [d.userId]);
      return { user: r.rows[0] };
    } catch { return { error: 'Unauthorized' }; }
  });

  app.post('/forgot-password', async (req: FastifyRequest) => {
    const { email, captchaToken } = req.body as any;
    const cap = await verifyTurnstile(captchaToken, reqIp(req));
    if (!cap.success) return { error: cap.error };
    const e = String(email || '').toLowerCase();
    // Always return success to avoid email enumeration
    const r = await pool.query('SELECT * FROM users WHERE email=$1 AND is_active=true', [e]);
    const user = r.rows[0];
    if (user && user.password_hash) {
      const token = crypto.randomBytes(32).toString('hex');
      await pool.query(`INSERT INTO verification_tokens (user_id,email,purpose,token_hash,expires_at) VALUES ($1,$2,'reset_password',$3,now()+interval '1 hour')`, [user.id, user.email, hashToken(token)]);
      const link = `${APP_URL}/reset-password?token=${token}`;
      const mail = buildResetLinkEmail(link);
      await sendEmail({ to: user.email, subject: mail.subject, text: mail.text, html: mail.html });
    }
    return { success: true, message: 'Jika email terdaftar, link reset sudah dikirim.' };
  });

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

  app.get('/google', async () => ({ error: 'Google OAuth belum dikonfigurasi' }));
  app.get('/google/callback', async () => ({ error: 'Google OAuth callback belum aktif' }));
}
