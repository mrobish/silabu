-- Migration: Add qty column to journal_lines
-- For Persediaan (inventory) tracking — physical quantity
-- File: apps/api/src/migrations/005_journal_lines_qty.sql

BEGIN;

-- Add qty column for inventory item tracking
ALTER TABLE journal_lines 
ADD COLUMN IF NOT EXISTS qty numeric(18,2);

COMMIT;
