import { promises as fs } from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { getSMTPConfig } from './admin-settings.js';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const MAIL_LOG_DIR = process.env.MAIL_LOG_DIR || '/var/log/silabu-digi/mail';

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
  // Log to file always
  await fs.mkdir(MAIL_LOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(MAIL_LOG_DIR, `${ts}_${to.replace(/[^a-z0-9]/gi, '_')}.log`);
  await fs.writeFile(file, `TO: ${to}\nSUBJECT: ${subject}\n\n--- TEXT ---\n${text}\n\n--- HTML ---\n${html}\n`);
  console.log(`[mail] -> ${to}: ${subject} (logged to ${file})`);

  // Try SMTP if configured
  const smtp = await getSMTPConfig();
  if (smtp?.host) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port || 587,
        secure: smtp.secure || false,
        auth: { user: smtp.user, pass: smtp.pass },
      });
      await transporter.sendMail({
        from: smtp.from || smtp.user,
        to,
        subject,
        text,
        html,
      });
      console.log(`[mail] SMTP sent to ${to}`);
    } catch (err: any) {
      console.error(`[mail] SMTP failed: ${err.message}`);
    }
  }
}

export function buildOTPEmail(otp: string, magicLink: string, purpose: 'verify' | 'reset') {
  const title = purpose === 'verify' ? 'Verifikasi Email SILABU DIGI' : 'Reset Password SILABU DIGI';
  const verb = purpose === 'verify' ? 'verifikasi email' : 'reset password';
  
  const text = `${title}

Kode OTP Anda: ${otp}

Atau klik link berikut untuk ${verb} otomatis:
${magicLink}

Berlaku 15 menit. Jika bukan Anda, abaikan email ini.

— SILABU DIGI
silabu.ondesa.id
`;

  const html = `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;max-width:480px;margin:24px auto;padding:24px;color:#0f172a">
  <h2 style="margin:0 0 16px">${title}</h2>
  <p style="margin:0 0 12px">Kode OTP Anda:</p>
  <p style="font-size:32px;letter-spacing:6px;font-weight:700;background:#f1f5f9;padding:16px 24px;border-radius:8px;text-align:center;margin:0 0 16px">${otp}</p>
  <p style="margin:0 0 12px">Atau klik tombol di bawah untuk ${verb} otomatis:</p>
  <p style="margin:0 0 24px"><a href="${magicLink}" style="display:inline-block;background:#06b6d4;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${verb === 'verifikasi email' ? 'Verifikasi Email' : 'Reset Password'}</a></p>
  <p style="font-size:13px;color:#64748b;margin:0">Berlaku 15 menit. Jika bukan Anda, abaikan email ini.</p>
  <hr style="margin:24px 0;border:0;border-top:1px solid #e2e8f0"/>
  <p style="font-size:12px;color:#94a3b8;margin:0">SILABU DIGI · silabu.ondesa.id</p>
</body></html>`;

  return { text, html, subject: title };
}
