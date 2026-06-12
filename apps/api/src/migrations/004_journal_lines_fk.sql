-- Migration: Add contact_id and inventory_item_id FK to journal_lines
-- This enables Buku Pembantu (subsidiary ledger) tracking
-- File: apps/api/src/migrations/004_journal_lines_fk.sql

BEGIN;

-- Add contact_id FK (for Utang/Piutang tracking)
ALTER TABLE journal_lines 
ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;

-- Add inventory_item_id FK (for Persediaan tracking)
ALTER TABLE journal_lines 
ADD COLUMN IF NOT EXISTS inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL;

-- Indexes for fast Buku Pembantu queries
CREATE INDEX IF NOT EXISTS idx_journal_lines_contact ON journal_lines(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_lines_inventory ON journal_lines(inventory_item_id) WHERE inventory_item_id IS NOT NULL;

COMMIT;
