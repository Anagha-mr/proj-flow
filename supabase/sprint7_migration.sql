-- Sprint 7: Client Portal, Site Tracking & WhatsApp Automation
-- Run each statement INDIVIDUALLY in the Supabase SQL Editor. Never batch.

-- ─── Table: site_updates ─────────────────────────────────────────────────────

CREATE TABLE site_updates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id           UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  submitted_by_type   TEXT NOT NULL CHECK (submitted_by_type IN ('contractor', 'designer')),
  submitted_by_id     UUID NOT NULL,
  photos              TEXT[] NOT NULL DEFAULT '{}',
  space_tag           TEXT,
  phase_tag           TEXT CHECK (phase_tag IN ('before', 'during', 'after')),
  status_note         TEXT,
  is_client_visible   BOOLEAN NOT NULL DEFAULT false,
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER set_updated_at_site_updates
  BEFORE UPDATE ON site_updates
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_site_updates_project_id ON site_updates(project_id);

CREATE INDEX idx_site_updates_studio_id  ON site_updates(studio_id);

CREATE INDEX idx_site_updates_submitted_at ON site_updates(submitted_at DESC);

-- ─── Table: notification_preferences ─────────────────────────────────────────

CREATE TABLE notification_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id   UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  in_app      BOOLEAN NOT NULL DEFAULT true,
  email       BOOLEAN NOT NULL DEFAULT true,
  whatsapp    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_type)
);

CREATE OR REPLACE TRIGGER set_updated_at_notification_preferences
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_notification_prefs_user_id ON notification_preferences(user_id);

CREATE INDEX idx_notification_prefs_studio_id ON notification_preferences(studio_id);

-- ─── Table: whatsapp_messages ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id       UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  recipient_type  TEXT NOT NULL CHECK (recipient_type IN ('client', 'contractor', 'vendor', 'user')),
  recipient_id    UUID NOT NULL,
  template_id     TEXT NOT NULL,
  variables       JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed')),
  project_id      UUID REFERENCES projects(id),
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER set_updated_at_whatsapp_messages
  BEFORE UPDATE ON whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_studio_id ON whatsapp_messages(studio_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_project_id ON whatsapp_messages(project_id);

-- ─── Enable RLS ───────────────────────────────────────────────────────────────

ALTER TABLE site_updates ENABLE ROW LEVEL SECURITY;

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies: site_updates ──────────────────────────────────────────────

CREATE POLICY "Studio members can select site_updates"
  ON site_updates FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert site_updates"
  ON site_updates FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update site_updates"
  ON site_updates FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete site_updates"
  ON site_updates FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- ─── RLS Policies: notification_preferences ──────────────────────────────────

CREATE POLICY "Studio members can select notification_preferences"
  ON notification_preferences FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert notification_preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update notification_preferences"
  ON notification_preferences FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can delete notification_preferences"
  ON notification_preferences FOR DELETE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

-- ─── RLS Policies: whatsapp_messages ─────────────────────────────────────────

CREATE POLICY "Studio members can select whatsapp_messages"
  ON whatsapp_messages FOR SELECT
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert whatsapp_messages"
  ON whatsapp_messages FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update whatsapp_messages"
  ON whatsapp_messages FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM users WHERE id = auth.uid()));
