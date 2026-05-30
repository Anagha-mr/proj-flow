-- Sprint 17: Razorpay Payment Automation
-- Run this against your Supabase project.

-- ─── 1.1 New columns on invoices ─────────────────────────────────────────────

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS razorpay_payment_link_id     TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_link_url    TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_link_status TEXT CHECK (razorpay_payment_link_status IN ('created', 'partially_paid', 'paid', 'cancelled', 'expired')) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reminder_sent_at             TIMESTAMPTZ[],
  ADD COLUMN IF NOT EXISTS reminders_paused             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_at                      TIMESTAMPTZ;

-- ─── 1.2 New columns on studios ──────────────────────────────────────────────

ALTER TABLE studios
  ADD COLUMN IF NOT EXISTS razorpay_key_id              TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_key_secret          TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_webhook_secret      TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_pass_fee_to_client  BOOLEAN NOT NULL DEFAULT false;

-- ─── 1.3 New columns on invoice_payments ─────────────────────────────────────

ALTER TABLE invoice_payments
  ADD COLUMN IF NOT EXISTS razorpay_payment_id  TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_order_id    TEXT,
  ADD COLUMN IF NOT EXISTS payment_method       TEXT,
  ADD COLUMN IF NOT EXISTS payment_source       TEXT CHECK (payment_source IN ('manual', 'razorpay_webhook', 'razorpay_manual')) DEFAULT 'manual';

-- ─── 1.4 New columns on stage_payments ───────────────────────────────────────

ALTER TABLE stage_payments
  ADD COLUMN IF NOT EXISTS contractor_confirmed_at TIMESTAMPTZ;

-- Extend stage_payments status to include 'confirmed'
-- Drop and re-add the check constraint to include 'confirmed'
DO $$
BEGIN
  -- Drop existing check constraint if it exists
  ALTER TABLE stage_payments DROP CONSTRAINT IF EXISTS stage_payments_status_check;
  -- Re-add with 'confirmed' included
  ALTER TABLE stage_payments
    ADD CONSTRAINT stage_payments_status_check
    CHECK (status IN ('pending', 'released', 'received', 'confirmed'));
EXCEPTION WHEN others THEN
  -- If constraint name differs, just add the column without constraint change
  NULL;
END $$;

-- ─── 1.5 New table: payment_reminders ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id       UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  reminder_type   TEXT NOT NULL CHECK (reminder_type IN (
                    'invoice_sent',
                    'reminder_3_days_before',
                    'reminder_due_today',
                    'reminder_7_days_overdue',
                    'reminder_14_days_overdue',
                    'reminder_30_days_overdue'
                  )),
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  whatsapp_message_id UUID REFERENCES whatsapp_messages(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── RLS for payment_reminders ────────────────────────────────────────────────

ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members can select payment reminders"
  ON payment_reminders FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert payment reminders"
  ON payment_reminders FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update payment reminders"
  ON payment_reminders FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete payment reminders"
  ON payment_reminders FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_payment_reminders_invoice_id
  ON payment_reminders(invoice_id);

CREATE INDEX IF NOT EXISTS idx_payment_reminders_studio_id
  ON payment_reminders(studio_id);

CREATE INDEX IF NOT EXISTS idx_payment_reminders_type
  ON payment_reminders(invoice_id, reminder_type);
