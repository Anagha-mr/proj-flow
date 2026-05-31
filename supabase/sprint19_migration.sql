-- Sprint 19: Weekly Client Narrative
-- Run this migration in the Supabase SQL editor

-- ── 1. weekly_narratives table ────────────────────────────────────────────────

CREATE TABLE weekly_narratives (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id             UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  week_start_date       DATE NOT NULL,
  generated_text        TEXT NOT NULL,
  edited_text           TEXT,
  final_text            TEXT GENERATED ALWAYS AS (COALESCE(edited_text, generated_text)) STORED,
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'approved', 'sent', 'skipped', 'failed')),
  language              TEXT NOT NULL DEFAULT 'en',
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at           TIMESTAMPTZ,
  reviewed_by_id        UUID REFERENCES users(id),
  sent_at               TIMESTAMPTZ,
  whatsapp_message_id   UUID REFERENCES whatsapp_messages(id),
  context_snapshot      JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, week_start_date)
);

CREATE OR REPLACE TRIGGER set_updated_at_weekly_narratives
  BEFORE UPDATE ON weekly_narratives
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE weekly_narratives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members can select weekly narratives"
  ON weekly_narratives FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert weekly narratives"
  ON weekly_narratives FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update weekly narratives"
  ON weekly_narratives FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete weekly narratives"
  ON weekly_narratives FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE INDEX idx_weekly_narratives_studio_id ON weekly_narratives(studio_id);
CREATE INDEX idx_weekly_narratives_project_id ON weekly_narratives(project_id);
CREATE INDEX idx_weekly_narratives_week_start ON weekly_narratives(studio_id, week_start_date);
CREATE INDEX idx_weekly_narratives_status ON weekly_narratives(studio_id, status);

-- ── 2. New columns on projects ────────────────────────────────────────────────

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS narrative_frequency TEXT
    CHECK (narrative_frequency IN ('weekly', 'biweekly', 'paused'))
    DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS narrative_language TEXT DEFAULT 'en';

-- ── 3. New column on clients ──────────────────────────────────────────────────

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';
