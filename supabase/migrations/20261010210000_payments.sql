-- Onlayn to'lovlar: Payme, Click, Multicard tranzaksiyalari

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  provider text not null check (provider in ('payme', 'click', 'multicard')),
  -- To'lov tizimidagi tranzaksiya id (Payme id, Click click_trans_id, Multicard uuid)
  external_id text not null,
  -- so'mda
  amount bigint not null,
  -- 1 = yaratildi/tayyorlandi, 2 = to'landi, -1 = to'lovdan oldin bekor, -2 = to'lovdan keyin bekor (qaytarildi)
  state integer not null default 1,
  reason integer,
  -- Payme talab qiladigan vaqtlar (millisekund)
  provider_time bigint,
  create_time bigint not null default (extract(epoch from now()) * 1000)::bigint,
  perform_time bigint not null default 0,
  cancel_time bigint not null default 0,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);

create index payment_tx_order_idx on public.payment_transactions (order_id);
create index payment_tx_ws_idx on public.payment_transactions (workspace_id, created_at desc);

create trigger payment_tx_set_updated_at
before update on public.payment_transactions
for each row execute function public.set_updated_at();

alter table public.payment_transactions enable row level security;
revoke insert, update, delete on table public.payment_transactions from anon, authenticated;
create policy "payment_tx_select_member" on public.payment_transactions
  for select using (public.is_workspace_member(workspace_id));

alter table public.orders add column paid_at timestamptz;
alter table public.shop_settings add column cash_enabled boolean not null default true;
grant insert (cash_enabled), update (cash_enabled) on table public.shop_settings to authenticated;
