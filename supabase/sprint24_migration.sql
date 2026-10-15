
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_reviewer ON tasks(reviewer_id);



CREATE TABLE review_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  reviewer_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  studio_id    UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  outcome      TEXT NOT NULL CHECK (outcome IN ('approved', 'changes_requested')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_logs_task   ON review_logs(task_id);
CREATE INDEX idx_review_logs_studio ON review_logs(studio_id);


ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_logs_select" ON review_logs
  FOR SELECT USING (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "review_logs_insert" ON review_logs
  FOR INSERT WITH CHECK (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "review_logs_update" ON review_logs
  FOR UPDATE USING (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "review_logs_delete" ON review_logs
  FOR DELETE USING (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
  );
