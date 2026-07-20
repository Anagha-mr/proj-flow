-- Bug #6b: task_assignees has RLS enabled with INSERT, SELECT, and DELETE
-- policies but no UPDATE policy. addTaskAssignee() upserts on (task_id, user_id);
-- when a conflicting row exists Postgres executes that as an UPDATE, which has
-- zero RLS coverage and is blocked by default ("new row violates row-level
-- security policy (USING expression)").
--
-- Purely additive: creates the missing UPDATE policy, mirroring the studio_id
-- scoping used by the existing INSERT/DELETE policies. Does not alter or drop
-- any existing policy. Guarded so it's safe to run more than once.

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
