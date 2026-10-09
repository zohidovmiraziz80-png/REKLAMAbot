-- 3-bosqich: saytni nashr qilish, subdomen va o'z domeni

-- ===== Platforma administratorlari (faqat SQL orqali qo'shiladi, API orqali yozib bo'lmaydi) =====
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
-- Siyosat yo'q: hech kim API orqali o'qiy/yoza olmaydi, faqat quyidagi funksiya tekshiradi

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- ===== Nashr qilingan saytlar (ommaviy o'qiladi) =====
create table public.published_sites (
  project_id uuid primary key references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'),
  content jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null
);

alter table public.published_sites enable row level security;

create policy "published_select_all" on public.published_sites
  for select using (true);
create policy "published_insert_member" on public.published_sites
  for insert with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = published_sites.workspace_id and p.type = 'website'
    )
  );
create policy "published_update_member" on public.published_sites
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "published_delete_member" on public.published_sites
  for delete using (public.is_workspace_member(workspace_id));

-- ===== O'z domenlari =====
create table public.site_domains (
  domain text primary key check (domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$'),
  project_id uuid not null references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'error')),
  last_error text,
  verification jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index site_domains_project_idx on public.site_domains (project_id);

create trigger site_domains_set_updated_at
before update on public.site_domains
for each row execute function public.set_updated_at();

alter table public.site_domains enable row level security;

create policy "domains_select_member_or_admin" on public.site_domains
  for select using (public.is_workspace_member(workspace_id) or public.is_platform_admin());
create policy "domains_insert_member" on public.site_domains
  for insert with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = site_domains.workspace_id and p.type = 'website'
    )
  );
create policy "domains_update_member_or_admin" on public.site_domains
  for update using (public.is_workspace_member(workspace_id) or public.is_platform_admin())
  with check (public.is_workspace_member(workspace_id) or public.is_platform_admin());
create policy "domains_delete_member_or_admin" on public.site_domains
  for delete using (public.is_workspace_member(workspace_id) or public.is_platform_admin());

-- Admin paneli loyiha nomlarini ko'ra olishi uchun
create policy "projects_select_admin" on public.projects
  for select using (public.is_platform_admin());

-- ===== Domen → sayt slug'i (middleware uchun, faqat faol domenlar) =====
create or replace function public.resolve_site_domain(d text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select ps.slug
  from public.site_domains sd
  join public.published_sites ps on ps.project_id = sd.project_id
  where sd.domain = lower(d) and sd.status = 'active'
  limit 1;
$$;

grant execute on function public.resolve_site_domain(text) to anon, authenticated;
grant execute on function public.is_platform_admin() to authenticated;
