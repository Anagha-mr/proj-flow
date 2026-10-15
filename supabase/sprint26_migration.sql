

ALTER TABLE snag_items
  ADD COLUMN IF NOT EXISTS plan_reference_document_id UUID REFERENCES documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_snag_items_plan_reference_document ON snag_items(plan_reference_document_id);
