-- `selected` picks which of an artist's (possibly several) candidate obras
-- counts; this adds a second, deliberately separate step for the multi-
-- candidate case: `promoted` is what actually moves a row into the "ya
-- confirmada" gallery on /admin/obras, instead of `selected` alone doing
-- both jobs. The admin asked for the extra click specifically so switching
-- which candidate is selected among several doesn't silently promote
-- whichever one happens to be selected at that moment — promoting is its
-- own explicit action (app/admin/obras/actions.ts's promoteLegacySubmission).
--
-- An artist with only one obra has nothing to decide between, so
-- selectLegacySubmission auto-promotes in that case — no second click.
alter table public.legacy_submissions
  add column if not exists promoted boolean not null default false;

-- Backfill: every row `selected = true` before this migration represents a
-- deliberate admin choice made under the old single-step model, where
-- `selected` alone was the finalization — treat all of them as already
-- promoted rather than making the admin redo curation they already did.
update public.legacy_submissions
set promoted = true
where selected = true;

notify pgrst, 'reload schema';
