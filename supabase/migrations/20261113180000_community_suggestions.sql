-- Suggestions by tag (docs/red-social-explorar.md §7): obras similar to one obra,
-- and artists a visitor may like. Both read the closed tag vocabulary, never
-- call AI, and stay on the service role like the rest of Comunidad.

-- Published obras that share tags with `match_tags`, most overlap first. Same
-- for everyone, so the CDN keeps the answer (app/api/comunidad/parecidas).
create or replace function public.obra_similar(
  match_tags text[],
  skip_slug text default null,
  page_size integer default 6
)
returns table (slug text, title text, image_url text, author_name text, author_country text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.slug, a.title, a.image_url, p.name, p.country_code
  from public.artworks a
  join public.profiles p on p.id = a.profile_id
  where a.is_selected
    and a.archived_at is null
    and a.duplicate_of is null
    and not a.is_club_only
    and p.is_public
    and a.image_url is not null
    and a.slug is not null
    and (skip_slug is null or a.slug <> skip_slug)
    and cardinality(match_tags) > 0
    and a.tags && match_tags
  order by (
    select count(*)::integer from unnest(a.tags) tag where tag = any (match_tags)
  ) desc, a.last_activity_at desc, a.id desc
  limit least(greatest(page_size, 1), 12)
$$;

revoke all on function public.obra_similar(text[], text, integer) from public, anon, authenticated;
grant execute on function public.obra_similar(text[], text, integer) to service_role;

-- One suggestion per artist: their obra that best matches the visitor's taste.
-- Leaves out the visitor, and artists whose obras the visitor already liked or
-- commented on. Empty without a taste (fewer than five interactions or
-- profiles.personalize = false), so the mail and the page both fall back to
-- what they show today. Returns the profile id only to build the public
-- /artistas link; never an email.
create or replace function public.community_suggested_artists(visitor uuid, page_size integer default 6)
returns table (
  profile_id uuid,
  artist_name text,
  country_code text,
  obra_slug text,
  obra_title text,
  image_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  with taste as (
    select t.tag, t.weight from public.community_taste(visitor) t
  ),
  answered as (
    select a.profile_id
      from public.artwork_likes l
      join public.artworks a on a.id = l.artwork_id
      where l.user_id = visitor
    union
    select a.profile_id
      from public.artwork_comments c
      join public.artworks a on a.id = c.artwork_id
      where c.user_id = visitor and c.status = 'approved'
  ),
  scored as (
    select a.profile_id, a.slug, a.title, a.image_url, a.last_activity_at,
           (select coalesce(sum(t.weight), 0) from taste t where t.tag = any (a.tags)) as score
      from public.artworks a
      join public.profiles p on p.id = a.profile_id
      where visitor is not null
        and a.is_selected
        and a.archived_at is null
        and a.duplicate_of is null
        and not a.is_club_only
        and p.is_public
        and a.image_url is not null
        and a.slug is not null
        and a.profile_id <> visitor
        and a.profile_id not in (select answered.profile_id from answered)
  ),
  best as (
    select distinct on (s.profile_id) s.*
      from scored s
      where s.score > 0
      order by s.profile_id, s.score desc, s.last_activity_at desc
  )
  select b.profile_id, p.name, p.country_code, b.slug, b.title, b.image_url
    from best b
    join public.profiles p on p.id = b.profile_id
    order by b.score desc, b.last_activity_at desc, b.profile_id
    limit least(greatest(page_size, 1), 6)
$$;

revoke all on function public.community_suggested_artists(uuid, integer) from public, anon, authenticated;
grant execute on function public.community_suggested_artists(uuid, integer) to service_role;

notify pgrst, 'reload schema';
