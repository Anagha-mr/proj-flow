-- Sprint 23: Google Calendar Sync
-- Tables: calendar_connections, calendar_event_links, calendar_busy_blocks
-- Alter: users.calendar_connected

-- ─── calendar_connections ─────────────────────────────────────────────────────

CREATE TABLE calendar_connections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id             UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token          TEXT NOT NULL,
  refresh_token         TEXT NOT NULL,
  token_expiry          TIMESTAMPTZ NOT NULL,
  google_calendar_id    TEXT NOT NULL DEFAULT 'primary',
  google_email          TEXT NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  connected_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sync_at          TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX idx_calendar_connections_studio ON calendar_connections(studio_id);
CREATE INDEX idx_calendar_connections_user   ON calendar_connections(user_id);

CREATE TRIGGER set_updated_at_calendar_connections
  BEFORE UPDATE ON calendar_connections
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── RLS: calendar_connections ────────────────────────────────────────────────

ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_connections_select" ON calendar_connections
  FOR SELECT USING (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "calendar_connections_insert" ON calendar_connections
  FOR INSERT WITH CHECK (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "calendar_connections_update" ON calendar_connections
  FOR UPDATE USING (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "calendar_connections_delete" ON calendar_connections
  FOR DELETE USING (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

-- ─── calendar_event_links ─────────────────────────────────────────────────────

CREATE TABLE calendar_event_links (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id         UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type       TEXT NOT NULL CHECK (source_type IN (
                      'task_due_date', 'meeting', 'site_visit',
                      'invoice_due_date', 'project_milestone'
                    )),
  source_id         UUID NOT NULL,
  project_id        UUID REFERENCES projects(id) ON DELETE CASCADE,
  google_event_id   TEXT NOT NULL,
  last_pushed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_pushed_hash  TEXT NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_type, source_id)
);

CREATE INDEX idx_calendar_event_links_studio  ON calendar_event_links(studio_id);
CREATE INDEX idx_calendar_event_links_user    ON calendar_event_links(user_id);
CREATE INDEX idx_calendar_event_links_source  ON calendar_event_links(source_type, source_id);
CREATE INDEX idx_calendar_event_links_project ON calendar_event_links(project_id);

CREATE TRIGGER set_updated_at_calendar_event_links
  BEFORE UPDATE ON calendar_event_links
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── RLS: calendar_event_links ────────────────────────────────────────────────

ALTER TABLE calendar_event_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_event_links_select" ON calendar_event_links
  FOR SELECT USING (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "calendar_event_links_insert" ON calendar_event_links
  FOR INSERT WITH CHECK (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "calendar_event_links_update" ON calendar_event_links
  FOR UPDATE USING (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "calendar_event_links_delete" ON calendar_event_links
  FOR DELETE USING (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

-- ─── calendar_busy_blocks ─────────────────────────────────────────────────────
-- Read-only mirror of personal events pulled FROM Google Calendar.
-- No updated_at trigger — rows are deleted+reinserted on each sync.

CREATE TABLE calendar_busy_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id       UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  title           TEXT,
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ NOT NULL,
  is_all_day      BOOLEAN NOT NULL DEFAULT false,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, google_event_id)
);

CREATE INDEX idx_calendar_busy_blocks_studio     ON calendar_busy_blocks(studio_id);
CREATE INDEX idx_calendar_busy_blocks_user_range ON calendar_busy_blocks(user_id, start_at, end_at);

-- ─── RLS: calendar_busy_blocks ────────────────────────────────────────────────
-- SELECT: any studio member can see busy blocks (title redacted in server action)
-- INSERT/UPDATE/DELETE: own rows only

ALTER TABLE calendar_busy_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_busy_blocks_select" ON calendar_busy_blocks
  FOR SELECT USING (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "calendar_busy_blocks_insert" ON calendar_busy_blocks
  FOR INSERT WITH CHECK (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "calendar_busy_blocks_update" ON calendar_busy_blocks
  FOR UPDATE USING (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "calendar_busy_blocks_delete" ON calendar_busy_blocks
  FOR DELETE USING (
    studio_id = (SELECT studio_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

-- ─── users: add calendar_connected flag ───────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS calendar_connected BOOLEAN NOT NULL DEFAULT false;
