import { pool } from './db.js';

export async function verifyTurnstile(token: string, remoteIp?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cfg = await getSecuritySettings();
    if (!cfg.turnstile_secret_key) return { success: true }; // no captcha configured yet, skip
    if (!token) return { success: false, error: 'Token CAPTCHA tidak valid' };
    const formData = new URLSearchParams();
    formData.append('secret', cfg.turnstile_secret_key);
    formData.append('response', token);
    if (remoteIp) formData.append('remoteip', remoteIp);
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });
    const data = await resp.json();
    return { success: !!data.success, error: data.success ? undefined : 'Verifikasi CAPTCHA gagal, silakan coba lagi' };
  } catch {
    return { success: false, error: 'Gagal verifikasi CAPTCHA' };
  }
}

export async function getSecuritySettings() {
  try {
    const r = await pool.query(`SELECT value_encrypted FROM app_settings WHERE key='security'`);
    if (!r.rowCount) return { turnstile_site_key: '', turnstile_secret_key: '' };
    return typeof r.rows[0].value_encrypted === 'string' ? JSON.parse(r.rows[0].value_encrypted) : r.rows[0].value_encrypted;
  } catch {
    return { turnstile_site_key: '', turnstile_secret_key: '' };
  }
}
