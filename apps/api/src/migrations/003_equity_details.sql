-- Migration: Equity Details (Rincian Modal / Ekuitas)
-- File: apps/api/src/migrations/003_equity_details.sql
-- Zero breaking changes: tabel baru, tidak sentuh schema existing.

BEGIN;

CREATE TABLE IF NOT EXISTS equity_details (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sumber          varchar(64) NOT NULL DEFAULT 'Lainnya'
                  CHECK (sumber IN ('Pemerintah Desa', 'Masyarakat', 'Lainnya')),
  tahun_penerimaan integer NOT NULL,
  keterangan      text,
  akun_id         uuid NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  saldo_awal      numeric(18,2) NOT NULL DEFAULT 0,
  created_at      timestamp NOT NULL DEFAULT now(),
  updated_at      timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equity_tenant   ON equity_details(tenant_id);
CREATE INDEX IF NOT EXISTS idx_equity_akun     ON equity_details(tenant_id, akun_id);
CREATE INDEX IF NOT EXISTS idx_equity_tahun    ON equity_details(tenant_id, tahun_penerimaan);

COMMIT;
