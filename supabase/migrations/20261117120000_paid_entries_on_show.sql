-- Fer (2026-11-17): every obra an artist paid to postulate is published and
-- takes part, not only the one that represents them. An artist wrote in to
-- say only one of their obras showed, and was right: the public site only
-- ever read is_selected (one obra per artist), so the extra entries
-- (is_entered, lib/entries.ts) were in the contest but nowhere to be seen.
--
-- artwork_on_show() is the rule from now on, in place of is_selected
-- wherever the public sees or touches obras: the representative obra, or
-- any other one entered by an artist who paid. The payment check matters:
-- an artist who never paid can still carry a stale is_entered on an obra
-- an admin took off the site (20261110120000_hide_unreadable_obra_image.sql
-- unselects; the admin's «Usar esta obra» only clears is_entered for those
-- who didn't pay). is_selected keeps meaning «the one obra per artist» for
-- what is per artist: certificates, contacts, suggestions, the digest.
create or replace function public.artwork_on_show(a public.artworks)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a.is_selected
    or (
      a.is_entered
      and a.archived_at is null
      and a.duplicate_of is null
      and not a.is_club_only
      and exists (
        select 1 from public.entry_purchases e
        where e.user_id = a.profile_id and e.status = 'paid'
      )
    )
$$;

revoke all on function public.artwork_on_show(public.artworks) from public;
grant execute on function public.artwork_on_show(public.artworks) to anon, authenticated, service_role;

drop policy if exists "artworks: public read of published profiles" on public.artworks;
create policy "artworks: public read of published profiles"
  on public.artworks for select
  using (
    public.artwork_on_show(artworks)
    and exists (
      select 1 from public.profiles p
      where p.id = artworks.profile_id and p.is_public = true
    )
  );

-- Everyone who paid gets all their obras in: the ones they uploaded after
-- paying and never ticked on /onboarding/obras included. Only when they all
-- fit in what was paid for (site.entries.paidLimit); an artist with more
-- keeps the ones they chose.
with paid as (
  select user_id, max(entries_allowed) as allowed
  from public.entry_purchases
  where status = 'paid'
  group by user_id
), eligible as (
  select a.profile_id, count(*) as obras
  from public.artworks a
  join paid on paid.user_id = a.profile_id
  where a.archived_at is null and a.duplicate_of is null and not a.is_club_only and a.image_url is not null
  group by a.profile_id
)
update public.artworks a
   set is_entered = true
  from eligible e
  join paid on paid.user_id = e.profile_id
 where a.profile_id = e.profile_id
   and e.obras <= paid.allowed
   and not a.is_entered
   and a.archived_at is null and a.duplicate_of is null and not a.is_club_only and a.image_url is not null;

-- The same functions as before, with artwork_on_show() where they checked
-- is_selected: the day's lineup in the 3D gallery, likes, stamps and
-- attention on a gallery obra, the obra feeds and the community posts
-- about an obra.
CREATE OR REPLACE FUNCTION public.ensure_exhibition_today()
 RETURNS TABLE(slot smallint, artwork_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
declare
  today date := public.exhibition_day();
  -- Keep in sync with gallerySlots.length in data/artworks.ts.
  wall_count constant int := 37;
  hung int;
  next_slot int;
begin
  select count(*) into hung from public.exhibition_days e where e.day = today;
  if hung < wall_count then
    -- Two first visitors at 09:00 must not both build (or top up) a lineup.
    perform pg_advisory_xact_lock(hashtext('public.exhibition_days'));
    select count(*), coalesce(max(e.slot) + 1, 0) into hung, next_slot
    from public.exhibition_days e where e.day = today;
    if hung < wall_count then
      insert into public.exhibition_days (day, slot, artwork_id)
      select today, (next_slot + row_number() over (order by random()) - 1)::smallint, picked.id
      from (
        select a.id
        from public.artworks a
        join public.profiles p on p.id = a.profile_id
        left join lateral (
          select max(e.day) as last_day from public.exhibition_days e
          where e.artwork_id = a.id and e.notify_status is not null
        ) shown on true
        left join lateral (
          select true as unmailed from public.exhibition_days w
          where w.artwork_id = a.id and w.day < today and w.notify_status is null
          limit 1
        ) hung_before on true
        where public.artwork_on_show(a) and p.is_public
          and not exists (select 1 from public.exhibition_days t where t.day = today and t.artwork_id = a.id)
        order by
          (coalesce(hung_before.unmailed, false) and shown.last_day is null) desc,
          shown.last_day asc nulls first,
          (a.created_at at time zone 'utc')::date asc,
          random()
        limit wall_count - hung
      ) picked;
    end if;
  end if;

  return query
    select e.slot, e.artwork_id from public.exhibition_days e where e.day = today order by e.slot;
end;
$function$;

CREATE OR REPLACE FUNCTION public.like_gallery_artwork(artwork_slug text, voter_email text, voter_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_id uuid;
  account_id uuid;
  inserted integer := 0;
begin
  if voter_email is null or voter_email <> lower(btrim(voter_email))
     or length(voter_email) > 254 or voter_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' then
    raise exception 'Invalid email';
  end if;
  select a.id into target_id from public.artworks a
    where a.slug = artwork_slug and (
      (public.artwork_on_show(a) and exists (select 1 from public.profiles p where p.id = a.profile_id and p.is_public))
      or exists (
        select 1 from public.club_gallery_hangings h
        join public.club_galleries g on g.id = h.gallery_id
        where h.artwork_id = a.id and g.status = 'active'
      )
    );
  if target_id is null then raise exception 'Artwork unavailable'; end if;
  insert into public.contacts(email, source)
    values (voter_email, 'galeria-3d') on conflict (email) do nothing;
  insert into public.artwork_likes(artwork_id, email, user_id)
    values (target_id, voter_email, voter_id)
    on conflict (artwork_id, email) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    -- Already liked: only fill in the account if the old like had none.
    if voter_id is not null then
      update public.artwork_likes set user_id = voter_id
        where artwork_id = target_id and email = voter_email and user_id is null;
    end if;
    return;
  end if;
  -- A new like earns one Club coin (daily cap inside the function). Without a
  -- session id, fall back to the account that owns the email, as before.
  account_id := voter_id;
  if account_id is null then
    select u.id into account_id from auth.users u where lower(u.email) = voter_email order by u.created_at limit 1;
  end if;
  if account_id is not null then
    perform public.credit_club_activity_coins(account_id, 1, 'like:' || target_id::text || ':' || account_id::text);
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.collect_gallery_artwork_stamp(artwork_slug text)
 RETURNS TABLE(status text, remaining integer, resets_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  collector uuid := auth.uid();
  target_id uuid;
  club_gallery uuid;
  is_first_from_gallery boolean := false;
  collected_count integer;
  oldest_stamp timestamptz;
begin
  if collector is null then raise exception 'Sign in required'; end if;

  select a.id into target_id from public.artworks a
    where a.slug = artwork_slug and (
      (public.artwork_on_show(a) and exists (select 1 from public.profiles p where p.id = a.profile_id and p.is_public))
      or public.artwork_hangs_in_active_club_gallery(a.id)
    );
  if target_id is null then raise exception 'Artwork unavailable'; end if;

  perform pg_advisory_xact_lock(hashtextextended(collector::text, 0));
  select count(*)::integer, min(collected_at) into collected_count, oldest_stamp
    from public.artwork_stamp_collections
    where user_id = collector and collected_at > now() - interval '12 hours' and not is_bonus;

  if exists (select 1 from public.artwork_stamp_collections where user_id = collector and artwork_id = target_id) then
    return query select 'already_collected', greatest(0, 3 - collected_count), oldest_stamp + interval '12 hours';
    return;
  end if;

  select g.id into club_gallery
    from public.club_gallery_hangings h
    join public.club_galleries g on g.id = h.gallery_id
    where h.artwork_id = target_id and g.status = 'active'
    order by g.created_at limit 1;
  if club_gallery is not null then
    is_first_from_gallery := not exists (
      select 1 from public.artwork_stamp_collections c
      join public.club_gallery_hangings h on h.artwork_id = c.artwork_id
      where c.user_id = collector and h.gallery_id = club_gallery
    );
  end if;

  if not is_first_from_gallery and collected_count >= 3 then
    return query select 'limit_reached', 0, oldest_stamp + interval '12 hours';
    return;
  end if;

  insert into public.artwork_stamp_collections(user_id, artwork_id, is_bonus) values (collector, target_id, is_first_from_gallery);
  perform public.credit_club_activity_coins(collector, 3, 'stamp:' || target_id::text || ':' || collector::text);
  if is_first_from_gallery then
    -- The bonus takes none of the three and starts no clock.
    return query select 'collected', greatest(0, 3 - collected_count), oldest_stamp + interval '12 hours';
    return;
  end if;
  collected_count := collected_count + 1;
  if oldest_stamp is null then oldest_stamp := now(); end if;
  return query select 'collected', 3 - collected_count, oldest_stamp + interval '12 hours';
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_gallery_attention(viewer_id uuid, visit_id uuid, samples jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare owner_id uuid;
begin
  if jsonb_typeof(samples) <> 'array' or jsonb_array_length(samples) not between 1 and 40 then
    raise exception 'Invalid samples';
  end if;
  -- Serializes this account's writes: bounds also hold under concurrent requests.
  perform pg_advisory_xact_lock(hashtextextended(viewer_id::text, 0));
  select s.user_id into owner_id from public.gallery_attention_sessions s where s.id = visit_id;
  if owner_id is not null and owner_id <> viewer_id then raise exception 'Session owner mismatch'; end if;
  if owner_id is null then
    if (select count(*) from public.gallery_attention_sessions s where s.user_id = viewer_id and s.created_at >= now() - interval '1 day') >= 200 then
      raise exception 'Session limit reached';
    end if;
    insert into public.gallery_attention_sessions(id, user_id) values (visit_id, viewer_id);
  end if;
  if exists (select 1 from public.gallery_attention_sessions s where s.id = visit_id and s.created_at < now() - interval '1 day') then
    raise exception 'Session expired';
  end if;

  insert into public.gallery_attention(session_id, artwork_id, mode, milliseconds, episodes)
  select visit_id, a.id, x.mode, x.milliseconds, x.episodes
  from jsonb_to_recordset(samples) as x(slug text, mode text, milliseconds bigint, episodes integer)
  join public.artworks a on a.slug = x.slug
  join public.profiles p on p.id = a.profile_id
  -- The contest's obra on a public profile, or one hung in an active Club gallery.
  where a.archived_at is null and a.image_url is not null
    and ((public.artwork_on_show(a) and p.is_public) or public.artwork_hangs_in_active_club_gallery(a.id))
  on conflict (session_id, artwork_id, mode) do update set
    milliseconds = greatest(gallery_attention.milliseconds, excluded.milliseconds),
    episodes = greatest(gallery_attention.episodes, excluded.episodes),
    updated_at = now();
  -- Also bound malformed clients that submit disjoint batches.
  if (select coalesce(sum(milliseconds), 0) from public.gallery_attention where session_id = visit_id) > 14400000
     or (select count(*) from public.gallery_attention where session_id = visit_id) > 40 then
    raise exception 'Observation limit reached';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.obra_activity_feed(before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, before_id uuid DEFAULT NULL::uuid, page_size integer DEFAULT 10)
 RETURNS TABLE(id uuid, slug text, title text, image_url text, author_name text, author_country text, like_count integer, comment_count integer, last_activity_at timestamp with time zone, recent jsonb, tags text[], author_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
         a.tags,
         p.id
  from public.artworks a
  join public.profiles p on p.id = a.profile_id
  where public.artwork_on_show(a)
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
$function$;

CREATE OR REPLACE FUNCTION public.obra_similar(match_tags text[], skip_slug text DEFAULT NULL::text, page_size integer DEFAULT 6)
 RETURNS TABLE(slug text, title text, image_url text, author_name text, author_country text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select a.slug, a.title, a.image_url, p.name, p.country_code
  from public.artworks a
  join public.profiles p on p.id = a.profile_id
  where public.artwork_on_show(a)
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
$function$;

CREATE OR REPLACE FUNCTION public.community_feed(before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, before_id uuid DEFAULT NULL::uuid, author uuid DEFAULT NULL::uuid, page_size integer DEFAULT 20)
 RETURNS TABLE(id uuid, kind text, body text, created_at timestamp with time zone, like_count integer, comment_count integer, profile_id uuid, author_name text, author_country text, author_thumb text, artwork_slug text, artwork_title text, image_url text, image_path text, official boolean, pinned boolean, lang text, translations jsonb, image_alt text, tags text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    and (p.kind <> 'artwork' or (public.artwork_on_show(a) and a.archived_at is null))
    and (author is null or p.profile_id = author)
    and (before_at is null or (p.created_at, p.id) < (before_at, before_id))
  order by p.created_at desc, p.id desc
  limit least(greatest(page_size, 1), 50)
$function$;

CREATE OR REPLACE FUNCTION public.community_post(post uuid)
 RETURNS TABLE(id uuid, kind text, body text, created_at timestamp with time zone, like_count integer, comment_count integer, profile_id uuid, author_name text, author_country text, author_thumb text, artwork_slug text, artwork_title text, image_url text, image_path text, official boolean, pinned boolean, lang text, translations jsonb, image_alt text, tags text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    and (p.kind <> 'artwork' or (public.artwork_on_show(a) and a.archived_at is null))
$function$;

notify pgrst, 'reload schema';
