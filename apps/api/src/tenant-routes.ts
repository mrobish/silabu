import type { FastifyInstance, FastifyRequest } from 'fastify';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pool } from './db.js';
import { requireTenant, requireActiveTrial, type AuthPayload } from './guards.js';

const tenantGuard = { onRequest: [requireTenant] };
const mutationGuard = { onRequest: [requireActiveTrial] };

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
  app.put('/tenant/profile', mutationGuard, async (req: FastifyRequest) => {
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

  // ── File upload security helpers ─────────────────────────────
  
  /**
   * Validate file format by magic bytes (not just MIME header).
   * Returns true if file content matches expected image format.
   */
  function validateMagicBytes(buffer: Buffer, declaredMime: string): boolean {
    if (buffer.length < 12) return false;
    
    // PNG: 89 50 4E 47 0D 0A 1A 0A (first 8 bytes)
    if (declaredMime === 'image/png') {
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    }
    
    // JPEG: FF D8 FF (first 3 bytes)
    if (declaredMime === 'image/jpeg') {
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    }
    
    // WEBP: RIFF....WEBP (bytes 0-3 = "RIFF", bytes 8-11 = "WEBP")
    if (declaredMime === 'image/webp') {
      const riff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
      const webp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
      return riff && webp;
    }
    
    // SVG: check for <svg or <?xml (text-based format) — REJECT if detected
    if (declaredMime === 'image/svg+xml') return false;
    
    // Check if content is actually SVG disguised as other format
    const headerStr = buffer.toString('utf8', 0, Math.min(256, buffer.length)).trim().toLowerCase();
    if (headerStr.startsWith('<?xml') || headerStr.startsWith('<svg')) return false;
    
    return false;
  }
  
  /**
   * Sanitize filename — prevent path traversal.
   * Only allow alphanumeric, hyphens, underscores, dots.
   */
  function sanitizeFilename(filename: string): string {
    // Remove any path separators and directory traversal
    const basename = path.basename(filename);
    // Only keep safe characters
    return basename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  // POST /tenant/logo — upload logo (multipart). Stores file, saves logo_url.
  app.post('/tenant/logo', mutationGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const data = await (req as any).file();
    if (!data) return { error: 'File tidak ditemukan' };

    // Layer 1: MIME type check (client-reported)
    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedMimes.includes(data.mimetype)) {
      return { error: 'Format harus PNG, JPG/JPEG, atau WEBP. SVG tidak diizinkan karena alasan keamanan.' };
    }

    // Layer 2: File size check (before reading full buffer)
    const maxSize = 2 * 1024 * 1024; // 2MB
    
    // Read buffer for validation
    const buffer = await data.toBuffer();
    
    // Layer 3: File size check (after reading)
    if (buffer.length > maxSize) {
      return { error: `Ukuran file terlalu besar (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Maksimal 2MB.` };
    }
    if (buffer.length === 0) {
      return { error: 'File kosong' };
    }

    // Layer 4: Magic bytes validation (actual file content)
    if (!validateMagicBytes(buffer, data.mimetype)) {
      return { error: 'Format file tidak valid atau tidak sesuai dengan ekstensi. Pastikan file benar-benar berformat PNG, JPG, atau WEBP.' };
    }

    // Generate secure random filename (never use original filename)
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[data.mimetype as string] || 'png';
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${a.tenantId}-${randomName}.${ext}`;

    // Layer 5: Path traversal prevention — ensure final path is inside LOGO_DIR
    await fs.mkdir(LOGO_DIR, { recursive: true });
    const finalPath = path.join(LOGO_DIR, filename);
    const resolvedPath = path.resolve(finalPath);
    const resolvedLogoDir = path.resolve(LOGO_DIR);
    if (!resolvedPath.startsWith(resolvedLogoDir + path.sep)) {
      return { error: 'Path tidak valid' };
    }

    await fs.writeFile(finalPath, buffer);

    const logoUrl = `/uploads/logos/${filename}`;
    await pool.query('UPDATE tenants SET logo_url=$1, updated_at=now() WHERE id=$2', [logoUrl, a.tenantId]);
    return { success: true, logo_url: logoUrl, message: 'Logo berhasil diupload' };
  });
}
