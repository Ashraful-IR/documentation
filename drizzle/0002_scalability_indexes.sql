-- ============================================================================
-- 0002_scalability_indexes.sql — Scalability improvements
-- Unique index on navigation.document_id (prevents orphan docs), plus
-- additional indexes for common query patterns.
-- ============================================================================

-- Ensure each document is linked to at most one navigation node.
-- Uses a partial unique index (only non-deleted nav nodes) so restored nodes
-- don't conflict with soft-deleted ones that still hold the old document_id.
CREATE UNIQUE INDEX IF NOT EXISTS nav_document_unique_active
  ON documentation.navigation (document_id)
  WHERE deleted_at IS NULL AND document_id IS NOT NULL;

-- Index for audit log cleanup (DELETE WHERE created_at < cutoff).
CREATE INDEX IF NOT EXISTS audit_cleanup_idx
  ON documentation.audit_logs (created_at);

-- Covering index for document search: avoids heap fetches for the common
-- title + content_text search path.
CREATE INDEX IF NOT EXISTS documents_content_text_idx
  ON documentation.documents (content_text)
  WHERE deleted_at IS NULL AND content_text IS NOT NULL;
