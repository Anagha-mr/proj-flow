-- Sprint 6: Project Finance Migration
-- Run each statement INDIVIDUALLY in the Supabase SQL Editor. Never batch.

-- ─── Table: invoices ─────────────────────────────────────────────────────────

CREATE TABLE invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id           UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id           UUID NOT NULL REFERENCES clients(id),
  invoice_number      TEXT NOT NULL,
  line_items          JSONB NOT NULL DEFAULT '[]',
  subtotal            NUMERIC NOT NULL DEFAULT 0,
  gst_amount          NUMERIC NOT NULL DEFAULT 0,
  total               NUMERIC NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'sent', 'partial', 'paid', 'overdue')),
  issue_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date            DATE,
  sent_at             TIMESTAMPTZ,
  reminder_sent_at    TIMESTAMPTZ[],
  notes               TEXT,
  created_by_id       UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (studio_id, invoice_number)
);

CREATE OR REPLACE TRIGGER set_updated_at_invoices
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_invoices_project_id ON invoices(project_id);

CREATE INDEX idx_invoices_studio_id ON invoices(studio_id);

CREATE INDEX idx_invoices_client_id ON invoices(client_id);

CREATE INDEX idx_invoices_status ON invoices(status);

-- ─── Table: invoice_payments ─────────────────────────────────────────────────

CREATE TABLE invoice_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  studio_id        UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  amount           NUMERIC NOT NULL CHECK (amount > 0),
  payment_date     DATE NOT NULL,
  bank_reference   TEXT,
  notes            TEXT,
  recorded_by_id   UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);

CREATE INDEX idx_invoice_payments_studio_id ON invoice_payments(studio_id);

-- ─── Table: expense_entries ──────────────────────────────────────────────────

CREATE TABLE expense_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id       UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category        TEXT NOT NULL CHECK (category IN (
                    'procurement',
                    'contractor',
                    'vendor_payment',
                    'consultant_fee',
                    'site_expense',
                    'other'
                  )),
  description     TEXT NOT NULL,
  amount          NUMERIC NOT NULL CHECK (amount >= 0),
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  reference       TEXT,
  recorded_by_id  UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER set_updated_at_expense_entries
  BEFORE UPDATE ON expense_entries
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_expense_entries_project_id ON expense_entries(project_id);

CREATE INDEX idx_expense_entries_studio_id ON expense_entries(studio_id);

-- ─── Enable RLS ──────────────────────────────────────────────────────────────

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

ALTER TABLE expense_entries ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies: invoices ──────────────────────────────────────────────────

CREATE POLICY "Studio members can select invoices"
  ON invoices FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert invoices"
  ON invoices FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update invoices"
  ON invoices FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete invoices"
  ON invoices FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- ─── RLS Policies: invoice_payments ─────────────────────────────────────────

CREATE POLICY "Studio members can select payments"
  ON invoice_payments FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert payments"
  ON invoice_payments FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update payments"
  ON invoice_payments FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete payments"
  ON invoice_payments FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- ─── RLS Policies: expense_entries ───────────────────────────────────────────

CREATE POLICY "Studio members can select expenses"
  ON expense_entries FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert expenses"
  ON expense_entries FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update expenses"
  ON expense_entries FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete expenses"
  ON expense_entries FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));
