
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'task_assignees'
      AND policyname = 'Studio members can update task assignees'
  ) THEN
    CREATE POLICY "Studio members can update task assignees"
    ON task_assignees
    FOR UPDATE
    USING (studio_id = (SELECT users.studio_id FROM users WHERE users.id = auth.uid()))
    WITH CHECK (studio_id = (SELECT users.studio_id FROM users WHERE users.id = auth.uid()));
  END IF;
END $$;
