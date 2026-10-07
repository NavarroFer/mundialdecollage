create table public.customer_payment_errors (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  subscription_id uuid references public.subscriptions(id),
  provider text not null check (provider in ('mercadopago', 'paypal')),
  event_key text unique,
  stage text not null,
  http_status integer,
  message text not null,
  codes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index customer_payment_errors_customer_date_idx on public.customer_payment_errors(customer_id, created_at desc);
create index customer_payment_errors_date_idx on public.customer_payment_errors(created_at desc);
alter table public.customer_payment_errors enable row level security;
revoke all on public.customer_payment_errors from anon, authenticated;
grant select on public.customer_payment_errors to authenticated;
create policy "admins read customer payment errors" on public.customer_payment_errors for select to authenticated using (public.is_admin());
grant select, insert, update on public.customer_payment_errors to service_role;

-- Preserve diagnostics collected before the history table was introduced.
insert into public.customer_payment_errors (customer_id, subscription_id, provider, stage, http_status, message, codes, created_at)
select customer_id, id, provider, checkout_error->>'stage',
  (checkout_error->>'status')::integer, checkout_error->>'message',
  coalesce(checkout_error->'codes', '[]'::jsonb), (checkout_error->>'at')::timestamptz
from public.subscriptions where checkout_error is not null;
