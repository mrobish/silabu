import { promises as fs } from 'fs';
import path from 'path';
import { getSMTPConfig } from './settings-routes.js';

const MAIL_LOG_DIR = process.env.MAIL_LOG_DIR || '/var/log/silabu-digi/mail';

export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  try {
    const cfg = await getSMTPConfig();
    if (cfg?.host && cfg?.port) {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: cfg.host, port: Number(cfg.port), secure: !!cfg.secure,
        auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
      });
      await transporter.sendMail({ from: cfg.from || `SILABU DIGI <${cfg.user}>`, to, subject, html, text });
      return;
    }
  } catch {}
  await logEmailToFile({ to, subject, html, text });
}

async function logEmailToFile({ to, subject, text }: { to: string; subject: string; html: string; text: string }) {
  try {
    await fs.mkdir(MAIL_LOG_DIR, { recursive: true });
    const filename = `mail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.txt`;
    await fs.writeFile(path.join(MAIL_LOG_DIR, filename), `To: ${to}\nSubject: ${subject}\n\n${text}`);
  } catch {}
}

export function buildVerifyLinkEmail(link: string) {
  return {
    subject: 'Verifikasi Email - SILABU DIGI',
    text: `Klik link berikut untuk verifikasi email Anda: ${link}`,
    html: `<div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:20px"><h2 style="color:#0e7490">Verifikasi Email</h2><p>Klik tombol berikut untuk verifikasi email Anda:</p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#0891b2;color:white;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Verifikasi Email</a><p style="color:#64748b;font-size:13px">Link berlaku 24 jam. Jika tidak mendaftar, abaikan email ini.</p></div>`,
  };
}

export function buildResetLinkEmail(link: string) {
  return {
    subject: 'Reset Password - SILABU DIGI',
    text: `Klik link berikut untuk reset password Anda: ${link}`,
    html: `<div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:20px"><h2 style="color:#0e7490">Reset Password</h2><p>Klik tombol berikut untuk membuat password baru:</p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#0891b2;color:white;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Reset Password</a><p style="color:#64748b;font-size:13px">Link berlaku 1 jam. Jika tidak meminta reset, abaikan email ini.</p></div>`,
  };
}
