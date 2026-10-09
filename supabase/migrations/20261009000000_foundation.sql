-- 1-bosqich: asos jadvallari (profiles, workspaces, workspace_members, projects, audit_logs)

create extension if not exists "pgcrypto";

-- ===== Profiles =====
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

-- ===== Workspaces =====
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create type public.workspace_role as enum ('owner', 'admin', 'member');

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);

-- ===== Projects =====
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  type text not null check (type in ('website', 'bot', 'automation')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_workspace_idx on public.projects (workspace_id, created_at desc);

-- ===== Audit log =====
create table public.audit_logs (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_workspace_idx on public.audit_logs (workspace_id, created_at desc);

-- ===== Yordamchi funksiyalar (RLS ichida rekursiyani oldini oladi) =====
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function public.workspace_role_of(ws uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.workspace_members
  where workspace_id = ws and user_id = auth.uid();
$$;

-- updated_at ni avtomatik yangilash
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- Ro'yxatdan o'tganda: profil + shaxsiy workspace + egasi sifatida a'zolik
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  display_name text;
begin
  display_name := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));

  insert into public.profiles (id, full_name) values (new.id, display_name);

  insert into public.workspaces (name, owner_id)
  values (left(display_name, 80) || ' workspace', new.id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ===== RLS =====
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: faqat o'zi
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Workspaces: a'zolar ko'radi, egasi o'zgartiradi
create policy "workspaces_select_member" on public.workspaces
  for select using (public.is_workspace_member(id));
create policy "workspaces_update_owner" on public.workspaces
  for update using (public.workspace_role_of(id) = 'owner')
  with check (public.workspace_role_of(id) = 'owner');

-- Workspace members: a'zolar ro'yxatni ko'radi; o'zgartirish keyingi bosqichda
create policy "members_select_member" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));

-- Projects: workspace a'zolari CRUD; o'chirish faqat owner/admin
create policy "projects_select_member" on public.projects
  for select using (public.is_workspace_member(workspace_id));
create policy "projects_insert_member" on public.projects
  for insert with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy "projects_update_member" on public.projects
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "projects_delete_admin" on public.projects
  for delete using (public.workspace_role_of(workspace_id) in ('owner', 'admin'));

-- Audit log: a'zolar o'qiydi, faqat o'z nomidan yozadi, o'zgartirib/o'chirib bo'lmaydi
create policy "audit_select_member" on public.audit_logs
  for select using (public.is_workspace_member(workspace_id));
create policy "audit_insert_self" on public.audit_logs
  for insert with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());
