-- Preventa de la Revista 1ª Edición (app/revista): printed copies paid once
-- through Mercado Pago Checkout Pro and shipped within Argentina. Buying
-- doesn't require an account; user_id is kept when the buyer was signed in.
create table if not exists public.magazine_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  name text not null,
  phone text not null,
  -- { address_line_1, address_line_2, city, province, postal_code }
  shipping_address jsonb not null,
  quantity integer not null check (quantity between 1 and 10),
  amount numeric not null,
  currency text not null default 'ARS',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),
  mp_preference_id text,
  mp_payment_id text,
  -- Set from /admin/revista once the copy is on its way.
  shipped_at timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists magazine_orders_status_idx on public.magazine_orders (status, created_at);

alter table public.magazine_orders enable row level security;

-- Written only server-side with the service-role client (app/revista/actions.ts
-- creates them, lib/magazine-payments.ts marks them paid after re-fetching the
-- payment from Mercado Pago). Only admins read them: they hold addresses.
create policy "magazine_orders: admin read"
  on public.magazine_orders for select
  using (public.is_admin());

create policy "magazine_orders: admin update"
  on public.magazine_orders for update
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.magazine_orders from anon;
grant select, update on public.magazine_orders to authenticated;
grant select, insert, update, delete on public.magazine_orders to service_role;

notify pgrst, 'reload schema';
