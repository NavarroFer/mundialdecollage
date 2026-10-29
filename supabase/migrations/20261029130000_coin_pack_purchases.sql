-- One-time Club coin packs. The paid row is separate from the wallet ledger:
-- provider retries update this row, while credit_club_coins guarantees that
-- the matching balance movement is inserted exactly once.

create table public.coin_pack_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id text not null check (pack_id in ('chico', 'mediano', 'mecenas')),
  coins integer not null,
  provider text not null check (provider in ('mercadopago', 'paypal')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null check (currency in ('ARS', 'USD')),
  checkout_id text,
  mp_payment_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (pack_id = 'chico' and coins = 500 and ((currency = 'ARS' and amount = 5000) or (currency = 'USD' and amount = 5)))
    or (pack_id = 'mediano' and coins = 1725 and ((currency = 'ARS' and amount = 13000) or (currency = 'USD' and amount = 13)))
    or (pack_id = 'mecenas' and coins = 4550 and ((currency = 'ARS' and amount = 30000) or (currency = 'USD' and amount = 30)))
  )
);

create index coin_pack_purchases_user_created_idx
  on public.coin_pack_purchases(user_id, created_at desc);

create unique index coin_pack_purchases_provider_payment_idx
  on public.coin_pack_purchases(provider, mp_payment_id)
  where mp_payment_id is not null;

alter table public.coin_pack_purchases enable row level security;

create policy "coin packs: owner reads own" on public.coin_pack_purchases
  for select to authenticated using (user_id = auth.uid());

grant select on public.coin_pack_purchases to authenticated;
grant select, insert, update, delete on public.coin_pack_purchases to service_role;

notify pgrst, 'reload schema';
