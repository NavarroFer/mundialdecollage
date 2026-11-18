-- Publishing the jury (/admin/jurado, «Publicar el jurado»): a switch that
-- shows who judges on the home, in the obra feed and in «El mundial». Off
-- until the organizers turn it on, so the jury can be loaded and its profiles
-- completed ahead of time without anyone seeing them.
-- One row, like call_state; only the service role writes it, after checking
-- for an admin.
create table if not exists public.jury_state (
  id boolean primary key default true check (id),
  published_at timestamptz,
  published_by text,
  updated_at timestamptz not null default now()
);

insert into public.jury_state (id) values (true) on conflict (id) do nothing;

alter table public.jury_state enable row level security;
create policy "jury_state: public read" on public.jury_state for select using (true);
grant select on public.jury_state to anon, authenticated;
grant select, insert, update on public.jury_state to service_role;

-- What a visitor may see of the jury: only while it is published, only the
-- active jurors whose profile has a name, a country and a position, and only
-- the presentation fields (never the email, the long bio or the scores). The
-- jurors table itself stays closed to everyone but admins.
create or replace function public.public_jury()
returns table (id uuid, name text, country_code text, job_title text, photo_path text, bio_short text, bio_medium text)
language sql
stable
security definer
set search_path = public
as $$
  select j.id, j.name, j.country_code, j.job_title, j.photo_path, j.bio_short, j.bio_medium
  from public.jurors j
  where j.active
    and j.name is not null and j.country_code is not null and j.job_title is not null
    and exists (select 1 from public.jury_state s where s.id and s.published_at is not null)
  order by j.created_at, j.id;
$$;

revoke all on function public.public_jury() from public;
grant execute on function public.public_jury() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
