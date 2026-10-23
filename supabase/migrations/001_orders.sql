-- Orders, admin allow-list and row-level security for the glasses-case order page.
-- Customers never write to the table directly: the create-order edge function
-- (service role) inserts orders. Only signed-in admins can read and edit them.

create table public.orders (
  id              bigint generated always as identity primary key,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  customer_name   text not null check (char_length(customer_name) between 3 and 100),
  phone           text not null check (phone ~ '^0[567][0-9]{8}$'),
  wilaya          text not null check (char_length(wilaya) between 4 and 60),
  commune         text not null check (char_length(commune) between 2 and 60),
  delivery_type   text not null check (delivery_type in ('home', 'desk')),
  address         text not null default '' check (char_length(address) <= 300),
  quantity        integer not null check (quantity between 16 and 5000),
  unit_price      integer not null default 50,
  total_price     integer not null,
  status          text not null default 'new'
                  check (status in ('new', 'no_answer', 'confirmed', 'shipped', 'delivered', 'returned', 'cancelled')),
  tracking_number text,
  notes           text,
  telegram_sent   boolean not null default false
);

create index orders_created_at_idx on public.orders (created_at desc);
create index orders_phone_idx on public.orders (phone, created_at desc);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = (select auth.uid())) $$;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end $$;

create trigger orders_touch before update on public.orders
for each row execute function public.touch_updated_at();

alter table public.orders enable row level security;
alter table public.admins enable row level security;   -- no policies: only is_admin() reads it

create policy "admins read orders" on public.orders
  for select to authenticated using ((select public.is_admin()));
create policy "admins update orders" on public.orders
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- the browser may only call is_admin(); table access is limited to the policies above
revoke all on public.orders, public.admins from anon, authenticated;
grant select, update on public.orders to authenticated;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
