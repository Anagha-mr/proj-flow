-- Bug #7: Unable to upload attachments in task panel.
--
-- Root cause (confirmed via the Storage Management API against the live
-- project): the projectflow-files bucket has zero RLS policies on
-- storage.objects. The only policies ever written for it are the
-- commented-out CREATE POLICY statements in sprint2_migration.sql
-- ("Run in Supabase Dashboard...") — they were never actually executed.
-- Storage RLS is enabled by default on storage.objects, so with no
-- policies present, every INSERT/SELECT/DELETE from a non-service-role
-- client is denied — uploads fail regardless of application code.
--
-- (Separately, the task-attachment upload code was also pointed at a
-- different, unrelated bucket — "studio-files" — with a path missing the
-- project_id segment. That's fixed in task-detail-panel.tsx to use
-- projectflow-files with the {studio_id}/{project_id}/tasks/{task_id}/
-- convention, matching Document Centre. This migration adds the policies
-- that bucket needs regardless of that fix, since Document Centre's own
-- uploads run through the same bucket and are equally exposed.)
--
-- Mirrors the studio_id scoping used by every other table's RLS: auth.uid()
-- resolves to a studio member, whose studio_id must match the first path
-- segment of the object name.
--
-- Purely additive: does not touch or drop any existing policy. Guarded so
-- it's safe to run more than once.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Studio members can upload to projectflow-files'
  ) THEN
    CREATE POLICY "Studio members can upload to projectflow-files"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'projectflow-files'
      AND (storage.foldername(name))[1] = (SELECT users.studio_id::text FROM users WHERE users.id = auth.uid())
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Studio members can read projectflow-files'
  ) THEN
    CREATE POLICY "Studio members can read projectflow-files"
    ON storage.objects
    FOR SELECT
    USING (
      bucket_id = 'projectflow-files'
      AND (storage.foldername(name))[1] = (SELECT users.studio_id::text FROM users WHERE users.id = auth.uid())
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Studio members can delete from projectflow-files'
  ) THEN
    CREATE POLICY "Studio members can delete from projectflow-files"
    ON storage.objects
    FOR DELETE
    USING (
      bucket_id = 'projectflow-files'
      AND (storage.foldername(name))[1] = (SELECT users.studio_id::text FROM users WHERE users.id = auth.uid())
    );
  END IF;
END $$;
