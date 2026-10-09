-- The home's counters move on their own while the page is open: «Ya
-- participan N obras de M países» in the hero and «recibimos N obras» in the
-- edition banner. Every write that can change them makes the database send
-- the new totals on the Realtime topic `home-stats` when it commits; Supabase
-- delivers them straight to the open tabs (components/use-live-home-stats.ts)
-- — no Vercel Function runs.

-- `artworks` and `countries`: the obras getFinalists() (lib/finalists.ts)
-- lists and the hero counts — selected, of a published profile (the
-- "artworks: public read of published profiles" policy), with everything
-- rowToFinalist() requires. `received`: get_total_submissions_count(), the
-- edition banner's. Also read by a tab that reconnects, to catch up.
create or replace function public.home_stats()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'artworks', count(*)::integer,
    'countries', count(distinct p.country_code)::integer,
    'received', public.get_total_submissions_count()
  )
  from public.artworks a
  join public.profiles p on p.id = a.profile_id
  where a.is_selected
    and p.is_public
    and coalesce(a.slug, '') <> ''
    and coalesce(a.image_url, '') <> ''
    and coalesce(p.name, '') <> ''
    and coalesce(p.country_code, '') <> ''
$$;

-- The last totals sent, so a write that leaves them as they were (a profile
-- saved unchanged, an obra the count doesn't include) reaches no tab.
create table if not exists public.home_stats_sent (
  id boolean primary key default true check (id),
  stats jsonb not null,
  sent_at timestamptz not null default now()
);

alter table public.home_stats_sent enable row level security;
revoke all on public.home_stats_sent from anon, authenticated;

insert into public.home_stats_sent (stats) values (public.home_stats())
on conflict (id) do nothing;

-- Runs at commit (the triggers below are deferred), once per transaction:
-- the Registro sync's hundreds of writes send one message, and the row lock
-- below is held only while the transaction finishes, never while it works.
create or replace function public.broadcast_home_stats()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  next_stats jsonb;
begin
  if current_setting('home_stats.done', true) = 'on' then
    return null;
  end if;
  perform set_config('home_stats.done', 'on', true);
  begin
    -- Locked before counting: of two transactions committing at once, the
    -- second waits here and then counts the first one's obra too.
    perform 1 from public.home_stats_sent where id for update;
    next_stats := public.home_stats();
    update public.home_stats_sent set stats = next_stats, sent_at = now()
    where id and stats is distinct from next_stats;
    if found then
      -- Private topic (last argument): see the policy below. Delivered once
      -- this transaction commits.
      perform realtime.send(next_stats, 'stats', 'home-stats', true);
    end if;
  exception when others then
    -- A live counter must never undo the obra it counts.
    raise warning 'home stats: % failed: %', tg_name, sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists artworks_broadcast_home_stats on public.artworks;
create constraint trigger artworks_broadcast_home_stats
  after insert or update of is_selected, profile_id, slug, image_url, archived_at, is_entered, legacy_submission_id or delete
  on public.artworks
  deferrable initially deferred
  for each row execute function public.broadcast_home_stats();

drop trigger if exists profiles_broadcast_home_stats on public.profiles;
create constraint trigger profiles_broadcast_home_stats
  after update of is_public, name, country_code or delete on public.profiles
  deferrable initially deferred
  for each row execute function public.broadcast_home_stats();

drop trigger if exists legacy_submissions_broadcast_home_stats on public.legacy_submissions;
create constraint trigger legacy_submissions_broadcast_home_stats
  after insert or update of archived_at or delete on public.legacy_submissions
  deferrable initially deferred
  for each row execute function public.broadcast_home_stats();

-- A private topic, because on a public one any visitor could send too and
-- put made-up totals on every open home. Everyone may listen (no session
-- needed); with no insert policy for it, only the database sends.
drop policy if exists "home-stats: anyone listens" on realtime.messages;
create policy "home-stats: anyone listens" on realtime.messages
  for select to anon, authenticated
  using ((select realtime.topic()) = 'home-stats' and extension = 'broadcast');

revoke all on function public.home_stats() from public, anon, authenticated;
grant execute on function public.home_stats() to anon, authenticated, service_role;
revoke all on function public.broadcast_home_stats() from public, anon, authenticated;

notify pgrst, 'reload schema';
