-- Purely diagnostic, no schema change: prints the actual table-level grants
-- Postgres has on record for legacy_submissions into the migration log, so
-- we can see the real state instead of guessing why "permission denied for
-- table legacy_submissions" persisted after 20260921000000 re-granted it.
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

  raise notice 'legacy_submissions grants: %', coalesce(grants, '(none found)');
  raise notice 'legacy_submissions row level security enabled: %', rls_enabled;
end $$;
