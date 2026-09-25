-- The 3D gallery's daily exhibition, remembered: which obras hung on which
-- day. Replaces the stateless daily shuffle (lib/gallery-artworks.ts keeps it
-- only as a fallback) so no obra repeats until every published one has had
-- its day — 20 walls × 30 days = 600 before the final. It is also the list
-- the 09:00 mail ("hoy tu obra está en el museo") goes out to.
create table if not exists public.exhibition_days (
  day date not null,
  -- 0-based wall index into data/artworks.ts's gallerySlots.
  slot smallint not null,
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  -- Mail state (app/api/cron/exhibition): null until the cron handles the
  -- row, then 'sending' → 'sent' | 'failed' | 'skipped' (with the reason).
  notify_status text check (notify_status in ('sending', 'sent', 'failed', 'skipped')),
  notify_error text,
  notified_at timestamptz,
  resend_email_id text,
  created_at timestamptz not null default now(),
  primary key (day, slot),
  unique (day, artwork_id)
);

create index if not exists exhibition_days_artwork_idx on public.exhibition_days (artwork_id, day);

alter table public.exhibition_days enable row level security;

-- Only artwork ids and dates — the obras themselves stay behind artworks'
-- own RLS, so an unpublished one still drops out of the public gallery.
create policy "exhibition_days: public read"
  on public.exhibition_days for select using (true);

create policy "exhibition_days: admin all"
  on public.exhibition_days for all
  using (public.is_admin()) with check (public.is_admin());

grant select on public.exhibition_days to anon, authenticated;
grant select, insert, update, delete on public.exhibition_days to service_role;

-- The exhibition day starts at 09:00 Argentina (UTC-3, no DST) = 12:00 UTC.
-- Keep in sync with ROTATION_OFFSET_MS in lib/gallery-artworks.ts.
create or replace function public.exhibition_day()
returns date
language sql
stable
as $$
  select ((now() at time zone 'utc') - interval '12 hours')::date
$$;

-- Today's lineup, created on first call of the day (by the 09:00 cron, or
-- by the first visitor if the cron is late). No arguments on purpose: it's
-- callable by anon, so a caller can't pick the day or the size.
--
-- Picks the 20 obras that went longest without a day — never-shown ones
-- first, oldest submissions first among those (random within the same
-- submission day), so each new obra waits its turn instead of being skipped
-- forever. Once every obra has hung, the least recently shown come back.
create or replace function public.ensure_exhibition_today()
returns table (slot smallint, artwork_id uuid)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  today date := public.exhibition_day();
  -- Keep in sync with gallerySlots.length in data/artworks.ts.
  wall_count constant int := 20;
begin
  if not exists (select 1 from public.exhibition_days e where e.day = today) then
    -- Two first visitors at 09:00 must not both build a lineup.
    perform pg_advisory_xact_lock(hashtext('public.exhibition_days'));
    if not exists (select 1 from public.exhibition_days e where e.day = today) then
      insert into public.exhibition_days (day, slot, artwork_id)
      select today, (row_number() over (order by random()) - 1)::smallint, picked.id
      from (
        select a.id
        from public.artworks a
        join public.profiles p on p.id = a.profile_id
        left join lateral (
          select max(e.day) as last_day from public.exhibition_days e where e.artwork_id = a.id
        ) shown on true
        where a.is_selected and p.is_public
        order by shown.last_day asc nulls first, (a.created_at at time zone 'utc')::date asc, random()
        limit wall_count
      ) picked;
    end if;
  end if;

  return query
    select e.slot, e.artwork_id from public.exhibition_days e where e.day = today order by e.slot;
end;
$$;

revoke all on function public.ensure_exhibition_today() from public;
grant execute on function public.ensure_exhibition_today() to anon, authenticated, service_role;

-- Today's rows the mail cron hasn't handled yet, with everything the mail
-- needs. The artist's address comes from their login (auth.users), matched
-- to `contacts` so unsubscribes are respected and the footer link works.
create or replace function public.exhibition_mail_queue()
returns table (
  day date,
  slot smallint,
  artwork_id uuid,
  artwork_title text,
  artwork_slug text,
  artist_name text,
  country_code text,
  email text,
  contact_id uuid,
  subscribed boolean,
  sent_before boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    e.day,
    e.slot,
    e.artwork_id,
    a.title,
    a.slug,
    p.name,
    p.country_code,
    lower(trim(u.email)),
    c.id,
    c.subscribed,
    exists (
      select 1 from public.exhibition_days prev
      where prev.artwork_id = e.artwork_id and prev.day <> e.day and prev.notify_status = 'sent'
    )
  from public.exhibition_days e
  join public.artworks a on a.id = e.artwork_id
  join public.profiles p on p.id = a.profile_id
  left join auth.users u on u.id = p.id
  left join public.contacts c on c.email = lower(trim(u.email))
  where e.day = public.exhibition_day() and e.notify_status is null
  order by e.slot
$$;

revoke all on function public.exhibition_mail_queue() from public, anon, authenticated;
grant execute on function public.exhibition_mail_queue() to service_role;

-- Templates the app sends on its own (not from /admin/campanas) are found by
-- key; they still show up and stay editable in /admin/plantillas.
alter table public.templates add column if not exists system_key text unique;

notify pgrst, 'reload schema';
