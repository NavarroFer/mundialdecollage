-- The curated Registro is the canonical submission count. Native artwork
-- rows materialize those submissions after registration and must not add to
-- the total a second time.
create or replace function public.get_total_submissions_count()
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::integer
  from public.legacy_submissions
  where archived_at is null
$$;

revoke all on function public.get_total_submissions_count() from public;
grant execute on function public.get_total_submissions_count() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
