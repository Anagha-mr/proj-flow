-- Sprint 5: Procurement & Approvals Migration
-- Run each statement INDIVIDUALLY in the Supabase SQL Editor. Never batch.

-- ─── Table: procurement_schedules ────────────────────────────────────────────

CREATE TABLE procurement_schedules (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id            UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL DEFAULT 'Untitled',
  view_type            TEXT NOT NULL DEFAULT 'schedule_based'
                         CHECK (view_type IN ('room_based', 'schedule_based')),
  status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'in_review', 'approved', 'ordered', 'delivered')),
  owner_id             UUID REFERENCES users(id),
  is_client_published  BOOLEAN NOT NULL DEFAULT false,
  shared_with          JSONB DEFAULT '[]',
  is_archived          BOOLEAN NOT NULL DEFAULT false,
  client_can_view_supplier   BOOLEAN NOT NULL DEFAULT true,
  client_can_view_brand      BOOLEAN NOT NULL DEFAULT true,
  client_can_view_pricing    BOOLEAN NOT NULL DEFAULT false,
  client_can_view_details    BOOLEAN NOT NULL DEFAULT true,
  client_can_approve         BOOLEAN NOT NULL DEFAULT false,
  share_token          UUID UNIQUE DEFAULT gen_random_uuid(),
  share_token_expires_at TIMESTAMPTZ,
  share_enabled        BOOLEAN NOT NULL DEFAULT false,
  created_by_id        UUID REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Trigger: procurement_schedules ──────────────────────────────────────────

CREATE OR REPLACE TRIGGER set_updated_at_procurement_schedules
  BEFORE UPDATE ON procurement_schedules
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── Indexes: procurement_schedules ──────────────────────────────────────────

CREATE INDEX idx_procurement_schedules_project_id ON procurement_schedules(project_id);
CREATE INDEX idx_procurement_schedules_studio_id ON procurement_schedules(studio_id);
CREATE INDEX idx_procurement_schedules_share_token ON procurement_schedules(share_token);

-- ─── Table: procurement_items ─────────────────────────────────────────────────

CREATE TABLE procurement_items (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id                 UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id                UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  schedule_id               UUID NOT NULL REFERENCES procurement_schedules(id) ON DELETE CASCADE,
  room_or_category          TEXT,
  name                      TEXT NOT NULL,
  description               TEXT,
  product_code              TEXT,
  brand                     TEXT,
  supplier_name             TEXT,
  source_url                TEXT,
  dimensions_length         NUMERIC,
  dimensions_height         NUMERIC,
  dimensions_depth          NUMERIC,
  dimensions_unit           TEXT DEFAULT 'mm' CHECK (dimensions_unit IN ('mm', 'cm', 'inches', 'ft')),
  finish                    TEXT,
  material                  TEXT,
  quantity                  NUMERIC NOT NULL DEFAULT 1,
  unit_cost                 NUMERIC NOT NULL DEFAULT 0,
  total_cost                NUMERIC GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  image_url                 TEXT,
  quotation_attachment_url  TEXT,
  in_stock                  BOOLEAN,
  is_flagged                BOOLEAN NOT NULL DEFAULT false,
  is_archived               BOOLEAN NOT NULL DEFAULT false,
  position                  INTEGER NOT NULL DEFAULT 0,
  created_by_id             UUID REFERENCES users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Trigger: procurement_items ───────────────────────────────────────────────

CREATE OR REPLACE TRIGGER set_updated_at_procurement_items
  BEFORE UPDATE ON procurement_items
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── Indexes: procurement_items ───────────────────────────────────────────────

CREATE INDEX idx_procurement_items_schedule_id ON procurement_items(schedule_id);
CREATE INDEX idx_procurement_items_project_id ON procurement_items(project_id);
CREATE INDEX idx_procurement_items_studio_id ON procurement_items(studio_id);

-- ─── Table: procurement_item_status ──────────────────────────────────────────

CREATE TABLE procurement_item_status (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id                UUID NOT NULL UNIQUE REFERENCES procurement_items(id) ON DELETE CASCADE,
  studio_id              UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  curation_status        TEXT NOT NULL DEFAULT 'draft'
                           CHECK (curation_status IN (
                             'draft', 'hidden', 'quoting', 'selected',
                             'internal_review', 'internally_approved'
                           )),
  client_approval_status TEXT NOT NULL DEFAULT 'client_review'
                           CHECK (client_approval_status IN (
                             'client_review', 'approved', 'rejected', 'resubmit', 'closed'
                           )),
  procurement_status     TEXT NOT NULL DEFAULT 'ordered'
                           CHECK (procurement_status IN (
                             'ordered', 'in_production', 'in_transit', 'delivered', 'installed'
                           )),
  payment_status         TEXT NOT NULL DEFAULT 'invoiced'
                           CHECK (payment_status IN (
                             'invoiced', 'payment_due', 'partial_payment', 'paid'
                           )),
  client_comment         TEXT,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Trigger: procurement_item_status ────────────────────────────────────────

CREATE OR REPLACE TRIGGER set_updated_at_procurement_item_status
  BEFORE UPDATE ON procurement_item_status
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── Indexes: procurement_item_status ────────────────────────────────────────

CREATE INDEX idx_procurement_item_status_item_id ON procurement_item_status(item_id);
CREATE INDEX idx_procurement_item_status_studio_id ON procurement_item_status(studio_id);

-- ─── Enable RLS ───────────────────────────────────────────────────────────────

ALTER TABLE procurement_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_item_status ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies: procurement_schedules ─────────────────────────────────────

CREATE POLICY "Studio members can select schedules"
  ON procurement_schedules FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert schedules"
  ON procurement_schedules FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update schedules"
  ON procurement_schedules FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete schedules"
  ON procurement_schedules FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Public share token access for schedules"
  ON procurement_schedules FOR SELECT
  USING (
    share_enabled = true
    AND (share_token_expires_at IS NULL OR share_token_expires_at > now())
  );

-- ─── RLS Policies: procurement_items ─────────────────────────────────────────

CREATE POLICY "Studio members can select items"
  ON procurement_items FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert items"
  ON procurement_items FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update items"
  ON procurement_items FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete items"
  ON procurement_items FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- ─── RLS Policies: procurement_item_status ───────────────────────────────────

CREATE POLICY "Studio members can select item status"
  ON procurement_item_status FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert item status"
  ON procurement_item_status FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update item status"
  ON procurement_item_status FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));
