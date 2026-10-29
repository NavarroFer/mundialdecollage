-- Club del Mundial: where each member's «house» sits on the map. The member
-- clicks the map in the editor, never types an address, and only a position
-- rounded to a tenth of a degree (about 11 km) is ever stored. The column
-- type does the rounding, so not even the owner can keep a precise point.

alter table public.club_galleries
  add column home_lat numeric(4, 1) check (home_lat between -90 and 90),
  add column home_lng numeric(4, 1) check (home_lng between -180 and 180),
  add constraint club_galleries_home_complete check ((home_lat is null) = (home_lng is null));

grant update (home_lat, home_lng) on public.club_galleries to authenticated;

-- Every active gallery that has a house, for the public map: who the artist
-- is and how many obras hang there. Runs with its owner's rights because a
-- gallery's owner is an auth user, which visitors cannot join to profiles.
create function public.club_map_houses()
returns table (slug text, title text, artist_name text, country_code text, home_lat numeric, home_lng numeric, obras integer)
language sql stable security definer set search_path = public
as $$
  select g.slug, g.title, coalesce(nullif(btrim(p.name), ''), g.title), p.country_code, g.home_lat, g.home_lng,
    (select count(*)::integer from public.club_gallery_hangings h where h.gallery_id = g.id)
  from public.club_galleries g
  left join public.profiles p on p.id = g.user_id
  where g.status = 'active' and g.home_lat is not null
  order by g.created_at
$$;

revoke all on function public.club_map_houses() from public;
grant execute on function public.club_map_houses() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
