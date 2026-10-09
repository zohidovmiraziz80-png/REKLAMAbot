-- 2-bosqich: AI Website Builder — har bir "website" loyihasining sayt tuzilmasi (JSON)

create table public.websites (
  project_id uuid primary key references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content jsonb not null,
  -- AI'ga berilgan dastlabki tavsif (qayta yaratish va tahlil uchun)
  brief jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create index websites_workspace_idx on public.websites (workspace_id);

create trigger websites_set_updated_at
before update on public.websites
for each row execute function public.set_updated_at();

alter table public.websites enable row level security;

create policy "websites_select_member" on public.websites
  for select using (public.is_workspace_member(workspace_id));
create policy "websites_insert_member" on public.websites
  for insert with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = websites.workspace_id and p.type = 'website'
    )
  );
create policy "websites_update_member" on public.websites
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "websites_delete_admin" on public.websites
  for delete using (public.workspace_role_of(workspace_id) in ('owner', 'admin'));
