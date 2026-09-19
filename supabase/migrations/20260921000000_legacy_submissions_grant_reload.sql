-- "permission denied for table legacy_submissions" on /admin/obras's
-- "Importar" button — even though 20260919000000_legacy_submissions.sql
-- already grants these same privileges to authenticated. Grants applied via
-- a direct migration connection (as this project's CI does with
-- `supabase db push`) don't always make PostgREST reload its cached role
-- privileges right away. Re-granting is a harmless no-op either way; the
-- NOTIFY is what actually forces PostgREST to pick it up.
grant select, insert, update, delete on public.legacy_submissions to authenticated;
notify pgrst, 'reload schema';
