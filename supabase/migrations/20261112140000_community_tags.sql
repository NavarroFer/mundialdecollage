-- Language of comments, tags on obras, and a public "similar" lookup.
-- Reads stay on the service role (docs/red-social.md §11 bis and §11 ter).

alter table public.post_comments
  add column if not exists lang text,
  add column if not exists translations jsonb not null default '{}'::jsonb,
  add column if not exists ai_verdict text,
  add column if not exists ai_reason text;

alter table public.posts
  add column if not exists ai_verdict text,
  add column if not exists ai_reason text;

alter table public.artworks
  add column if not exists tags text[] not null default '{}';

-- Posts that share tags with `match_tags`, most overlap first. `skip` leaves
-- out the post the visitor is already looking at.
create or replace function public.community_similar(
  match_tags text[],
  skip uuid default null,
  page_size integer default 6
)
returns table (
  id uuid, kind text, body text, created_at timestamptz,
  like_count integer, comment_count integer,
  profile_id uuid, author_name text, author_country text, author_thumb text,
  artwork_slug text, artwork_title text, image_url text, image_path text,
  official boolean, pinned boolean, lang text, translations jsonb, image_alt text, tags text[]
)
language sql stable security definer set search_path = '' as $$
  select f.id, f.kind, f.body, f.created_at, f.like_count, f.comment_count,
         f.profile_id, f.author_name, f.author_country, f.author_thumb,
         f.artwork_slug, f.artwork_title, f.image_url, f.image_path,
         f.official, f.pinned, f.lang, f.translations, f.image_alt, f.tags
  from public.community_feed(null, null, null, 50) f
  where (skip is null or f.id <> skip)
    and cardinality(match_tags) > 0
    and f.tags && match_tags
  order by (
    select count(*)::integer from unnest(f.tags) tag where tag = any (match_tags)
  ) desc, f.created_at desc
  limit least(greatest(page_size, 1), 12)
$$;

revoke all on function public.community_similar(text[], uuid, integer) from public, anon, authenticated;
grant execute on function public.community_similar(text[], uuid, integer) to service_role;

notify pgrst, 'reload schema';
