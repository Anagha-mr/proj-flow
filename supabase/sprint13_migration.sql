-- Sprint 13: Canva Moodboard Embed
-- Run each statement individually in Supabase SQL Editor

-- ─── moodboards table ─────────────────────────────────────────────────────────

CREATE TABLE moodboards (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id           UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  canva_design_id     TEXT,
  canva_embed_url     TEXT,
  canva_edit_url      TEXT,
  canva_export_url    TEXT,
  thumbnail_url       TEXT,
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'shared_with_client', 'approved', 'archived')),
  share_token         UUID UNIQUE DEFAULT gen_random_uuid(),
  is_client_visible   BOOLEAN NOT NULL DEFAULT false,
  client_feedback     TEXT,
  client_approved_at  TIMESTAMPTZ,
  client_approved_by  TEXT,
  display_order       INT NOT NULL DEFAULT 0,
  created_by_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── trigger ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER set_updated_at_moodboards
  BEFORE UPDATE ON moodboards
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_moodboards_project_id ON moodboards(project_id);
CREATE INDEX idx_moodboards_studio_id ON moodboards(studio_id);
CREATE INDEX idx_moodboards_share_token ON moodboards(share_token);
CREATE INDEX idx_moodboards_display_order ON moodboards(project_id, display_order);

-- ─── studios Canva OAuth columns ──────────────────────────────────────────────

ALTER TABLE studios
  ADD COLUMN IF NOT EXISTS canva_access_token TEXT;

ALTER TABLE studios
  ADD COLUMN IF NOT EXISTS canva_refresh_token TEXT;

ALTER TABLE studios
  ADD COLUMN IF NOT EXISTS canva_token_expires_at TIMESTAMPTZ;

ALTER TABLE studios
  ADD COLUMN IF NOT EXISTS canva_user_id TEXT;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE moodboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members can select moodboards"
  ON moodboards FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert moodboards"
  ON moodboards FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update moodboards"
  ON moodboards FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete moodboards"
  ON moodboards FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));
