-- «Gracias por el aguante» (lib/supporter-welcome.ts): one welcome mail to
-- each «hincha» — someone who signed in to like or comment an artist's obra
-- in the Galería 3D and isn't an artist themselves (mostly the artists'
-- friends and family). Sent once, the day after their first like or comment.
create table if not exists public.supporter_welcomes (
  email text primary key check (email = lower(btrim(email))),
  status text not null check (status in ('sending', 'sent', 'failed', 'skipped')),
  error text,
  resend_email_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.supporter_welcomes enable row level security;
create policy "supporter_welcomes: admin read" on public.supporter_welcomes for select using (public.is_admin());
revoke all on public.supporter_welcomes from anon;
grant select on public.supporter_welcomes to authenticated;
grant select, insert, update, delete on public.supporter_welcomes to service_role;

-- Hinchas due a welcome: their FIRST like or comment ever falls between
-- `since` and `until` (so the cron only greets recent ones, never someone
-- who liked weeks ago), they're a subscribed contact, they don't take part
-- (participant_emails()) and haven't been welcomed. One row each, with the
-- obra of that first interaction and the name they commented with, if any.
create or replace function public.supporter_welcome_queue(since timestamptz, until timestamptz)
returns table (
  email text,
  contact_id uuid,
  supporter_name text,
  artwork_slug text,
  artwork_title text,
  artist_name text,
  artist_country text,
  first_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with interactions as (
    select l.email, l.artwork_id, l.created_at, null::text as author_name
    from public.artwork_likes l
    union all
    select lower(btrim(c.author_email)), c.artwork_id, c.created_at, c.author_name
    from public.artwork_comments c
    where c.author_email is not null
  ),
  firsts as (
    select distinct on (i.email) i.email, i.artwork_id, i.created_at
    from interactions i
    order by i.email, i.created_at
  ),
  names as (
    select distinct on (i.email) i.email, i.author_name
    from interactions i
    where i.author_name is not null
    order by i.email, i.created_at desc
  )
  select f.email, ct.id, coalesce(n.author_name, ct.name), a.slug, a.title, p.name, p.country_code, f.created_at
  from firsts f
  join public.contacts ct on ct.email = f.email and ct.subscribed
  join public.artworks a on a.id = f.artwork_id and a.slug is not null
  join public.profiles p on p.id = a.profile_id
  left join names n on n.email = f.email
  where f.created_at >= since and f.created_at < until
    and not exists (select 1 from public.supporter_welcomes w where w.email = f.email)
    and f.email not in (select pe.email from public.participant_emails() pe where pe.email is not null)
    and auth.role() = 'service_role'
$$;

revoke all on function public.supporter_welcome_queue(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.supporter_welcome_queue(timestamptz, timestamptz) to service_role;

notify pgrst, 'reload schema';
