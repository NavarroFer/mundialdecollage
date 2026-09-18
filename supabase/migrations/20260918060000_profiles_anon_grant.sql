-- Same root cause as 20260918040000/20260918050000: profiles never got the
-- anon grant Supabase normally sets up for the public schema. The "profiles:
-- public read published" policy (is_public = true) already restricts what
-- anon can see, but with no table-level GRANT that policy never even gets
-- evaluated — every anon-key read (createPublicClient, used by /obras,
-- /participantes, the homepage submission count, ...) has been failing with
-- "permission denied for table profiles" and silently returning no rows, so
-- obras an admin approved from /admin/obras never actually showed up anywhere
-- public.
grant select on public.profiles to anon;
