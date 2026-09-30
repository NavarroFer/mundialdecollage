-- The public "obras recibidas" total is intake, not curation. Keep every
-- active Registro row (including multiple works sent by the same artist),
-- then add native onboarding entries that have no Registro row. A native
-- artwork linked to Registro must not be counted twice.
create or replace function public.get_total_submissions_count()
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select (
    (select count(*)
     from public.legacy_submissions
     where archived_at is null)
    +
    (select count(*)
     from public.artworks
     where archived_at is null
       and is_entered = true
       and legacy_submission_id is null)
  )::integer
$$;

revoke all on function public.get_total_submissions_count() from public;
grant execute on function public.get_total_submissions_count() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
