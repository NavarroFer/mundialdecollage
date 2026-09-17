-- One registration per logged-in user for the workshop (20 spots). They pay
-- either the minimum deposit ("seña") or the full price online via Mercado
-- Pago; any remaining balance after a deposit is collected in person at the
-- workshop, not through a second online charge.
create table if not exists public.workshop_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  payment_type text not null check (payment_type in ('sena', 'completo')),
  amount_total numeric not null,
  amount_paid numeric not null default 0,
  amount_pending numeric not null default 0,
  mp_preference_id text,
  mp_payment_id text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.workshop_registrations enable row level security;

create policy "workshop_registrations: read own or admin"
  on public.workshop_registrations for select
  using (auth.uid() = user_id or public.is_admin());

create policy "workshop_registrations: insert own"
  on public.workshop_registrations for insert
  with check (auth.uid() = user_id);

-- Payment status changes only happen server-side: the webhook uses the
-- service-role client (bypasses RLS) after verifying with Mercado Pago
-- directly, and admins can also correct a row by hand if needed.
create policy "workshop_registrations: admin update"
  on public.workshop_registrations for update
  using (public.is_admin())
  with check (public.is_admin());
