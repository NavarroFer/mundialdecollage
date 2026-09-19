-- Follow-up to 20260921010000: `supabase db push` doesn't surface RAISE
-- NOTICE output, so that migration applied silently with nothing useful in
-- the log. This deliberately fails instead, with the real grants/RLS state
-- for legacy_submissions baked into the error message — the only channel
-- available to see ground truth instead of continuing to guess why
-- "permission denied for table legacy_submissions" persisted after
-- 20260921000000 re-granted it. Meant to be read once from the failed CI
-- run's log, then removed/replaced by whatever the real fix turns out to be.
do $$
declare
  grants text;
  rls_enabled boolean;
begin
  select string_agg(grantee || ':' || privilege_type, ', ' order by grantee, privilege_type)
    into grants
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'legacy_submissions';

  select relrowsecurity into rls_enabled
    from pg_class
   where relname = 'legacy_submissions' and relnamespace = 'public'::regnamespace;

  raise exception 'DIAGNOSTIC legacy_submissions grants=[%] rls_enabled=[%] current_user=[%]',
    coalesce(grants, '(none found)'), rls_enabled, current_user;
end $$;
