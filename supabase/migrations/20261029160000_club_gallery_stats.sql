-- Club members see how their gallery is doing. Two parts:
--  1. record_gallery_attention counted only the contest's selected obra; an obra
--     that hangs only in a Club gallery recorded nothing, so a member's stats
--     would be empty. It now counts those too.
--  2. club_gallery_stats() answers each member about their own gallery. It runs
--     with the owner's rights (the attention tables are admin-only) but looks
--     only at the caller's hangings.
-- Attention comes from signed-in visitors only (a visit needs an account), so
-- the numbers are of people with an account, not of every visit.
create or replace function public.record_gallery_attention(viewer_id uuid, visit_id uuid, samples jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
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
    and ((a.is_selected and p.is_public) or public.artwork_hangs_in_active_club_gallery(a.id))
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
$$;

revoke all on function public.record_gallery_attention(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_gallery_attention(uuid, uuid, jsonb) to service_role;

create function public.club_gallery_stats(since timestamptz)
returns table (
  artwork_id uuid, slug text, title text, slot integer,
  viewers bigint, view_seconds numeric, details_seconds numeric, stamps bigint, likes bigint
)
language sql stable security definer set search_path = public, pg_temp as $$
  select a.id, a.slug, a.title, h.slot,
    coalesce(att.viewers, 0), coalesce(att.view_seconds, 0), coalesce(att.details_seconds, 0),
    (select count(*) from public.artwork_stamp_collections c where c.artwork_id = a.id and c.collected_at >= since),
    (select count(*) from public.artwork_likes l where l.artwork_id = a.id and l.created_at >= since)
  from public.club_galleries gal
  join public.club_gallery_hangings h on h.gallery_id = gal.id
  join public.artworks a on a.id = h.artwork_id
  left join lateral (
    select count(distinct s.user_id) filter (where g.mode = 'view') as viewers,
      round(coalesce(sum(g.milliseconds) filter (where g.mode = 'view'), 0) / 1000.0, 1) as view_seconds,
      round(coalesce(sum(g.milliseconds) filter (where g.mode = 'details'), 0) / 1000.0, 1) as details_seconds
    from public.gallery_attention g
    join public.gallery_attention_sessions s on s.id = g.session_id
    where g.artwork_id = a.id and s.created_at >= since
  ) att on true
  where gal.user_id = auth.uid()
  order by h.slot;
$$;

revoke all on function public.club_gallery_stats(timestamptz) from public, anon;
grant execute on function public.club_gallery_stats(timestamptz) to authenticated;

notify pgrst, 'reload schema';
