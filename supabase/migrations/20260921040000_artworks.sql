-- Phase 1 (additive/expand) of moving from "one artwork per profile" to
-- "many artworks per profile, one of them curated as the selected one" — the
-- same pattern legacy_submissions already uses (see
-- 20260919000000_legacy_submissions.sql's `selected` column), now extended
-- to real registered artists so a resubmission no longer silently overwrites
-- the previous one (app/onboarding/actions.ts used to upsert profiles by
-- id, destroying history).
--
-- This migration is intentionally 100% additive: profiles.artwork_title/
-- artwork_slug/artwork_image_url/technique and the old artwork_slug_taken(
-- candidate, owner) RPC are left in place, untouched. Phase 2 (a later,
-- separate migration, once production is confirmed working against this
-- table) drops them. Two phases because .github/workflows/supabase-
-- migrations.yml applies migrations on push to main in a pipeline separate
-- from Vercel's app deploy, with no ordering guarantee between the two — a
-- destructive drop landing before the updated app code is live would break
-- the site; a purely additive migration can't.
create type public.artwork_technique as enum ('Analógica', 'Mixta', 'Digital');

create table public.artworks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  slug text not null,
  image_url text not null,
  technique public.artwork_technique,
  -- Which artwork represents this artist — separate concern from
  -- profiles.is_public (whether that artwork is shown on the public site at
  -- all). Defaults false: a resubmission (2nd+ row for the same profile_id)
  -- needs an admin to curate it via the "Usar esta obra" action before it
  -- replaces the previously-selected one. The exception (a profile's very
  -- first-ever artwork auto-selecting) is app logic in
  -- app/onboarding/actions.ts, not enforced here — there's nothing to curate
  -- yet when it's the only row.
  is_selected boolean not null default false,
  created_at timestamptz not null default now()
);

-- Global uniqueness, same as the artwork_slug column it replaces — slugs
-- back the public /obras/[slug] route regardless of which profile owns them.
create unique index artworks_slug_key on public.artworks (slug);
create index artworks_profile_id_idx on public.artworks (profile_id);

alter table public.artworks enable row level security;

create policy "artworks: admin only" on public.artworks
  for all using (public.is_admin()) with check (public.is_admin());

-- The submitter can insert their own artwork (app/onboarding/actions.ts,
-- running on their own session) and read all of their own rows regardless of
-- is_selected/is_public (mirrors profiles' "users read own" — an artist can
-- preview any of their own obras, curated or not, via getFinalistBySlug()).
-- Deliberately NO owner update/delete policy: whether a row is is_selected
-- is admin-curated only, same boundary as legacy_submissions.selected — an
-- artist can't flip their own resubmission live by hitting the table
-- directly.
create policy "artworks: owner insert own"
  on public.artworks for insert
  with check (profile_id = auth.uid());

create policy "artworks: owner read own"
  on public.artworks for select
  using (profile_id = auth.uid());

-- Public/anon visibility mirrors "profiles: public read published" — only
-- the curated, selected artwork of a published profile is visible with no
-- session.
create policy "artworks: public read of published profiles"
  on public.artworks for select
  using (
    is_selected
    and exists (
      select 1 from public.profiles p
      where p.id = artworks.profile_id and p.is_public = true
    )
  );

-- Same class of bug this project already got bitten by twice (see
-- 20260921030000_service_role_table_grants.sql) — RLS policies alone don't
-- grant anything; every role this table's queries actually run as needs an
-- explicit table-level GRANT.
grant select, insert on public.artworks to authenticated;
grant select on public.artworks to anon;
grant select, insert, update, delete on public.artworks to service_role;

-- Replaces artwork_slug_taken(candidate, owner): the old signature excluded
-- the caller's own existing row so a resubmission could reuse its slug,
-- which made sense when resubmitting overwrote in place. Now every artwork
-- row (including a 2nd+ submission from the same artist) needs its own
-- distinct slug, so this is a plain global-uniqueness check with no
-- exclusion. Overloads the same function name rather than replacing the old
-- one, consistent with this migration otherwise leaving Phase-2-deprecated
-- things alone.
create or replace function public.artwork_slug_taken(candidate text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.artworks where slug = candidate)
$$;

revoke all on function public.artwork_slug_taken(text) from public;
grant execute on function public.artwork_slug_taken(text) to authenticated;

-- Backfill: one row per already-onboarded profile, carrying over its current
-- single artwork as the selected one. Guards the technique cast instead of
-- casting blind — the onboarding <select> has only ever offered these three
-- values, but a hard migration failure on live data over one stray value
-- would be a bad trade for skipping a cheap check.
insert into public.artworks (profile_id, title, slug, image_url, technique, is_selected, created_at)
select
  id,
  artwork_title,
  artwork_slug,
  artwork_image_url,
  case
    when technique in ('Analógica', 'Mixta', 'Digital') then technique::public.artwork_technique
    else null
  end,
  true,
  coalesce(onboarded_at, created_at)
from public.profiles
where artwork_slug is not null and artwork_title is not null and artwork_image_url is not null;

notify pgrst, 'reload schema';
