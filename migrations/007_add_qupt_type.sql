-- Add qupt_type column for formal type system
ALTER TABLE qupts ADD COLUMN qupt_type TEXT;

-- Create index for type-based queries
CREATE INDEX IF NOT EXISTS idx_qupts_type ON qupts(qupt_type);

-- Backfill existing qupts based on source and metadata
UPDATE qupts SET qupt_type = 
  CASE 
    -- GitHub events
    WHEN source = 'github' AND json_extract(metadata, '$.event_type') = 'PushEvent' THEN 'github:push'
    WHEN source = 'github' AND json_extract(metadata, '$.event_type') = 'PullRequestEvent' THEN 'github:pull_request'
    WHEN source = 'github' AND json_extract(metadata, '$.event_type') = 'IssuesEvent' THEN 'github:issue'
    WHEN source = 'github' AND json_extract(metadata, '$.event_type') = 'IssueCommentEvent' THEN 'github:issue_comment'
    WHEN source = 'github' AND json_extract(metadata, '$.event_type') = 'PullRequestReviewCommentEvent' THEN 'github:pr_comment'
    WHEN source = 'github' AND json_extract(metadata, '$.event_type') = 'ReleaseEvent' THEN 'github:release'
    WHEN source = 'github' THEN 'github:push'
    -- Google Drive events
    WHEN source = 'gdrive' AND json_extract(metadata, '$.type') = 'revision' THEN 'gdrive:revision'
    WHEN source = 'gdrive' AND json_extract(metadata, '$.type') = 'comment' THEN 'gdrive:comment'
    WHEN source = 'gdrive' AND json_extract(metadata, '$.type') = 'file_created' THEN 'gdrive:file_created'
    WHEN source = 'gdrive' AND json_extract(metadata, '$.type') = 'file_renamed' THEN 'gdrive:file_renamed'
    WHEN source = 'gdrive' THEN 'gdrive:revision'
    -- Gmail events
    WHEN source = 'gmail' THEN 'gmail:message'
    -- Zammad events
    WHEN source = 'zammad' AND json_extract(metadata, '$.type') = 'article' THEN 'zammad:article'
    WHEN source = 'zammad' AND json_extract(metadata, '$.type') = 'ticket' THEN 'zammad:ticket'
    WHEN source = 'zammad' THEN 'zammad:ticket'
    -- Manual entries
    WHEN source = 'manual' THEN 'manual:note'
    -- MCP entries
    WHEN source = 'mcp' THEN 'manual:note'
    -- Fallback
    ELSE source || ':unknown'
  END
WHERE qupt_type IS NULL;
