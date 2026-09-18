-- Same root cause as 20260918040000 (profiles), but project-wide: this
-- project never got the "grant to anon/authenticated/service_role by
-- default" setup that Supabase normally configures for the public schema,
-- so every table created since has had RLS policies with no table-level
-- privileges backing them — e.g. "contacts: admin only" allows an admin to
-- read/write, but without a GRANT that never even gets evaluated, and the
-- request just fails with "permission denied for table contacts" first.
--
-- Grants below match exactly what each table's existing policies allow, so
-- RLS remains the real access boundary.
grant select, insert, update, delete on public.contacts to authenticated;
grant select, insert, update, delete on public.templates to authenticated;
grant select, insert, update, delete on public.campaigns to authenticated;
grant select, insert, update, delete on public.campaign_sends to authenticated;
grant select, insert, update on public.workshop_registrations to authenticated;

-- And going forward: any new table created in public by the migration role
-- should get the standard Supabase grants automatically, so this class of
-- bug can't happen again on the next table.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
