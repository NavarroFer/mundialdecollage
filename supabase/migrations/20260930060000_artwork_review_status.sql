-- Editorial review is separate from public participation and from the
-- per-artist representative artwork (`is_selected`). Every received work
-- begins without a jury decision.
alter table public.artworks
  add column if not exists review_status text not null default 'unreviewed'
  check (review_status in ('unreviewed', 'preselected', 'rejected'));

alter table public.legacy_submissions
  add column if not exists review_status text not null default 'unreviewed'
  check (review_status in ('unreviewed', 'preselected', 'rejected'));
