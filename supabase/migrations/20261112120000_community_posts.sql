-- Comunidad (docs/red-social.md): artists post their obra, a 3D-gallery
-- souvenir or a photo of their own; anyone signed in likes and comments.
-- Every read and write for visitors goes through the server with the service
-- role (app/api/comunidad, app/[locale]/(site)/comunidad/actions.ts), so
-- emails and auth ids never reach the browser.

-- ---------------------------------------------------------------- posts
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  -- profiles.id = auth.users.id; only onboarded, public artists post.
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('artwork', 'souvenir', 'photo')),
  artwork_id uuid references public.artworks (id) on delete cascade,
  -- Inside the 'posts' bucket: `${profile_id}/${uuid}.jpg`.
  image_path text unique,
  body text not null default '' check (char_length(body) <= 1000 and body = btrim(body)),
  status text not null default 'published'
    check (status in ('pending', 'published', 'hidden', 'removed')),
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  report_count integer not null default 0 check (report_count >= 0),
  -- Posted by an admin as «Mundial de Collage»: shown without the profile.
  official boolean not null default false,
  -- The week's prompt stays first until then; one at a time.
  pinned_until timestamptz,
  -- Filled after publishing (lib/community-ai.ts): the body's language, its
  -- translations ({ "en": "…", … }) and a description of the image.
  lang text,
  translations jsonb not null default '{}'::jsonb,
  image_alt text,
  -- What it shows, from a fixed vocabulary (lib/community-tags.ts): what the
  -- «Para vos» order and the suggestions match tastes on (§11 ter).
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  moderated_at timestamptz,
  constraint posts_kind_shape check (
    (kind = 'artwork' and artwork_id is not null and image_path is null)
    or (kind <> 'artwork' and artwork_id is null and image_path is not null)
  )
);

create index if not exists posts_feed_idx on public.posts (created_at desc, id desc) where status = 'published';
create index if not exists posts_profile_idx on public.posts (profile_id, created_at desc, id desc);
create index if not exists posts_pending_idx on public.posts (created_at) where status = 'pending';
-- An obra is posted as «Mi obra» once (deleting the post frees it).
create unique index if not exists posts_artwork_once on public.posts (artwork_id)
  where kind = 'artwork' and status <> 'removed';

-- ---------------------------------------------------------------- likes
create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_user_idx on public.post_likes (user_id, post_id);

-- ---------------------------------------------------------------- comments
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  -- Only for moderation context (/admin/comentarios); never shown publicly.
  author_email text,
  body text not null check (char_length(body) between 1 and 500 and body = btrim(body)),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, status, created_at);
create index if not exists post_comments_user_idx on public.post_comments (user_id, created_at);
create index if not exists post_comments_pending_idx on public.post_comments (created_at) where status = 'pending';

-- ---------------------------------------------------------------- reports
create table if not exists public.post_reports (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ---------------------------------------------------------------- access
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_reports enable row level security;

drop policy if exists "posts: admin all" on public.posts;
create policy "posts: admin all" on public.posts for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "post_comments: admin all" on public.post_comments;
create policy "post_comments: admin all" on public.post_comments for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "post_reports: admin all" on public.post_reports;
create policy "post_reports: admin all" on public.post_reports for all using (public.is_admin()) with check (public.is_admin());

revoke all on public.posts, public.post_likes, public.post_comments, public.post_reports from anon, authenticated;
grant select, update, delete on public.posts, public.post_comments, public.post_reports to authenticated; -- RLS: admins only
grant select, insert, update, delete on public.posts, public.post_likes, public.post_comments, public.post_reports to service_role;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posts', 'posts', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "posts: owner upload" on storage.objects;
create policy "posts: owner upload" on storage.objects for insert
  with check (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "posts: owner delete" on storage.objects;
create policy "posts: owner delete" on storage.objects for delete
  using (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "posts: admin all" on storage.objects;
create policy "posts: admin all" on storage.objects for all
  using (bucket_id = 'posts' and public.is_admin()) with check (bucket_id = 'posts' and public.is_admin());

-- ---------------------------------------------------------------- limits
-- 5 posts a day and 30 comments an hour per person; admins are exempt.
create or replace function public.community_rate_limit()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  author uuid;
  recent integer;
begin
  -- NEW is the row of whichever table fired this trigger. A single CASE that
  -- names both profile_id and user_id fails to compile: the other column
  -- isn't on that row. Read only the column this table has.
  if tg_table_name = 'posts' then
    author := new.profile_id;
  else
    author := new.user_id;
  end if;
  if author in (select * from public.admin_user_ids()) then
    return new;
  end if;
  if tg_table_name = 'posts' then
    select count(*) into recent from public.posts
      where profile_id = author and created_at > now() - interval '24 hours';
    if recent >= 5 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  else
    select count(*) into recent from public.post_comments
      where user_id = author and created_at > now() - interval '1 hour';
    if recent >= 30 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_rate_limit on public.posts;
create trigger posts_rate_limit before insert on public.posts
  for each row execute function public.community_rate_limit();
drop trigger if exists post_comments_rate_limit on public.post_comments;
create trigger post_comments_rate_limit before insert on public.post_comments
  for each row execute function public.community_rate_limit();

-- ---------------------------------------------------------------- activity
-- Likes and approved comments on a post, grouped per Argentine day into one
-- notice for its author, like bump_artwork_activity does for obras.
create or replace function public.bump_post_activity(post uuid, field text, actor uuid, actor_name text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid;
  day text := to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD');
begin
  if field not in ('likes', 'comments') then
    raise exception 'bump_post_activity: unknown field %', field;
  end if;
  select profile_id into owner_id from public.posts where id = post;
  if owner_id is null or owner_id = actor then return; end if;
  insert into public.notifications as n (user_id, type, dedupe_key, data)
  values (owner_id, 'post_activity', 'post_activity:' || post || ':' || day,
          jsonb_build_object('postId', post, 'day', day, 'likes', 0, 'comments', 0, 'lastName', actor_name)
            || jsonb_build_object(field, 1))
  on conflict (user_id, dedupe_key) do update
    -- lastName: who answered last, so the notice reads «A Marta y 2 más…».
    set data = n.data || jsonb_build_object(field, coalesce((n.data ->> field)::integer, 0) + 1)
          || case when actor_name is null then '{}'::jsonb else jsonb_build_object('lastName', actor_name) end,
        read_at = null,
        updated_at = now();
end;
$$;

create or replace function public.on_post_like()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    perform public.bump_post_activity(new.post_id, 'likes', new.user_id,
      (select split_part(name, ' ', 1) from public.profiles where id = new.user_id));
    return new;
  end if;
  update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;
drop trigger if exists post_likes_count on public.post_likes;
create trigger post_likes_count after insert or delete on public.post_likes
  for each row execute function public.on_post_like();

-- comment_count counts approved comments only.
create or replace function public.on_post_comment()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  was boolean := tg_op in ('UPDATE', 'DELETE') and old.status = 'approved';
  now_approved boolean := tg_op in ('INSERT', 'UPDATE') and new.status = 'approved';
  target uuid := case when tg_op = 'DELETE' then old.post_id else new.post_id end;
begin
  if now_approved and not was then
    update public.posts set comment_count = comment_count + 1 where id = target;
    perform public.bump_post_activity(target, 'comments', new.user_id, split_part(new.author_name, ' ', 1));
  elsif was and not now_approved then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = target;
  end if;
  -- A moderated comment: its author hears about it (same as obra comments).
  if tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'approved' then
    perform public.notify_user(new.user_id, 'post_comment_approved', jsonb_build_object('postId', new.post_id));
  end if;
  -- A comment waiting for moderation: one grouped notice for the admins.
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.notify_admins('post_comments_pending',
      jsonb_build_object('count', (select count(*) from public.post_comments where status = 'pending')),
      'post_comments_pending');
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists post_comments_count on public.post_comments;
create trigger post_comments_count after insert or update of status or delete on public.post_comments
  for each row execute function public.on_post_comment();

-- ---------------------------------------------------------------- moderation
-- A photo waiting for approval tells the admins; approving or hiding tells
-- its author.
create or replace function public.on_post_status()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      perform public.notify_admins('posts_pending',
        jsonb_build_object('count', (select count(*) from public.posts where status = 'pending')),
        'posts_pending');
    end if;
    return new;
  end if;
  if old.status = new.status then return new; end if;
  if old.status = 'pending' and new.status = 'published' then
    perform public.notify_user(new.profile_id, 'post_approved', jsonb_build_object('postId', new.id));
  elsif new.status in ('hidden', 'removed') and old.status in ('pending', 'published')
        and new.moderated_at is not null then
    -- Only when an admin did it (moderated_at set), not the author deleting.
    perform public.notify_user(new.profile_id, 'post_hidden', jsonb_build_object('postId', new.id, 'kind', new.kind));
  end if;
  return new;
end;
$$;
drop trigger if exists posts_status on public.posts;
create trigger posts_status after insert or update of status on public.posts
  for each row execute function public.on_post_status();

-- Three reports from different people hide a post until an admin looks.
create or replace function public.on_post_report()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare total integer;
begin
  update public.posts set report_count = report_count + 1 where id = new.post_id
    returning report_count into total;
  if total >= 3 then
    update public.posts set status = 'hidden' where id = new.post_id and status = 'published';
  end if;
  perform public.notify_admins('post_reported',
    jsonb_build_object('postId', new.post_id, 'reports', total), 'post_reported:' || new.post_id);
  return new;
end;
$$;
drop trigger if exists post_reports_count on public.post_reports;
create trigger post_reports_count after insert on public.post_reports
  for each row execute function public.on_post_report();

-- ---------------------------------------------------------------- feed
-- The public feed, newest first, keyset-paginated by (created_at, id). Only
-- published posts by public artists, whose obra (for «Mi obra») is still
-- published. `author` narrows it to one artist's profile.
create or replace function public.community_feed(
  before_at timestamptz default null,
  before_id uuid default null,
  author uuid default null,
  page_size integer default 20
)
returns table (
  id uuid, kind text, body text, created_at timestamptz,
  like_count integer, comment_count integer,
  profile_id uuid, author_name text, author_country text, author_thumb text,
  artwork_slug text, artwork_title text, image_url text, image_path text,
  official boolean, pinned boolean, lang text, translations jsonb, image_alt text, tags text[]
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.kind, p.body, p.created_at, p.like_count, p.comment_count,
         pr.id, pr.name, pr.country_code,
         (select a2.image_url from public.artworks a2
            where a2.profile_id = pr.id and a2.archived_at is null and a2.image_url is not null
            order by a2.is_selected desc, a2.created_at desc limit 1),
         a.slug, a.title, a.image_url, p.image_path,
         p.official, coalesce(p.pinned_until > now(), false), p.lang, p.translations, p.image_alt, p.tags
  from public.posts p
  join public.profiles pr on pr.id = p.profile_id and (pr.is_public or p.official)
  left join public.artworks a on a.id = p.artwork_id
  where p.status = 'published'
    and (p.kind <> 'artwork' or (a.is_selected and a.archived_at is null))
    and (author is null or p.profile_id = author)
    and (before_at is null or (p.created_at, p.id) < (before_at, before_id))
  order by p.created_at desc, p.id desc
  limit least(greatest(page_size, 1), 50)
$$;
revoke all on function public.community_feed(timestamptz, uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.community_feed(timestamptz, uuid, uuid, integer) to service_role;

-- The home strip: the pinned prompt first, then the most answered posts of
-- the last 14 days (a comment weighs twice a like), newest breaking ties, so
-- the home shows conversation rather than whatever came last. Picks among
-- the 50 newest; no cursor.
create or replace function public.community_highlights(page_size integer default 10)
returns table (
  id uuid, kind text, body text, created_at timestamptz,
  like_count integer, comment_count integer,
  profile_id uuid, author_name text, author_country text, author_thumb text,
  artwork_slug text, artwork_title text, image_url text, image_path text,
  official boolean, pinned boolean, lang text, translations jsonb, image_alt text, tags text[]
)
language sql stable security definer set search_path = '' as $$
  select f.*
  from public.community_feed(null, null, null, 50) f
  order by f.pinned desc,
           case when f.created_at > now() - interval '14 days'
                then f.like_count + 2 * f.comment_count else -1 end desc,
           f.created_at desc
  limit least(greatest(page_size, 1), 20)
$$;
revoke all on function public.community_highlights(integer) from public, anon, authenticated;
grant execute on function public.community_highlights(integer) to service_role;

-- One pinned post at a time.
create or replace function public.on_post_pinned()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.posts set pinned_until = null where id <> new.id and pinned_until is not null;
  return new;
end;
$$;
drop trigger if exists posts_single_pin on public.posts;
create trigger posts_single_pin after insert or update of pinned_until on public.posts
  for each row when (new.pinned_until is not null) execute function public.on_post_pinned();


-- One published post, for /api/comunidad/[id]. Same row as the feed; a
-- hidden, removed or unpublished post returns nothing.
create or replace function public.community_post(post uuid)
returns table (
  id uuid, kind text, body text, created_at timestamptz,
  like_count integer, comment_count integer,
  profile_id uuid, author_name text, author_country text, author_thumb text,
  artwork_slug text, artwork_title text, image_url text, image_path text,
  official boolean, pinned boolean, lang text, translations jsonb, image_alt text, tags text[]
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.kind, p.body, p.created_at, p.like_count, p.comment_count,
         pr.id, pr.name, pr.country_code,
         (select a2.image_url from public.artworks a2
            where a2.profile_id = pr.id and a2.archived_at is null and a2.image_url is not null
            order by a2.is_selected desc, a2.created_at desc limit 1),
         a.slug, a.title, a.image_url, p.image_path,
         p.official, coalesce(p.pinned_until > now(), false), p.lang, p.translations, p.image_alt, p.tags
  from public.posts p
  join public.profiles pr on pr.id = p.profile_id and (pr.is_public or p.official)
  left join public.artworks a on a.id = p.artwork_id
  where p.id = post
    and p.status = 'published'
    and (p.kind <> 'artwork' or (a.is_selected and a.archived_at is null))
$$;
revoke all on function public.community_post(uuid) from public, anon, authenticated;
grant execute on function public.community_post(uuid) to service_role;

notify pgrst, 'reload schema';
