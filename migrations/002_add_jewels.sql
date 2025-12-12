-- Migration: Add jewels store
-- This allows jewels to be stored once and referenced by multiple sources

-- Jewels table (stored separately, reusable)
CREATE TABLE IF NOT EXISTS jewels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,               -- User-friendly name: "GitHub - Personal", "Gmail - Work"
  type TEXT NOT NULL,                -- 'github', 'gmail', 'zammad', 'gdrive', 'gdocs'
  data TEXT NOT NULL,                -- JSON encrypted credentials
  last_validated INTEGER,            -- When credentials were last verified
  validation_metadata TEXT,          -- JSON metadata from last validation
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_jewels_type ON jewels(type);
CREATE INDEX IF NOT EXISTS idx_jewels_name ON jewels(name);

-- Trigger to update updated_at on jewel changes
CREATE TRIGGER IF NOT EXISTS jewels_updated_at
AFTER UPDATE ON jewels
BEGIN
  UPDATE jewels SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Add jewel_id to sources (optional - sources can still have inline credentials)
-- Note: SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we check first
-- This migration is idempotent - safe to run multiple times

-- Create sources table with jewel_id column (fresh start)
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  entanglement_id TEXT NOT NULL REFERENCES entanglements(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  config TEXT NOT NULL,
  credentials TEXT,                  -- Still supported for backward compatibility
  jewel_id TEXT REFERENCES jewels(id) ON DELETE SET NULL,
  enabled INTEGER DEFAULT 1,
  last_sync INTEGER,
  sync_cursor TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  last_error_at INTEGER
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sources_entanglement ON sources(entanglement_id);
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
CREATE INDEX IF NOT EXISTS idx_sources_enabled ON sources(enabled);
CREATE INDEX IF NOT EXISTS idx_sources_jewel ON sources(jewel_id);
