-- Minimal profile: onboarding only collects name + location today. Extend
-- this table (don't create a new one) as later phases need more fields
-- (role for admin campaign access, subscription status, shipping address, ...).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  location text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: users read own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: users insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles: users update own"
  on public.profiles for update
  using (auth.uid() = id);
