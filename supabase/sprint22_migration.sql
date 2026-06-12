-- Sprint 22: Gmail Integration + AI Suggestions
-- Tables: gmail_connections, ai_suggestions
-- Alter: users.gmail_connected

-- ─── gmail_connections ────────────────────────────────────────────────────────

CREATE TABLE gmail_connections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id     UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry  TIMESTAMPTZ NOT NULL,
  gmail_address TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  connected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sync_at  TIMESTAMPTZ,
  UNIQUE (user_id)
);

CREATE INDEX idx_gmail_connections_studio ON gmail_connections(studio_id);
CREATE INDEX idx_gmail_connections_user ON gmail_connections(user_id);

SELECT trigger_set_updated_at('gmail_connections');

-- ─── ai_suggestions ───────────────────────────────────────────────────────────

CREATE TABLE ai_suggestions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id             UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id            UUID REFERENCES projects(id) ON DELETE SET NULL,
  source_type           TEXT NOT NULL CHECK (source_type IN ('gmail', 'whatsapp', 'analysis')),
  source_reference      TEXT NOT NULL,
  sender_email          TEXT,
  sender_name           TEXT,
  email_subject         TEXT,
  email_snippet         TEXT,
  classification        TEXT NOT NULL CHECK (classification IN (
                          'client_approval', 'vendor_quote', 'contractor_query',
                          'invoice_query', 'site_update', 'general'
                        )),
  suggested_action_type TEXT NOT NULL CHECK (suggested_action_type IN (
                          'update_procurement_approval', 'create_quote_response',
                          'create_task', 'update_invoice_status', 'log_site_update', 'no_action'
                        )),
  suggested_action_data JSONB NOT NULL DEFAULT '{}',
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                          'pending', 'accepted', 'edited', 'dismissed'
                        )),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  acted_at              TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 day')
);

CREATE INDEX idx_ai_suggestions_studio ON ai_suggestions(studio_id);
CREATE INDEX idx_ai_suggestions_user ON ai_suggestions(user_id);
CREATE INDEX idx_ai_suggestions_status ON ai_suggestions(studio_id, status) WHERE status = 'pending';
CREATE INDEX idx_ai_suggestions_expires ON ai_suggestions(expires_at);

SELECT trigger_set_updated_at('ai_suggestions');

-- ─── users: gmail_connected flag ──────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_connected BOOLEAN NOT NULL DEFAULT false;

-- ─── RLS: gmail_connections ───────────────────────────────────────────────────

ALTER TABLE gmail_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gmail_connections_select" ON gmail_connections
  FOR SELECT USING (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "gmail_connections_insert" ON gmail_connections
  FOR INSERT WITH CHECK (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "gmail_connections_update" ON gmail_connections
  FOR UPDATE USING (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "gmail_connections_delete" ON gmail_connections
  FOR DELETE USING (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

-- ─── RLS: ai_suggestions ─────────────────────────────────────────────────────

ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_suggestions_select" ON ai_suggestions
  FOR SELECT USING (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "ai_suggestions_insert" ON ai_suggestions
  FOR INSERT WITH CHECK (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "ai_suggestions_update" ON ai_suggestions
  FOR UPDATE USING (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "ai_suggestions_delete" ON ai_suggestions
  FOR DELETE USING (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
  );
