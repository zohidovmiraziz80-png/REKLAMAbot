-- Tariflar: Bot, Sayt, Sayt + Bot. Yangi workspace 14 kunlik "Sayt + Bot" sinov muddati bilan boshlanadi.

create table public.plans (
  id text primary key,
  name text not null,
  description text not null default '',
  price_uzs integer check (price_uzs is null or price_uzs >= 0),
  allow_sites boolean not null,
  allow_bots boolean not null,
  sort integer not null default 0
);

insert into public.plans (id, name, description, price_uzs, allow_sites, allow_bots, sort) values
  ('bot', 'Bot', 'Telegram bot: menyu, javoblar, arizalar va Mini App tugmasi', null, false, true, 1),
  ('site', 'Sayt', 'Shablondan sayt, tahrirlovchi va internetga nashr qilish', null, true, false, 2),
  ('site_bot', 'Sayt + Bot', 'Sayt va Telegram bot birga — sayt bot ichida Mini App bo''lib ochiladi', null, true, true, 3);

alter table public.plans enable row level security;
create policy "plans_select_all" on public.plans for select using (true);
create policy "plans_update_admin" on public.plans
  for update using (public.is_platform_admin()) with check (public.is_platform_admin());
grant select on public.plans to anon, authenticated;

-- ===== Workspace tarifi =====
alter table public.workspaces
  add column plan_id text not null default 'site_bot' references public.plans (id),
  add column plan_status text not null default 'trial' check (plan_status in ('trial', 'active', 'expired')),
  add column trial_ends_at timestamptz default (now() + interval '14 days');

-- Foydalanuvchi o'z tarifini o'zgartira olmasin: faqat nomni yangilash ruxsat etiladi
revoke update on table public.workspaces from anon, authenticated;
grant update (name) on table public.workspaces to authenticated;

-- ===== Admin funksiyalari =====
create or replace function public.admin_list_workspaces()
returns table (
  id uuid,
  name text,
  owner_email text,
  owner_name text,
  owner_phone text,
  plan_id text,
  plan_status text,
  trial_ends_at timestamptz,
  created_at timestamptz,
  sites_count bigint,
  bots_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  return query
  select
    w.id, w.name, u.email::text, p.full_name, p.phone, w.plan_id, w.plan_status, w.trial_ends_at, w.created_at,
    (select count(*) from public.projects pr where pr.workspace_id = w.id and pr.type = 'website'),
    (select count(*) from public.projects pr where pr.workspace_id = w.id and pr.type = 'bot')
  from public.workspaces w
  left join auth.users u on u.id = w.owner_id
  left join public.profiles p on p.id = w.owner_id
  order by w.created_at desc;
end;
$$;

create or replace function public.admin_set_workspace_plan(ws uuid, new_plan text, new_status text, new_trial_ends timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  update public.workspaces
  set plan_id = new_plan, plan_status = new_status, trial_ends_at = new_trial_ends
  where id = ws;
end;
$$;

revoke execute on function public.admin_list_workspaces() from public, anon;
revoke execute on function public.admin_set_workspace_plan(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.admin_list_workspaces() to authenticated;
grant execute on function public.admin_set_workspace_plan(uuid, text, text, timestamptz) to authenticated;
