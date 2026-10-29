-- Club del Mundial: obras uploaded only for the member's gallery
-- (artworks.is_club_only). They never take part in the contest, and the
-- gallery shows its owner's name and flag even when the profile was never
-- published from /admin/obras (a founder given a courtesy gallery).

-- A Club obra can be neither the artist's contest entry nor their main obra.
alter table public.artworks add constraint artworks_club_only_outside_contest
  check (not (is_club_only and (is_selected or is_entered)));

-- The public gallery reads each obra's author through profiles. Asked of a
-- function that runs with its owner's rights, like
-- artwork_hangs_in_active_club_gallery, so the policy never reads
-- club_galleries under the caller's rules.
create function public.profile_has_active_club_gallery(p_profile_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.club_galleries g where g.user_id = p_profile_id and g.status = 'active')
$$;

revoke all on function public.profile_has_active_club_gallery(uuid) from public;
grant execute on function public.profile_has_active_club_gallery(uuid) to anon, authenticated, service_role;

create policy "profiles: public reads active club members" on public.profiles
  for select using (public.profile_has_active_club_gallery(id));

-- «Varias obras» invites artists to choose which obra takes part: Club obras
-- are not candidates and must not put anyone in that audience.
create or replace function public.multiple_artwork_contacts()
returns table (contact_id uuid, artwork_titles text[])
language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select c.id, works.titles
  from public.contacts c
  left join auth.users u on lower(trim(u.email)) = lower(trim(c.email))
  left join public.profiles p on p.id = u.id
  join lateral (
    select array_agg(w.title order by w.created_at, w.id) as titles, count(*) as total
    from (
      select a.id, nullif(trim(a.title), '') as title, a.created_at
      from public.artworks a
      where a.profile_id = u.id and a.archived_at is null and not a.is_club_only
        and a.duplicate_of is null and nullif(trim(a.image_url), '') is not null
      union all
      select l.id, nullif(trim(l.title), ''), l.created_at
      from public.legacy_submissions l
      where lower(trim(l.email)) = lower(trim(c.email))
        and l.archived_at is null and l.duplicate_of is null
        and nullif(trim(l.image_url), '') is not null
        and not exists (select 1 from public.artworks a where a.legacy_submission_id = l.id)
    ) w
  ) works on works.total > 1
  where c.subscribed and p.entries_chosen_at is null
    and (public.is_admin() or auth.role() = 'service_role')
    and not exists (select 1 from public.entry_purchases e where e.user_id = u.id and e.status = 'paid')
    and (
      (p.is_public and exists (select 1 from public.artworks a where a.profile_id = u.id and a.is_selected and a.archived_at is null and a.duplicate_of is null))
      or exists (select 1 from public.legacy_submissions l where lower(trim(l.email)) = lower(trim(c.email)) and l.promoted and l.archived_at is null and l.duplicate_of is null and nullif(trim(l.image_url), '') is not null)
    )
$$;

notify pgrst, 'reload schema';
