import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  generateMagicToken,
  generateOTP,
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
  extractClientInfo,
} from '@silabu/auth';
import { pool } from './db.js';
import { buildOTPEmail, sendEmail } from './mailer.js';

const APP_URL = process.env.APP_URL || 'https://silabu.ondesa.id';
const OTP_TTL_MINUTES = 15;
const REFRESH_TTL_DAYS = 7;

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  namaLengkap: z.string().min(2).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifySchema = z.object({
  email: z.string().email().optional(),
  otp: z.string().length(6).optional(),
  token: z.string().min(32).optional(),
});

const refreshSchema = z.object({ refreshToken: z.string().min(20) });
const forgotSchema = z.object({ email: z.string().email() });
const resetSchema = z.object({ email: z.string().email().optional(), otp: z.string().length(6).optional(), token: z.string().min(32).optional(), password: z.string().min(8) });

type UserRow = {
  id: string;
  email: string;
  password_hash: string | null;
  nama_lengkap: string | null;
  role: string;
  tenant_id: string | null;
  email_verified_at: Date | null;
  is_active: boolean;
  auth_provider: string;
};

function addMinutes(d: Date, mins: number) { return new Date(d.getTime() + mins * 60_000); }
function addDays(d: Date, days: number) { return new Date(d.getTime() + days * 86400_000); }
function normalizeEmail(email: string) { return email.trim().toLowerCase(); }

async function audit(req: FastifyRequest, event: string, payload: { userId?: string; email?: string; metadata?: Record<string, unknown> } = {}) {
  const { ipAddress, userAgent } = extractClientInfo(req);
  await pool.query(
    `INSERT INTO audit_logs (user_id, email, event, ip_address, user_agent, metadata) VALUES ($1,$2,$3,$4,$5,$6)`,
    [payload.userId ?? null, payload.email ?? null, event, ipAddress, userAgent, payload.metadata ?? null]
  );
}

async function createVerification(req: FastifyRequest, userId: string | null, email: string, purpose: 'email_verify' | 'password_reset') {
  const otp = generateOTP();
  const token = generateMagicToken();
  const otpHash = await hashPassword(otp);
  const tokenHash = hashRefreshToken(token);
  const expiresAt = addMinutes(new Date(), OTP_TTL_MINUTES);

  await pool.query(
    `INSERT INTO verification_tokens (user_id, email, purpose, otp_hash, magic_token_hash, expires_at) VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId, email, purpose, otpHash, tokenHash, expiresAt]
  );

  const path = purpose === 'email_verify' ? '/verify-email' : '/reset-password';
  const magicLink = `${APP_URL}${path}?token=${token}&email=${encodeURIComponent(email)}`;
  const msg = buildOTPEmail(otp, magicLink, purpose === 'email_verify' ? 'verify' : 'reset');
  await sendEmail({ to: email, subject: msg.subject, html: msg.html, text: msg.text });

  await audit(req, purpose === 'email_verify' ? 'verify_email_sent' : 'password_reset_request', { userId: userId ?? undefined, email });
}

async function findValidVerification(email: string | undefined, otp: string | undefined, token: string | undefined, purpose: 'email_verify' | 'password_reset') {
  if (!otp && !token) throw new Error('OTP atau token wajib diisi');

  let rows;
  if (token) {
    rows = await pool.query(
      `SELECT * FROM verification_tokens WHERE magic_token_hash=$1 AND purpose=$2 AND consumed_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
      [hashRefreshToken(token), purpose]
    );
  } else {
    rows = await pool.query(
      `SELECT * FROM verification_tokens WHERE email=$1 AND purpose=$2 AND consumed_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
      [normalizeEmail(email || ''), purpose]
    );
  }

  const row = rows.rows[0];
  if (!row) throw new Error('Kode verifikasi tidak valid atau kedaluwarsa');

  if (otp) {
    if (row.attempts >= 5) throw new Error('Terlalu banyak percobaan OTP');
    const ok = await verifyPassword(otp, row.otp_hash);
    if (!ok) {
      await pool.query(`UPDATE verification_tokens SET attempts=attempts+1 WHERE id=$1`, [row.id]);
      throw new Error('OTP salah');
    }
  }

  return row;
}

async function issueSession(req: FastifyRequest, user: UserRow, parentId?: string | null) {
  const { ipAddress, userAgent } = extractClientInfo(req);
  const sessionInsert = await pool.query(
    `INSERT INTO sessions (user_id, refresh_token_hash, parent_id, ip_address, user_agent, expires_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [user.id, 'pending', parentId ?? null, ipAddress, userAgent, addDays(new Date(), REFRESH_TTL_DAYS)]
  );
  const sessionId = sessionInsert.rows[0].id;
  const refreshToken = signRefreshToken({ sessionId, userId: user.id });
  await pool.query(`UPDATE sessions SET refresh_token_hash=$1 WHERE id=$2`, [hashRefreshToken(refreshToken), sessionId]);
  const accessToken = signAccessToken({ userId: user.id, email: user.email, role: user.role, tenantId: user.tenant_id });
  return { accessToken, refreshToken };
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const email = normalizeEmail(body.email);
    const { ipAddress } = extractClientInfo(req);
    const strength = validatePasswordStrength(body.password);
    if (!strength.valid) return reply.status(400).send({ error: strength.errors.join(', ') });

    const recent = await pool.query(`SELECT count(*)::int AS c FROM signup_attempts WHERE ip_address=$1 AND created_at > now() - interval '1 hour'`, [ipAddress]);
    if ((recent.rows[0]?.c ?? 0) >= 5) return reply.status(429).send({ error: 'Terlalu banyak percobaan daftar. Coba lagi nanti.' });

    await pool.query(`INSERT INTO signup_attempts (ip_address, email) VALUES ($1,$2)`, [ipAddress, email]);

    const existing = await pool.query<UserRow>(`SELECT * FROM users WHERE email=$1`, [email]);
    if (existing.rows[0]?.email_verified_at) return reply.status(409).send({ error: 'Email sudah terdaftar' });

    const passwordHash = await hashPassword(body.password);
    let user: UserRow;
    if (existing.rows[0]) {
      const res = await pool.query<UserRow>(`UPDATE users SET password_hash=$1, nama_lengkap=coalesce($2,nama_lengkap), auth_provider=CASE WHEN auth_provider='google' THEN 'both' ELSE 'email' END, updated_at=now() WHERE id=$3 RETURNING *`, [passwordHash, body.namaLengkap ?? null, existing.rows[0].id]);
      user = res.rows[0];
    } else {
      const res = await pool.query<UserRow>(`INSERT INTO users (email, password_hash, nama_lengkap, auth_provider) VALUES ($1,$2,$3,'email') RETURNING *`, [email, passwordHash, body.namaLengkap ?? null]);
      user = res.rows[0];
    }

    await createVerification(req, user.id, email, 'email_verify');
    await audit(req, 'register', { userId: user.id, email });
    return reply.send({ success: true, message: 'OTP/link verifikasi sudah dikirim ke email', email });
  });

  app.post('/auth/verify-email', async (req, reply) => {
    try {
      const body = verifySchema.parse(req.body);
      const row = await findValidVerification(body.email, body.otp, body.token, 'email_verify');
      await pool.query(`UPDATE verification_tokens SET consumed_at=now() WHERE id=$1`, [row.id]);
      const res = await pool.query<UserRow>(`UPDATE users SET email_verified_at=now(), updated_at=now() WHERE id=$1 RETURNING *`, [row.user_id]);
      const user = res.rows[0];
      const tokens = await issueSession(req, user);
      await audit(req, 'verify_email', { userId: user.id, email: user.email });
      return reply.send({ success: true, user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenant_id }, ...tokens });
    } catch (e: any) {
      return reply.status(400).send({ error: e.message || 'Verifikasi gagal' });
    }
  });

  app.post('/auth/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const email = normalizeEmail(body.email);
    const res = await pool.query<UserRow>(`SELECT * FROM users WHERE email=$1`, [email]);
    const user = res.rows[0];
    if (!user || !user.password_hash) {
      await audit(req, 'login_failed', { email });
      return reply.status(401).send({ error: 'Email atau password salah' });
    }
    if (!user.is_active) return reply.status(403).send({ error: 'Akun dinonaktifkan' });
    const ok = await verifyPassword(body.password, user.password_hash);
    if (!ok) {
      await audit(req, 'login_failed', { userId: user.id, email });
      return reply.status(401).send({ error: 'Email atau password salah' });
    }
    if (!user.email_verified_at) {
      await createVerification(req, user.id, email, 'email_verify');
      return reply.status(403).send({ error: 'Email belum diverifikasi. OTP baru sudah dikirim.', needsVerification: true, email });
    }
    await pool.query(`UPDATE users SET last_login_at=now() WHERE id=$1`, [user.id]);
    const tokens = await issueSession(req, user);
    await audit(req, 'login_success', { userId: user.id, email });
    return reply.send({ success: true, user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenant_id }, ...tokens });
  });

  app.post('/auth/refresh', async (req, reply) => {
    try {
      const body = refreshSchema.parse(req.body);
      const payload = verifyRefreshToken(body.refreshToken);
      const tokenHash = hashRefreshToken(body.refreshToken);
      const sess = await pool.query(`SELECT * FROM sessions WHERE id=$1 AND refresh_token_hash=$2 AND revoked_at IS NULL AND expires_at > now()`, [payload.sessionId, tokenHash]);
      const session = sess.rows[0];
      if (!session) throw new Error('Session tidak valid');
      await pool.query(`UPDATE sessions SET revoked_at=now(), revoked_reason='rotated' WHERE id=$1`, [session.id]);
      const userRes = await pool.query<UserRow>(`SELECT * FROM users WHERE id=$1 AND is_active=true`, [payload.userId]);
      const user = userRes.rows[0];
      if (!user) throw new Error('User tidak valid');
      const tokens = await issueSession(req, user, session.id);
      await audit(req, 'refresh', { userId: user.id, email: user.email });
      return reply.send({ success: true, ...tokens });
    } catch {
      return reply.status(401).send({ error: 'Refresh token tidak valid' });
    }
  });

  app.post('/auth/logout', async (req, reply) => {
    const body = refreshSchema.safeParse(req.body);
    if (body.success) {
      try {
        const payload = verifyRefreshToken(body.data.refreshToken);
        await pool.query(`UPDATE sessions SET revoked_at=now(), revoked_reason='logout' WHERE id=$1`, [payload.sessionId]);
        await audit(req, 'logout', { userId: payload.userId });
      } catch {}
    }
    return reply.send({ success: true });
  });

  app.post('/auth/forgot-password', async (req, reply) => {
    const body = forgotSchema.parse(req.body);
    const email = normalizeEmail(body.email);
    const userRes = await pool.query<UserRow>(`SELECT * FROM users WHERE email=$1`, [email]);
    const user = userRes.rows[0];
    if (user) await createVerification(req, user.id, email, 'password_reset');
    return reply.send({ success: true, message: 'Jika email terdaftar, link reset sudah dikirim' });
  });

  app.post('/auth/reset-password', async (req, reply) => {
    try {
      const body = resetSchema.parse(req.body);
      const strength = validatePasswordStrength(body.password);
      if (!strength.valid) return reply.status(400).send({ error: strength.errors.join(', ') });
      const row = await findValidVerification(body.email, body.otp, body.token, 'password_reset');
      const passwordHash = await hashPassword(body.password);
      await pool.query(`UPDATE users SET password_hash=$1, auth_provider=CASE WHEN auth_provider='google' THEN 'both' ELSE 'email' END, updated_at=now() WHERE id=$2`, [passwordHash, row.user_id]);
      await pool.query(`UPDATE verification_tokens SET consumed_at=now() WHERE id=$1`, [row.id]);
      await pool.query(`UPDATE sessions SET revoked_at=now(), revoked_reason='password_reset' WHERE user_id=$1 AND revoked_at IS NULL`, [row.user_id]);
      await audit(req, 'password_reset_complete', { userId: row.user_id, email: row.email });
      return reply.send({ success: true, message: 'Password berhasil diubah' });
    } catch (e: any) {
      return reply.status(400).send({ error: e.message || 'Reset password gagal' });
    }
  });
}
