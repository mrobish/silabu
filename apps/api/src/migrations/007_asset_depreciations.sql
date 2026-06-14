-- 007_asset_depreciations.sql
-- Migration for asset_depreciations table (Fix #3 — Depresiasi tracking)
-- Idempotent: safe to run multiple times, even if table already exists
-- Created: 2026-06-14

-- Step 1: Create table (IF NOT EXISTS handles existing table)
CREATE TABLE IF NOT EXISTS asset_depreciations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id        UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  tahun           INTEGER NOT NULL,
  bulan           INTEGER NOT NULL,
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  amount          NUMERIC(15,2) NOT NULL,
  created_at      TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- Step 2: Add constraints (only if they don't exist)
-- Note: PostgreSQL doesn't support IF NOT EXISTS for constraints directly,
-- so we use DO blocks to check pg_constraint

-- UNIQUE(tenant_id, asset_id, tahun, bulan)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'asset_depreciations'::regclass
    AND contype = 'u'
    AND conname LIKE '%tenant_id%asset_id%tahun%bulan%'
  ) THEN
    ALTER TABLE asset_depreciations
      ADD CONSTRAINT asset_depr_unique_period
      UNIQUE (tenant_id, asset_id, tahun, bulan);
  END IF;
END $$;

-- CHECK: bulan BETWEEN 1 AND 12
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'asset_depreciations'::regclass
    AND contype = 'c'
    AND conname = 'asset_depr_bulan_range'
  ) THEN
    ALTER TABLE asset_depreciations
      ADD CONSTRAINT asset_depr_bulan_range
      CHECK (bulan BETWEEN 1 AND 12);
  END IF;
END $$;

-- CHECK: tahun >= 2000
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'asset_depreciations'::regclass
    AND contype = 'c'
    AND conname = 'asset_depr_tahun_min'
  ) THEN
    ALTER TABLE asset_depreciations
      ADD CONSTRAINT asset_depr_tahun_min
      CHECK (tahun >= 2000);
  END IF;
END $$;

-- CHECK: amount >= 0
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'asset_depreciations'::regclass
    AND contype = 'c'
    AND conname = 'asset_depr_amount_pos'
  ) THEN
    ALTER TABLE asset_depreciations
      ADD CONSTRAINT asset_depr_amount_pos
      CHECK (amount >= 0);
  END IF;
END $$;

-- Step 3: Create indexes (IF NOT EXISTS handles existing indexes)
CREATE INDEX IF NOT EXISTS idx_asset_depr_tenant_period
  ON asset_depreciations (tenant_id, tahun, bulan);

CREATE INDEX IF NOT EXISTS idx_asset_depr_tenant_asset
  ON asset_depreciations (tenant_id, asset_id);

CREATE INDEX IF NOT EXISTS idx_asset_depr_journal_entry
  ON asset_depreciations (journal_entry_id);

-- Step 4: Comments (will update if exists, create if not)
COMMENT ON TABLE asset_depreciations IS 'Tracks monthly depreciation entries per asset. One record per (tenant, asset, year, month).';
COMMENT ON COLUMN asset_depreciations.amount IS 'Depreciation amount for this period (Rupiah)';
