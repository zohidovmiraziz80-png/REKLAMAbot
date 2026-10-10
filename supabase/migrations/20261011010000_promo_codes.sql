-- Marketing: promo-kodlar
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9_-]{3,30}$'),
  kind text not null default 'percent' check (kind in ('percent', 'fixed')),
  value bigint not null check (value > 0),
  min_order bigint not null default 0 check (min_order >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, code)
);
alter table public.promo_codes enable row level security;
drop policy if exists "promo_select_member" on public.promo_codes;
create policy "promo_select_member" on public.promo_codes for select using (public.is_workspace_member(workspace_id));
revoke insert, update, delete on table public.promo_codes from anon, authenticated;

alter table public.orders add column if not exists promo_code text;
alter table public.orders add column if not exists discount bigint not null default 0;
