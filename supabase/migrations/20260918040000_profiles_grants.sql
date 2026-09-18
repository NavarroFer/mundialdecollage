-- profiles was created by hand in the SQL editor before the migration
-- workflow existed (see 5yNy1v2's "Repair migration history..."), which
-- skipped the grants Supabase normally applies to new public-schema tables.
-- RLS policies alone don't grant access — Postgres checks table-level
-- privileges first, so every onboarding upsert from a logged-in user has
-- been failing with "permission denied for table profiles" (42501)
-- regardless of what the policies above allow.
grant select, insert, update on public.profiles to authenticated;
