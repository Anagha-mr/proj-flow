-- Sprint 4: Document Centre Migration
-- Run each statement individually in the Supabase SQL Editor

-- ─── Table: documents ────────────────────────────────────────────────────────

CREATE TABLE documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id          UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  category           TEXT NOT NULL CHECK (category IN (
                       'Drawings',
                       'Specifications',
                       'Site Photos',
                       'Contracts',
                       'Reports',
                       'Client Shared',
                       'Contractor Shared'
                     )),
  file_url           TEXT NOT NULL,
  file_type          TEXT NOT NULL,
  file_size_bytes    BIGINT,
  version_number     INTEGER NOT NULL DEFAULT 1,
  version_status     TEXT NOT NULL DEFAULT 'latest_issued'
                       CHECK (version_status IN ('latest_issued', 'superseded', 'archived')),
  access_level       TEXT NOT NULL DEFAULT 'internal'
                       CHECK (access_level IN ('internal', 'client_visible', 'contractor_visible', 'public')),
  uploaded_by_id     UUID NOT NULL REFERENCES users(id),
  previous_version_id UUID REFERENCES documents(id),
  share_token        UUID UNIQUE DEFAULT gen_random_uuid(),
  share_token_expires_at TIMESTAMPTZ,
  share_enabled      BOOLEAN NOT NULL DEFAULT false,
  description        TEXT,
  tags               TEXT[],
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Trigger ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER set_updated_at_documents
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_documents_studio_id ON documents(studio_id);
CREATE INDEX idx_documents_share_token ON documents(share_token);
CREATE INDEX idx_documents_previous_version_id ON documents(previous_version_id);

-- ─── Table: document_access_logs ─────────────────────────────────────────────

CREATE TABLE document_access_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id        UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  studio_id          UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  accessed_by_type   TEXT NOT NULL CHECK (accessed_by_type IN ('studio_member', 'client', 'contractor', 'public')),
  accessed_by_id     UUID,
  accessed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address         TEXT,
  user_agent         TEXT
);

CREATE INDEX idx_document_access_logs_document_id ON document_access_logs(document_id);
CREATE INDEX idx_document_access_logs_studio_id ON document_access_logs(studio_id);

-- ─── Enable RLS ───────────────────────────────────────────────────────────────

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access_logs ENABLE ROW LEVEL SECURITY;

-- ─── RLS: documents ───────────────────────────────────────────────────────────

CREATE POLICY "Studio members can view documents"
  ON documents FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert documents"
  ON documents FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update documents"
  ON documents FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete documents"
  ON documents FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Public share token access"
  ON documents FOR SELECT
  USING (
    share_enabled = true
    AND (share_token_expires_at IS NULL OR share_token_expires_at > now())
  );

-- ─── RLS: document_access_logs ────────────────────────────────────────────────

CREATE POLICY "Studio members can view access logs"
  ON document_access_logs FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Anyone can insert access logs"
  ON document_access_logs FOR INSERT
  WITH CHECK (true);
