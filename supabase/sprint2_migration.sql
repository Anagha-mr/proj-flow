-- ============================================================
-- ProjectFlow — Sprint 2 Database Migration
-- Run this in Supabase SQL Editor in the order shown below.
-- Sprint 1 schema must already be applied.
-- ============================================================

-- ─── updated_at trigger function (shared) ────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Clients (must exist before projects references it) ──────
CREATE TABLE public.clients (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id             UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  company               TEXT,
  email                 TEXT,
  phone_primary         TEXT,
  phone_secondary       TEXT,
  address_line1         TEXT,
  address_line2         TEXT,
  address_line3         TEXT,
  postcode              TEXT,
  state_code            TEXT,
  whatsapp_number       TEXT,
  preferred_comms       TEXT DEFAULT 'whatsapp',
  available_hours       TEXT,
  social_media          JSONB DEFAULT '{}',
  portal_token          UUID DEFAULT gen_random_uuid(),
  portal_token_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();

-- ─── Process Templates (must exist before projects) ──────────
CREATE TABLE public.process_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id    UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  project_type TEXT NOT NULL,
  phases       JSONB NOT NULL DEFAULT '[]',
  tasks        JSONB NOT NULL DEFAULT '[]',
  is_default   BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_process_templates_updated_at
  BEFORE UPDATE ON public.process_templates
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();

-- ─── Projects ────────────────────────────────────────────────
CREATE TABLE public.projects (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id          UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  client_id          UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  name               TEXT NOT NULL,
  type               TEXT NOT NULL DEFAULT 'residential',
  type_custom        TEXT,
  status             TEXT NOT NULL DEFAULT 'active',
  status_custom      TEXT,
  address_line1      TEXT,
  address_line2      TEXT,
  address_line3      TEXT,
  postcode           TEXT,
  cover_image_url    TEXT,
  currency           TEXT NOT NULL DEFAULT 'INR',
  gst_bracket        TEXT,
  measurement_unit   TEXT NOT NULL DEFAULT 'metric',
  scope_description  TEXT,
  scope_items        JSONB DEFAULT '[]',
  phases             JSONB DEFAULT '[]',
  template_id        UUID REFERENCES public.process_templates(id) ON DELETE SET NULL,
  pinterest_url      TEXT,
  is_pinned          BOOLEAN DEFAULT false,
  created_by         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();

-- ─── Project Members ─────────────────────────────────────────
CREATE TABLE public.project_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  studio_id    UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  project_role TEXT NOT NULL DEFAULT 'designer',
  added_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- ─── Tasks (minimal schema for Sprint 2; Sprint 3 extends it) ─
CREATE TABLE public.tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id   UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'todo',
  priority    TEXT NOT NULL DEFAULT 'medium',
  phase_tag   TEXT,
  start_date  DATE,
  due_date    DATE,
  created_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────

ALTER TABLE public.projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks            ENABLE ROW LEVEL SECURITY;

-- Projects
CREATE POLICY "Studio members can view their projects"
  ON public.projects FOR SELECT
  USING (studio_id = (SELECT studio_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Studio members can insert projects"
  ON public.projects FOR INSERT
  WITH CHECK (studio_id = (SELECT studio_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Studio members can update their projects"
  ON public.projects FOR UPDATE
  USING (studio_id = (SELECT studio_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Owners and senior designers can delete projects"
  ON public.projects FOR DELETE
  USING (
    studio_id = (SELECT studio_id FROM public.users WHERE id = auth.uid())
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('owner', 'senior_designer')
  );

-- Project members
CREATE POLICY "Studio members can view project members"
  ON public.project_members FOR SELECT
  USING (studio_id = (SELECT studio_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Studio members can manage project members"
  ON public.project_members FOR ALL
  USING (studio_id = (SELECT studio_id FROM public.users WHERE id = auth.uid()));

-- Clients
CREATE POLICY "Studio members can view their clients"
  ON public.clients FOR SELECT
  USING (studio_id = (SELECT studio_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Studio members can manage their clients"
  ON public.clients FOR ALL
  USING (studio_id = (SELECT studio_id FROM public.users WHERE id = auth.uid()));

-- Process templates
CREATE POLICY "Studio members can view their templates"
  ON public.process_templates FOR SELECT
  USING (studio_id = (SELECT studio_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Owners and senior designers can manage templates"
  ON public.process_templates FOR ALL
  USING (
    studio_id = (SELECT studio_id FROM public.users WHERE id = auth.uid())
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('owner', 'senior_designer')
  );

-- Tasks
CREATE POLICY "Studio members can view their tasks"
  ON public.tasks FOR SELECT
  USING (studio_id = (SELECT studio_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Studio members can manage their tasks"
  ON public.tasks FOR ALL
  USING (studio_id = (SELECT studio_id FROM public.users WHERE id = auth.uid()));

-- ─── Seed: Default process template per new studio ───────────

CREATE OR REPLACE FUNCTION public.seed_default_templates(p_studio_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.process_templates (studio_id, name, project_type, is_default, phases, tasks)
  VALUES (
    p_studio_id,
    'Standard Residential Project',
    'residential',
    true,
    '[
      {"name": "Concept", "offset_days_from_start": 0, "duration_days": 14, "color": "#6366f1"},
      {"name": "Design Development", "offset_days_from_start": 14, "duration_days": 21, "color": "#8b5cf6"},
      {"name": "Procurement", "offset_days_from_start": 35, "duration_days": 30, "color": "#f59e0b"},
      {"name": "Execution", "offset_days_from_start": 65, "duration_days": 60, "color": "#10b981"},
      {"name": "Handover", "offset_days_from_start": 125, "duration_days": 7, "color": "#e94560"}
    ]',
    '[
      {"title": "Initial client briefing", "phase_name": "Concept", "role": "project_lead", "offset_days": 0, "duration_days": 1, "priority": "high", "dependencies": []},
      {"title": "Site survey and measurements", "phase_name": "Concept", "role": "designer", "offset_days": 1, "duration_days": 2, "priority": "high", "dependencies": []},
      {"title": "Concept moodboard and references", "phase_name": "Concept", "role": "designer", "offset_days": 3, "duration_days": 3, "priority": "medium", "dependencies": []},
      {"title": "Concept presentation to client", "phase_name": "Concept", "role": "project_lead", "offset_days": 7, "duration_days": 1, "priority": "high", "dependencies": []},
      {"title": "Floor plan development", "phase_name": "Design Development", "role": "designer", "offset_days": 0, "duration_days": 5, "priority": "high", "dependencies": []},
      {"title": "3D renders / visuals", "phase_name": "Design Development", "role": "designer", "offset_days": 5, "duration_days": 7, "priority": "medium", "dependencies": []},
      {"title": "Design presentation and sign-off", "phase_name": "Design Development", "role": "project_lead", "offset_days": 14, "duration_days": 1, "priority": "high", "dependencies": []},
      {"title": "Prepare furniture procurement schedule", "phase_name": "Procurement", "role": "designer", "offset_days": 0, "duration_days": 5, "priority": "high", "dependencies": []},
      {"title": "Send procurement for client approval", "phase_name": "Procurement", "role": "project_lead", "offset_days": 5, "duration_days": 1, "priority": "high", "dependencies": []},
      {"title": "Place orders with vendors", "phase_name": "Procurement", "role": "designer", "offset_days": 10, "duration_days": 3, "priority": "high", "dependencies": []},
      {"title": "Site handover to contractor", "phase_name": "Execution", "role": "project_lead", "offset_days": 0, "duration_days": 1, "priority": "high", "dependencies": []},
      {"title": "Weekly site visit", "phase_name": "Execution", "role": "designer", "offset_days": 7, "duration_days": 1, "priority": "medium", "dependencies": []},
      {"title": "Snag list walkthrough", "phase_name": "Handover", "role": "project_lead", "offset_days": 0, "duration_days": 1, "priority": "high", "dependencies": []},
      {"title": "Client handover and project close", "phase_name": "Handover", "role": "project_lead", "offset_days": 3, "duration_days": 1, "priority": "high", "dependencies": []}
    ]'
  );
END;
$$ LANGUAGE plpgsql;

-- ─── Update handle_new_user_signup to seed templates ─────────
-- Replaces the Sprint 1 version; adds seed_default_templates call.
CREATE OR REPLACE FUNCTION public.handle_new_user_signup(
  p_user_id     UUID,
  p_user_name   TEXT,
  p_user_email  TEXT,
  p_studio_name TEXT
) RETURNS VOID AS $$
DECLARE
  v_studio_id UUID;
BEGIN
  INSERT INTO public.studios (name)
  VALUES (p_studio_name)
  RETURNING id INTO v_studio_id;

  INSERT INTO public.users (id, studio_id, name, email, role)
  VALUES (p_user_id, v_studio_id, p_user_name, p_user_email, 'owner');

  PERFORM public.seed_default_templates(v_studio_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Supabase Storage policy for project cover images ────────
-- Run in Supabase Dashboard > Storage > projectflow-files bucket > Policies
-- OR add these SQL policies:
--
-- Allow authenticated users to upload to their studio's project folder:
-- CREATE POLICY "Studio members can upload project assets"
--   ON storage.objects FOR INSERT
--   WITH CHECK (
--     bucket_id = 'projectflow-files'
--     AND auth.uid() IS NOT NULL
--   );
--
-- Allow authenticated users to read from the bucket:
-- CREATE POLICY "Studio members can read project assets"
--   ON storage.objects FOR SELECT
--   USING (
--     bucket_id = 'projectflow-files'
--     AND auth.uid() IS NOT NULL
--   );
