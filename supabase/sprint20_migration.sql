-- Sprint 20 Migration: Annotated RFI System
-- Adds annotation columns to rfis table and escalated status

-- 1. Add annotation columns (IF NOT EXISTS guards — safe to re-run)
ALTER TABLE rfis
  ADD COLUMN IF NOT EXISTS annotation_data          JSONB,
  ADD COLUMN IF NOT EXISTS annotation_preview_url   TEXT,
  ADD COLUMN IF NOT EXISTS response_annotation_data JSONB;

-- 2. The following columns were already added in Sprint 8 — guard included for safety
ALTER TABLE rfis
  ADD COLUMN IF NOT EXISTS linked_document_id    UUID REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS response_text         TEXT,
  ADD COLUMN IF NOT EXISTS responded_by_id       UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS responded_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_deadline     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS space_tag             TEXT;

-- 3. Extend status check constraint to include 'escalated'
--    Drop existing constraint and recreate with escalated added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'rfis' AND constraint_name = 'rfis_status_check'
  ) THEN
    ALTER TABLE rfis DROP CONSTRAINT rfis_status_check;
  END IF;
END $$;

ALTER TABLE rfis
  ADD CONSTRAINT rfis_status_check
  CHECK (status IN ('open', 'under_review', 'responded', 'closed', 'escalated'));

-- 4. Performance index for escalation cron
CREATE INDEX IF NOT EXISTS idx_rfis_open_overdue
  ON rfis (response_deadline, escalated_at)
  WHERE status = 'open' AND escalated_at IS NULL;

-- 5. Service-role bypass policy for contractor token submissions
--    The cron and contractor API use the service client, which bypasses RLS.
--    No additional policy needed — service role always bypasses RLS.

-- AnnotationData JSONB structure (reference comment — not a SQL object):
-- {
--   "shapes": [{
--     "type": "circle" | "rect" | "arrow" | "text" | "freehand",
--     "x": number, "y": number,
--     "width": number?, "height": number?, "radius": number?,
--     "points": number[]?,   -- flattened [x1,y1,x2,y2,...] for freehand
--     "color": string, "strokeWidth": number,
--     "text": string?, "fontSize": number?
--   }],
--   "canvas_width": number,
--   "canvas_height": number,
--   "pdf_page": number,
--   "created_at": string
-- }
