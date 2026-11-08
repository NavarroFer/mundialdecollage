-- «Artistas con perfil público»: the campaign that sends each artist the
-- link to their own /artistas page. A profile is public when an admin
-- published it and it has a selected, non-archived obra — the same rule
-- as the RLS policy "artworks: public read of published profiles".
-- The name comes back so lib/campaign-delivery.ts can build {{perfil_url}}
-- (lib/artist-profiles.ts, artistProfileSlug) the way the site does.

alter table public.campaigns drop constraint if exists campaigns_audience_check;
alter table public.campaigns add constraint campaigns_audience_check
  check (audience in ('subscribed', 'no_artwork', 'profile_review', 'not_participating', 'multiple_artworks', 'club_prospects', 'public_profiles'));

create or replace function public.public_profile_contacts()
returns table (contact_id uuid, profile_id uuid, artist_name text)
language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select distinct on (c.id) c.id, p.id, p.name
  from public.contacts c
  join auth.users u on lower(trim(u.email)) = lower(trim(c.email))
  join public.profiles p on p.id = u.id
  where c.subscribed
    and (public.is_admin() or auth.role() = 'service_role')
    and p.is_public
    and nullif(trim(p.name), '') is not null
    and p.country_code is not null
    and exists (
      select 1 from public.artworks a
      where a.profile_id = p.id and a.is_selected and a.archived_at is null
        and nullif(trim(a.image_url), '') is not null
    )
  order by c.id, p.id
$$;

revoke all on function public.public_profile_contacts() from public, anon;
grant execute on function public.public_profile_contacts() to authenticated, service_role;

notify pgrst, 'reload schema';
