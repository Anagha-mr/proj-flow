-- ============================================================
-- ProjectFlow — Sprint 1 Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Enums ───────────────────────────────────────────────────
create type studio_role as enum ('owner', 'senior_designer', 'designer', 'intern');
create type plan_tier as enum ('starter', 'pro', 'scale');
create type project_status as enum ('active', 'on_hold', 'completed', 'archived');
create type project_type as enum ('residential', 'commercial', 'hospitality', 'retail', 'other');

-- ─── Studios ─────────────────────────────────────────────────
create table public.studios (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  logo_url            text,
  gstin               text check (gstin is null or length(gstin) = 15),
  address_line1       text,
  address_line2       text,
  address_line3       text,
  postcode            text,
  state_code          text,           -- 2-digit GST state code e.g. '29' for Karnataka
  contact_phone       text,
  contact_email       text,
  bank_details        jsonb,
  currency            text not null default 'INR',
  gst_brackets        jsonb,
  plan_tier           plan_tier not null default 'starter',
  whatsapp_number     text,
  invoice_prefix      text not null default 'PF', -- e.g. PF → PF-2025-0001
  onboarding_complete boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ─── Users (extends auth.users) ──────────────────────────────
create table public.users (
  id                    uuid primary key references auth.users(id) on delete cascade,
  studio_id             uuid references public.studios(id) on delete set null,
  name                  text not null,
  email                 text not null,
  phone                 text,
  whatsapp_number       text,
  dob                   date,
  address               text,
  emergency_contact     jsonb,
  role                  studio_role not null default 'designer',
  permissions           jsonb,      -- per-user permission overrides
  hourly_rate           numeric(10,2),
  employment_type       text check (employment_type in ('full_time','part_time','freelance')),
  employment_start_date date,
  bank_details          jsonb,
  profile_photo_url     text,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now()
);

-- ─── Invitations (for team invites) ──────────────────────────
create table public.invitations (
  id            uuid primary key default uuid_generate_v4(),
  studio_id     uuid not null references public.studios(id) on delete cascade,
  email         text not null,
  role          studio_role not null default 'designer',
  token         uuid not null default uuid_generate_v4(),
  invited_by_id uuid references public.users(id),
  accepted_at   timestamptz,
  expires_at    timestamptz not null default (now() + interval '7 days'),
  created_at    timestamptz not null default now()
);

-- ─── handle_new_user_signup — creates studio + user atomically ─
create or replace function public.handle_new_user_signup(
  p_user_id    uuid,
  p_user_name  text,
  p_user_email text,
  p_studio_name text
) returns void as $$
declare
  v_studio_id uuid;
begin
  insert into public.studios (name)
  values (p_studio_name)
  returning id into v_studio_id;

  insert into public.users (id, studio_id, name, email, role)
  values (p_user_id, v_studio_id, p_user_name, p_user_email, 'owner');
end;
$$ language plpgsql security definer;

-- ─── Trigger: create user profile on auth signup ─────────────
-- When studio_name is in metadata, creates the studio too.
-- When it's absent (Google OAuth / team invite), creates only the profile.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_studio_name text;
  v_name        text;
begin
  v_name        := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  v_studio_name := new.raw_user_meta_data->>'studio_name';

  if v_studio_name is not null and v_studio_name <> '' then
    -- Email signup: create studio + user in one shot
    perform public.handle_new_user_signup(new.id, v_name, new.email, v_studio_name);
  else
    -- OAuth or team invite: create user profile only (no studio yet)
    insert into public.users (id, name, email)
    values (new.id, v_name, new.email);
  end if;

  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Row-Level Security ───────────────────────────────────────

alter table public.studios enable row level security;
alter table public.users enable row level security;
alter table public.invitations enable row level security;

-- Helper function: get the studio_id for the calling user
create or replace function public.get_my_studio_id()
returns uuid language sql stable security definer as $$
  select studio_id from public.users where id = auth.uid()
$$;

-- Helper function: get the role for the calling user
create or replace function public.get_my_role()
returns studio_role language sql stable security definer as $$
  select role from public.users where id = auth.uid()
$$;

-- Studios policies
create policy "users can read their studio"
  on public.studios for select
  using (id = get_my_studio_id());

create policy "owner can update their studio"
  on public.studios for update
  using (id = get_my_studio_id() and get_my_role() = 'owner');

create policy "authenticated users can create a studio"
  on public.studios for insert
  with check (auth.uid() is not null);

-- Users policies
create policy "read own studio members"
  on public.users for select
  using (studio_id = get_my_studio_id() or id = auth.uid());

create policy "owner can manage studio members"
  on public.users for update
  using (
    studio_id = get_my_studio_id()
    and get_my_role() in ('owner', 'senior_designer')
  );

create policy "users can update own profile"
  on public.users for update
  using (id = auth.uid());

-- Security-definer trigger bypasses RLS for the insert
create policy "system can insert users"
  on public.users for insert
  with check (true);

-- Invitations policies
create policy "owner can manage invitations"
  on public.invitations for all
  using (studio_id = get_my_studio_id() and get_my_role() = 'owner');

create policy "anyone can read invitation by token"
  on public.invitations for select
  using (true);

-- ─── Invoice sequence counter ─────────────────────────────────
create table public.invoice_sequences (
  studio_id  uuid not null references public.studios(id) on delete cascade,
  year       int not null,
  next_seq   int not null default 1,
  primary key (studio_id, year)
);

alter table public.invoice_sequences enable row level security;

create policy "studio members can read invoice sequence"
  on public.invoice_sequences for select
  using (studio_id = get_my_studio_id());

-- Generates next invoice number: e.g. PF-2025-0042
create or replace function public.next_invoice_number(p_studio_id uuid)
returns text language plpgsql security definer as $$
declare
  v_year     int := extract(year from now());
  v_prefix   text;
  v_seq      int;
begin
  select invoice_prefix into v_prefix from public.studios where id = p_studio_id;

  insert into public.invoice_sequences (studio_id, year, next_seq)
  values (p_studio_id, v_year, 2)
  on conflict (studio_id, year) do update
    set next_seq = invoice_sequences.next_seq + 1
  returning next_seq - 1 into v_seq;

  return v_prefix || '-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- ─── Supabase Storage bucket ──────────────────────────────────
-- Run separately in Supabase Dashboard > Storage:
-- Create bucket "projectflow-files" with public = false
-- Path pattern: /{studio_id}/logo/{filename}
--               /{studio_id}/{project_id}/{category}/{version}/{filename}
