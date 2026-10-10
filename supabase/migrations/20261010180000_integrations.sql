-- Integratsiyalar (Bito, to'lovlar, yetkazish, SMS, CRM). Kalitlar shifrlangan, faqat server o'qiydi.

create table public.integrations (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null check (provider in ('bito', 'payme', 'click', 'multicard', 'yandex', 'bts', 'fargo', 'eskiz', 'amocrm', 'bitrix24')),
  status text not null default 'active' check (status in ('active', 'error', 'disabled')),
  -- AES-256-GCM (BOT_TOKEN_KEY) bilan shifrlangan JSON
  credentials_encrypted text not null,
  -- Maxfiy bo'lmagan sozlamalar (filial, narx turi, ombor ...)
  settings jsonb not null default '{}'::jsonb,
  -- Kalitning oxirgi 4 belgisi (foydalanuvchiga ko'rsatish uchun)
  key_hint text,
  last_sync_at timestamptz,
  sync_started_at timestamptz,
  last_sync_result jsonb,
  last_error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, provider)
);

create trigger integrations_set_updated_at
before update on public.integrations
for each row execute function public.set_updated_at();

alter table public.integrations enable row level security;
revoke all on table public.integrations from anon, authenticated;
grant select (workspace_id, provider, status, settings, key_hint, last_sync_at, sync_started_at, last_sync_result, last_error, created_at, updated_at)
  on table public.integrations to authenticated;
create policy "integrations_select_member" on public.integrations
  for select using (public.is_workspace_member(workspace_id));

-- Tashqi tizim bilan bog'lanish
alter table public.products add column synced_at timestamptz;
drop index if exists public.products_external_idx;
alter table public.products add constraint products_external_key unique (workspace_id, external_source, external_id);

alter table public.customers add column external_ids jsonb not null default '{}'::jsonb;

alter table public.orders add column external_ids jsonb not null default '{}'::jsonb;
alter table public.orders add column sync_error text;
