

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
