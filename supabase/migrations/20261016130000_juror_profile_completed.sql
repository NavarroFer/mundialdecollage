-- When the juror confirmed their own profile on /jurado (null: not yet).
-- Until then /jurado opens on the profile form, prefilled with what the
-- admin entered, before the obras to score.
alter table public.jurors
  add column if not exists profile_completed_at timestamptz;

notify pgrst, 'reload schema';
