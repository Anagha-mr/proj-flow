-- Sprint 10: per-studio WATI + Resend integration credentials
-- Run this in the Supabase SQL editor

ALTER TABLE studios
  ADD COLUMN IF NOT EXISTS wati_api_key    text,
  ADD COLUMN IF NOT EXISTS wati_api_url    text,
  ADD COLUMN IF NOT EXISTS resend_api_key  text,
  ADD COLUMN IF NOT EXISTS sending_email   text,
  ADD COLUMN IF NOT EXISTS sending_email_name text;
