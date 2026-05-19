-- Sprint 11: Studio-Level Finance (P&L)
-- Run each statement individually in Supabase SQL Editor

-- 1. studio_expenses table
CREATE TABLE studio_expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id       UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  category        TEXT NOT NULL CHECK (category IN (
                    'rent',
                    'salaries',
                    'software',
                    'marketing',
                    'utilities',
                    'equipment',
                    'professional_fees',
                    'travel',
                    'other'
                  )),
  description     TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  reference       TEXT,
  is_recurring    BOOLEAN NOT NULL DEFAULT false,
  recurrence      TEXT CHECK (recurrence IN ('monthly', 'quarterly', 'annual') OR recurrence IS NULL),
  recorded_by_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Updated_at trigger for studio_expenses
CREATE OR REPLACE TRIGGER set_updated_at_studio_expenses
  BEFORE UPDATE ON studio_expenses
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- 3. Indexes for studio_expenses
CREATE INDEX idx_studio_expenses_studio_id ON studio_expenses(studio_id);
CREATE INDEX idx_studio_expenses_expense_date ON studio_expenses(expense_date);
CREATE INDEX idx_studio_expenses_category ON studio_expenses(category);

-- 4. Add contract_value to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS contract_value NUMERIC(12,2);

-- 5. Enable RLS on studio_expenses
ALTER TABLE studio_expenses ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies (separate per operation)
CREATE POLICY "Studio members can select studio_expenses"
  ON studio_expenses FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert studio_expenses"
  ON studio_expenses FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update studio_expenses"
  ON studio_expenses FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete studio_expenses"
  ON studio_expenses FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));
