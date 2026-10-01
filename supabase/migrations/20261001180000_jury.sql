-- Jury MVP (app/jurado, app/admin/jurado). Admins add jurors by email; a
-- juror signs in with Google and scores the preselected obras from 1 to 10,
-- blind (no artist name or country). Scores key an obra as
-- "artwork:<id>" or "legacy:<id>" — the same two sources /admin/obras
-- curates. Everything is read and written server-side with the service role
-- after checking who's asking (lib/jury.ts); admins can also read directly.
create table if not exists public.jurors (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(trim(email))),
  name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.jury_scores (
  juror_id uuid not null references public.jurors (id) on delete cascade,
  item_key text not null check (item_key ~ '^(artwork|legacy):[0-9a-f-]{36}$'),
  score smallint not null check (score between 1 and 10),
  comment text check (char_length(comment) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (juror_id, item_key)
);

alter table public.jurors enable row level security;
alter table public.jury_scores enable row level security;

create policy "jurors: admin read" on public.jurors for select using (public.is_admin());
create policy "jury_scores: admin read" on public.jury_scores for select using (public.is_admin());

revoke all on public.jurors, public.jury_scores from anon;
grant select on public.jurors, public.jury_scores to authenticated;
grant select, insert, update, delete on public.jurors, public.jury_scores to service_role;

notify pgrst, 'reload schema';
