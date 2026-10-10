-- 5-bosqich: Mahsulotlar, buyurtmalar, mijozlar (CRM) va do'kon sozlamalari

-- ===== Mahsulotlar =====
create table public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  price bigint not null default 0 check (price >= 0),
  old_price bigint check (old_price is null or old_price >= 0),
  category text not null default '' check (char_length(category) <= 60),
  image_url text check (image_url is null or image_url ~ '^https://'),
  emoji text not null default '' check (char_length(emoji) <= 8),
  sku text check (sku is null or char_length(sku) <= 64),
  -- null = cheklanmagan qoldiq
  stock integer check (stock is null or stock >= 0),
  is_active boolean not null default true,
  sort integer not null default 0,
  -- Tashqi tizim (masalan Bito) bilan sinxronlash uchun
  external_source text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_workspace_idx on public.products (workspace_id, sort, created_at desc);
create unique index products_external_idx on public.products (workspace_id, external_source, external_id) where external_id is not null;

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

alter table public.products enable row level security;
create policy "products_select_member" on public.products for select using (public.is_workspace_member(workspace_id));
create policy "products_insert_member" on public.products for insert with check (public.is_workspace_member(workspace_id));
create policy "products_update_member" on public.products for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "products_delete_member" on public.products for delete using (public.is_workspace_member(workspace_id));

-- ===== Mijozlar (CRM) =====
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text,
  phone text not null,
  telegram_chat_id bigint,
  telegram_username text,
  address text,
  note text not null default '' check (char_length(note) <= 2000),
  orders_count integer not null default 0,
  total_spent bigint not null default 0,
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, phone)
);

create index customers_workspace_idx on public.customers (workspace_id, last_order_at desc nulls last);

alter table public.customers enable row level security;
revoke insert, update on table public.customers from anon, authenticated;
grant update (name, address, note) on table public.customers to authenticated;
create policy "customers_select_member" on public.customers for select using (public.is_workspace_member(workspace_id));
create policy "customers_update_member" on public.customers for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "customers_delete_member" on public.customers for delete using (public.is_workspace_member(workspace_id));

-- ===== Buyurtmalar =====
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  number integer not null,
  customer_id uuid references public.customers (id) on delete set null,
  source text not null default 'site' check (source in ('site', 'miniapp', 'bot', 'manual')),
  -- Buyurtma kelgan sayt va (Mini App bo'lsa) bot
  site_project_id uuid references public.projects (id) on delete set null,
  bot_project_id uuid references public.projects (id) on delete set null,
  chat_id bigint,
  customer_name text,
  phone text not null,
  address text,
  comment text,
  delivery_method text not null default 'pickup' check (delivery_method in ('pickup', 'courier')),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'payme', 'click', 'multicard')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  status text not null default 'new' check (status in ('new', 'confirmed', 'delivering', 'done', 'cancelled')),
  items jsonb not null default '[]'::jsonb,
  subtotal bigint not null default 0,
  delivery_price bigint not null default 0,
  total bigint not null default 0,
  admin_note text not null default '' check (char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, number)
);

create index orders_workspace_idx on public.orders (workspace_id, created_at desc);
create index orders_chat_idx on public.orders (workspace_id, chat_id, created_at desc) where chat_id is not null;
create index orders_customer_idx on public.orders (customer_id, created_at desc);

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- Har bir workspace ichida ketma-ket raqam (№1, №2, ...)
create or replace function public.orders_assign_number()
returns trigger
language plpgsql
as $fn$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text, 0));
  select coalesce(max(number), 0) + 1 into new.number from public.orders where workspace_id = new.workspace_id;
  return new;
end;
$fn$;

create trigger orders_assign_number
before insert on public.orders
for each row execute function public.orders_assign_number();

-- Bekor qilinganda qoldiq va mijoz statistikasi qaytariladi
create or replace function public.orders_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  it jsonb;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    for it in select * from jsonb_array_elements(old.items) loop
      update public.products
        set stock = stock + coalesce((it->>'qty')::int, 0)
        where id = (it->>'product_id')::uuid and workspace_id = old.workspace_id and stock is not null;
    end loop;
    if old.customer_id is not null then
      update public.customers
        set orders_count = greatest(orders_count - 1, 0), total_spent = greatest(total_spent - old.total, 0)
        where id = old.customer_id;
    end if;
  end if;
  return new;
end;
$fn$;

create trigger orders_on_cancel
after update of status on public.orders
for each row execute function public.orders_on_cancel();

alter table public.orders enable row level security;
revoke insert, update on table public.orders from anon, authenticated;
grant update (status, payment_status, admin_note) on table public.orders to authenticated;
create policy "orders_select_member" on public.orders for select using (public.is_workspace_member(workspace_id));
create policy "orders_update_member" on public.orders for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "orders_delete_member" on public.orders for delete using (public.is_workspace_member(workspace_id));

-- ===== Do'kon sozlamalari =====
create table public.shop_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  accept_orders boolean not null default true,
  pickup_enabled boolean not null default true,
  pickup_address text not null default '' check (char_length(pickup_address) <= 300),
  delivery_enabled boolean not null default true,
  delivery_price bigint not null default 0 check (delivery_price >= 0),
  free_delivery_from bigint check (free_delivery_from is null or free_delivery_from >= 0),
  min_order bigint not null default 0 check (min_order >= 0),
  order_thanks text not null default '' check (char_length(order_thanks) <= 500),
  -- Buyurtmalar tushadigan Telegram guruh (bot orqali "/ulash KOD" bilan bog'lanadi)
  group_link_code text not null default substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  group_chat_id bigint,
  group_title text,
  group_bot_project_id uuid references public.projects (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger shop_settings_set_updated_at
before update on public.shop_settings
for each row execute function public.set_updated_at();

alter table public.shop_settings enable row level security;
revoke insert, update on table public.shop_settings from anon, authenticated;
grant insert (workspace_id, accept_orders, pickup_enabled, pickup_address, delivery_enabled, delivery_price, free_delivery_from, min_order, order_thanks)
  on table public.shop_settings to authenticated;
grant update (accept_orders, pickup_enabled, pickup_address, delivery_enabled, delivery_price, free_delivery_from, min_order, order_thanks)
  on table public.shop_settings to authenticated;
create policy "shop_settings_select_member" on public.shop_settings for select using (public.is_workspace_member(workspace_id));
create policy "shop_settings_insert_member" on public.shop_settings for insert with check (public.is_workspace_member(workspace_id));
create policy "shop_settings_update_member" on public.shop_settings for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

-- ===== Buyurtma yaratish (atomar: narx, qoldiq, mijoz, raqam). Faqat server (service role) chaqiradi =====
create or replace function public.create_order(
  p_workspace uuid,
  p_source text,
  p_site_project uuid,
  p_bot_project uuid,
  p_chat_id bigint,
  p_items jsonb,
  p_name text,
  p_phone text,
  p_username text,
  p_delivery text,
  p_address text,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  s public.shop_settings%rowtype;
  r record;
  p public.products%rowtype;
  v_items jsonb := '[]'::jsonb;
  v_subtotal bigint := 0;
  v_delivery bigint := 0;
  v_total bigint;
  v_customer uuid;
  v_order public.orders%rowtype;
begin
  select * into s from public.shop_settings where workspace_id = p_workspace;
  if not found then
    s.accept_orders := true; s.pickup_enabled := true; s.delivery_enabled := true;
    s.delivery_price := 0; s.min_order := 0;
  end if;

  if not s.accept_orders then raise exception 'orders_closed'; end if;
  if p_delivery = 'pickup' and not s.pickup_enabled then raise exception 'delivery_unavailable'; end if;
  if p_delivery = 'courier' and not s.delivery_enabled then raise exception 'delivery_unavailable'; end if;

  for r in
    select (e->>'id')::uuid as id, sum(greatest(least((e->>'qty')::int, 999), 1))::int as qty
    from jsonb_array_elements(p_items) e
    group by 1
  loop
    select * into p from public.products
      where id = r.id and workspace_id = p_workspace and is_active
      for update;
    if not found then raise exception 'product_unavailable'; end if;
    if p.stock is not null and p.stock < r.qty then
      raise exception 'out_of_stock:%', p.name;
    end if;
    if p.stock is not null then
      update public.products set stock = stock - r.qty where id = p.id;
    end if;
    v_subtotal := v_subtotal + p.price * r.qty;
    v_items := v_items || jsonb_build_object(
      'product_id', p.id, 'name', p.name, 'price', p.price, 'qty', r.qty, 'image_url', p.image_url, 'emoji', p.emoji
    );
  end loop;

  if jsonb_array_length(v_items) = 0 then raise exception 'empty_cart'; end if;
  if v_subtotal < s.min_order then raise exception 'min_order:%', s.min_order; end if;

  if p_delivery = 'courier' then
    v_delivery := case when s.free_delivery_from is not null and v_subtotal >= s.free_delivery_from then 0 else s.delivery_price end;
  end if;
  v_total := v_subtotal + v_delivery;

  insert into public.customers as c (workspace_id, name, phone, telegram_chat_id, telegram_username, address, orders_count, total_spent, last_order_at)
  values (p_workspace, nullif(p_name, ''), p_phone, p_chat_id, nullif(p_username, ''), nullif(p_address, ''), 1, v_total, now())
  on conflict (workspace_id, phone) do update set
    name = coalesce(excluded.name, c.name),
    telegram_chat_id = coalesce(excluded.telegram_chat_id, c.telegram_chat_id),
    telegram_username = coalesce(excluded.telegram_username, c.telegram_username),
    address = coalesce(excluded.address, c.address),
    orders_count = c.orders_count + 1,
    total_spent = c.total_spent + v_total,
    last_order_at = now()
  returning id into v_customer;

  insert into public.orders (
    workspace_id, number, customer_id, source, site_project_id, bot_project_id, chat_id,
    customer_name, phone, address, comment, delivery_method, items, subtotal, delivery_price, total
  ) values (
    p_workspace, 0, v_customer, p_source, p_site_project, p_bot_project, p_chat_id,
    nullif(p_name, ''), p_phone, nullif(p_address, ''), nullif(p_comment, ''), p_delivery, v_items, v_subtotal, v_delivery, v_total
  )
  returning * into v_order;

  return jsonb_build_object('id', v_order.id, 'number', v_order.number, 'total', v_order.total);
end;
$fn$;

revoke all on function public.create_order(uuid, text, uuid, uuid, bigint, jsonb, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, uuid, uuid, bigint, jsonb, text, text, text, text, text, text) to service_role;
