-- Club del Mundial: the galleries /club shows as examples. An admin picks
-- them in /admin/club; each card shows the artist, their country, how many
-- obras hang there and the first one as its cover.

alter table public.club_galleries
  add column is_sample boolean not null default false;

create function public.club_sample_galleries()
returns table (slug text, title text, artist_name text, country_code text, obras integer, cover_url text)
language sql stable security definer set search_path = public
as $$
  select g.slug, g.title, coalesce(nullif(btrim(p.name), ''), g.title), p.country_code,
    (select count(*)::integer from public.club_gallery_hangings h where h.gallery_id = g.id),
    (select a.image_url from public.club_gallery_hangings h join public.artworks a on a.id = h.artwork_id
      where h.gallery_id = g.id order by h.slot limit 1)
  from public.club_galleries g
  left join public.profiles p on p.id = g.user_id
  where g.status = 'active' and g.is_sample
  order by g.created_at
$$;

create function public.set_club_gallery_sample(p_gallery_id uuid, p_sample boolean)
returns text
language plpgsql security definer set search_path = public
as $$
declare changed_slug text;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  update public.club_galleries set is_sample = p_sample where id = p_gallery_id
    returning slug into changed_slug;
  return changed_slug;
end;
$$;

-- /admin/club also shows which galleries are examples.
drop function public.admin_club_galleries();
create function public.admin_club_galleries()
returns table (
  id uuid, slug text, title text, status text, email text, courtesy_granted_at timestamptz,
  subscription_status text, balance integer, hung integer, created_at timestamptz, is_sample boolean
)
language sql stable security definer set search_path = public
as $$
  select g.id, g.slug, g.title, g.status, u.email, g.courtesy_granted_at, s.status,
    coalesce(w.balance, 0),
    (select count(*)::integer from public.club_gallery_hangings h where h.gallery_id = g.id),
    g.created_at, g.is_sample
  from public.club_galleries g
  join auth.users u on u.id = g.user_id
  left join public.subscriptions s on s.id = g.subscription_id
  left join public.club_wallets w on w.user_id = g.user_id
  where public.is_admin()
  order by g.created_at desc
$$;

revoke all on function public.club_sample_galleries() from public;
revoke all on function public.set_club_gallery_sample(uuid, boolean) from public, anon;
revoke all on function public.admin_club_galleries() from public, anon;
grant execute on function public.club_sample_galleries() to anon, authenticated, service_role;
grant execute on function public.set_club_gallery_sample(uuid, boolean) to authenticated;
grant execute on function public.admin_club_galleries() to authenticated;

notify pgrst, 'reload schema';
