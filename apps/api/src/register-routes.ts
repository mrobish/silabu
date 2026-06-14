import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from './db.js';
import { sendEmail, buildOTPCodeEmail } from './mailer.js';
import { verifyTurnstile, getSecuritySettings } from './turnstile.js';
import { getSetting } from './settings-routes.js';
import { seedDefaultCoa } from './coa-seed.js';
import { JWT_SECRET } from './config.js';
const APP_URL = process.env.APP_URL || 'https://silabu.ondesa.id';

function sign(user: any) {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role, tenantId: user.tenant_id }, JWT_SECRET, { expiresIn: '7d' });
}
function hashOTP(code: string) { return crypto.createHash('sha256').update(code).digest('hex'); }
function reqIp(req: FastifyRequest) { return req.ip || (req.headers['x-forwarded-for'] as string) || ''; }

function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

async function storeOTP(userId: string, email: string): Promise<string> {
  const otp = generateOTP();
  const hashedOTP = hashOTP(otp);
  await pool.query(`DELETE FROM verification_tokens WHERE email=$1 AND purpose='otp' AND consumed_at IS NULL`, [email]);
  await pool.query(
    `INSERT INTO verification_tokens (user_id, email, purpose, token_hash, expires_at) VALUES ($1, $2, 'otp', $3, now() + interval '5 minutes')`,
    [userId, email, hashedOTP]
  );
  return otp;
}

async function verifyOTP(email: string, code: string): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const hashedOTP = hashOTP(code);
  const r = await pool.query(
    `SELECT * FROM verification_tokens WHERE email=$1 AND purpose='otp' AND token_hash=$2 AND consumed_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
    [email, hashedOTP]
  );
  if (!r.rowCount) return { valid: false, error: 'Kode OTP salah atau sudah kedaluwarsa' };
  const v = r.rows[0];
  await pool.query('UPDATE verification_tokens SET consumed_at=now() WHERE id=$1', [v.id]);
  return { valid: true, userId: v.user_id };
}

export async function registerRoutes(app: FastifyInstance) {
  // ========== REGISTER WITH EMAIL ==========
  app.post('/register-email', async (req: FastifyRequest) => {
    const b = req.body as any;
    const { email, password, confirmPassword, nama_lengkap, captchaToken } = b;
    if (!email || !password || !confirmPassword || !nama_lengkap) {
      return { error: 'Semua field wajib diisi' };
    }
    if (password !== confirmPassword) return { error: 'Password tidak sama' };
    if (String(password).length < 8) return { error: 'Password minimal 8 karakter' };
    const cap = await verifyTurnstile(captchaToken, reqIp(req));
    if (!cap.success) return { error: cap.error };
    const exists = await pool.query('SELECT id, email_verified_at FROM users WHERE email=$1', [String(email).toLowerCase()]);
    if (exists.rowCount) {
      const u = exists.rows[0];
      if (u.email_verified_at) return { error: 'Email sudah terdaftar. Silakan login.' };
      const otp = await storeOTP(u.id, String(email).toLowerCase());
      const otpEmail = buildOTPCodeEmail(otp);
      await sendEmail({ to: String(email).toLowerCase(), subject: otpEmail.subject, text: otpEmail.text, html: otpEmail.html });
      return { success: true, message: 'Kode OTP baru sudah dikirim ke email Anda.', email: String(email).toLowerCase(), needsVerification: true };
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const passHash = await bcrypt.hash(password, 12);
      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, nama_lengkap, role, auth_provider, email_verified_at) VALUES ($1, $2, $3, 'bumdes', 'email', NULL) RETURNING *`,
        [String(email).toLowerCase(), passHash, nama_lengkap]
      );
      const user = userRes.rows[0];
      const otp = await storeOTP(user.id, user.email);
      await client.query('COMMIT');
      const otpEmail = buildOTPCodeEmail(otp);
      await sendEmail({ to: user.email, subject: otpEmail.subject, text: otpEmail.text, html: otpEmail.html });
      return { success: true, message: 'Kode OTP sudah dikirim ke email Anda.', email: user.email };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return { error: e.message };
    } finally { client.release(); }
  });

  // ========== RESEND OTP ==========
  app.post('/resend-otp', async (req: FastifyRequest) => {
    const { email } = req.body as any;
    if (!email) return { error: 'Email wajib diisi' };
    const e = String(email).toLowerCase();
    const r = await pool.query('SELECT id FROM users WHERE email=$1', [e]);
    if (!r.rowCount) return { error: 'Email tidak ditemukan' };
    const otp = await storeOTP(r.rows[0].id, e);
    const otpEmail = buildOTPCodeEmail(otp);
    await sendEmail({ to: e, subject: otpEmail.subject, text: otpEmail.text, html: otpEmail.html });
    return { success: true, message: 'Kode OTP baru sudah dikirim.' };
  });

  // ========== VERIFY OTP ==========
  app.post('/verify-otp', async (req: FastifyRequest) => {
    const { email, code } = req.body as any;
    if (!email || !code) return { error: 'Email dan kode OTP wajib diisi' };
    const result = await verifyOTP(String(email).toLowerCase(), String(code));
    if (!result.valid) return { error: result.error };
    await pool.query('UPDATE users SET email_verified_at=now(), updated_at=now() WHERE id=$1', [result.userId]);
    return { success: true, message: 'Verifikasi berhasil.' };
  });

  // ========== SET PASSWORD (Google flow) ==========
  app.post('/set-password', async (req: FastifyRequest) => {
    const { email, password, confirmPassword } = req.body as any;
    if (!email || !password || !confirmPassword) return { error: 'Semua field wajib diisi' };
    if (password !== confirmPassword) return { error: 'Password tidak sama' };
    if (String(password).length < 8) return { error: 'Password minimal 8 karakter' };
    const e = String(email).toLowerCase();
    const r = await pool.query('SELECT id, email_verified_at FROM users WHERE email=$1', [e]);
    if (!r.rowCount) return { error: 'Email tidak ditemukan' };
    if (!r.rows[0].email_verified_at) return { error: 'Email belum diverifikasi' };
    const passHash = await bcrypt.hash(password, 12);
    await pool.query('UPDATE users SET password_hash=$1, updated_at=now() WHERE id=$2', [passHash, r.rows[0].id]);
    return { success: true, message: 'Password berhasil disimpan.' };
  });

  // ========== COMPLETE REGISTRATION (BUMDes data + pelaksana) ==========
  app.post('/complete-registration', async (req: FastifyRequest) => {
    const b = req.body as any;
    const { email, nama_bumdes, provinsi, kabupaten, kecamatan, desa, tahun_berdiri, nama_penasihat, nama_direktur, nama_sekretaris, nama_bendahara, nama_pengawas_1, nama_pengawas_2 } = b;
    if (!email) return { error: 'Email wajib diisi' };
    const required = ['nama_bumdes', 'provinsi', 'kabupaten', 'kecamatan', 'desa', 'tahun_berdiri', 'nama_penasihat', 'nama_direktur', 'nama_sekretaris', 'nama_bendahara', 'nama_pengawas_1'];
    for (const f of required) {
      if (!b[f] || !String(b[f]).trim()) return { error: `${f} wajib diisi` };
    }
    const e = String(email).toLowerCase();
    const userR = await pool.query('SELECT id, tenant_id, email_verified_at FROM users WHERE email=$1', [e]);
    if (!userR.rowCount) return { error: 'User tidak ditemukan' };
    const user = userR.rows[0];
    if (!user.email_verified_at) return { error: 'Email belum diverifikasi' };
    if (user.tenant_id) return { error: 'Data BUM Desa sudah pernah diisi' };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tenantRes = await client.query(
        `INSERT INTO tenants (nama_bumdes, provinsi, kabupaten, kecamatan, desa, tahun_berdiri, npwp, nama_penasihat, nama_direktur, nama_sekretaris, nama_bendahara, nama_pengawas_1, nama_pengawas_2, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [nama_bumdes, provinsi, kabupaten, kecamatan, desa, Number(tahun_berdiri), b.npwp || null, nama_penasihat, nama_direktur, nama_sekretaris, nama_bendahara, nama_pengawas_1, nama_pengawas_2 || null, user.id]
      );
      const tenantId = tenantRes.rows[0].id;
      await client.query('UPDATE users SET tenant_id=$1, updated_at=now() WHERE id=$2', [tenantId, user.id]);
      await client.query('COMMIT');
      client.release();

      // Auto-seed CoA (304 akun Kepmendesa 136) — di luar transaction biar ga nested
      try {
        await seedDefaultCoa(tenantId);
      } catch (seedErr: any) {
        // Gagal seed → tenant tetap terdaftar, user bisa seed manual di CoA page
        console.error('CoA seed failed for tenant', tenantId, seedErr);
      }

      // Generate JWT so user is auto-logged in after registration
      const updatedUser = { id: user.id, email: e, role: 'bumdes', tenant_id: tenantId };
      const accessToken = sign(updatedUser);
      return {
        success: true, message: 'Registrasi berhasil!', tenantId,
        accessToken,
        user: { id: user.id, email: e, nama_lengkap: user.nama_lengkap || '', role: 'bumdes', tenantId },
      };
    } catch (e: any) {
      await client.query('ROLLBACK');
      client.release();
      return { error: e.message };
    }
  });

  // ========== LOGIN ==========
  app.post('/login', async (req: FastifyRequest) => {
    const { email, password, captchaToken } = req.body as any;
    const cap = await verifyTurnstile(captchaToken, reqIp(req));
    if (!cap.success) return { error: cap.error };

    const emailLower = String(email || '').toLowerCase();
    const r = await pool.query(
      `SELECT id,email,password_hash,nama_lengkap,role,tenant_id,
              email_verified_at,failed_login_count,locked_until
       FROM users WHERE email=$1 AND is_active=true`,
      [emailLower]
    );
    const user = r.rows[0];
    if (!user || !user.password_hash) return { error: 'Email atau password salah' };

    // Lockout check
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const secs = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 1000);
      const mins = Math.ceil(secs / 60);
      return { error: `Terlalu banyak percobaan salah. Coba lagi ${mins} menit.` };
    }

    const ok = await bcrypt.compare(password || '', user.password_hash);
    if (!ok) {
      // Increment failed count; lock at 3
      const newCount = (user.failed_login_count || 0) + 1;
      if (newCount >= 3) {
        await pool.query(
          `UPDATE users SET failed_login_count=$1, locked_until=now()+interval '5 minutes' WHERE id=$2`,
          [newCount, user.id]
        );
        return { error: 'Password salah 3×. Akun terkunci 5 menit.' };
      }
      await pool.query(`UPDATE users SET failed_login_count=$1 WHERE id=$2`, [newCount, user.id]);
      return { error: `Email atau password salah (percobaan ${newCount}/3)` };
    }

    // Password benar → reset lockout
    if (!user.email_verified_at && user.role !== 'super_admin') return { error: 'Email belum diverifikasi' };
    await pool.query(
      `UPDATE users SET last_login_at=now(), failed_login_count=0, locked_until=NULL WHERE id=$1`,
      [user.id]
    );

    // ── OTP: Check if enabled ──
    let otpEnabled = false;
    try {
      const otpSetting = await pool.query("SELECT value FROM system_settings WHERE key='otp_enabled'");
      otpEnabled = otpSetting.rowCount ? otpSetting.rows[0].value === true || otpSetting.rows[0].value === 'true' : false;
    } catch {}

    if (otpEnabled) {
      // OTP flow: Generate + send, don't give JWT yet
      const otp = crypto.randomInt(100000, 999999).toString();
      const hashed = crypto.createHash('sha256').update(otp).digest('hex');
      await pool.query('DELETE FROM verification_tokens WHERE user_id=$1 AND purpose=\'login_otp\' AND consumed_at IS NULL', [user.id]);
      await pool.query(
        `INSERT INTO verification_tokens (user_id, email, purpose, token_hash, expires_at) VALUES ($1, $2, 'login_otp', $3, now() + interval '5 minutes')`,
        [user.id, emailLower, hashed]
      );
      const tempToken = jwt.sign({ userId: user.id, email: user.email, purpose: 'otp_login' }, JWT_SECRET, { expiresIn: '5m' });
      const { sendOTPChannels } = await import('./otp-routes.js').catch(() => ({ sendOTPChannels: null }));
      if (sendOTPChannels) {
        sendOTPChannels(user, otp, pool).catch(() => {});
      }
      return { requires_otp: true, tempToken, message: 'OTP dikirim' };
    }

    // OTP disabled → issue JWT directly
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, tenantId: user.tenant_id },
      JWT_SECRET, { expiresIn: '7d' }
    );
    return {
      accessToken,
      user: { id: user.id, email: user.email, nama_lengkap: user.nama_lengkap, role: user.role, tenantId: user.tenant_id },
    };
  });

  // ========== ME ==========
  app.get('/me', async (req: FastifyRequest) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return { error: 'Unauthorized' };
    try {
      const d = jwt.verify(auth.slice(7), JWT_SECRET) as any;
      const r = await pool.query(`SELECT u.id,u.email,u.nama_lengkap,u.role,u.tenant_id,t.nama_bumdes,t.trial_ends_at,t.subscription_ends_at,t.subscription_status,t.plan FROM users u LEFT JOIN tenants t ON t.id=u.tenant_id WHERE u.id=$1`, [d.userId]);
      return { user: r.rows[0] };
    } catch { return { error: 'Unauthorized' }; }
  });

  // ========== CHANGE PASSWORD ==========
  app.post('/change-password', async (req: FastifyRequest) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return { error: 'Unauthorized' };
    let userId: string;
    try {
      const d = jwt.verify(auth.slice(7), JWT_SECRET) as any;
      userId = d.userId;
    } catch { return { error: 'Unauthorized' }; }

    const { oldPassword, newPassword, confirmPassword } = req.body as any;
    if (!oldPassword || !newPassword || !confirmPassword) return { error: 'Semua field wajib diisi' };
    if (String(newPassword).length < 8) return { error: 'Password baru minimal 8 karakter' };
    if (newPassword !== confirmPassword) return { error: 'Konfirmasi password tidak cocok' };
    if (newPassword === oldPassword) return { error: 'Password baru harus berbeda dari password lama' };

    const r = await pool.query('SELECT id, password_hash FROM users WHERE id=$1 AND is_active=true', [userId]);
    const user = r.rows[0];
    if (!user || !user.password_hash) return { error: 'User tidak ditemukan' };

    const ok = await bcrypt.compare(oldPassword, user.password_hash);
    if (!ok) return { error: 'Password lama salah' };

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash=$1, updated_at=now() WHERE id=$2', [hash, userId]);
    return { success: true, message: 'Password berhasil diubah' };
  });

  // ========== GOOGLE OAUTH ==========
  app.get('/google', async () => {
    const oauth = await getSetting('oauth');
    if (!oauth.googleClientId) return { error: 'Google OAuth belum dikonfigurasi' };
    const redirectUri = `${APP_URL}/api/auth/google/callback`;
    const scope = 'openid email profile';
    const state = crypto.randomBytes(16).toString('hex');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${oauth.googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}`;
    return { url };
  });

  app.get('/google/callback', async (req: FastifyRequest, reply: FastifyReply) => {
    const { code } = req.query as any;
    if (!code) return reply.redirect(`${APP_URL}/register?error=oauth`);
    const oauth = await getSetting('oauth');
    if (!oauth.googleClientId || !oauth.googleClientSecret) return reply.redirect(`${APP_URL}/register?error=oauth_config`);
    const redirectUri = `${APP_URL}/api/auth/google/callback`;
    try {
      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code, client_id: oauth.googleClientId, client_secret: oauth.googleClientSecret,
          redirect_uri: redirectUri, grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenResp.json();
      if (!tokenData.access_token) return reply.redirect(`${APP_URL}/register?error=token`);
      const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const gUser = await userResp.json();
      if (!gUser.email) return reply.redirect(`${APP_URL}/register?error=email`);
      const email = String(gUser.email).toLowerCase();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const exists = await client.query('SELECT * FROM users WHERE email=$1', [email]);
        let user;
        if (exists.rowCount) {
          user = exists.rows[0];
          if (!user.google_id) {
            await client.query('UPDATE users SET google_id=$1, auth_provider=$2, avatar_url=$3, updated_at=now() WHERE id=$4', [gUser.id, 'google', gUser.picture, user.id]);
          }
        } else {
          // New Google user: created UNVERIFIED, must pass OTP per spec
          const userRes = await client.query(
            `INSERT INTO users (email, nama_lengkap, auth_provider, google_id, avatar_url, role, email_verified_at) VALUES ($1, $2, 'google', $3, $4, 'bumdes', NULL) RETURNING *`,
            [email, gUser.name || email.split('@')[0], gUser.id, gUser.picture]
          );
          user = userRes.rows[0];
        }
        await client.query('COMMIT');
        // CASE 1: Existing fully registered user (has tenant + verified)
        if (user.tenant_id && user.email_verified_at) {
          // Check OTP toggle
          let otpEnabled = false;
          try {
            const otpSetting = await client.query("SELECT value FROM system_settings WHERE key='otp_enabled'");
            otpEnabled = otpSetting.rowCount ? otpSetting.rows[0].value === true || otpSetting.rows[0].value === 'true' : false;
          } catch {}

          if (otpEnabled) {
            const otp = crypto.randomInt(100000, 999999).toString();
            const hashed = crypto.createHash('sha256').update(otp).digest('hex');
            await client.query('DELETE FROM verification_tokens WHERE user_id=$1 AND purpose=\'login_otp\' AND consumed_at IS NULL', [user.id]);
            await client.query(
              `INSERT INTO verification_tokens (user_id, email, purpose, token_hash, expires_at) VALUES ($1, $2, 'login_otp', $3, now() + interval '5 minutes')`,
              [user.id, email, hashed]
            );
            const tempToken = jwt.sign({ userId: user.id, email: user.email, purpose: 'otp_login' }, JWT_SECRET, { expiresIn: '5m' });
            const { sendOTPChannels: sendOTP } = await import('./otp-routes.js').catch(() => ({ sendOTPChannels: null }));
            if (sendOTP) sendOTP(user, otp, pool).catch(() => {});
            return reply.redirect(`${APP_URL}/verify-otp?token=${tempToken}&flow=google`);
          }

          // OTP disabled → issue JWT directly
          const accessToken = jwt.sign(
            { userId: user.id, email: user.email, role: user.role, tenantId: user.tenant_id },
            JWT_SECRET, { expiresIn: '7d' }
          );
          return reply.redirect(`${APP_URL}/login/callback?token=${accessToken}&user=${encodeURIComponent(JSON.stringify({ id: user.id, email: user.email, nama_lengkap: user.nama_lengkap, role: user.role, tenantId: user.tenant_id }))}`);
        }
        // CASE 2: New or incomplete user → send OTP, go through verification
        const otp = await storeOTP(user.id, email);
        const otpEmail = buildOTPCodeEmail(otp);
        await sendEmail({ to: email, subject: otpEmail.subject, text: otpEmail.text, html: otpEmail.html });
        return reply.redirect(`${APP_URL}/register/verify-otp?email=${encodeURIComponent(email)}&flow=google`);
      } catch (e: any) {
        await client.query('ROLLBACK');
        return reply.redirect(`${APP_URL}/register?error=server`);
      } finally { client.release(); }
    } catch (e: any) {
      return reply.redirect(`${APP_URL}/register?error=oauth`);
    }
  });
}
