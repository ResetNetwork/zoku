-- Add database indexes for common query patterns
-- These indexes improve performance on frequently accessed columns

-- Index on qupts.timestamp for recent activity queries
-- Used by: Dashboard recent qupts, entanglement activity streams
CREATE INDEX IF NOT EXISTS idx_qupts_timestamp ON qupts(timestamp);

-- Composite index on qupts for entanglement activity queries
-- Used by: Entanglement detail page, filtered qupts by entanglement
CREATE INDEX IF NOT EXISTS idx_qupts_entanglement_timestamp ON qupts(entanglement_id, timestamp);

-- Index on audit_log.timestamp for audit log filtering
-- Used by: Audit log page, user activity history
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);

-- Composite index for audit logs by user
-- Used by: User activity tracking, per-user audit queries
CREATE INDEX IF NOT EXISTS idx_audit_log_zoku_timestamp ON audit_log(zoku_id, timestamp);

-- Index on sources.last_sync for scheduled sync prioritization
-- Used by: Cron job to determine which sources need syncing
CREATE INDEX IF NOT EXISTS idx_sources_last_sync ON sources(last_sync);

-- Index on qupts.source for filtering by source type
-- Used by: Source-specific qupt queries, dashboard filters
CREATE INDEX IF NOT EXISTS idx_qupts_source ON qupts(source);

-- Composite index for source-specific entanglement queries
-- Used by: "Show me all GitHub events for this entanglement"
CREATE INDEX IF NOT EXISTS idx_qupts_entanglement_source ON qupts(entanglement_id, source);
