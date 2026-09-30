-- Personal collections are separate from profile_stamps (which are site
-- achievements). Any signed-in visitor can collect an artwork, even when
-- they have not submitted one and therefore have no profiles row yet.
create table public.artwork_stamp_collections (
  user_id uuid not null references auth.users(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  collected_at timestamptz not null default now(),
  primary key (user_id, artwork_id)
);

create index artwork_stamp_collections_window_idx
  on public.artwork_stamp_collections (user_id, collected_at);

alter table public.artwork_stamp_collections enable row level security;

create policy "artwork stamps: owner reads own" on public.artwork_stamp_collections
  for select using (user_id = auth.uid());

revoke all on public.artwork_stamp_collections from anon, authenticated;
grant select on public.artwork_stamp_collections to authenticated;
grant select, insert, update, delete on public.artwork_stamp_collections to service_role;

-- A rolling twelve-hour window makes the rule clear: three new stamps are
-- available again twelve hours after the oldest stamp in the current batch.
-- The advisory lock means simultaneous clicks/tabs cannot take a fourth.
create function public.collect_gallery_artwork_stamp(artwork_slug text)
returns table (status text, remaining integer, resets_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  collector uuid := auth.uid();
  target_id uuid;
  collected_count integer;
  oldest_stamp timestamptz;
begin
  if collector is null then raise exception 'Sign in required'; end if;

  select a.id into target_id from public.artworks a
    join public.profiles p on p.id = a.profile_id
    where a.slug = artwork_slug and a.is_selected and p.is_public;
  if target_id is null then raise exception 'Artwork unavailable'; end if;

  perform pg_advisory_xact_lock(hashtextextended(collector::text, 0));

  select count(*)::integer, min(collected_at) into collected_count, oldest_stamp
    from public.artwork_stamp_collections
    where user_id = collector and collected_at > now() - interval '12 hours';

  if exists (select 1 from public.artwork_stamp_collections where user_id = collector and artwork_id = target_id) then
    return query select 'already_collected', greatest(0, 3 - collected_count), oldest_stamp + interval '12 hours';
    return;
  end if;

  if collected_count >= 3 then
    return query select 'limit_reached', 0, oldest_stamp + interval '12 hours';
    return;
  end if;

  insert into public.artwork_stamp_collections (user_id, artwork_id) values (collector, target_id);
  collected_count := collected_count + 1;
  if oldest_stamp is null then oldest_stamp := now(); end if;
  return query select 'collected', 3 - collected_count, oldest_stamp + interval '12 hours';
end;
$$;

revoke all on function public.collect_gallery_artwork_stamp(text) from public, anon;
grant execute on function public.collect_gallery_artwork_stamp(text) to authenticated;

notify pgrst, 'reload schema';
