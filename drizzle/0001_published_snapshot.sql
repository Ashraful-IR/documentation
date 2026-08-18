-- ============================================================================
-- 0001_published_snapshot.sql — separate the live (published) content from the
-- working copy so autosaves only ever touch the draft, never what readers see.
--
-- `documents.content` remains the working copy (what the editor autosaves).
-- `published_title` / `published_content` hold the last published snapshot;
-- the documentation viewer renders those, so a publish action is what takes
-- edits live. Existing PUBLISHED documents keep showing their current content.
-- ============================================================================

ALTER TABLE documentation.documents
  ADD COLUMN published_title TEXT,
  ADD COLUMN published_content JSONB;

UPDATE documentation.documents
SET published_title = title,
    published_content = content
WHERE status = 'PUBLISHED';
