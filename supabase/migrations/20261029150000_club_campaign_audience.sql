-- A campaign audience for the Club launch: artists who have taken part but
-- have no Club gallery yet. The campaign tool works the list out from the
-- subscribed contacts, the participants (participant_emails) and, new here,
-- the people who already have a Club gallery (club_member_emails). Whoever has
-- one is left out whatever its status: an active member needs no invitation
-- and a lapsed one already knows the Club.
alter table public.campaigns drop constraint if exists campaigns_audience_check;
alter table public.campaigns add constraint campaigns_audience_check
  check (audience in ('subscribed', 'no_artwork', 'profile_review', 'not_participating', 'multiple_artworks', 'club_prospects'));

create or replace function public.club_member_emails()
returns table (email text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select lower(trim(u.email))
  from auth.users u
  join public.club_galleries g on g.user_id = u.id
  where u.email is not null
    and (public.is_admin() or auth.role() = 'service_role')
$$;

revoke all on function public.club_member_emails() from public, anon;
grant execute on function public.club_member_emails() to authenticated, service_role;

notify pgrst, 'reload schema';
