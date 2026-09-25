-- An obra only counts as "already exhibited" once the 09:05 cron handled its
-- day (notify_status set: sent, skipped or failed). The first lineup ever,
-- created by a visitor right after this shipped at night, hung for a few
-- hours and never got its "hoy tu obra está en el museo" mail — without this
-- those 20 obras would have lost their turn until all ~600 had hung. Same
-- for any day the cron doesn't run: its obras get a proper day later.
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
          select max(e.day) as last_day from public.exhibition_days e
          where e.artwork_id = a.id and e.notify_status is not null
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

notify pgrst, 'reload schema';
