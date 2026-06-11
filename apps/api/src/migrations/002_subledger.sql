-- Migration: Sub-Ledger Master Data Tables
-- File: apps/api/src/migrations/002_subledger.sql
-- Aman untuk existing schema — zero breaking changes.
-- Three new tables: contacts, inventory_items, fixed_assets

BEGIN;

-- ─── contacts (Suplier / Pelanggan) ─────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nama         varchar(255) NOT NULL,
  tipe         varchar(20)  NOT NULL CHECK (tipe IN ('supplier', 'pelanggan')),
  telepon      varchar(50),
  alamat       text,
  akun_id      uuid NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  saldo_awal   numeric(18,2) NOT NULL DEFAULT 0,
  saldo_awal_tipe varchar(6) NOT NULL CHECK (saldo_awal_tipe IN ('debit', 'kredit')),
  created_at   timestamp NOT NULL DEFAULT now(),
  updated_at   timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant  ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_akun    ON contacts(tenant_id, akun_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tipe    ON contacts(tenant_id, tipe);

-- ─── inventory_items (Barang / Perlengkapan) ────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nama           varchar(255) NOT NULL,
  kode           varchar(64),
  satuan         varchar(32),
  akun_id        uuid NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  qty_awal       numeric(18,2) NOT NULL DEFAULT 0,
  harga_satuan   numeric(18,2) NOT NULL DEFAULT 0,
  saldo_awal     numeric(18,2) NOT NULL DEFAULT 0,
  created_at     timestamp NOT NULL DEFAULT now(),
  updated_at     timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_akun   ON inventory_items(tenant_id, akun_id);

-- ─── fixed_assets (Aset Tetap) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS fixed_assets (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nama                    varchar(255) NOT NULL,
  kategori                varchar(64)  NOT NULL DEFAULT 'lainnya'
                          CHECK (kategori IN ('kendaraan','bangunan','peralatan','tanah','lainnya')),
  akun_id                 uuid NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  tanggal_perolehan       date,
  harga_perolehan         numeric(18,2) NOT NULL DEFAULT 0,
  akumulasi_penyusutan    numeric(18,2) NOT NULL DEFAULT 0,
  nilai_buku_awal         numeric(18,2) NOT NULL DEFAULT 0,
  umur_manfaat_bulan      integer,
  created_at              timestamp NOT NULL DEFAULT now(),
  updated_at              timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_tenant ON fixed_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_akun   ON fixed_assets(tenant_id, akun_id);

COMMIT;
