-- app/onboarding/actions.ts's uniqueSlug() checks whether a candidate
-- artwork_slug is already taken with a plain SELECT as the submitting user.
-- Since 20260918000000_profile_visibility.sql, "profiles: public read
-- published" only lets that SELECT see rows where is_public = true — every
-- brand-new submission starts out unpublished, so a slug already claimed by
-- an unpublished profile looked free, the check passed, and the upsert then
-- hit the artwork_slug unique constraint for real, surfacing as a generic
-- "save_failed" with no clue why.
--
-- security definer runs this as the function owner, bypassing RLS, so it
-- sees every row regardless of is_public — same pattern as is_admin().
create or replace function public.artwork_slug_taken(candidate text, owner uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where artwork_slug = candidate and id <> owner
  )
$$;

revoke all on function public.artwork_slug_taken(text, uuid) from public;
grant execute on function public.artwork_slug_taken(text, uuid) to authenticated;
