-- Add error tracking to sources table

ALTER TABLE sources ADD COLUMN last_error TEXT;
ALTER TABLE sources ADD COLUMN error_count INTEGER DEFAULT 0;
ALTER TABLE sources ADD COLUMN last_error_at INTEGER;
