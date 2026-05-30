-- Sprint 18 Migration: AI Assistant
-- Run this in the Supabase SQL editor after sprint17_migration.sql

-- ─── 1. ai_conversations table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id       UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  messages        JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER set_updated_at_ai_conversations
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members can select ai conversations"
  ON ai_conversations FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert ai conversations"
  ON ai_conversations FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update ai conversations"
  ON ai_conversations FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete ai conversations"
  ON ai_conversations FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_project ON ai_conversations(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_studio_id ON ai_conversations(studio_id);

-- ─── 2. studios.ai_enabled column ─────────────────────────────────────────────

ALTER TABLE studios
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT true;
