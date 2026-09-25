-- The gallery → sign-in → home → sign-up circuit, measured, and the daily
-- mail that tells each artist what happened to their obra.

-- 1. Circuit steps (lib/funnel.ts). One anonymous random id per browser
-- (cookie mdc-vid), plus the account once signed in. Written only by
-- /api/track and server actions with the service role; admins read it on
-- /admin/estadisticas.
create table if not exists public.funnel_events (
  id bigint generated always as identity primary key,
  name text not null check (name ~ '^[a-z_]{3,40}$'),
  visitor_id text not null check (visitor_id ~ '^[a-zA-Z0-9-]{8,64}$'),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists funnel_events_created_idx on public.funnel_events (created_at);
create index if not exists funnel_events_name_idx on public.funnel_events (name, created_at);

alter table public.funnel_events enable row level security;
create policy "funnel_events: admin read" on public.funnel_events for select using (public.is_admin());
revoke all on public.funnel_events from anon;
grant select on public.funnel_events to authenticated;
grant select, insert, delete on public.funnel_events to service_role;

-- How many distinct visitors reached each step since a date. Runs with the
-- caller's rights, so only admins get rows back (RLS above).
create or replace function public.funnel_summary(since timestamptz)
returns table (name text, visitors bigint, events bigint)
language sql
stable
set search_path = public, pg_temp
as $$
  select e.name, count(distinct e.visitor_id), count(*)
  from public.funnel_events e
  where e.created_at >= since
  group by e.name
$$;

revoke all on function public.funnel_summary(timestamptz) from public, anon;
grant execute on function public.funnel_summary(timestamptz) to authenticated, service_role;

-- 2. "Así le fue a tu obra": at most one mail per artist per day
-- (app/api/cron/exhibition). The row is claimed before sending so a second
-- run can't mail twice.
create table if not exists public.artist_digests (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  status text not null check (status in ('sending', 'sent', 'failed', 'skipped')),
  error text,
  resend_email_id text,
  created_at timestamptz not null default now(),
  primary key (profile_id, day)
);

alter table public.artist_digests enable row level security;
create policy "artist_digests: admin read" on public.artist_digests for select using (public.is_admin());
revoke all on public.artist_digests from anon;
grant select on public.artist_digests to authenticated;
grant select, insert, update, delete on public.artist_digests to service_role;

-- Every obra that got likes, or had comments approved, in a time window —
-- with its artist's address (their login, matched to `contacts` so
-- unsubscribes are respected).
create or replace function public.artist_activity_digest(window_start timestamptz, window_end timestamptz)
returns table (
  profile_id uuid,
  artist_name text,
  country_code text,
  email text,
  contact_id uuid,
  subscribed boolean,
  artwork_title text,
  artwork_slug text,
  likes_window bigint,
  likes_total bigint,
  comments jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with activity as (
    select
      a.profile_id,
      a.title,
      a.slug,
      (select count(*) from public.artwork_likes l
        where l.artwork_id = a.id and l.created_at >= window_start and l.created_at < window_end) as likes_window,
      (select count(*) from public.artwork_likes l where l.artwork_id = a.id) as likes_total,
      coalesce((
        select jsonb_agg(jsonb_build_object('author', c.author_name, 'body', c.body) order by c.created_at)
        from public.artwork_comments c
        where c.artwork_id = a.id and c.status = 'approved'
          and c.moderated_at >= window_start and c.moderated_at < window_end
      ), '[]'::jsonb) as comments
    from public.artworks a
    where a.is_selected and a.archived_at is null
  )
  select
    act.profile_id,
    p.name,
    p.country_code,
    lower(trim(u.email)),
    c.id,
    c.subscribed,
    act.title,
    act.slug,
    act.likes_window,
    act.likes_total,
    act.comments
  from activity act
  join public.profiles p on p.id = act.profile_id
  left join auth.users u on u.id = p.id
  left join public.contacts c on c.email = lower(trim(u.email))
  where act.likes_window > 0 or jsonb_array_length(act.comments) > 0
$$;

revoke all on function public.artist_activity_digest(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.artist_activity_digest(timestamptz, timestamptz) to service_role;

notify pgrst, 'reload schema';
