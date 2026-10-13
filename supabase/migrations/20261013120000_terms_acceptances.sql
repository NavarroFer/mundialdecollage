-- Who accepted which version of the Términos y Condiciones (lib/terms.ts),
-- and when. Written by the onboarding actions when an artist ticks the
-- TermsCheckbox; one row per person and version, never updated or deleted
-- by the artist, so it stays as the record of their consent.
-- A separate table instead of columns on profiles: published profiles are
-- publicly readable, and this history is nobody else's business.
create table if not exists public.terms_acceptances (
  id bigint generated always as identity primary key,
  profile_id uuid not null references auth.users (id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  unique (profile_id, terms_version)
);

alter table public.terms_acceptances enable row level security;

create policy "terms_acceptances: users insert own"
  on public.terms_acceptances for insert
  with check (auth.uid() = profile_id);

create policy "terms_acceptances: users read own"
  on public.terms_acceptances for select
  using (auth.uid() = profile_id);

create policy "terms_acceptances: admin read all"
  on public.terms_acceptances for select
  using (public.is_admin());

-- accepted_at is always the server's clock, whatever the client sends.
create or replace function public.terms_acceptances_set_time()
returns trigger
language plpgsql
as $$
begin
  new.accepted_at := now();
  return new;
end;
$$;

create trigger terms_acceptances_set_time
  before insert on public.terms_acceptances
  for each row
  execute function public.terms_acceptances_set_time();
