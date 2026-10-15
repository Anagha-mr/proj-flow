-- Sprint 25: Specification multi-row rebuild (Bug #28, Stage 1)
--
-- Investigation findings (live data checked via REST API before writing this):
--   - spec_items currently holds 4 real rows across 2 studios.
--   - All 4 rows use the legacy free-text `supplier` column (e.g. "Raj Tiles"); none
--     have `drawing_reference` or `linked_procurement_id` set.
--   - No unique constraint on (project_id, space) exists today, so the "one item
--     per space" behaviour reported in the bug is a UI/workflow limitation
--     (add-one-via-side-sheet), not a DB-level restriction — nothing to unwind there.
--   - Because none of the 4 rows use drawing_reference/linked_procurement_id and the
--     new vendor/document link columns are net-new, this is a purely additive ALTER.
--     No backfill/data mapping is needed and no existing row is touched.
--   - Legacy `supplier` (text) and `drawing_reference` (text) columns are left in
--     place so old free-text values stay visible; the app now treats the new FK
--     columns as the source of truth going forward.

ALTER TABLE spec_items
  ADD COLUMN IF NOT EXISTS supplier_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS drawing_reference_document_id UUID REFERENCES documents(id) ON DELETE SET NULL;

-- linked_procurement_id already existed (Sprint 9) as a bare UUID column with no FK.
-- All 4 existing rows have it NULL, so adding the constraint now is safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'spec_items_linked_procurement_id_fkey'
  ) THEN
    ALTER TABLE spec_items
      ADD CONSTRAINT spec_items_linked_procurement_id_fkey
      FOREIGN KEY (linked_procurement_id) REFERENCES procurement_items(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_spec_items_supplier_vendor    ON spec_items(supplier_vendor_id);
CREATE INDEX IF NOT EXISTS idx_spec_items_drawing_reference  ON spec_items(drawing_reference_document_id);
CREATE INDEX IF NOT EXISTS idx_spec_items_linked_procurement ON spec_items(linked_procurement_id);
