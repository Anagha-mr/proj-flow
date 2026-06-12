-- Sprint 21 Migration: Visual Product Discovery Stage 1
-- Adds URL autofill columns to procurement_items and creates url_extraction_cache table

-- 1. New columns on procurement_items (all nullable — existing rows unaffected)
ALTER TABLE procurement_items
  ADD COLUMN IF NOT EXISTS source_url          TEXT,
  ADD COLUMN IF NOT EXISTS product_image_url   TEXT,
  ADD COLUMN IF NOT EXISTS brand               TEXT,
  ADD COLUMN IF NOT EXISTS material_finish     TEXT,
  ADD COLUMN IF NOT EXISTS dimensions          TEXT,
  ADD COLUMN IF NOT EXISTS last_url_refresh_at TIMESTAMPTZ;

-- 2. URL extraction cache table (no RLS — server-side only, no user data)
CREATE TABLE IF NOT EXISTS url_extraction_cache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_hash     TEXT NOT NULL UNIQUE,    -- SHA-256 of normalised URL
  source_url   TEXT NOT NULL,
  extracted    JSONB NOT NULL,          -- ExtractedProduct object
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_url_extraction_cache_hash    ON url_extraction_cache(url_hash);
CREATE INDEX IF NOT EXISTS idx_url_extraction_cache_expires ON url_extraction_cache(expires_at);
