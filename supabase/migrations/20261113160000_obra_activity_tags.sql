-- The participant feed now sends each obra's tags, so «Para vos» can rank the
-- pages the browser already has (docs/red-social-explorar.md). The return type
-- changes, so the function is dropped and recreated instead of replaced.

drop function if exists public.obra_activity_feed(timestamptz, uuid, integer);

create function public.obra_activity_feed(
  before_at timestamptz default null,
  before_id uuid default null,
  page_size integer default 10
)
returns table (
  id uuid,
  slug text,
  title text,
  image_url text,
  author_name text,
  author_country text,
  like_count integer,
  comment_count integer,
  last_activity_at timestamptz,
  recent jsonb,
  tags text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.slug, a.title, a.image_url,
         p.name, p.country_code,
         (select count(*)::integer from public.artwork_likes l where l.artwork_id = a.id),
         (select count(*)::integer from public.artwork_comments c where c.artwork_id = a.id and c.status = 'approved'),
         a.last_activity_at,
         coalesce((
           select jsonb_agg(jsonb_build_object('author', r.author_name, 'body', r.body, 'createdAt', r.created_at) order by r.created_at desc)
           from (
             select author_name, body, created_at
             from public.artwork_comments
             where artwork_id = a.id and status = 'approved'
             order by created_at desc
             limit 2
           ) r
         ), '[]'::jsonb),
         a.tags
  from public.artworks a
  join public.profiles p on p.id = a.profile_id
  where a.is_selected
    and a.archived_at is null
    and a.duplicate_of is null
    and not a.is_club_only
    and p.is_public
    and a.image_url is not null
    and (
      before_at is null
      or a.last_activity_at < before_at
      or (a.last_activity_at = before_at and (before_id is null or a.id < before_id))
    )
  order by a.last_activity_at desc, a.id desc
  limit least(greatest(page_size, 1), 20);
$$;

revoke all on function public.obra_activity_feed(timestamptz, uuid, integer) from public, anon, authenticated;
grant execute on function public.obra_activity_feed(timestamptz, uuid, integer) to service_role;

notify pgrst, 'reload schema';
