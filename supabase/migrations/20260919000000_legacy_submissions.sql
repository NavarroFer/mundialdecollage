-- Before the real registration flow existed (Google login + /onboarding),
-- ~90 artists already sent in their collage by email — name + a Google Drive
-- photo link, tracked ad hoc in a spreadsheet. This table holds that backlog
-- so when one of those people finally logs in with Google, /onboarding can
-- find their row by email and prefill the form instead of making them start
-- from a blank page (see app/onboarding/page.tsx).
--
-- Several artists sent in more than one artwork under the same email, so
-- `email` is deliberately NOT unique here — every distinct Drive link they
-- sent gets imported as its own row (see app/admin/obras/actions.ts's
-- importLegacySubmissions), and an admin picks which one is "the" submission
-- for that person via `selected`. `drive_url` is unique instead, so
-- re-running the import stays idempotent. /onboarding only ever prefills
-- from a `selected = true` row — until an admin curates a multi-submission
-- artist down to one pick, that person just gets the normal blank form.
--
-- It's a landing pad, not a permanent record: once someone claims their
-- selected row, the `profiles` row (per 20260916000000_profiles.sql/
-- 20260917020000_submission_fields.sql) is the real source of truth for
-- their submission, same as anyone who registered the normal way.
-- `claimed_by`/`claimed_at` just mark a row as spoken for so it stops being
-- offered for prefill and can't be matched twice.
create table if not exists public.legacy_submissions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  drive_url text unique,
  -- Best-effort salvage of the sheet's free-text "País" column, kept only
  -- where it read as a real place name rather than a leaked fragment of
  -- unrelated text (see app/admin/obras/actions.ts's Deliverable 4 import).
  -- Informational only, shown to the admin doing the `selected` curation
  -- below — never auto-fills a profile's country_code, which stays a
  -- self-reported field the artist picks themselves at /onboarding.
  country_raw text,
  selected boolean not null default false,
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.legacy_submissions enable row level security;

-- Reuses is_admin() from 20260917000000_admin_mailing.sql — the /admin/obras
-- bulk-import UI (insert/select/delete, plus the per-row "elegir obra"
-- action that flips `selected`) runs on the admin's own session through
-- this policy, same as the "contacts: admin only" pattern.
create policy "legacy_submissions: admin only" on public.legacy_submissions
  for all using (public.is_admin()) with check (public.is_admin());

-- A logged-in visitor can see their own row while it's unclaimed AND an
-- admin has picked it as their one real submission (selected = true) — an
-- artist who sent multiple candidate obras should never see the ones that
-- weren't chosen, only the curated pick.
create policy "legacy_submissions: read own unclaimed"
  on public.legacy_submissions for select
  using (claimed_by is null and selected = true and email = lower(auth.jwt() ->> 'email'));

-- ...and claim it once, when they actually submit. The check clause pins
-- claimed_by to their own uid, so they can only ever claim their own row,
-- never someone else's or hand a claim off to another account.
create policy "legacy_submissions: claim own unclaimed"
  on public.legacy_submissions for update
  using (claimed_by is null and selected = true and email = lower(auth.jwt() ->> 'email'))
  with check (claimed_by = auth.uid());

-- Same root cause as 20260918050000_authenticated_table_grants.sql/
-- 20260918060000_profiles_anon_grant.sql: an RLS policy with no table-level
-- GRANT behind it never even gets evaluated — the request just fails with
-- "permission denied for table legacy_submissions" first. Matches the
-- contacts grant exactly: admin CRUD (import/select/delete from
-- /admin/obras) and a visitor's own select/claim (from /onboarding) all go
-- through the authenticated role, so it needs the full set.
grant select, insert, update, delete on public.legacy_submissions to authenticated;
