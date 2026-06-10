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
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email varchar(255) NOT NULL UNIQUE,
      email_verified_at timestamp,
      password_hash varchar(255),
      nama_lengkap varchar(255),
      avatar_url text,
      role varchar(32) NOT NULL DEFAULT 'bumdes',
      tenant_id uuid,
      auth_provider varchar(32) NOT NULL DEFAULT 'email',
      google_id varchar(64),
      is_active boolean NOT NULL DEFAULT true,
      last_login_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );

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

    CREATE TABLE IF NOT EXISTS verification_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      email varchar(255) NOT NULL,
      purpose varchar(32) NOT NULL,
      otp_hash varchar(255),
      magic_token_hash varchar(255),
      consumed_at timestamp,
      attempts integer NOT NULL DEFAULT 0,
      expires_at timestamp NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    );

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

    CREATE TABLE IF NOT EXISTS signup_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ip_address varchar(64) NOT NULL,
      email varchar(255),
      succeeded boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS users_google_id_idx ON users(google_id);
    CREATE INDEX IF NOT EXISTS users_tenant_idx ON users(tenant_id);
    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(refresh_token_hash);
    CREATE INDEX IF NOT EXISTS verification_email_purpose_idx ON verification_tokens(email, purpose);
    CREATE INDEX IF NOT EXISTS verification_magic_idx ON verification_tokens(magic_token_hash);
    CREATE INDEX IF NOT EXISTS audit_user_idx ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS audit_event_idx ON audit_logs(event);
    CREATE INDEX IF NOT EXISTS signup_ip_idx ON signup_attempts(ip_address, created_at);
  `);
}
