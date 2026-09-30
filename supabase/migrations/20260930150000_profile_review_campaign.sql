-- Personalized campaign audience for artists whose saved participation data
-- still needs confirmation. Only subscribed contacts are ultimately mailed;
-- the application intersects these rows with contacts.subscribed = true.
alter table public.campaigns drop constraint if exists campaigns_audience_check;
alter table public.campaigns add constraint campaigns_audience_check
  check (audience in ('subscribed', 'no_artwork', 'profile_review'));

create or replace function public.profile_review_contacts()
returns table (
  contact_id uuid,
  artist_name text,
  country_code text,
  artwork_title text,
  missing_fields text[]
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    c.id,
    nullif(trim(p.name), ''),
    nullif(trim(p.country_code), ''),
    nullif(trim(a.title), ''),
    array_remove(array[
      case when nullif(trim(p.name), '') is null then 'nombre' end,
      case when nullif(trim(p.country_code), '') is null then 'país' end,
      case when nullif(trim(a.title), '') is null then 'título de la obra' end
    ], null)
  from public.contacts c
  join auth.users u on lower(trim(u.email)) = lower(trim(c.email))
  join public.profiles p on p.id = u.id
  join lateral (
    select artwork.title
    from public.artworks artwork
    where artwork.profile_id = p.id
      and artwork.archived_at is null
      and artwork.duplicate_of is null
    order by artwork.is_selected desc, artwork.created_at desc
    limit 1
  ) a on true
  where (public.is_admin() or auth.role() = 'service_role')
    and (
      p.details_confirmed_at is null
      or nullif(trim(p.name), '') is null
      or nullif(trim(p.country_code), '') is null
      or nullif(trim(a.title), '') is null
    )
$$;

revoke all on function public.profile_review_contacts() from public, anon;
grant execute on function public.profile_review_contacts() to authenticated, service_role;

notify pgrst, 'reload schema';
