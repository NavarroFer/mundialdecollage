-- Notices for visitors and artists in the bell (20261005120000_notifications.sql),
-- rendered in each reader's language (lib/notifications/registry.ts):
--   - a comment approved, a collective collage photo approved or rejected;
--   - likes and comments on one's obra, grouped per day;
--   - one's obra hanging in today's 3D gallery;
--   - someone joining through one's link.

-- Likes and approved comments on an obra, grouped per Argentine day into one
-- notice for its artist ("«X» sumó 3 me gusta y 1 comentario"). Nothing when
-- the artist is the one liking or commenting.
create or replace function public.bump_artwork_activity(artwork uuid, field text, actor uuid, actor_email text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid;
  owner_email text;
  artwork_title text;
  artwork_slug text;
  day text := to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD');
begin
  if field not in ('likes', 'comments') then
    raise exception 'bump_artwork_activity: unknown field %', field;
  end if;

  select a.profile_id, lower(u.email), a.title, a.slug
    into owner_id, owner_email, artwork_title, artwork_slug
    from public.artworks a
    join auth.users u on u.id = a.profile_id
    where a.id = artwork;
  if owner_id is null or owner_id = actor or owner_email = lower(actor_email) then
    return;
  end if;

  insert into public.notifications as n (user_id, type, dedupe_key, data)
  values (
    owner_id,
    'artwork_activity',
    'artwork_activity:' || artwork || ':' || day,
    jsonb_build_object('artworkId', artwork, 'title', artwork_title, 'slug', artwork_slug, 'day', day, 'likes', 0, 'comments', 0)
      || jsonb_build_object(field, 1)
  )
  on conflict (user_id, dedupe_key) do update
    set data = n.data || jsonb_build_object(
          'title', artwork_title,
          'slug', artwork_slug,
          field, coalesce((n.data ->> field)::integer, 0) + 1
        ),
        read_at = null,
        updated_at = now();
end;
$$;

-- A comment approved from /admin/comentarios: its author hears about it, and
-- it counts toward the obra's activity for the artist.
create or replace function public.on_comment_moderated()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  artwork_title text;
  artwork_slug text;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    select a.title, a.slug into artwork_title, artwork_slug from public.artworks a where a.id = new.artwork_id;
    perform public.notify_user(
      new.user_id,
      'comment_approved',
      jsonb_build_object('commentId', new.id, 'title', artwork_title, 'slug', artwork_slug),
      'comment:' || new.id
    );
    perform public.bump_artwork_activity(new.artwork_id, 'comments', new.user_id, new.author_email);
  end if;
  return null;
exception when others then
  -- A notice must never undo what it reports (a payment, a like…).
  raise warning 'notifications: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists artwork_comments_notify on public.artwork_comments;
create trigger artwork_comments_notify
  after update of status on public.artwork_comments
  for each row execute function public.on_comment_moderated();

-- A photo for the collective collage approved or rejected from /admin/muro.
-- Admins' own photos go up approved on insert and notify nobody.
create or replace function public.on_wall_piece_moderated()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform public.notify_user(
      new.user_id,
      case new.status when 'approved' then 'wall_approved' else 'wall_rejected' end,
      jsonb_build_object('pieceId', new.id, 'weekStart', new.week_start),
      'wall:' || new.id
    );
  end if;
  return null;
exception when others then
  -- A notice must never undo what it reports (a payment, a like…).
  raise warning 'notifications: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists wall_pieces_notify on public.wall_pieces;
create trigger wall_pieces_notify
  after update of status on public.wall_pieces
  for each row execute function public.on_wall_piece_moderated();

-- A like from the 3D gallery (like_gallery_artwork).
create or replace function public.on_artwork_liked()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.bump_artwork_activity(new.artwork_id, 'likes', null, new.email);
  return null;
exception when others then
  -- A notice must never undo what it reports (a payment, a like…).
  raise warning 'notifications: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists artwork_likes_notify on public.artwork_likes;
create trigger artwork_likes_notify
  after insert on public.artwork_likes
  for each row execute function public.on_artwork_liked();

-- Someone sent their first obra through an artist's link (recordReferral).
create or replace function public.on_referral()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  referred_name text;
  referred_slug text;
begin
  select p.name into referred_name from public.profiles p where p.id = new.referred_id;
  select a.slug into referred_slug from public.artworks a
    where a.profile_id = new.referred_id
    order by a.is_selected desc, a.created_at
    limit 1;
  perform public.notify_user(
    new.referrer_id,
    'referral_joined',
    jsonb_build_object('name', referred_name, 'slug', referred_slug),
    'referral:' || new.referred_id
  );
  return null;
exception when others then
  -- A notice must never undo what it reports (a payment, a like…).
  raise warning 'notifications: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists referrals_notify on public.referrals;
create trigger referrals_notify
  after insert on public.referrals
  for each row execute function public.on_referral();

-- Today's lineup in the 3D gallery (ensure_exhibition_today), same moment as
-- the 09:00 mail.
create or replace function public.on_exhibition_day()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid;
  artwork_title text;
  artwork_slug text;
begin
  select a.profile_id, a.title, a.slug into owner_id, artwork_title, artwork_slug
    from public.artworks a where a.id = new.artwork_id;
  if owner_id is not null then
    perform public.notify_user(
      owner_id,
      'artwork_exhibited',
      jsonb_build_object('artworkId', new.artwork_id, 'title', artwork_title, 'slug', artwork_slug, 'day', new.day),
      'exhibited:' || new.artwork_id || ':' || new.day
    );
  end if;
  return null;
exception when others then
  -- A notice must never undo what it reports (a payment, a like…).
  raise warning 'notifications: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists exhibition_days_notify on public.exhibition_days;
create trigger exhibition_days_notify
  after insert on public.exhibition_days
  for each row execute function public.on_exhibition_day();

revoke all on function public.bump_artwork_activity(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.on_comment_moderated() from public, anon, authenticated;
revoke all on function public.on_wall_piece_moderated() from public, anon, authenticated;
revoke all on function public.on_artwork_liked() from public, anon, authenticated;
revoke all on function public.on_referral() from public, anon, authenticated;
revoke all on function public.on_exhibition_day() from public, anon, authenticated;

notify pgrst, 'reload schema';
