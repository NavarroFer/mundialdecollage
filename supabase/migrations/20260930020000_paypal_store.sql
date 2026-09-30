-- PayPal store: all writes come from server-side routes/webhooks using the
-- service role.  Browser clients never get a policy that could mark a payment
-- as paid or create a shipment.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  price numeric(10,2) not null,
  currency text not null default 'USD',
  active boolean not null default true
);

create table if not exists public.shipping_rates (
  country_code text primary key,
  price numeric(10,2) not null
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  provider text not null default 'paypal',
  provider_subscription_id text unique,
  provider_plan_id text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'suspended', 'cancelled', 'expired')),
  shipping_address jsonb not null,
  next_billing_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  provider text not null default 'paypal',
  provider_order_id text unique,
  status text not null default 'created' check (status in ('created', 'paid', 'refunded', 'reversed')),
  items jsonb not null,
  subtotal numeric(10,2) not null,
  shipping numeric(10,2) not null,
  total numeric(10,2) not null,
  currency text not null default 'USD',
  shipping_address jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paypal',
  provider_payment_id text not null unique,
  kind text not null check (kind in ('subscription', 'one_time')),
  subscription_id uuid references public.subscriptions(id),
  order_id uuid references public.orders(id),
  amount numeric(10,2) not null,
  fee numeric(10,2),
  currency text not null,
  status text not null default 'completed' check (status in ('completed', 'refunded', 'reversed')),
  invoice_number text,
  paid_at timestamptz not null default now(),
  check ((subscription_id is null) <> (order_id is null))
);

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id),
  shipping_address jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'packed', 'shipped', 'delivered', 'cancelled')),
  carrier text,
  tracking_code text,
  shipped_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id text primary key,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create index if not exists subscriptions_provider_subscription_id_idx on public.subscriptions(provider_subscription_id);
create index if not exists payments_subscription_id_idx on public.payments(subscription_id);
create index if not exists payments_order_id_idx on public.payments(order_id);
create index if not exists shipments_status_idx on public.shipments(status);

alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.subscriptions enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.shipments enable row level security;
alter table public.webhook_events enable row level security;

grant select, insert, update, delete on public.customers, public.products, public.shipping_rates,
  public.subscriptions, public.orders, public.payments, public.shipments, public.webhook_events to service_role;

-- Atomically records an accepted payment and exactly one pending shipment.
create or replace function public.record_paypal_subscription_payment(
  p_payment_id text, p_subscription_provider_id text, p_amount numeric, p_fee numeric, p_currency text
) returns boolean language plpgsql security definer set search_path = public as $$
declare local_subscription public.subscriptions%rowtype;
declare local_payment_id uuid;
begin
  select * into local_subscription from public.subscriptions where provider_subscription_id = p_subscription_provider_id;
  if not found then raise exception 'subscription not found: %', p_subscription_provider_id; end if;
  insert into public.payments (provider_payment_id, kind, subscription_id, amount, fee, currency)
  values (p_payment_id, 'subscription', local_subscription.id, p_amount, p_fee, p_currency)
  on conflict (provider_payment_id) do nothing returning id into local_payment_id;
  if local_payment_id is not null then
    insert into public.shipments (payment_id, shipping_address) values (local_payment_id, local_subscription.shipping_address);
  end if;
  update public.subscriptions set status = 'active', updated_at = now() where id = local_subscription.id;
  return local_payment_id is not null;
end;
$$;

create or replace function public.record_paypal_order_payment(
  p_payment_id text, p_order_id uuid, p_amount numeric, p_fee numeric, p_currency text
) returns boolean language plpgsql security definer set search_path = public as $$
declare local_order public.orders%rowtype;
declare local_payment_id uuid;
begin
  select * into local_order from public.orders where id = p_order_id;
  if not found then raise exception 'order not found: %', p_order_id; end if;
  insert into public.payments (provider_payment_id, kind, order_id, amount, fee, currency)
  values (p_payment_id, 'one_time', local_order.id, p_amount, p_fee, p_currency)
  on conflict (provider_payment_id) do nothing returning id into local_payment_id;
  if local_payment_id is not null then
    insert into public.shipments (payment_id, shipping_address) values (local_payment_id, local_order.shipping_address);
  end if;
  update public.orders set status = 'paid' where id = local_order.id;
  return local_payment_id is not null;
end;
$$;

revoke all on function public.record_paypal_subscription_payment(text, text, numeric, numeric, text) from public;
revoke all on function public.record_paypal_order_payment(text, uuid, numeric, numeric, text) from public;
grant execute on function public.record_paypal_subscription_payment(text, text, numeric, numeric, text) to service_role;
grant execute on function public.record_paypal_order_payment(text, uuid, numeric, numeric, text) to service_role;

notify pgrst, 'reload schema';
