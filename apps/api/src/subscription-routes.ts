import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { pool } from './db.js';
import { requireAuth, requireTenant, type AuthPayload } from './guards.js';
import { getSetting } from './settings-routes.js';

const SUBSCRIPTION_PRICE = 1000000; // Rp 1.000.000/tahun

const auth = { onRequest: [requireAuth] };
const tenantGuard = { onRequest: [requireTenant] };

/** Compute subscription state from tenant row. */
function computeState(t: any) {
  const now = Date.now();
  const trialEnds = t.trial_ends_at ? new Date(t.trial_ends_at).getTime() : 0;
  const subEnds = t.subscription_ends_at ? new Date(t.subscription_ends_at).getTime() : 0;
  const trialActive = trialEnds > now;
  const subActive = subEnds > now;
  const active = trialActive || subActive;
  let status: string;
  if (subActive) status = 'active';
  else if (trialActive) status = 'trial';
  else status = 'expired';
  const ref = subActive ? subEnds : trialEnds;
  const daysLeft = Math.max(0, Math.ceil((ref - now) / 86400000));
  return { status, active, trialActive, subActive, daysLeft, trial_ends_at: t.trial_ends_at, subscription_ends_at: t.subscription_ends_at };
}

export async function subscriptionRoutes(app: FastifyInstance) {
  // GET /subscription/status — current tenant subscription state
  app.get('/subscription/status', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const r = await pool.query(
      'SELECT trial_ends_at, subscription_ends_at, subscription_status, plan FROM tenants WHERE id=$1',
      [a.tenantId]
    );
    if (!r.rowCount) return { error: 'Tenant tidak ditemukan' };
    const state = computeState(r.rows[0]);
    const payments = await pool.query(
      "SELECT id, merchant_ref, amount, total_amount, status, checkout_url, paid_at, created_at FROM payments WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 10",
      [a.tenantId]
    );
    return { ...state, price: SUBSCRIPTION_PRICE, payments: payments.rows };
  });

  // POST /subscription/checkout — create Tripay transaction
  app.post('/subscription/checkout', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const tripay = await getSetting('tripay');
    if (!tripay?.api_key || !tripay?.private_key || !tripay?.merchant_code) {
      return { error: 'Pembayaran belum dikonfigurasi. Hubungi admin.', code: 'TRIPAY_NOT_CONFIGURED' };
    }

    const userR = await pool.query('SELECT email, nama_lengkap FROM users WHERE id=$1', [a.userId]);
    const tenantR = await pool.query('SELECT nama_bumdes FROM tenants WHERE id=$1', [a.tenantId]);
    const user = userR.rows[0];
    const tenant = tenantR.rows[0];

    const merchantRef = `SILABU-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const amount = SUBSCRIPTION_PRICE;
    const signature = crypto
      .createHmac('sha256', tripay.private_key)
      .update(tripay.merchant_code + merchantRef + amount)
      .digest('hex');

    const isProd = tripay.mode === 'production';
    const baseUrl = isProd ? 'https://tripay.co.id/api' : 'https://tripay.co.id/api-sandbox';
    const APP_URL = process.env.APP_URL || 'https://silabu.ondesa.id';

    const payload = {
      method: tripay.method || 'QRIS',
      merchant_ref: merchantRef,
      amount,
      customer_name: tenant?.nama_bumdes || user?.nama_lengkap || 'BUM Desa',
      customer_email: user?.email || 'noreply@ondesa.id',
      order_items: [{ name: 'Langganan SILABU DIGI 1 Tahun', price: amount, quantity: 1 }],
      return_url: `${APP_URL}/app`,
      expired_time: Math.floor(Date.now() / 1000) + 24 * 3600,
      signature,
    };

    try {
      const resp = await fetch(`${baseUrl}/transaction/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tripay.api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: any = await resp.json();
      if (!data.success) return { error: data.message || 'Gagal membuat transaksi pembayaran' };

      const d = data.data;
      await pool.query(
        `INSERT INTO payments (tenant_id, user_id, provider, merchant_ref, reference, amount, fee, total_amount, status, checkout_url, raw_payload, expires_at)
         VALUES ($1,$2,'tripay',$3,$4,$5,$6,$7,$8,$9,$10,to_timestamp($11))`,
        [a.tenantId, a.userId, merchantRef, d.reference, amount, d.fee_customer || 0, d.amount || amount, d.status || 'UNPAID', d.checkout_url, JSON.stringify(d), d.expired_time]
      );

      return { success: true, checkout_url: d.checkout_url, reference: d.reference, merchant_ref: merchantRef };
    } catch (e: any) {
      return { error: `Gagal terhubung ke Tripay: ${e.message}` };
    }
  });

  // POST /subscription/webhook — Tripay callback (NO auth, verify by signature)
  app.post('/subscription/webhook', async (req: FastifyRequest, reply: FastifyReply) => {
    const tripay = await getSetting('tripay');
    if (!tripay?.private_key) return reply.code(503).send({ success: false, message: 'not configured' });

    const callbackSig = req.headers['x-callback-signature'] as string;
    const rawBody = JSON.stringify(req.body);
    const computedSig = crypto.createHmac('sha256', tripay.private_key).update(rawBody).digest('hex');
    if (callbackSig !== computedSig) {
      return reply.code(403).send({ success: false, message: 'Invalid signature' });
    }

    const body = req.body as any;
    const merchantRef = body.merchant_ref;
    const status = body.status; // PAID, EXPIRED, FAILED

    const payR = await pool.query('SELECT tenant_id, status FROM payments WHERE merchant_ref=$1', [merchantRef]);
    if (!payR.rowCount) return reply.code(404).send({ success: false, message: 'Payment not found' });
    const payment = payR.rows[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE payments SET status=$1, paid_at=CASE WHEN $1='PAID' THEN now() ELSE paid_at END, raw_payload=$2, updated_at=now() WHERE merchant_ref=$3`,
        [status, JSON.stringify(body), merchantRef]
      );

      // On successful payment: extend subscription 1 year from now (or from current sub end if still active)
      if (status === 'PAID' && payment.status !== 'PAID') {
        await client.query(
          `UPDATE tenants SET
             subscription_ends_at = GREATEST(COALESCE(subscription_ends_at, now()), now()) + interval '1 year',
             subscription_status = 'active',
             plan = 'paid',
             updated_at = now()
           WHERE id=$1`,
          [payment.tenant_id]
        );
      }
      await client.query('COMMIT');
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ success: false, message: e.message });
    } finally {
      client.release();
    }

    return reply.send({ success: true });
  });

  // GET /subscription/invoice/:paymentId — invoice data for PDF (bumdes own tenant only)
  app.get('/subscription/invoice/:paymentId', tenantGuard, async (req: FastifyRequest) => {
    const a = (req as any).auth as AuthPayload;
    const { paymentId } = req.params as { paymentId: string };

    const payR = await pool.query(
      `SELECT p.id, p.merchant_ref, p.reference, p.amount, p.fee, p.total_amount,
              p.status, p.paid_at, p.created_at, p.checkout_url,
              t.nama_bumdes, t.provinsi, t.kabupaten, t.kecamatan, t.desa,
              t.nama_direktur, t.nama_bendahara, t.npwp
       FROM payments p JOIN tenants t ON t.id = p.tenant_id
       WHERE p.id = $1 AND p.tenant_id = $2`,
      [paymentId, a.tenantId]
    );
    if (!payR.rowCount) return { error: 'Invoice tidak ditemukan' };
    const inv = payR.rows[0];
    if (inv.status !== 'PAID') return { error: 'Invoice belum dibayar' };

    return {
      invoice: {
        id: inv.id,
        merchant_ref: inv.merchant_ref,
        reference: inv.reference,
        amount: inv.amount,
        fee: inv.fee,
        total_amount: inv.total_amount,
        status: inv.status,
        paid_at: inv.paid_at,
        created_at: inv.created_at,
        tenant: {
          nama_bumdes: inv.nama_bumdes,
          provinsi: inv.provinsi,
          kabupaten: inv.kabupaten,
          kecamatan: inv.kecamatan,
          desa: inv.desa,
          nama_direktur: inv.nama_direktur,
          nama_bendahara: inv.nama_bendahara,
          npwp: inv.npwp,
        },
        vendor: {
          nama: 'CV. Microtech Riset Tasela',
          alamat: 'Kabupaten Tasikmalaya, Jawa Barat',
          email: 'admin@ondesa.id',
        },
        product: {
          name: 'Langganan SILABU DIGI — Sistem Akuntansi BUM Desa',
          period: '1 Tahun',
          price: 1000000,
        },
      },
    };
  });
}
