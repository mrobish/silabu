import { promises as fs } from 'fs';
import path from 'path';
import { getSMTPConfig } from './settings-routes.js';

const MAIL_LOG_DIR = process.env.MAIL_LOG_DIR || '/var/log/silabu-digi/mail';

export async function sendEmail(params: {to:string;subject:string;html:string;text:string}) {
  await fs.mkdir(MAIL_LOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(MAIL_LOG_DIR, `${ts}_${params.to.replace(/[^a-z0-9]/gi, '_')}.log`);
  await fs.writeFile(file, `TO: ${params.to}\nSUBJECT: ${params.subject}\n\n${params.text}\n`);
  console.log(`[mail] -> ${params.to}: ${params.subject} (logged)`);

  const smtp = await getSMTPConfig();
  if (!smtp?.host) return;
  try {
    const nodemailer = await import('nodemailer');
    const t = nodemailer.createTransport({ host: smtp.host, port: smtp.port||587, secure: smtp.secure||false, auth:{user:smtp.user,pass:smtp.pass} });
    await t.sendMail({ from: smtp.from||smtp.user, to: params.to, subject: params.subject, text: params.text, html: params.html });
    console.log(`[mail] SMTP sent to ${params.to}`);
  } catch (e:any) { console.error(`[mail] SMTP fail: ${e.message}`); }
}

export function buildVerifyLinkEmail(link: string) {
  return {
    subject: 'SILABU DIGI — Verifikasi Email',
    text: `Verifikasi email SILABU DIGI:\n${link}\n\nLink berlaku 24 jam.\n— SILABU DIGI`,
    html: `<div style="font-family:system-ui;max-width:480px;margin:auto;padding:24px;color:#0f172a"><h2>Verifikasi Email</h2><p>Klik tombol di bawah untuk verifikasi akun SILABU DIGI Anda.</p><a href="${link}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#0891b2,#2563eb);color:white;text-decoration:none;border-radius:12px;font-weight:700;font-size:16px">Verifikasi Email</a><p style="color:#64748b;margin-top:24px;font-size:13px">Link berlaku 24 jam. Jika bukan Anda, abaikan email ini.</p><p>— SILABU DIGI</p></div>`,
  };
}
