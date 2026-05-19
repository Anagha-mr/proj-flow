-- Sprint 12: Portfolio Management
-- Run each statement individually in Supabase SQL Editor

-- ─── portfolio_gallery_items ────────────────────────────────────────────────
CREATE TABLE portfolio_gallery_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id        UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  image_url        TEXT NOT NULL,
  caption          TEXT,
  space_tag        TEXT,
  display_order    INT NOT NULL DEFAULT 0,
  include_in_export BOOLEAN NOT NULL DEFAULT true,
  uploaded_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_portfolio_gallery_items_project_id ON portfolio_gallery_items(project_id);

CREATE INDEX idx_portfolio_gallery_items_studio_id ON portfolio_gallery_items(studio_id);

CREATE INDEX idx_portfolio_gallery_items_display_order ON portfolio_gallery_items(project_id, display_order);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE portfolio_gallery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members can select portfolio_gallery_items"
  ON portfolio_gallery_items FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert portfolio_gallery_items"
  ON portfolio_gallery_items FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update portfolio_gallery_items"
  ON portfolio_gallery_items FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete portfolio_gallery_items"
  ON portfolio_gallery_items FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- ─── projects: portfolio columns ────────────────────────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS portfolio_summary TEXT;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS portfolio_key_decisions TEXT;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS portfolio_location_city TEXT;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS portfolio_year_completed INT;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS portfolio_published BOOLEAN NOT NULL DEFAULT false;
