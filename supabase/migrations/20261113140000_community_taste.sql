-- Taste per visitor (docs/red-social.md §11 ter): sums the tags of what one
-- person liked, commented, saved or looked at, more weight to recent things,
-- and returns the ten strongest normalized to 0..1. No AI and no per-visit
-- work: reads stay on the service role, like the rest of Comunidad.
--
-- `artworks.tags` is a closed vocabulary (lib/community-tags.ts), so tags can
-- be added, compared and translated later without asking the database to
-- validate them here. Artworks with no tags simply contribute nothing.

-- Likes remember the account that made them. Email stays for contact and for
-- likes cast from the 3D gallery before signing in (legacy rows keep email
-- only, which is exactly why the column allows null).
alter table public.artwork_likes
  add column if not exists user_id uuid references auth.users (id) on delete set null;

update public.artwork_likes l
  set user_id = u.id
  from auth.users u
  where l.user_id is null and lower(u.email) = l.email;

create index if not exists artwork_likes_user_idx
  on public.artwork_likes (user_id, created_at)
  where user_id is not null;

comment on column public.artwork_likes.user_id is
  'Account that liked the obra. New likes always set it; email remains for contact.';

-- The "No personalizar mis sugerencias" switch in "Editar mis datos".
alter table public.profiles
  add column if not exists personalize boolean not null default true;

comment on column public.profiles.personalize is
  'When false, community_taste() returns nothing for this visitor.';

-- Empty when the visitor is unknown, when they opted out, or when they have
-- fewer than five interactions to read a taste from. Interaction rows (a like,
-- an approved comment, a saved stamp, one attention mode on one obra) are
-- counted before the artwork tags expand, so one obra with three tags still
-- counts as one interaction.
create or replace function public.community_taste(visitor uuid)
returns table (tag text, weight double precision)
language sql
stable
security definer
set search_path = ''
as $$
  with signals as (
    select l.artwork_id, 3.0::double precision as base, l.created_at as happened_at
      from public.artwork_likes l
      where l.user_id = visitor
    union all
    -- Only approved comments; pending and rejected are moderation noise.
    select c.artwork_id, 4.0::double precision, c.created_at
      from public.artwork_comments c
      where c.user_id = visitor and c.status = 'approved'
    union all
    select s.artwork_id, 5.0::double precision, s.collected_at
      from public.artwork_stamp_collections s
      where s.user_id = visitor
    union all
    -- One signal per obra and mode, not per session: the same obra seen in ten
    -- visits is still one thing that person looked at. Time is summed across
    -- sessions and capped at 60 seconds before it is weighted.
    select g.artwork_id,
           (1.0 * least(least(sum(g.milliseconds), 60000) / 30000.0, 1.0))::double precision,
           max(g.updated_at)
      from public.gallery_attention g
      join public.gallery_attention_sessions gs on gs.id = g.session_id
      where gs.user_id = visitor and g.mode = 'view'
      group by g.artwork_id
    union all
    -- Opening the details sheet says more than just looking.
    select g.artwork_id,
           (1.5 * least(least(sum(g.milliseconds), 60000) / 30000.0, 1.0))::double precision,
           max(g.updated_at)
      from public.gallery_attention g
      join public.gallery_attention_sessions gs on gs.id = g.session_id
      where gs.user_id = visitor and g.mode = 'details'
      group by g.artwork_id
  ),
  interaction_count as (
    select count(*)::integer as total from signals
  ),
  scored as (
    -- 90-day half-life: an old interaction is worth half as much as today's.
    select s.artwork_id,
           s.base * power(
             0.5::double precision,
             (extract(epoch from (now() - s.happened_at)) / (90 * 86400.0))::double precision
           ) as w
      from signals s
  ),
  per_tag as (
    select t.tag, sum(sc.w) as w
      from scored sc
      join public.artworks a on a.id = sc.artwork_id
      cross join lateral unnest(a.tags) as t(tag)
      where btrim(t.tag) <> ''
      group by t.tag
  )
  select pt.tag, (pt.w / max(pt.w) over ())::double precision
    from per_tag pt
    cross join interaction_count ic
    where visitor is not null
      and ic.total >= 5
      and coalesce((select p.personalize from public.profiles p where p.id = visitor), true)
    order by 2 desc, 1 asc
    limit 10
$$;

revoke all on function public.community_taste(uuid) from public, anon, authenticated;
grant execute on function public.community_taste(uuid) to service_role;

-- New likes carry the account, which is what community_taste() reads. The
-- email stays for contact and for the notification/relink rules. Replaces the
-- two-argument version from 20260922130000_artwork_likes.sql.
create or replace function public.like_gallery_artwork(
  artwork_slug text,
  voter_email text,
  voter_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_id uuid;
begin
  if voter_email is null or voter_email <> lower(btrim(voter_email))
     or length(voter_email) > 254 or voter_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' then
    raise exception 'Invalid email';
  end if;
  select a.id into target_id from public.artworks a
    join public.profiles p on p.id = a.profile_id
    where a.slug = artwork_slug and a.is_selected and p.is_public;
  if target_id is null then raise exception 'Artwork unavailable'; end if;
  insert into public.contacts(email, source)
    values (voter_email, 'galeria-3d') on conflict (email) do nothing;
  insert into public.artwork_likes(artwork_id, email, user_id)
    values (target_id, voter_email, voter_id)
    on conflict (artwork_id, email) do update
      set user_id = coalesce(excluded.user_id, public.artwork_likes.user_id);
end;
$$;

drop function if exists public.like_gallery_artwork(text, text);
revoke all on function public.like_gallery_artwork(text, text, uuid) from public, anon, authenticated;
grant execute on function public.like_gallery_artwork(text, text, uuid) to service_role;

notify pgrst, 'reload schema';
