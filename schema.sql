-- The Great Game Database Schema

-- Entanglements (projects/initiatives)
CREATE TABLE IF NOT EXISTS entanglements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent_id TEXT REFERENCES entanglements(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_entanglements_parent ON entanglements(parent_id);

-- Trigger to update updated_at on entanglement changes
CREATE TRIGGER IF NOT EXISTS entanglements_updated_at
AFTER UPDATE ON entanglements
BEGIN
  UPDATE entanglements SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Zoku (humans and AI agents)
CREATE TABLE IF NOT EXISTS zoku (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('human', 'agent')),
  email TEXT UNIQUE,
  access_tier TEXT NOT NULL DEFAULT 'observed' CHECK (access_tier IN ('observed', 'coherent', 'entangled', 'prime')),
  cf_access_sub TEXT,
  last_login INTEGER,
  created_by TEXT,
  updated_by TEXT,
  description TEXT,
  metadata TEXT,              -- JSON blob
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_zoku_email ON zoku(email);
CREATE INDEX IF NOT EXISTS idx_zoku_cf_sub ON zoku(cf_access_sub);
CREATE INDEX IF NOT EXISTS idx_zoku_access_tier ON zoku(access_tier);

-- PASCI responsibility matrix
CREATE TABLE IF NOT EXISTS entanglement_zoku (
  entanglement_id TEXT NOT NULL REFERENCES entanglements(id) ON DELETE CASCADE,
  zoku_id TEXT NOT NULL REFERENCES zoku(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('perform', 'accountable', 'control', 'support', 'informed')),
  linked_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (entanglement_id, zoku_id, role)
);

CREATE INDEX IF NOT EXISTS idx_entanglement_zoku_entanglement ON entanglement_zoku(entanglement_id);

-- Qupts (activity records)
CREATE TABLE IF NOT EXISTS qupts (
  id TEXT PRIMARY KEY,
  entanglement_id TEXT NOT NULL REFERENCES entanglements(id) ON DELETE CASCADE,
  zoku_id TEXT REFERENCES zoku(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  source TEXT DEFAULT 'manual',  -- 'manual', 'github', 'gmail', 'zammad', 'gdrive', 'gdocs', 'webhook', 'mcp'
  external_id TEXT,              -- For deduplication: 'github:{id}', 'gmail:{id}', etc.
  metadata TEXT,                 -- JSON blob
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_qupts_entanglement ON qupts(entanglement_id);
CREATE INDEX IF NOT EXISTS idx_qupts_created ON qupts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qupts_external ON qupts(source, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_qupts_unique_external ON qupts(source, external_id) WHERE external_id IS NOT NULL;

-- Taxonomy dimensions
CREATE TABLE IF NOT EXISTS dimensions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,        -- 'function', 'pillar', 'service_area'
  label TEXT NOT NULL,              -- 'Function', 'Pillar', 'Service Area'
  description TEXT,
  allow_multiple INTEGER DEFAULT 0, -- Can entanglement have multiple values?
  parent_dimension_id TEXT REFERENCES dimensions(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Dimension values
CREATE TABLE IF NOT EXISTS dimension_values (
  id TEXT PRIMARY KEY,
  dimension_id TEXT NOT NULL REFERENCES dimensions(id) ON DELETE CASCADE,
  value TEXT NOT NULL,              -- 'tech_innovation'
  label TEXT NOT NULL,              -- 'Technology Innovation'
  description TEXT,
  parent_value_id TEXT REFERENCES dimension_values(id),
  depends_on_value_id TEXT REFERENCES dimension_values(id),
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(dimension_id, value)
);

CREATE INDEX IF NOT EXISTS idx_dimension_values_dimension ON dimension_values(dimension_id);
CREATE INDEX IF NOT EXISTS idx_dimension_values_parent ON dimension_values(parent_value_id);

-- Entanglement attributes (taxonomy assignments)
CREATE TABLE IF NOT EXISTS entanglement_attributes (
  entanglement_id TEXT NOT NULL REFERENCES entanglements(id) ON DELETE CASCADE,
  dimension_id TEXT NOT NULL REFERENCES dimensions(id) ON DELETE CASCADE,
  value_id TEXT NOT NULL REFERENCES dimension_values(id) ON DELETE CASCADE,
  assigned_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (entanglement_id, dimension_id, value_id)
);

CREATE INDEX IF NOT EXISTS idx_entanglement_attributes_entanglement ON entanglement_attributes(entanglement_id);
CREATE INDEX IF NOT EXISTS idx_entanglement_attributes_dimension ON entanglement_attributes(dimension_id);
CREATE INDEX IF NOT EXISTS idx_entanglement_attributes_value ON entanglement_attributes(value_id);

-- Sources (external activity sources)
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  entanglement_id TEXT NOT NULL REFERENCES entanglements(id) ON DELETE CASCADE,
  type TEXT NOT NULL,           -- 'github', 'gmail', 'zammad', 'gdrive', 'gdocs', 'webhook'
  config TEXT NOT NULL,         -- JSON configuration
  credentials TEXT,             -- JSON encrypted credentials (tokens, etc.)
  jewel_id TEXT REFERENCES jewels(id) ON DELETE SET NULL,
  enabled INTEGER DEFAULT 1,
  last_sync INTEGER,            -- Last successful sync timestamp
  sync_cursor TEXT,             -- Pagination cursor for incremental sync
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  last_error_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sources_entanglement ON sources(entanglement_id);
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
CREATE INDEX IF NOT EXISTS idx_sources_enabled ON sources(enabled);
CREATE INDEX IF NOT EXISTS idx_sources_jewel ON sources(jewel_id);

-- Jewels (stored credentials for reuse across sources)
CREATE TABLE IF NOT EXISTS jewels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  owner_id TEXT REFERENCES zoku(id) ON DELETE CASCADE,
  last_validated INTEGER,
  validation_metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_jewels_type ON jewels(type);
CREATE INDEX IF NOT EXISTS idx_jewels_name ON jewels(name);
CREATE INDEX IF NOT EXISTS idx_jewels_owner ON jewels(owner_id);

-- Trigger to update updated_at on jewel changes
CREATE TRIGGER IF NOT EXISTS jewels_updated_at
AFTER UPDATE ON jewels
BEGIN
  UPDATE jewels SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Audit log table
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
