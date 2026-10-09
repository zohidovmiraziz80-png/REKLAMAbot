-- Ro'yxatdan o'tishda telefon raqami (+998XXXXXXXXX formatida)

alter table public.profiles
  add column phone text check (phone is null or phone ~ '^\+998[0-9]{9}$');

create index profiles_phone_idx on public.profiles (phone);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  display_name text;
  phone_value text;
begin
  display_name := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));
  phone_value := new.raw_user_meta_data ->> 'phone';
  if phone_value is not null and phone_value !~ '^\+998[0-9]{9}$' then
    phone_value := null;
  end if;

  insert into public.profiles (id, full_name, phone) values (new.id, display_name, phone_value);

  insert into public.workspaces (name, owner_id)
  values (left(display_name, 80) || ' workspace', new.id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  return new;
end;
$$;
