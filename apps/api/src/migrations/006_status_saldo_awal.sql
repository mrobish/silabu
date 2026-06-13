-- Migration: Add status_saldo_awal to tenants (Draft & Posting system)
-- Replaces binary lock with state machine: DRAFT → POSTED
-- File: apps/api/src/migrations/006_status_saldo_awal.sql

BEGIN;

-- Add status column
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS status_saldo_awal varchar(16) NOT NULL DEFAULT 'DRAFT';

-- Migrate existing data: locked=true → POSTED, locked=false → DRAFT
UPDATE tenants SET status_saldo_awal = 'POSTED' WHERE saldo_awal_locked = true;
UPDATE tenants SET status_saldo_awal = 'DRAFT' WHERE saldo_awal_locked = false OR saldo_awal_locked IS NULL;

-- Add check constraint
ALTER TABLE tenants 
ADD CONSTRAINT tenants_status_saldo_awal_check 
CHECK (status_saldo_awal IN ('DRAFT', 'POSTED'));

COMMIT;
