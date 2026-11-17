-- Fer (2026-11-17): more stamps in the album so people want to collect them
-- all, and a notice for every one earned. Sixteen in all (lib/stamps.ts keeps
-- the same list; lib/stamps.test.ts checks this constraint against it):
--
--   to walk the site, for anyone signed in
--     gallery    walked the 3D gallery            (the browser, /api/stamps)
--     world      opened a country on the map      (the browser, /api/stamps)
--     like       a first like (an obra or a Comunidad post)
--     fan        10 likes
--     collector  a first obra saved in the album
--     curator    10 obras saved
--     archive    25 obras saved
--     regular    the 3D gallery on 3 different days (attention sessions)
--     comment    a first comment approved (obra or post)
--     wall       a first photo approved on a wall (the collective collage
--                or a Club board)
--   for artists
--     first      sent an obra                     (20260930170000)
--     post       published in Comunidad
--     exhibited  an obra hung in the day's 3D gallery
--     ambassador someone joined through one's link
--     applause   an obra reached 10 likes
--   and
--     legend     the other fifteen
--
-- Every stamp but the two the browser reports is awarded here, by triggers
-- on the tables where things happen, so no code path can forget one and
-- nobody can write one for themselves. A new row in profile_stamps writes
-- the 'stamp_unlocked' notice (lib/notifications/registry.ts) and, with the
-- fifteenth, the legend.

-- ------------------------------------------------------------------ keys
alter table public.profile_stamps drop constraint if exists profile_stamps_stamp_key_check;
alter table public.profile_stamps add constraint profile_stamps_stamp_key_check check (stamp_key in (
  'gallery', 'world', 'like', 'fan', 'collector', 'curator', 'archive', 'regular', 'comment', 'wall',
  'first', 'post', 'exhibited', 'ambassador', 'applause',
  'legend'
));

-- Visitors used to be able to insert any key for themselves; now only the
-- two the browser reports (app/api/stamps). The rest come from triggers.
drop policy if exists "profile_stamps: owner insert own" on public.profile_stamps;
create policy "profile_stamps: owner insert own" on public.profile_stamps
  for insert with check (user_id = auth.uid() and stamp_key in ('gallery', 'world'));

-- ------------------------------------------------------------------ helpers
create or replace function public.award_stamp(recipient uuid, stamp text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if recipient is null or not exists (select 1 from auth.users u where u.id = recipient) then
    return;
  end if;
  insert into public.profile_stamps (user_id, stamp_key) values (recipient, stamp)
    on conflict (user_id, stamp_key) do nothing;
end;
$$;

create or replace function public.has_stamp(recipient uuid, stamp text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profile_stamps s where s.user_id = recipient and s.stamp_key = stamp)
$$;

-- Likes count on obras (3D gallery, obra pages, Club) and on Comunidad posts.
create or replace function public.award_like_stamps(voter uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if voter is null then return; end if;
  perform public.award_stamp(voter, 'like');
  if not public.has_stamp(voter, 'fan')
     and (select count(*) from public.artwork_likes l where l.user_id = voter)
       + (select count(*) from public.post_likes l where l.user_id = voter) >= 10 then
    perform public.award_stamp(voter, 'fan');
  end if;
end;
$$;

-- ------------------------------------------------------------------ triggers
-- A stamp never undoes what earned it (a like, a payment…): every trigger
-- swallows its own errors, like the notification triggers do.

create or replace function public.on_artwork_like_stamps()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  voter uuid := new.user_id;
  owner_id uuid;
begin
  if voter is null then
    select u.id into voter from auth.users u where lower(u.email) = new.email limit 1;
  end if;
  perform public.award_like_stamps(voter);

  select a.profile_id into owner_id from public.artworks a where a.id = new.artwork_id;
  if owner_id is not null and not public.has_stamp(owner_id, 'applause')
     and (select count(*) from public.artwork_likes l where l.artwork_id = new.artwork_id) >= 10 then
    perform public.award_stamp(owner_id, 'applause');
  end if;
  return null;
exception when others then
  raise warning 'stamps: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists artwork_likes_stamps on public.artwork_likes;
create trigger artwork_likes_stamps
  after insert on public.artwork_likes
  for each row execute function public.on_artwork_like_stamps();

create or replace function public.on_post_like_stamps()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.award_like_stamps(new.user_id);
  return null;
exception when others then
  raise warning 'stamps: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists post_likes_stamps on public.post_likes;
create trigger post_likes_stamps
  after insert on public.post_likes
  for each row execute function public.on_post_like_stamps();

create or replace function public.on_artwork_collected_stamps()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  saved integer;
begin
  select count(*)::integer into saved from public.artwork_stamp_collections c where c.user_id = new.user_id;
  perform public.award_stamp(new.user_id, 'collector');
  if saved >= 10 then perform public.award_stamp(new.user_id, 'curator'); end if;
  if saved >= 25 then perform public.award_stamp(new.user_id, 'archive'); end if;
  return null;
exception when others then
  raise warning 'stamps: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists artwork_stamp_collections_stamps on public.artwork_stamp_collections;
create trigger artwork_stamp_collections_stamps
  after insert on public.artwork_stamp_collections
  for each row execute function public.on_artwork_collected_stamps();

-- A visit to the 3D gallery leaves an attention session (record_gallery_attention)
-- once something is looked at; three Argentine days make a regular.
create or replace function public.on_gallery_visit_stamps()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_stamp(new.user_id, 'regular')
     and (select count(distinct (s.created_at at time zone 'America/Argentina/Buenos_Aires')::date)
          from public.gallery_attention_sessions s where s.user_id = new.user_id) >= 3 then
    perform public.award_stamp(new.user_id, 'regular');
  end if;
  return null;
exception when others then
  raise warning 'stamps: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists gallery_attention_sessions_stamps on public.gallery_attention_sessions;
create trigger gallery_attention_sessions_stamps
  after insert on public.gallery_attention_sessions
  for each row execute function public.on_gallery_visit_stamps();

-- Comments on obras and on posts, once approved (by an admin or on arrival).
create or replace function public.on_comment_approved_stamps()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'approved' then
    perform public.award_stamp(new.user_id, 'comment');
  end if;
  return null;
exception when others then
  raise warning 'stamps: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists artwork_comments_stamps on public.artwork_comments;
create trigger artwork_comments_stamps
  after insert or update of status on public.artwork_comments
  for each row execute function public.on_comment_approved_stamps();

drop trigger if exists post_comments_stamps on public.post_comments;
create trigger post_comments_stamps
  after insert or update of status on public.post_comments
  for each row execute function public.on_comment_approved_stamps();

create or replace function public.on_wall_piece_stamps()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'approved' then
    perform public.award_stamp(new.user_id, 'wall');
  end if;
  return null;
exception when others then
  raise warning 'stamps: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists wall_pieces_stamps on public.wall_pieces;
create trigger wall_pieces_stamps
  after insert or update of status on public.wall_pieces
  for each row execute function public.on_wall_piece_stamps();

-- Posts by the admins as «Mundial de Collage» (official) earn nothing.
create or replace function public.on_post_published_stamps()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and not new.official then
    perform public.award_stamp(new.profile_id, 'post');
  end if;
  return null;
exception when others then
  raise warning 'stamps: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists posts_stamps on public.posts;
create trigger posts_stamps
  after insert or update of status on public.posts
  for each row execute function public.on_post_published_stamps();

create or replace function public.on_exhibition_day_stamps()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.award_stamp((select a.profile_id from public.artworks a where a.id = new.artwork_id), 'exhibited');
  return null;
exception when others then
  raise warning 'stamps: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists exhibition_days_stamps on public.exhibition_days;
create trigger exhibition_days_stamps
  after insert on public.exhibition_days
  for each row execute function public.on_exhibition_day_stamps();

create or replace function public.on_referral_stamps()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.award_stamp(new.referrer_id, 'ambassador');
  return null;
exception when others then
  raise warning 'stamps: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists referrals_stamps on public.referrals;
create trigger referrals_stamps
  after insert on public.referrals
  for each row execute function public.on_referral_stamps();

-- ------------------------------------------------------------------ backfill
-- What people already did before these stamps existed counts too. Written
-- before the notice trigger below exists, so nobody gets one notice per old
-- stamp: each person with new ones gets a single 'stamps_backfilled' notice.
create temporary table stamps_backfill (user_id uuid not null, stamp_key text not null);

with liked as (
  select coalesce(l.user_id, u.id) as user_id
  from public.artwork_likes l
  left join auth.users u on l.user_id is null and lower(u.email) = l.email
  union all
  select p.user_id from public.post_likes p
), saved as (
  select c.user_id, count(*) as n from public.artwork_stamp_collections c group by c.user_id
), candidates (user_id, stamp_key) as (
  select distinct user_id, 'like' from liked where user_id is not null
  union select user_id, 'fan' from liked where user_id is not null group by user_id having count(*) >= 10
  union select user_id, 'collector' from saved
  union select user_id, 'curator' from saved where n >= 10
  union select user_id, 'archive' from saved where n >= 25
  union select s.user_id, 'regular' from public.gallery_attention_sessions s
    group by s.user_id having count(distinct (s.created_at at time zone 'America/Argentina/Buenos_Aires')::date) >= 3
  union select c.user_id, 'comment' from public.artwork_comments c where c.status = 'approved'
  union select c.user_id, 'comment' from public.post_comments c where c.status = 'approved'
  union select w.user_id, 'wall' from public.wall_pieces w where w.status = 'approved'
  union select p.profile_id, 'post' from public.posts p where p.status = 'published' and not p.official
  union select a.profile_id, 'exhibited' from public.exhibition_days d join public.artworks a on a.id = d.artwork_id
  union select r.referrer_id, 'ambassador' from public.referrals r
  union select a.profile_id, 'applause' from public.artworks a
    where (select count(*) from public.artwork_likes l where l.artwork_id = a.id) >= 10
), inserted as (
  insert into public.profile_stamps (user_id, stamp_key)
  select c.user_id, c.stamp_key from candidates c
  where exists (select 1 from auth.users u where u.id = c.user_id)
  on conflict (user_id, stamp_key) do nothing
  returning user_id, stamp_key
)
insert into stamps_backfill select user_id, stamp_key from inserted;

with inserted as (
  insert into public.profile_stamps (user_id, stamp_key)
  select s.user_id, 'legend' from public.profile_stamps s
  where s.stamp_key <> 'legend'
  group by s.user_id having count(*) >= 15
  on conflict (user_id, stamp_key) do nothing
  returning user_id, stamp_key
)
insert into stamps_backfill select user_id, stamp_key from inserted;

select public.notify_user(
  b.user_id,
  'stamps_backfilled',
  jsonb_build_object('count', (select count(*)::integer from public.profile_stamps s where s.user_id = b.user_id)),
  'stamps:backfill'
)
from (select distinct user_id from stamps_backfill) b;

drop table stamps_backfill;

-- ------------------------------------------------------------------ notice
-- Every stamp earned from now on, whoever wrote it, reaches the bell with how
-- many the person has; components/stamp-toaster.tsx also shows it on screen at once.
create or replace function public.on_stamp_unlocked()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  owned integer;
begin
  select count(*)::integer into owned from public.profile_stamps s where s.user_id = new.user_id;
  perform public.notify_user(
    new.user_id,
    'stamp_unlocked',
    jsonb_build_object('stamp', new.stamp_key, 'count', owned),
    'stamp:' || new.stamp_key
  );
  if new.stamp_key <> 'legend' and not public.has_stamp(new.user_id, 'legend')
     and (select count(*) from public.profile_stamps s where s.user_id = new.user_id and s.stamp_key <> 'legend') >= 15 then
    perform public.award_stamp(new.user_id, 'legend');
  end if;
  return null;
exception when others then
  raise warning 'stamps: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists profile_stamps_notify on public.profile_stamps;
create trigger profile_stamps_notify
  after insert on public.profile_stamps
  for each row execute function public.on_stamp_unlocked();

revoke all on function public.award_stamp(uuid, text) from public, anon, authenticated;
revoke all on function public.has_stamp(uuid, text) from public, anon, authenticated;
revoke all on function public.award_like_stamps(uuid) from public, anon, authenticated;
revoke all on function public.on_artwork_like_stamps() from public, anon, authenticated;
revoke all on function public.on_post_like_stamps() from public, anon, authenticated;
revoke all on function public.on_artwork_collected_stamps() from public, anon, authenticated;
revoke all on function public.on_gallery_visit_stamps() from public, anon, authenticated;
revoke all on function public.on_comment_approved_stamps() from public, anon, authenticated;
revoke all on function public.on_wall_piece_stamps() from public, anon, authenticated;
revoke all on function public.on_post_published_stamps() from public, anon, authenticated;
revoke all on function public.on_exhibition_day_stamps() from public, anon, authenticated;
revoke all on function public.on_referral_stamps() from public, anon, authenticated;
revoke all on function public.on_stamp_unlocked() from public, anon, authenticated;

notify pgrst, 'reload schema';
