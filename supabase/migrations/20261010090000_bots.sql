-- 4-bosqich: Telegram Bot Builder

-- ===== Ulangan botlar (har bir "bot" loyihasiga bitta) =====
create table public.bots (
  project_id uuid primary key references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  telegram_bot_id bigint not null unique,
  username text not null,
  -- Bot tokeni AES-256-GCM bilan shifrlangan (kalit: BOT_TOKEN_KEY, faqat serverda)
  token_encrypted text not null,
  -- Telegram webhook so'rovlarini tekshirish uchun maxfiy kalit
  webhook_secret text not null,
  -- Egasi botga "start owner_<kod>" yuborib, o'zini administrator qilib ulaydi
  owner_link_code text not null,
  owner_chat_id bigint,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'error')),
  last_error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger bots_set_updated_at
before update on public.bots
for each row execute function public.set_updated_at();

alter table public.bots enable row level security;

-- Foydalanuvchilar faqat maxfiy bo'lmagan ustunlarni o'qiy oladi; yozish faqat server (service role) orqali
revoke all on table public.bots from anon, authenticated;
grant select (
  project_id, workspace_id, telegram_bot_id, username, owner_link_code, owner_chat_id,
  config, status, last_error, created_at, updated_at
) on table public.bots to authenticated;

create policy "bots_select_member" on public.bots
  for select using (public.is_workspace_member(workspace_id));

-- ===== Bot obunachilari (botga yozgan foydalanuvchilar) =====
create table public.bot_subscribers (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  chat_id bigint not null,
  first_name text,
  username text,
  -- Suhbat holati (masalan ariza: telefon kutilmoqda)
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (project_id, chat_id)
);

alter table public.bot_subscribers enable row level security;
revoke insert, update, delete on table public.bot_subscribers from anon, authenticated;

create policy "subscribers_select_member" on public.bot_subscribers
  for select using (public.is_workspace_member(workspace_id));

-- ===== Bot orqali kelgan arizalar / buyurtmalar =====
create table public.bot_requests (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  chat_id bigint not null,
  customer_name text,
  username text,
  phone text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'in_progress', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);

create index bot_requests_project_idx on public.bot_requests (project_id, created_at desc);

alter table public.bot_requests enable row level security;
revoke insert, delete on table public.bot_requests from anon, authenticated;

create policy "requests_select_member" on public.bot_requests
  for select using (public.is_workspace_member(workspace_id));
create policy "requests_update_member" on public.bot_requests
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
