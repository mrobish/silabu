import type { FastifyInstance, FastifyRequest } from 'fastify';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pool } from './db.js';
import { requireTenant, type AuthPayload } from './guards.js';

const tenantGuard = { onRequest: [requireTenant] };

const LOGO_DIR = process.env.LOGO_DIR || '/www/wwwroot/silabudigi/uploads/logos';
const APP_URL = process.env.APP_URL || 'https://silabu.ondesa.id';

// Editable profile fields (whitelist — never trust client keys directly)
const PROFILE_FIELDS = [
  'nama_bumdes', 'provinsi', 'kabupaten', 'kecamatan', 'desa', 'tahun_berdiri',
  'npwp', 'nomor_sertifikat', 'nomor_perdes', 'telpon',
  'nama_penasihat', 'nama_direktur', 'nama_sekretaris', 'nama_bendahara',
  'nama_pengawas_1', 'nama_pengawas_2',
];

export async function tenantRoutes(app: FastifyInstance) {
  // GET /tenant/profile — full tenant profile
  app.get('/tenant/profile', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const r = await pool.query(
      `SELECT id, nama_bumdes, provinsi, kabupaten, kecamatan, desa, tahun_berdiri,
              npwp, nomor_sertifikat, nomor_perdes, telpon, logo_url,
              nama_penasihat, nama_direktur, nama_sekretaris, nama_bendahara,
              nama_pengawas_1, nama_pengawas_2, created_at, updated_at
       FROM tenants WHERE id=$1`,
      [a.tenantId]
    );
    if (!r.rowCount) return { error: 'Profil tidak ditemukan' };
    return { profile: r.rows[0] };
  });

  // PUT /tenant/profile — update profile (whitelisted fields)
  app.put('/tenant/profile', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const b = (req.body as any) || {};

    const required = ['nama_bumdes', 'provinsi', 'kabupaten', 'kecamatan', 'desa', 'tahun_berdiri',
      'nama_penasihat', 'nama_direktur', 'nama_sekretaris', 'nama_bendahara', 'nama_pengawas_1'];
    for (const f of required) {
      if (!b[f] || !String(b[f]).trim()) return { error: `${f.replace(/_/g, ' ')} wajib diisi` };
    }

    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    for (const f of PROFILE_FIELDS) {
      if (f in b) {
        sets.push(`${f}=$${i++}`);
        vals.push(f === 'tahun_berdiri' ? (Number(b[f]) || null) : (b[f] ?? null));
      }
    }
    if (!sets.length) return { error: 'Tidak ada data untuk disimpan' };
    vals.push(a.tenantId);
    await pool.query(`UPDATE tenants SET ${sets.join(', ')}, updated_at=now() WHERE id=$${i}`, vals);
    return { success: true, message: 'Profil berhasil disimpan' };
  });

  // POST /tenant/logo — upload logo (multipart). Stores file, saves logo_url.
  app.post('/tenant/logo', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const data = await (req as any).file();
    if (!data) return { error: 'File tidak ditemukan' };

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(data.mimetype)) {
      return { error: 'Format harus PNG, JPG, WEBP, atau SVG' };
    }

    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' }[data.mimetype as string] || 'png';
    const filename = `${a.tenantId}-${crypto.randomBytes(4).toString('hex')}.${ext}`;

    await fs.mkdir(LOGO_DIR, { recursive: true });
    const buffer = await data.toBuffer();
    if (buffer.length > 2 * 1024 * 1024) return { error: 'Ukuran maksimal 2MB' };
    await fs.writeFile(path.join(LOGO_DIR, filename), buffer);

    const logoUrl = `${APP_URL}/uploads/logos/${filename}`;
    await pool.query('UPDATE tenants SET logo_url=$1, updated_at=now() WHERE id=$2', [logoUrl, a.tenantId]);
    return { success: true, logo_url: logoUrl };
  });
}
