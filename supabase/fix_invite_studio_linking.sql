-- ============================================================
-- Fix Bug #5b: team invites lose studio_id / role on signup
--
-- inviteTeamMember() (app/actions/team.ts) already passes
-- { studio_id, role } via raw_user_meta_data on the Supabase
-- admin invite call. handle_new_user() ignored that and only
-- branched on studio_name (email signup) vs "everything else"
-- (OAuth and team invites treated identically), so invited
-- users landed with studio_id = null and the table default role.
--
-- This adds a new elsif branch: when raw_user_meta_data has a
-- studio_id, insert the user with studio_id + role set directly.
-- The studio_name branch (handle_new_user_signup) is untouched;
-- the OAuth-with-no-context fallback remains the final else.
--
-- Safe to run against the live DB: `create or replace function`
-- only, no table/trigger changes.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_studio_name text;
  v_name        text;
  v_studio_id   uuid;
  v_role        studio_role;
begin
  v_name        := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  v_studio_name := new.raw_user_meta_data->>'studio_name';
  v_studio_id   := (new.raw_user_meta_data->>'studio_id')::uuid;

  if v_studio_name is not null and v_studio_name <> '' then
    -- Email signup: create studio + user in one shot
    perform public.handle_new_user_signup(new.id, v_name, new.email, v_studio_name);
  elsif v_studio_id is not null then
    -- Team invite: studio_id + role passed via inviteTeamMember() metadata
    v_role := coalesce(new.raw_user_meta_data->>'role', 'designer')::studio_role;
    insert into public.users (id, studio_id, name, email, role, is_active)
    values (new.id, v_studio_id, v_name, new.email, v_role, true);
  else
    -- OAuth with no studio context yet
    insert into public.users (id, name, email, is_active)
    values (new.id, v_name, new.email, true);
  end if;

  return new;
end;
$$;
