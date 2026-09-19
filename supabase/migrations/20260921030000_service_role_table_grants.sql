-- Real fix for the "permission denied for table legacy_submissions" error
-- on fetchLegacyImagesBatch/retryLegacyImageFetch (lib/supabase/admin.ts's
-- service-role client). The diagnostic in 20260921020000 (before it was
-- neutralized) printed this table's actual grants:
--
--   service_role:REFERENCES, service_role:TRIGGER, service_role:TRUNCATE
--
-- No SELECT/INSERT/UPDATE/DELETE — service_role was never given the
-- ordinary table-level grants this project's earlier retroactive fixes
-- (20260918040000/50000/60000, 20260921000000) only ever extended to
-- anon/authenticated. BYPASSRLS (service_role's actual superpower) only
-- skips RLS *policies* — it doesn't imply a GRANT, which Postgres still
-- checks first for any role, same as anon or authenticated. This was
-- never exercised before app/api/unsubscribe/route.ts and this feature
-- started using the service-role client, so it's an old, project-wide
-- gap, not something introduced now.
grant select, insert, update, delete on public.legacy_submissions to service_role;
grant select, insert, update, delete on public.contacts to service_role;
grant select, insert, update, delete on public.templates to service_role;
grant select, insert, update, delete on public.campaigns to service_role;
grant select, insert, update, delete on public.campaign_sends to service_role;
grant select, insert, update on public.workshop_registrations to service_role;
grant select, insert, update, delete on public.profiles to service_role;

-- And going forward, matching 20260918050000_authenticated_table_grants.sql's
-- own default-privileges safeguard (which only covered anon/authenticated),
-- so this class of bug can't recur for service_role on the next new table.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

notify pgrst, 'reload schema';
