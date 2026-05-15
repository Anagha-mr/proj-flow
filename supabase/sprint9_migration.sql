-- Sprint 9 Migration: Time Tracking, Stage Payments, Contractor Queries, Spec Items
-- Run each CREATE TABLE individually in Supabase SQL Editor.

-- ─── time_entries ─────────────────────────────────────────────
CREATE TABLE time_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id             UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date            DATE NOT NULL,
  hours                 DECIMAL(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  phase_tag             TEXT,
  is_billable           BOOLEAN NOT NULL DEFAULT true,
  notes                 TEXT,
  hourly_rate_snapshot  DECIMAL(10,2) NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER set_updated_at_time_entries
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_time_entries_project_id ON time_entries(project_id);
CREATE INDEX idx_time_entries_studio_id  ON time_entries(studio_id);
CREATE INDEX idx_time_entries_user_id    ON time_entries(user_id);
CREATE INDEX idx_time_entries_entry_date ON time_entries(entry_date DESC);

-- ─── stage_payments ───────────────────────────────────────────
CREATE TABLE stage_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id         UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contractor_id     UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  milestone_name    TEXT NOT NULL,
  milestone_description TEXT,
  amount            DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  expected_date     DATE,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'released', 'received')),
  released_at       TIMESTAMPTZ,
  released_by_id    UUID REFERENCES users(id),
  received_at       TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER set_updated_at_stage_payments
  BEFORE UPDATE ON stage_payments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_stage_payments_project_id    ON stage_payments(project_id);
CREATE INDEX idx_stage_payments_studio_id     ON stage_payments(studio_id);
CREATE INDEX idx_stage_payments_contractor_id ON stage_payments(contractor_id);

-- ─── contractor_queries ───────────────────────────────────────
CREATE TABLE contractor_queries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id         UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contractor_id     UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  query_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  description       TEXT NOT NULL,
  assigned_to_id    UUID REFERENCES users(id),
  response_deadline TIMESTAMPTZ,
  response_text     TEXT,
  responded_by_id   UUID REFERENCES users(id),
  responded_at      TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'responded', 'closed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER set_updated_at_contractor_queries
  BEFORE UPDATE ON contractor_queries
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_contractor_queries_project_id    ON contractor_queries(project_id);
CREATE INDEX idx_contractor_queries_studio_id     ON contractor_queries(studio_id);
CREATE INDEX idx_contractor_queries_contractor_id ON contractor_queries(contractor_id);

-- ─── spec_items ───────────────────────────────────────────────
CREATE TABLE spec_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id               UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  space                   TEXT NOT NULL,
  surface                 TEXT NOT NULL CHECK (surface IN ('floor', 'wall', 'ceiling', 'joinery', 'other')),
  material_name           TEXT NOT NULL,
  finish_type             TEXT,
  supplier                TEXT,
  location_notes          TEXT,
  dimensions              TEXT,
  drawing_reference       TEXT,
  linked_procurement_id   UUID,
  revisions               JSONB NOT NULL DEFAULT '[]',
  created_by_id           UUID REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER set_updated_at_spec_items
  BEFORE UPDATE ON spec_items
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_spec_items_project_id ON spec_items(project_id);
CREATE INDEX idx_spec_items_studio_id  ON spec_items(studio_id);
CREATE INDEX idx_spec_items_space      ON spec_items(space);

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE spec_items ENABLE ROW LEVEL SECURITY;

-- time_entries policies
CREATE POLICY "Studio members can select time_entries"
  ON time_entries FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert time_entries"
  ON time_entries FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update time_entries"
  ON time_entries FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete time_entries"
  ON time_entries FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- stage_payments policies
CREATE POLICY "Studio members can select stage_payments"
  ON stage_payments FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert stage_payments"
  ON stage_payments FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update stage_payments"
  ON stage_payments FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete stage_payments"
  ON stage_payments FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- contractor_queries policies
CREATE POLICY "Studio members can select contractor_queries"
  ON contractor_queries FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert contractor_queries"
  ON contractor_queries FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update contractor_queries"
  ON contractor_queries FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete contractor_queries"
  ON contractor_queries FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- spec_items policies
CREATE POLICY "Studio members can select spec_items"
  ON spec_items FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert spec_items"
  ON spec_items FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update spec_items"
  ON spec_items FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete spec_items"
  ON spec_items FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));
