-- Donations (lib/donations.ts), recorded when Mercado Pago or PayPal reports
-- a payment for one (lib/donation-payments.ts), so /admin/estadisticas lists
-- them with the rest of what came in. One row per checkout: its id is the
-- one in the "donacion:<id>" reference, and a checkout left unpaid leaves no
-- row. Written only server-side with the service role; only admins read them.
create table if not exists public.donations (
  id uuid primary key,
  provider text not null check (provider in ('mercadopago', 'paypal')),
  -- The provider's latest payment for this checkout (a rejected card, then
  -- another that went through).
  provider_payment_id text not null,
  status text not null check (status in ('pending', 'paid', 'failed', 'refunded')),
  amount numeric not null,
  currency text not null,
  -- What the provider says about the donor: Mercado Pago gives an email,
  -- PayPal's capture nothing.
  payer_email text,
  payer_name text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists donations_created_at_idx on public.donations (created_at desc);

alter table public.donations enable row level security;

create policy "donations: admin read"
  on public.donations for select
  using (public.is_admin());

revoke all on public.donations from anon;
grant select on public.donations to authenticated;
grant select, insert, update, delete on public.donations to service_role;

-- The dollar donations made before this table: PayPal's webhook kept each
-- capture in webhook_events though nothing was recorded from it. The peso
-- ones are brought from Mercado Pago from the admin (recoverMercadoPagoDonations).
insert into public.donations (id, provider, provider_payment_id, status, amount, currency, created_at, paid_at)
select distinct on (donation_id)
  donation_id,
  'paypal',
  e.payload->'resource'->>'id',
  'paid',
  (e.payload->'resource'->'amount'->>'value')::numeric,
  e.payload->'resource'->'amount'->>'currency_code',
  coalesce((e.payload->'resource'->>'create_time')::timestamptz, e.received_at),
  coalesce((e.payload->'resource'->>'create_time')::timestamptz, e.received_at)
from public.webhook_events e
cross join lateral (
  select (regexp_match(e.payload->'resource'->>'custom_id', '^donacion:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$'))[1]::uuid as donation_id
) d
where e.event_type = 'PAYMENT.CAPTURE.COMPLETED'
  and d.donation_id is not null
  and e.payload->'resource'->>'id' is not null
  and e.payload->'resource'->'amount'->>'value' is not null
order by donation_id, e.received_at
on conflict (id) do nothing;

notify pgrst, 'reload schema';
