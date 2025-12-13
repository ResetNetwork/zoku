-- Add authentication fields to zoku table
-- Fresh start migration - no data preservation needed

-- Add auth columns to zoku
ALTER TABLE zoku ADD COLUMN access_tier TEXT NOT NULL DEFAULT 'observed'
  CHECK (access_tier IN ('observed', 'coherent', 'entangled', 'prime'));
ALTER TABLE zoku ADD COLUMN email TEXT UNIQUE;
ALTER TABLE zoku ADD COLUMN cf_access_sub TEXT;
ALTER TABLE zoku ADD COLUMN last_login INTEGER;
ALTER TABLE zoku ADD COLUMN created_by TEXT;
ALTER TABLE zoku ADD COLUMN updated_by TEXT;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_zoku_email ON zoku(email);
CREATE INDEX IF NOT EXISTS idx_zoku_cf_sub ON zoku(cf_access_sub);
CREATE INDEX IF NOT EXISTS idx_zoku_access_tier ON zoku(access_tier);

-- Add owner to jewels
ALTER TABLE jewels ADD COLUMN owner_id TEXT REFERENCES zoku(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_jewels_owner ON jewels(owner_id);

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  zoku_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_zoku ON audit_log(zoku_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
