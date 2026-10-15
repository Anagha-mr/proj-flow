-- Bug #30: portfolio gallery item caption
-- The `caption` column already shipped in sprint12_migration.sql. This is a
-- defensive no-op for any environment where that migration wasn't applied,
-- so existing portfolio_gallery_items rows are unaffected either way.

ALTER TABLE portfolio_gallery_items
  ADD COLUMN IF NOT EXISTS caption TEXT;
