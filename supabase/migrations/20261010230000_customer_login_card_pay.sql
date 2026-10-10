-- Mijoz kabineti (Telegram orqali telefon tasdiqlash) va kartaga o'tkazma (kanal SMS orqali avto-tasdiqlash)

-- ===== Mijozning saytga kirishi =====
create table public.customer_logins (
  token text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  bot_project_id uuid references public.projects (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'used')),
  phone text,
  chat_id bigint,
  name text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);
create index customer_logins_ws_idx on public.customer_logins (workspace_id, created_at desc);
alter table public.customer_logins enable row level security;
revoke all on table public.customer_logins from anon, authenticated;

-- ===== Kartaga o'tkazma =====
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('cash', 'payme', 'click', 'multicard', 'card'));
-- Mijoz o'tkazishi kerak bo'lgan aniq (noyob) summa
alter table public.orders add column pay_amount bigint;
create index orders_pay_amount_idx on public.orders (workspace_id, pay_amount) where pay_amount is not null and payment_status = 'unpaid';

alter table public.payment_transactions drop constraint if exists payment_transactions_provider_check;
alter table public.payment_transactions add constraint payment_transactions_provider_check
  check (provider in ('payme', 'click', 'multicard', 'card'));

alter table public.shop_settings
  add column card_enabled boolean not null default false,
  add column card_number text not null default '' check (char_length(card_number) <= 32),
  add column card_holder text not null default '' check (char_length(card_holder) <= 80),
  add column pay_channel_code text not null default substr(md5(random()::text), 1, 10),
  add column pay_channel_chat_id bigint,
  add column pay_channel_title text,
  add column pay_channel_bot_project_id uuid references public.projects (id) on delete set null;

grant insert (card_enabled, card_number, card_holder), update (card_enabled, card_number, card_holder)
  on table public.shop_settings to authenticated;
