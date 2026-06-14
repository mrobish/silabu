import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../.env'), override: !!process.env.VITEST });
import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  user: process.env.DB_USER || 'silabu',
  password: process.env.DB_PASSWORD || 'silabu2026',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'silabu',
});

export async function initDatabase() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email varchar(255) NOT NULL UNIQUE,
      password_hash varchar(255),
      nama_lengkap varchar(255) NOT NULL,
      auth_provider varchar(32) NOT NULL DEFAULT 'email',
      google_id varchar(64),
      email_verification_token varchar(255),
      email_verified_at timestamp,
      role varchar(32) NOT NULL DEFAULT 'bumdes',
      tenant_id uuid,
      avatar_url text,
      is_active boolean NOT NULL DEFAULT true,
      last_login_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nama_bumdes varchar(255) NOT NULL,
      provinsi varchar(128),
      kabupaten varchar(128),
      kecamatan varchar(128),
      desa varchar(128),
      tahun_berdiri integer,
      npwp varchar(64),
      logo_url text,
      nama_penasihat varchar(255),
      nama_direktur varchar(255),
      nama_sekretaris varchar(255),
      nama_bendahara varchar(255),
      nama_pengawas_1 varchar(255),
      nama_pengawas_2 varchar(255),
      trial_ends_at timestamp NOT NULL DEFAULT (now() + interval '14 days'),
      subscription_ends_at timestamp,
      plan varchar(32) NOT NULL DEFAULT 'trial',
      subscription_status varchar(32) NOT NULL DEFAULT 'trial',
      is_active boolean NOT NULL DEFAULT true,
      created_by uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token_hash varchar(255) NOT NULL,
      parent_id uuid,
      user_agent text,
      ip_address varchar(64),
      revoked_at timestamp,
      revoked_reason varchar(64),
      expires_at timestamp NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS verification_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      email varchar(255) NOT NULL,
      purpose varchar(32) NOT NULL,
      token_hash varchar(255) NOT NULL,
      consumed_at timestamp,
      expires_at timestamp NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      email varchar(255),
      event varchar(64) NOT NULL,
      ip_address varchar(64),
      user_agent text,
      metadata jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS signup_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ip_address varchar(64) NOT NULL,
      email varchar(255),
      succeeded boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      key varchar(128) NOT NULL UNIQUE,
      value_encrypted text NOT NULL DEFAULT '{}',
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);

  // Phase 4 — Accounting tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chart_of_accounts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      kode varchar(32) NOT NULL,
      nama varchar(255) NOT NULL,
      jenisAkun varchar(32),
      kelompok varchar(32),
      saldoNormal char(1) NOT NULL DEFAULT 'D',
      isPostable boolean NOT NULL DEFAULT false,
      parent_id uuid REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
      is_seeded boolean NOT NULL DEFAULT false,
      is_system_default boolean NOT NULL DEFAULT false,
      isActive boolean NOT NULL DEFAULT true,
      level integer NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      UNIQUE(tenant_id, kode)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      no_jurnal varchar(64) NOT NULL,
      tanggal date NOT NULL,
      bulan integer NOT NULL,
      tahun integer NOT NULL,
      keterangan text,
      referensi varchar(128),
      tipeTransaksi varchar(32) NOT NULL DEFAULT 'jurnal_umum',
      isPosted boolean NOT NULL DEFAULT true,
      isLocked boolean NOT NULL DEFAULT false,
      created_by uuid,
      created_at timestamp NOT NULL DEFAULT now(),
      UNIQUE(tenant_id, no_jurnal)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS journal_lines (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
      akun_id uuid NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
      debit numeric(18,2) NOT NULL DEFAULT 0,
      kredit numeric(18,2) NOT NULL DEFAULT 0,
      keterangan text,
      unit_usaha varchar(64),
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS financial_periods (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      tahun integer NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'OPEN',
      closed_at timestamp,
      closed_by uuid,
      UNIQUE(tenant_id, tahun)
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_coa_tenant ON chart_of_accounts(tenant_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_coa_parent ON chart_of_accounts(parent_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_journal_entry_tenant ON journal_entries(tenant_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_journal_entry_tanggal ON journal_entries(tenant_id, tahun, bulan);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(entry_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_journal_lines_akun ON journal_lines(akun_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_financial_periods_tenant ON financial_periods(tenant_id);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
      user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      provider varchar(32) NOT NULL DEFAULT 'tripay',
      merchant_ref varchar(64) NOT NULL UNIQUE,
      reference varchar(128),
      amount integer NOT NULL DEFAULT 1000000,
      fee integer NOT NULL DEFAULT 0,
      total_amount integer NOT NULL DEFAULT 1000000,
      status varchar(32) NOT NULL DEFAULT 'pending',
      checkout_url text,
      raw_payload jsonb,
      paid_at timestamp,
      expires_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);`);

  // Announcements / Broadcast messages
  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      message text NOT NULL,
      type varchar(16) NOT NULL DEFAULT 'info',
      active boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(),
      created_by uuid REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // Idempotent alterations for existing databases
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_tenant_id_key') THEN
        ALTER TABLE users ADD CONSTRAINT users_tenant_id_key UNIQUE (tenant_id);
      END IF;
    END $$;
  `);

  // Phase 4 — Accounting idempotent alterations for existing databases
  await pool.query(`ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS jenisAkun varchar(32);`);
  await pool.query(`ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS kelompok varchar(32);`);
  await pool.query(`ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS saldoNormal char(1) NOT NULL DEFAULT 'D';`);
  await pool.query(`ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS isPostable boolean NOT NULL DEFAULT true;`);
  await pool.query(`ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES chart_of_accounts(id) ON DELETE SET NULL;`);
  await pool.query(`ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS isActive boolean NOT NULL DEFAULT true;`);
  await pool.query(`ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS is_seeded boolean NOT NULL DEFAULT false;`);
  await pool.query(`ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS is_system_default boolean NOT NULL DEFAULT false;`);

  // Fix FK parent_id -> ON DELETE RESTRICT (drop old auto-named constraint, re-add)
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname LIKE '%parent_id%'
          AND conrelid = 'chart_of_accounts'::regclass AND contype = 'f'
      ) THEN
        EXECUTE (
          SELECT 'ALTER TABLE chart_of_accounts DROP CONSTRAINT ' || conname
          FROM pg_constraint WHERE conname LIKE '%parent_id%'
            AND conrelid = 'chart_of_accounts'::regclass AND contype = 'f'
          LIMIT 1
        );
      END IF;
    END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_coa_parent' AND conrelid = 'chart_of_accounts'::regclass) THEN
        ALTER TABLE chart_of_accounts ADD CONSTRAINT fk_coa_parent
          FOREIGN KEY (parent_id) REFERENCES chart_of_accounts(id) ON DELETE RESTRICT;
      END IF;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END $$;
  `);

  // Backfill is_system_default to mirror is_seeded (safe + idempotent).
  // Do NOT blanket-flip is_seeded here — that would convert user-created
  // custom accounts (is_seeded=false) into system accounts on every restart.
  await pool.query(`UPDATE chart_of_accounts SET is_system_default=true WHERE is_seeded=true AND is_system_default=false;`);

  // Indexes
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tenants_created_by ON tenants(created_by);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);`);

  // Login lockout columns (idempotent)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count integer NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until timestamp;`);

  // Phase 3 — BUM Desa profile columns
  await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nomor_sertifikat varchar(128);`);
  await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nomor_perdes varchar(128);`);
  await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS telpon varchar(64);`);

  await pool.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS referensi varchar(128);`);
}
