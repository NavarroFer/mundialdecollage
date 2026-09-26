-- Fer (2026-09-26): an artist can keep several obras on their account, but
-- only one participates for free — and they choose which. Postulating more
-- than one takes a one-time payment (ARS 30.000 by Mercado Pago today,
-- USD 15 by PayPal later) that raises the limit (lib/entries.ts).
--
-- is_selected keeps its meaning: the one obra that represents the artist on
-- the public site. is_entered is the new, wider set: every obra postulated
-- to the contest. The selected obra is always entered; the extra ones only
-- exist for an artist who paid.

alter table public.artworks add column if not exists is_entered boolean not null default false;

update public.artworks set is_entered = true where is_selected and archived_at is null;

-- Keeps "selected implies entered" true for every writer — link_registro_user,
-- the admin's "Usar esta obra", the onboarding insert — without each one
-- having to remember the second column.
create or replace function public.selected_artwork_is_entered()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_selected then
    new.is_entered := true;
  end if;
  return new;
end;
$$;

drop trigger if exists artworks_selected_is_entered on public.artworks;
create trigger artworks_selected_is_entered
  before insert or update of is_selected, is_entered on public.artworks
  for each row execute function public.selected_artwork_is_entered();

-- Set once the artist picks their obras from /onboarding/obras. An artist
-- with several obras (a resubmission, or more than one sent by mail and
-- linked by link_registro_user) is sent there to choose before anything else.
alter table public.profiles add column if not exists entries_chosen_at timestamptz;

create table if not exists public.entry_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Denormalized so the admin list needs no join against auth.users.
  email text not null,
  provider text not null check (provider in ('mercadopago', 'paypal')),
  amount numeric not null,
  currency text not null,
  -- How many obras this purchase lets the artist postulate in total.
  entries_allowed integer not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),
  mp_preference_id text,
  mp_payment_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists entry_purchases_user_id_idx on public.entry_purchases (user_id);

alter table public.entry_purchases enable row level security;

-- Rows are only ever written server-side with the service-role client
-- (app/onboarding/obras/actions.ts creates them, lib/entry-payments.ts marks
-- them paid after re-fetching the payment from Mercado Pago). No insert or
-- update policy for artists: a row they could write could say "paid".
create policy "entry_purchases: read own or admin"
  on public.entry_purchases for select
  using (auth.uid() = user_id or public.is_admin());

grant select on public.entry_purchases to authenticated;
grant select, insert, update, delete on public.entry_purchases to service_role;

notify pgrst, 'reload schema';
