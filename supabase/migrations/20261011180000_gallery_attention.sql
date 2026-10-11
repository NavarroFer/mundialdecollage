-- Private viewing history. Only the server writes; only admins read.
create table public.gallery_attention_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index gallery_attention_sessions_user_idx on public.gallery_attention_sessions(user_id, created_at);
alter table public.gallery_attention_sessions enable row level security;
create policy "gallery attention sessions: admin read" on public.gallery_attention_sessions for select to authenticated using (public.is_admin());
revoke all on public.gallery_attention_sessions from public, anon, authenticated;
grant select on public.gallery_attention_sessions to authenticated;
grant select, insert, delete on public.gallery_attention_sessions to service_role;

create table public.gallery_attention (
  session_id uuid not null references public.gallery_attention_sessions(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  mode text not null check (mode in ('view', 'details')),
  milliseconds bigint not null check (milliseconds between 2000 and 14400000),
  episodes integer not null check (episodes > 0 and episodes <= milliseconds / 2000),
  updated_at timestamptz not null default now(),
  primary key (session_id, artwork_id, mode)
);
create index gallery_attention_artwork_idx on public.gallery_attention(artwork_id);
alter table public.gallery_attention enable row level security;
create policy "gallery attention: admin read" on public.gallery_attention for select to authenticated using (public.is_admin());
revoke all on public.gallery_attention from public, anon, authenticated;
grant select on public.gallery_attention to authenticated;
grant select, insert, update, delete on public.gallery_attention to service_role;

create function public.record_gallery_attention(viewer_id uuid, visit_id uuid, samples jsonb)
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
  where a.is_selected and a.archived_at is null and a.image_url is not null and p.is_public
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

-- Invoker permissions + RLS: ordinary accounts cannot retrieve other viewers.
create function public.gallery_attention_summary(since timestamptz)
returns table (slug text, title text, viewers bigint, view_seconds numeric, details_seconds numeric, observations bigint, average_view_seconds numeric)
language sql stable set search_path = public, pg_temp as $$
  select a.slug, a.title, count(distinct s.user_id),
    round(coalesce(sum(g.milliseconds) filter (where g.mode = 'view'), 0) / 1000.0, 1),
    round(coalesce(sum(g.milliseconds) filter (where g.mode = 'details'), 0) / 1000.0, 1),
    coalesce(sum(g.episodes) filter (where g.mode = 'view'), 0)::bigint,
    round(coalesce(sum(g.milliseconds) filter (where g.mode = 'view'), 0) / 1000.0 /
      greatest(count(distinct s.user_id) filter (where g.mode = 'view'), 1), 1)
  from public.gallery_attention g
  join public.gallery_attention_sessions s on s.id = g.session_id
  join public.artworks a on a.id = g.artwork_id
  where s.created_at >= since
  group by a.id, a.slug, a.title
  order by 4 desc, a.slug;
$$;
revoke all on function public.gallery_attention_summary(timestamptz) from public, anon;
grant execute on function public.gallery_attention_summary(timestamptz) to authenticated, service_role;
notify pgrst, 'reload schema';
