
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

  insert into public.users (id, studio_id, name, email, role, is_active)
  values (p_user_id, v_studio_id, p_user_name, p_user_email, 'owner', true);
end;
$$ language plpgsql security definer;


create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_studio_name text;
  v_name        text;
begin
  v_name        := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  v_studio_name := new.raw_user_meta_data->>'studio_name';

  if v_studio_name is not null and v_studio_name <> '' then
    
    perform public.handle_new_user_signup(new.id, v_name, new.email, v_studio_name);
  else
    
    insert into public.users (id, name, email, is_active)
    values (new.id, v_name, new.email, true);
  end if;

  return new;
end;
$$;



update public.users
set is_active = true
where is_active = false;
