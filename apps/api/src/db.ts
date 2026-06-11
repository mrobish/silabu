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

  // Idempotent alterations for existing databases
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_tenant_id_key') THEN
        ALTER TABLE users ADD CONSTRAINT users_tenant_id_key UNIQUE (tenant_id);
      END IF;
    END $$;
  `);

  // Indexes
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tenants_created_by ON tenants(created_by);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);`);

  // Login lockout columns (idempotent)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count integer NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until timestamp;`);
}
