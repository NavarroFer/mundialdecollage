-- The first stamp a visitor saves from a member's Club gallery is a bonus: it
-- does not count against the museum's three stamps every twelve hours, which
-- gives collectors a reason to go out and walk members' galleries while they
-- wait for the museum's allowance. Later stamps from the same gallery count
-- like any other. A bonus stamp is marked so the window leaves it out.
alter table public.artwork_stamp_collections
  add column if not exists is_bonus boolean not null default false;

create or replace function public.collect_gallery_artwork_stamp(artwork_slug text)
returns table (status text, remaining integer, resets_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  collector uuid := auth.uid();
  target_id uuid;
  club_gallery uuid;
  is_first_from_gallery boolean := false;
  collected_count integer;
  oldest_stamp timestamptz;
begin
  if collector is null then raise exception 'Sign in required'; end if;

  select a.id into target_id from public.artworks a
    where a.slug = artwork_slug and (
      (a.is_selected and exists (select 1 from public.profiles p where p.id = a.profile_id and p.is_public))
      or public.artwork_hangs_in_active_club_gallery(a.id)
    );
  if target_id is null then raise exception 'Artwork unavailable'; end if;

  perform pg_advisory_xact_lock(hashtextextended(collector::text, 0));
  select count(*)::integer, min(collected_at) into collected_count, oldest_stamp
    from public.artwork_stamp_collections
    where user_id = collector and collected_at > now() - interval '12 hours' and not is_bonus;

  if exists (select 1 from public.artwork_stamp_collections where user_id = collector and artwork_id = target_id) then
    return query select 'already_collected', greatest(0, 3 - collected_count), oldest_stamp + interval '12 hours';
    return;
  end if;

  select g.id into club_gallery
    from public.club_gallery_hangings h
    join public.club_galleries g on g.id = h.gallery_id
    where h.artwork_id = target_id and g.status = 'active'
    order by g.created_at limit 1;
  if club_gallery is not null then
    is_first_from_gallery := not exists (
      select 1 from public.artwork_stamp_collections c
      join public.club_gallery_hangings h on h.artwork_id = c.artwork_id
      where c.user_id = collector and h.gallery_id = club_gallery
    );
  end if;

  if not is_first_from_gallery and collected_count >= 3 then
    return query select 'limit_reached', 0, oldest_stamp + interval '12 hours';
    return;
  end if;

  insert into public.artwork_stamp_collections(user_id, artwork_id, is_bonus) values (collector, target_id, is_first_from_gallery);
  perform public.credit_club_activity_coins(collector, 3, 'stamp:' || target_id::text || ':' || collector::text);
  if is_first_from_gallery then
    -- The bonus takes none of the three and starts no clock.
    return query select 'collected', greatest(0, 3 - collected_count), oldest_stamp + interval '12 hours';
    return;
  end if;
  collected_count := collected_count + 1;
  if oldest_stamp is null then oldest_stamp := now(); end if;
  return query select 'collected', 3 - collected_count, oldest_stamp + interval '12 hours';
end;
$$;

revoke all on function public.collect_gallery_artwork_stamp(text) from public, anon;
grant execute on function public.collect_gallery_artwork_stamp(text) to authenticated;

notify pgrst, 'reload schema';
