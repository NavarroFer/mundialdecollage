-- The public "N obras recibidas" banner (lib/submissions.ts, shown on the
-- homepage and /edicion-2026) used to count `profiles` rows with
-- onboarded_at set — but profiles is only visible to the anon client where
-- is_public = true (20260918000000_profile_visibility.sql), so that count
-- silently became "obras ya publicadas", not "obras recibidas". Submissions
-- sit unpublished for a while after arriving (an admin curates them from
-- /admin/obras before they go public), and most of the intake before the
-- real registration flow existed lives entirely in legacy_submissions
-- (20260919000000_legacy_submissions.sql), which the banner never counted
-- at all — so the number shown was far below what was actually received.
--
-- The true total is every artwork ever submitted through the real
-- onboarding flow (`artworks`, all rows — not just is_selected, since a
-- resubmission is still a distinct obra someone sent in) plus every legacy
-- backlog row that hasn't been claimed into one of those artworks rows yet
-- (claimed_by is null — once claimed, the same obra already has its own
-- artworks row from app/onboarding/actions.ts, so counting both would
-- double-count it).
--
-- Neither table's RLS lets an anon client read enough rows to compute this
-- itself (artworks: only is_selected obras of published profiles;
-- legacy_submissions: admin, or a visitor's own unclaimed+selected row) —
-- same reasoning as artwork_slug_taken in 20260921040000_artworks.sql, this
-- is security definer and hands back only the aggregate integer, never a
-- row, so it can't be used to read anything the caller couldn't already.
create or replace function public.get_total_submissions_count()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) from public.artworks)::integer
    + (select count(*) from public.legacy_submissions where claimed_by is null)::integer
$$;

revoke all on function public.get_total_submissions_count() from public;
grant execute on function public.get_total_submissions_count() to anon, authenticated;

notify pgrst, 'reload schema';
