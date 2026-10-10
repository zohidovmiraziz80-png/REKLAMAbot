-- Chat: bot orqali mijoz bilan yozishma
create table if not exists public.chat_messages (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  chat_id bigint not null,
  direction text not null check (direction in ('in', 'out')),
  text text not null check (char_length(text) <= 4096),
  -- Egasining Telegram chatidagi nusxa (reply qilib javob berish uchun)
  owner_message_id bigint,
  sender_user_id uuid references auth.users (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_conv_idx on public.chat_messages (workspace_id, project_id, chat_id, created_at desc);
create index if not exists chat_messages_ws_idx on public.chat_messages (workspace_id, created_at desc);
create index if not exists chat_messages_owner_idx on public.chat_messages (project_id, owner_message_id) where owner_message_id is not null;
alter table public.chat_messages enable row level security;
drop policy if exists "chat_select_member" on public.chat_messages;
create policy "chat_select_member" on public.chat_messages for select using (public.is_workspace_member(workspace_id));
revoke insert, update, delete on table public.chat_messages from anon, authenticated;
