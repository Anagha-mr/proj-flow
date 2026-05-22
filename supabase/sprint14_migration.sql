-- Sprint 14: Studio Management (Team, Leave, Payroll, Announcements)
-- Run each statement individually in Supabase SQL Editor

-- ─── New columns on users ────────────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS full_name       TEXT,
  ADD COLUMN IF NOT EXISTS phone           TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url      TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth   DATE,
  ADD COLUMN IF NOT EXISTS date_of_joining DATE,
  ADD COLUMN IF NOT EXISTS designation     TEXT,
  ADD COLUMN IF NOT EXISTS employment_type TEXT CHECK (employment_type IN ('full_time', 'part_time', 'contractor', 'intern')) DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS department      TEXT,
  ADD COLUMN IF NOT EXISTS is_active       BOOLEAN NOT NULL DEFAULT true;

-- ─── Table: leave_policies ───────────────────────────────────────────────────

CREATE TABLE leave_policies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id             UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  annual_leave_days     INT NOT NULL DEFAULT 12,
  sick_leave_days       INT NOT NULL DEFAULT 6,
  casual_leave_days     INT NOT NULL DEFAULT 6,
  carry_forward_max     INT NOT NULL DEFAULT 5,
  effective_from        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (studio_id)
);

CREATE OR REPLACE TRIGGER set_updated_at_leave_policies
  BEFORE UPDATE ON leave_policies
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_leave_policies_studio_id ON leave_policies(studio_id);

-- ─── Table: leave_requests ───────────────────────────────────────────────────

CREATE TABLE leave_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id       UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type      TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'casual', 'unpaid')),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  days_count      NUMERIC(4,1) NOT NULL,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by_id  UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  review_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT end_after_start CHECK (end_date >= start_date)
);

CREATE OR REPLACE TRIGGER set_updated_at_leave_requests
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_leave_requests_studio_id ON leave_requests(studio_id);
CREATE INDEX idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);

-- ─── Table: payroll_entries ──────────────────────────────────────────────────

CREATE TABLE payroll_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id       UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_month    INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year     INT NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
  base_amount     NUMERIC NOT NULL CHECK (base_amount >= 0),
  deductions      NUMERIC NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  bonuses         NUMERIC NOT NULL DEFAULT 0 CHECK (bonuses >= 0),
  net_amount      NUMERIC GENERATED ALWAYS AS (base_amount - deductions + bonuses) STORED,
  notes           TEXT,
  recorded_by_id  UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (studio_id, user_id, period_month, period_year)
);

CREATE OR REPLACE TRIGGER set_updated_at_payroll_entries
  BEFORE UPDATE ON payroll_entries
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_payroll_entries_studio_id ON payroll_entries(studio_id);
CREATE INDEX idx_payroll_entries_user_id ON payroll_entries(user_id);
CREATE INDEX idx_payroll_entries_period ON payroll_entries(period_year, period_month);

-- ─── Table: announcements ────────────────────────────────────────────────────

CREATE TABLE announcements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id     UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  is_pinned     BOOLEAN NOT NULL DEFAULT false,
  created_by_id UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER set_updated_at_announcements
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_announcements_studio_id ON announcements(studio_id);
CREATE INDEX idx_announcements_pinned ON announcements(studio_id, is_pinned);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- leave_policies
CREATE POLICY "Studio members can select leave policies"
  ON leave_policies FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert leave policies"
  ON leave_policies FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update leave policies"
  ON leave_policies FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete leave policies"
  ON leave_policies FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- leave_requests
CREATE POLICY "Studio members can select leave requests"
  ON leave_requests FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert leave requests"
  ON leave_requests FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update leave requests"
  ON leave_requests FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete leave requests"
  ON leave_requests FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- payroll_entries
CREATE POLICY "Studio members can select payroll entries"
  ON payroll_entries FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert payroll entries"
  ON payroll_entries FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update payroll entries"
  ON payroll_entries FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete payroll entries"
  ON payroll_entries FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- announcements
CREATE POLICY "Studio members can select announcements"
  ON announcements FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert announcements"
  ON announcements FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update announcements"
  ON announcements FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete announcements"
  ON announcements FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));
