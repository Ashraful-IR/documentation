-- ============================================================================
-- 0000_init.sql — documentation platform core schema
-- Six tables, ltree-backed navigation tree, fractional sort_key, soft deletes.
-- ============================================================================

-- Install ltree in `public` *before* touching search_path: the app connects
-- with the default search_path and casts `::ltree` in raw SQL, so the type
-- must be resolvable from `public`. (Installing it while search_path points at
-- `documentation` makes it invisible to app connections — see migrate.ts.)
CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA public;

SET search_path TO documentation, public;

CREATE SCHEMA IF NOT EXISTS documentation;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');
CREATE TYPE nav_type AS ENUM ('FOLDER', 'DOCUMENT', 'LINK');
CREATE TYPE document_status AS ENUM ('DRAFT', 'PUBLISHED');

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

CREATE TABLE documentation.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'VIEWER',
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_unique ON documentation.users (email);
CREATE INDEX users_role_idx ON documentation.users (role);

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------

CREATE TABLE documentation.documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  content          JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  content_text     TEXT,
  status           document_status NOT NULL DEFAULT 'DRAFT',
  current_version  INT NOT NULL DEFAULT 1,
  created_by       UUID REFERENCES documentation.users(id),
  updated_by       UUID REFERENCES documentation.users(id),
  published_by     UUID REFERENCES documentation.users(id),
  published_at     TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX documents_search_idx ON documentation.documents
  USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content_text, '')));

-- ---------------------------------------------------------------------------
-- document_versions — created only on publish / manual checkpoint (§13)
-- ---------------------------------------------------------------------------

CREATE TABLE documentation.document_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID NOT NULL REFERENCES documentation.documents(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  title          TEXT NOT NULL,
  content        JSONB NOT NULL,
  change_summary TEXT,
  created_by     UUID REFERENCES documentation.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number)
);

CREATE INDEX doc_versions_doc_idx ON documentation.document_versions (document_id);

-- ---------------------------------------------------------------------------
-- navigation — self-referencing tree with ltree materialized path
-- ---------------------------------------------------------------------------

CREATE TABLE documentation.navigation (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id    UUID REFERENCES documentation.navigation(id) ON DELETE CASCADE,
  path         LTREE NOT NULL,
  type         nav_type NOT NULL,
  title        TEXT NOT NULL,
  slug         TEXT NOT NULL,
  document_id  UUID REFERENCES documentation.documents(id),
  link_url     TEXT,
  icon         TEXT,
  description  TEXT,
  sort_key     TEXT NOT NULL,
  is_visible   BOOLEAN NOT NULL DEFAULT true,
  deleted_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES documentation.users(id),
  updated_by   UUID REFERENCES documentation.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT slug_unique_per_parent UNIQUE (parent_id, slug)
);

CREATE INDEX nav_parent_idx ON documentation.navigation (parent_id) WHERE deleted_at IS NULL;
CREATE INDEX nav_path_idx ON documentation.navigation USING GIST (path);
CREATE INDEX nav_document_idx ON documentation.navigation (document_id);

-- ---------------------------------------------------------------------------
-- media
-- ---------------------------------------------------------------------------

CREATE TABLE documentation.media (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename      TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size          INT NOT NULL,
  path          TEXT NOT NULL,
  uploaded_by   UUID REFERENCES documentation.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX media_uploaded_by_idx ON documentation.media (uploaded_by);

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------

CREATE TABLE documentation.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES documentation.users(id),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_entity_idx ON documentation.audit_logs (entity_type, entity_id);
CREATE INDEX audit_created_at_idx ON documentation.audit_logs (created_at);
