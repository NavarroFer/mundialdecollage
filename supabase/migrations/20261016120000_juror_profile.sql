-- A juror's profile (lib/juror-profile.ts, edited in /admin/jurado): the
-- country they're from, their position («Curadora del MALBA») and the bio in
-- up to three lengths, so each place that presents the jury can take the one
-- that fits. All nullable: the jurors added before this have none yet. The
-- limits match JUROR_PROFILE_LIMITS (lib/juror-profile.test.ts checks).
alter table public.jurors
  add column if not exists country_code text check (country_code ~ '^[A-Z]{2}$'),
  add column if not exists job_title text check (char_length(job_title) <= 160),
  add column if not exists bio_short text check (char_length(bio_short) <= 280),
  add column if not exists bio_medium text check (char_length(bio_medium) <= 800),
  add column if not exists bio_long text check (char_length(bio_long) <= 3000);

notify pgrst, 'reload schema';
