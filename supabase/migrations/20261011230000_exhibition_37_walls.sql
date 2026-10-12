-- The gallery's new layout (rooms in a zigzag, free-standing panels) hangs
-- 37 obras instead of 20 (data/artworks.ts HANGINGS), so the day's lineup
-- grows to match. A day already built with fewer — today's, built at 09:00
-- with 20 — is topped up from the same queue, never repeating one of that
-- day's obras. The ones added after the 09:05 cron hang without their "hoy
-- tu obra está en el museo" mail (their notify_status stays null), so they
-- go first in the next day's lineup: they stay up through tomorrow too, and
-- get the mail then. The same goes for any obra that hung on a day the cron
-- missed and never had a mailed day since.
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
  wall_count constant int := 37;
  hung int;
  next_slot int;
begin
  select count(*) into hung from public.exhibition_days e where e.day = today;
  if hung < wall_count then
    -- Two first visitors at 09:00 must not both build (or top up) a lineup.
    perform pg_advisory_xact_lock(hashtext('public.exhibition_days'));
    select count(*), coalesce(max(e.slot) + 1, 0) into hung, next_slot
    from public.exhibition_days e where e.day = today;
    if hung < wall_count then
      insert into public.exhibition_days (day, slot, artwork_id)
      select today, (next_slot + row_number() over (order by random()) - 1)::smallint, picked.id
      from (
        select a.id
        from public.artworks a
        join public.profiles p on p.id = a.profile_id
        left join lateral (
          select max(e.day) as last_day from public.exhibition_days e
          where e.artwork_id = a.id and e.notify_status is not null
        ) shown on true
        left join lateral (
          select true as unmailed from public.exhibition_days w
          where w.artwork_id = a.id and w.day < today and w.notify_status is null
          limit 1
        ) hung_before on true
        where a.is_selected and p.is_public
          and not exists (select 1 from public.exhibition_days t where t.day = today and t.artwork_id = a.id)
        order by
          (coalesce(hung_before.unmailed, false) and shown.last_day is null) desc,
          shown.last_day asc nulls first,
          (a.created_at at time zone 'utc')::date asc,
          random()
        limit wall_count - hung
      ) picked;
    end if;
  end if;

  return query
    select e.slot, e.artwork_id from public.exhibition_days e where e.day = today order by e.slot;
end;
$$;

revoke all on function public.ensure_exhibition_today() from public;
grant execute on function public.ensure_exhibition_today() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
