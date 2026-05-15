-- Sprint 8 Migration: Meetings, RFI Tracker, Snag List, Contractors
-- Run each statement individually in Supabase SQL Editor

-- ─── contractors ─────────────────────────────────────────────────────────────

CREATE TABLE contractors (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id                   UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  company_name                TEXT NOT NULL,
  company_type                TEXT,
  contact_name                TEXT NOT NULL,
  phone                       TEXT NOT NULL,
  email                       TEXT,
  whatsapp_number             TEXT,
  address                     TEXT,
  gstin                       TEXT,
  tax_bracket                 TEXT,
  site_supervisor_name        TEXT,
  site_supervisor_phone       TEXT,
  contractor_token            UUID NOT NULL DEFAULT gen_random_uuid(),
  contractor_token_expires_at TIMESTAMPTZ,
  is_active                   BOOLEAN NOT NULL DEFAULT true,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER set_updated_at_contractors
  BEFORE UPDATE ON contractors
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_contractors_studio_id ON contractors(studio_id);
CREATE UNIQUE INDEX idx_contractors_token ON contractors(contractor_token);

-- ─── project_contractors ─────────────────────────────────────────────────────

CREATE TABLE project_contractors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  studio_id     UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  scope_notes   TEXT,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, contractor_id)
);

CREATE INDEX idx_project_contractors_project_id    ON project_contractors(project_id);
CREATE INDEX idx_project_contractors_contractor_id ON project_contractors(contractor_id);

-- ─── meetings ────────────────────────────────────────────────────────────────

CREATE TABLE meetings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id     UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  meeting_type  TEXT NOT NULL CHECK (meeting_type IN (
                  'site_visit', 'design_review', 'client_presentation',
                  'contractor_briefing', 'internal', 'other'
                )),
  meeting_date  DATE NOT NULL,
  start_time    TIME,
  end_time      TIME,
  location      TEXT,
  attendees     JSONB NOT NULL DEFAULT '[]',
  agenda        TEXT,
  minutes       TEXT,
  action_items  JSONB NOT NULL DEFAULT '[]',
  created_by_id UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER set_updated_at_meetings
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_meetings_project_id   ON meetings(project_id);
CREATE INDEX idx_meetings_studio_id    ON meetings(studio_id);
CREATE INDEX idx_meetings_meeting_date ON meetings(meeting_date DESC);

-- ─── rfis ────────────────────────────────────────────────────────────────────

CREATE TABLE rfis (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id           UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contractor_id       UUID REFERENCES contractors(id),
  ref_number          TEXT NOT NULL,
  raised_by_type      TEXT NOT NULL CHECK (raised_by_type IN ('contractor', 'designer')),
  raised_by_id        UUID NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  linked_document_id  UUID REFERENCES documents(id),
  space_tag           TEXT,
  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'under_review', 'responded', 'closed')),
  response_deadline   TIMESTAMPTZ NOT NULL,
  response_text       TEXT,
  responded_by_id     UUID REFERENCES users(id),
  responded_at        TIMESTAMPTZ,
  escalated_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, ref_number)
);

CREATE OR REPLACE TRIGGER set_updated_at_rfis
  BEFORE UPDATE ON rfis
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_rfis_project_id        ON rfis(project_id);
CREATE INDEX idx_rfis_studio_id         ON rfis(studio_id);
CREATE INDEX idx_rfis_status            ON rfis(status);
CREATE INDEX idx_rfis_response_deadline ON rfis(response_deadline);

-- ─── snag_items ──────────────────────────────────────────────────────────────

CREATE TABLE snag_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id             UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  photo_url             TEXT NOT NULL,
  location_description  TEXT NOT NULL,
  plan_reference        TEXT,
  description           TEXT NOT NULL,
  assigned_to_type      TEXT NOT NULL CHECK (assigned_to_type IN ('contractor', 'vendor', 'designer')),
  assigned_to_id        UUID NOT NULL,
  due_date              DATE,
  status                TEXT NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'in_progress', 'resolved', 'client_signed_off')),
  resolution_photo_url  TEXT,
  resolution_note       TEXT,
  client_signed_off_at  TIMESTAMPTZ,
  client_signed_off_by  TEXT,
  created_by_id         UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER set_updated_at_snag_items
  BEFORE UPDATE ON snag_items
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_snag_items_project_id ON snag_items(project_id);
CREATE INDEX idx_snag_items_studio_id  ON snag_items(studio_id);
CREATE INDEX idx_snag_items_status     ON snag_items(status);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE meetings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfis              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE snag_items        ENABLE ROW LEVEL SECURITY;

-- meetings policies
CREATE POLICY "Studio members can select meetings"
  ON meetings FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert meetings"
  ON meetings FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update meetings"
  ON meetings FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete meetings"
  ON meetings FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- rfis policies
CREATE POLICY "Studio members can select rfis"
  ON rfis FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert rfis"
  ON rfis FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update rfis"
  ON rfis FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete rfis"
  ON rfis FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- contractors policies
CREATE POLICY "Studio members can select contractors"
  ON contractors FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert contractors"
  ON contractors FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update contractors"
  ON contractors FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete contractors"
  ON contractors FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- project_contractors policies
CREATE POLICY "Studio members can select project_contractors"
  ON project_contractors FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert project_contractors"
  ON project_contractors FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete project_contractors"
  ON project_contractors FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- snag_items policies
CREATE POLICY "Studio members can select snag_items"
  ON snag_items FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert snag_items"
  ON snag_items FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update snag_items"
  ON snag_items FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete snag_items"
  ON snag_items FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));
