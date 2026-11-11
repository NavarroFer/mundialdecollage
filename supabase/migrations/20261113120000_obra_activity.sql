-- The participant feed orders the public obras by the latest like or
-- approved comment. A pending comment does not move an obra: it is not
-- public yet. Visitors never call this function; the route checks the
-- session and then uses the service role.

alter table public.artworks
  add column if not exists last_activity_at timestamptz;

update public.artworks a
set last_activity_at = greatest(
  a.created_at,
  coalesce((select max(l.created_at) from public.artwork_likes l where l.artwork_id = a.id), a.created_at),
  coalesce((select max(c.created_at) from public.artwork_comments c where c.artwork_id = a.id and c.status = 'approved'), a.created_at)
)
where a.last_activity_at is null;

alter table public.artworks
  alter column last_activity_at set default now();

update public.artworks set last_activity_at = created_at where last_activity_at is null;

alter table public.artworks
  alter column last_activity_at set not null;

create index if not exists artworks_activity_idx
  on public.artworks (last_activity_at desc, id desc)
  where is_selected;

create or replace function public.touch_artwork_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if tg_table_name = 'artwork_likes' then
    target := coalesce(new.artwork_id, old.artwork_id);
  elsif tg_table_name = 'artwork_comments' then
    if tg_op = 'INSERT' and new.status = 'approved' then
      target := new.artwork_id;
    elsif tg_op = 'UPDATE' and new.status = 'approved' and old.status is distinct from 'approved' then
      target := new.artwork_id;
    else
      return coalesce(new, old);
    end if;
  else
    return coalesce(new, old);
  end if;
  update public.artworks set last_activity_at = now() where id = target;
  return coalesce(new, old);
end;
$$;

drop trigger if exists artwork_likes_activity on public.artwork_likes;
create trigger artwork_likes_activity
  after insert or delete on public.artwork_likes
  for each row execute function public.touch_artwork_activity();

drop trigger if exists artwork_comments_activity on public.artwork_comments;
create trigger artwork_comments_activity
  after insert or update of status on public.artwork_comments
  for each row execute function public.touch_artwork_activity();

-- Same list for every participant, so the route can describe it once.
-- Access is still checked in app/api/obras/actividad before this runs.
create or replace function public.obra_activity_feed(
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
  recent jsonb
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
         ), '[]'::jsonb)
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
