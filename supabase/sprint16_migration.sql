-- Sprint 16: Dashboard Wiring + Project Health Score
-- Run this against your Supabase project.

-- ─── 1.1 New columns on projects ─────────────────────────────────────────────

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS health_score       TEXT CHECK (health_score IN ('green', 'amber', 'red')) DEFAULT 'green',
  ADD COLUMN IF NOT EXISTS health_last_calculated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS health_signals     JSONB;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_projects_health_score
  ON projects(studio_id, health_score);

CREATE INDEX IF NOT EXISTS idx_projects_health_last_calc
  ON projects(health_last_calculated_at);

-- ─── 1.2 tasks.status — add 'review' to CHECK constraint if not present ───────
-- Only needed if the constraint doesn't already include 'review'.
-- The CONTEXT.md V5 Section 7.2 lists 4 statuses including 'review'.
-- IF the column constraint doesn't already have 'review', run:

DO $$
BEGIN
  -- Drop old constraint if it doesn't include 'review'
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%tasks_status%'
      AND check_clause NOT LIKE '%review%'
  ) THEN
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
    ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
      CHECK (status IN ('todo', 'in_progress', 'review', 'done'));
  END IF;
END $$;

-- Safety: if the column has no constraint at all, add it:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%tasks_status%'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
      CHECK (status IN ('todo', 'in_progress', 'review', 'done'));
  END IF;
END $$;
