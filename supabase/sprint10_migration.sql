-- ============================================================
-- Sprint 10 Migration: Order Tracking & Vendor Management
-- Run in the Supabase SQL Editor (safe to run multiple times
-- thanks to IF NOT EXISTS / IF NOT EXISTS guards).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Part A: Integrations columns on studios (from Sprint 10 Wave 1)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE studios
  ADD COLUMN IF NOT EXISTS wati_api_key          TEXT,
  ADD COLUMN IF NOT EXISTS wati_api_url          TEXT,
  ADD COLUMN IF NOT EXISTS resend_api_key        TEXT,
  ADD COLUMN IF NOT EXISTS sending_email         TEXT,
  ADD COLUMN IF NOT EXISTS sending_email_name    TEXT,
  ADD COLUMN IF NOT EXISTS po_approval_threshold DECIMAL(12,2) NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- Part B: supplier_id on procurement_items
-- ─────────────────────────────────────────────────────────────
-- Added so order tracking and vendor panels can link items to vendors.
ALTER TABLE procurement_items
  ADD COLUMN IF NOT EXISTS supplier_id UUID;

-- ─────────────────────────────────────────────────────────────
-- Part C: vendors
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id               UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  type                    TEXT NOT NULL
                            CHECK (type IN ('furniture','tiles','lighting','textiles','sanitaryware','hardware','other')),
  type_custom             TEXT,
  contact_name            TEXT,
  phone                   TEXT,
  email                   TEXT,
  whatsapp_number         TEXT,
  showroom_address        TEXT,
  gstin                   TEXT,
  bank_details            JSONB,
  preferred_categories    TEXT[]    NOT NULL DEFAULT '{}',
  default_lead_time_days  INTEGER,
  rating_by_category      JSONB     NOT NULL DEFAULT '{}',
  is_active               BOOLEAN   NOT NULL DEFAULT TRUE,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER set_updated_at_vendors
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_vendors_studio_id ON vendors(studio_id);
CREATE INDEX IF NOT EXISTS idx_vendors_type      ON vendors(type);
CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON vendors(is_active);

-- ─────────────────────────────────────────────────────────────
-- Part D: order_tracking
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_tracking (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id                  UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id                 UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  procurement_item_id        UUID NOT NULL REFERENCES procurement_items(id) ON DELETE CASCADE,
  vendor_id                  UUID REFERENCES vendors(id) ON DELETE SET NULL,
  order_number               TEXT,
  tracking_link              TEXT,
  shipment_notes             TEXT,
  status                     TEXT NOT NULL DEFAULT 'ordered'
                               CHECK (status IN ('ordered','in_production','in_transit','customs_hold','delayed','delivered','installed')),
  expected_delivery_date     DATE,
  actual_delivery_date       DATE,
  client_deposit_paid        DECIMAL(12,2),
  client_deposit_paid_date   DATE,
  supplier_deposit_paid      DECIMAL(12,2),
  supplier_deposit_paid_date DATE,
  client_balance_due         DECIMAL(12,2),
  client_balance_due_date    DATE,
  supplier_balance_due       DECIMAL(12,2),
  supplier_balance_due_date  DATE,
  delay_notified_at          TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (procurement_item_id)
);

CREATE OR REPLACE TRIGGER set_updated_at_order_tracking
  BEFORE UPDATE ON order_tracking
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_order_tracking_project_id          ON order_tracking(project_id);
CREATE INDEX IF NOT EXISTS idx_order_tracking_studio_id           ON order_tracking(studio_id);
CREATE INDEX IF NOT EXISTS idx_order_tracking_vendor_id           ON order_tracking(vendor_id);
CREATE INDEX IF NOT EXISTS idx_order_tracking_status              ON order_tracking(status);
CREATE INDEX IF NOT EXISTS idx_order_tracking_expected_delivery   ON order_tracking(expected_delivery_date);

-- ─────────────────────────────────────────────────────────────
-- Part E: purchase_orders
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id              UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id             UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_id              UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  po_number              TEXT NOT NULL,
  po_date                DATE NOT NULL DEFAULT CURRENT_DATE,
  line_items             JSONB NOT NULL DEFAULT '[]',
  subtotal               DECIMAL(14,2) NOT NULL DEFAULT 0,
  gst_total              DECIMAL(14,2) NOT NULL DEFAULT 0,
  grand_total            DECIMAL(14,2) NOT NULL DEFAULT 0,
  delivery_address       TEXT,
  expected_delivery_date DATE,
  payment_terms          JSONB NOT NULL DEFAULT '{}',
  special_instructions   TEXT,
  status                 TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','pending_approval','approved','sent','confirmed_by_vendor','cancelled')),
  approved_by_id         UUID REFERENCES users(id),
  approved_at            TIMESTAMPTZ,
  sent_at                TIMESTAMPTZ,
  vendor_confirmed_at    TIMESTAMPTZ,
  created_by_id          UUID NOT NULL REFERENCES users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (studio_id, po_number)
);

CREATE OR REPLACE TRIGGER set_updated_at_purchase_orders
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_purchase_orders_studio_id  ON purchase_orders(studio_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project_id ON purchase_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id  ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status     ON purchase_orders(status);

-- ─────────────────────────────────────────────────────────────
-- Part F: quote_requests
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id               UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  procurement_item_id     UUID NOT NULL REFERENCES procurement_items(id) ON DELETE CASCADE,
  requested_by_id         UUID NOT NULL REFERENCES users(id),
  vendor_ids              UUID[] NOT NULL DEFAULT '{}',
  specifications          TEXT,
  required_lead_time_days INTEGER,
  min_order_qty           INTEGER,
  logistics_notes         TEXT,
  response_deadline       DATE,
  status                  TEXT NOT NULL DEFAULT 'sent'
                            CHECK (status IN ('sent','partially_responded','fully_responded','closed')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER set_updated_at_quote_requests
  BEFORE UPDATE ON quote_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_quote_requests_studio_id            ON quote_requests(studio_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_project_id           ON quote_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_procurement_item_id  ON quote_requests(procurement_item_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_status               ON quote_requests(status);

-- ─────────────────────────────────────────────────────────────
-- Part G: quote_responses
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote_responses (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id            UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  quote_request_id     UUID NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  vendor_id            UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  unit_price           DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  lead_time_days       INTEGER,
  min_order_qty        INTEGER,
  validity_date        DATE,
  notes                TEXT,
  quote_document_url   TEXT,
  submitted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_selected          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (quote_request_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_quote_responses_studio_id        ON quote_responses(studio_id);
CREATE INDEX IF NOT EXISTS idx_quote_responses_quote_request_id ON quote_responses(quote_request_id);
CREATE INDEX IF NOT EXISTS idx_quote_responses_vendor_id        ON quote_responses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_quote_responses_is_selected      ON quote_responses(is_selected);

-- ─────────────────────────────────────────────────────────────
-- Part H: Row Level Security
-- ─────────────────────────────────────────────────────────────
ALTER TABLE vendors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_tracking  ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_responses ENABLE ROW LEVEL SECURITY;

-- vendors policies
CREATE POLICY "Studio members can select vendors"
  ON vendors FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert vendors"
  ON vendors FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update vendors"
  ON vendors FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete vendors"
  ON vendors FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- order_tracking policies
CREATE POLICY "Studio members can select order_tracking"
  ON order_tracking FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert order_tracking"
  ON order_tracking FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update order_tracking"
  ON order_tracking FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete order_tracking"
  ON order_tracking FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- purchase_orders policies
CREATE POLICY "Studio members can select purchase_orders"
  ON purchase_orders FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert purchase_orders"
  ON purchase_orders FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update purchase_orders"
  ON purchase_orders FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete purchase_orders"
  ON purchase_orders FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- Vendors can confirm their own POs via the public share page (no auth).
-- The API route uses the service role key, so no extra RLS policy needed for that.

-- quote_requests policies
CREATE POLICY "Studio members can select quote_requests"
  ON quote_requests FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert quote_requests"
  ON quote_requests FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update quote_requests"
  ON quote_requests FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete quote_requests"
  ON quote_requests FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- quote_responses policies
CREATE POLICY "Studio members can select quote_responses"
  ON quote_responses FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert quote_responses"
  ON quote_responses FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update quote_responses"
  ON quote_responses FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete quote_responses"
  ON quote_responses FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- Public-facing service-role access notes:
-- • /api/po/[id]/confirm  — uses service role key, bypasses RLS
-- • /api/quotes/respond   — uses service role key, bypasses RLS
-- • /share/po/[id]        — uses service role key, bypasses RLS
-- No additional anon policies needed; keep those routes server-only.
-- ─────────────────────────────────────────────────────────────
