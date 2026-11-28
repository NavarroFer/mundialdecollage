-- «Artistas con certificado»: the campaign that reminds each participating
-- artist to download their participation certificate, with a link of their
-- own that opens it without signing in ({{certificado_url}}, built in
-- lib/campaign-delivery.ts with lib/certificate-token.ts). Same artists and
-- obra as certificate_recipients() (20261002130000_certificate_sends.sql),
-- but only the subscribed ones: a reminder is a campaign, and an unsubscribe
-- wins. Name and country are required, as for the certificate mail: the
-- certificate can't be drawn without them.

alter table public.campaigns drop constraint if exists campaigns_audience_check;
alter table public.campaigns add constraint campaigns_audience_check
  check (audience in ('subscribed', 'no_artwork', 'profile_review', 'not_participating', 'multiple_artworks', 'club_prospects', 'public_profiles', 'certificates'));

create or replace function public.certificate_campaign_contacts()
returns table (contact_id uuid, profile_id uuid, artist_name text, artwork_slug text, artwork_title text)
language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select distinct on (c.id) c.id, p.id, p.name, a.slug, a.title
  from public.contacts c
  join auth.users u on lower(trim(u.email)) = lower(trim(c.email))
  join public.profiles p on p.id = u.id
  join public.artworks a on a.profile_id = p.id
  where c.subscribed
    and (public.is_admin() or auth.role() = 'service_role')
    and nullif(trim(p.name), '') is not null
    and p.country_code is not null
    and a.is_selected
    and a.archived_at is null
    and a.slug is not null
    and a.image_url is not null
  order by c.id, a.created_at
$$;

revoke all on function public.certificate_campaign_contacts() from public, anon;
grant execute on function public.certificate_campaign_contacts() to authenticated, service_role;

notify pgrst, 'reload schema';
