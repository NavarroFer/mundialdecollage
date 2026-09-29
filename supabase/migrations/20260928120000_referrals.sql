-- Every link an artist shares carries ?ref=<their obra> (lib/referral.ts).
-- When someone who arrived through one sends their first obra,
-- completeOnboarding records here which artist invited them, so that artist
-- sees on the home how many others they brought to the Mundial.
--
-- A table of its own rather than a profiles column: the inviting artist has
-- to count rows that belong to other people's profiles, which profiles' RLS
-- (rightly) doesn't let them read, and the invited artist must not be able to
-- rewrite who gets the credit through their own profile upsert.
create table if not exists public.referrals (
  -- One credit per artist, the first: later links don't move it.
  referred_id uuid primary key references public.profiles (id) on delete cascade,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  -- The obra whose link did it, as it was then (slugs can change later).
  artwork_slug text,
  created_at timestamptz not null default now(),
  constraint referrals_not_self check (referred_id <> referrer_id)
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

-- Written only by completeOnboarding with the service role. Artists read
-- (count) the rows that credit them; admins read everything.
alter table public.referrals enable row level security;
drop policy if exists "referrals: referrer read own" on public.referrals;
create policy "referrals: referrer read own" on public.referrals for select using (referrer_id = auth.uid());
drop policy if exists "referrals: admin read" on public.referrals;
create policy "referrals: admin read" on public.referrals for select using (public.is_admin());
-- The default privileges (20260918050000) would also hand authenticated
-- insert/update/delete; RLS already blocks those, but nobody needs them.
revoke all on public.referrals from anon, authenticated;
grant select on public.referrals to authenticated;
grant select, insert, update, delete on public.referrals to service_role;

notify pgrst, 'reload schema';
