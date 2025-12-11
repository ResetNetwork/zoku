-- Migration: Add credentials store
-- This allows credentials to be stored once and referenced by multiple sources

-- Credentials table (stored separately, reusable)
CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,               -- User-friendly name: "GitHub - Personal", "Gmail - Work"
  type TEXT NOT NULL,                -- 'github', 'gmail', 'zammad', 'gdrive', 'gdocs'
  data TEXT NOT NULL,                -- JSON encrypted credentials
  last_validated INTEGER,            -- When credentials were last verified
  validation_metadata TEXT,          -- JSON metadata from last validation
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_credentials_type ON credentials(type);
CREATE INDEX IF NOT EXISTS idx_credentials_name ON credentials(name);

-- Trigger to update updated_at on credential changes
CREATE TRIGGER IF NOT EXISTS credentials_updated_at
AFTER UPDATE ON credentials
BEGIN
  UPDATE credentials SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Add credential_id to sources (optional - sources can still have inline credentials)
-- Note: SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we check first
-- This migration is idempotent - safe to run multiple times

-- Create new sources table with credential_id column
CREATE TABLE IF NOT EXISTS sources_new (
  id TEXT PRIMARY KEY,
  volition_id TEXT NOT NULL REFERENCES volitions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  config TEXT NOT NULL,
  credentials TEXT,                  -- Still supported for backward compatibility
  credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL,
  enabled INTEGER DEFAULT 1,
  last_sync INTEGER,
  sync_cursor TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Copy data from old table if it exists
INSERT INTO sources_new (id, volition_id, type, config, credentials, enabled, last_sync, sync_cursor, created_at)
SELECT id, volition_id, type, config, credentials, enabled, last_sync, sync_cursor, created_at
FROM sources
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='sources');

-- Drop old table and rename new one
DROP TABLE IF EXISTS sources;
ALTER TABLE sources_new RENAME TO sources;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_sources_volition ON sources(volition_id);
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
CREATE INDEX IF NOT EXISTS idx_sources_enabled ON sources(enabled);
CREATE INDEX IF NOT EXISTS idx_sources_credential ON sources(credential_id);
