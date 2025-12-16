-- Add OAuth Applications table for centralized OAuth credentials
CREATE TABLE IF NOT EXISTS oauth_applications (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'google', 'microsoft', 'slack', etc.
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL, -- encrypted with ENCRYPTION_KEY
  scopes TEXT NOT NULL, -- JSON array of scopes
  metadata TEXT, -- JSON for provider-specific config
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Add oauth_app_id to jewels table
ALTER TABLE jewels ADD COLUMN oauth_app_id TEXT REFERENCES oauth_applications(id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_oauth_applications_provider ON oauth_applications(provider);
CREATE INDEX IF NOT EXISTS idx_jewels_oauth_app_id ON jewels(oauth_app_id);
