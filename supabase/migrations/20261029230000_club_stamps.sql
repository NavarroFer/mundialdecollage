-- Club del Mundial: two stamps per gallery for the visitors' album.
--  - postal: the artist's postal stamp, for having looked at every obra
--    hanging in their room. The database checks it against the visitor's
--    own recorded attention (gallery_attention), not the browser's word.
--  - vernissage: «I met them live in their gallery», for being in the room
--    while its member was there too. Who is live is only known to the
--    browsers (Realtime presence), so this one rests on their word.

create table public.club_stamps (
  user_id uuid not null references auth.users(id) on delete cascade,
  gallery_id uuid not null references public.club_galleries(id) on delete cascade,
  kind text not null check (kind in ('postal', 'vernissage')),
  collected_at timestamptz not null default now(),
  primary key (user_id, gallery_id, kind)
);

alter table public.club_stamps enable row level security;
revoke all on public.club_stamps from anon, authenticated;
create policy "club stamps: owner reads own" on public.club_stamps
  for select to authenticated using (user_id = auth.uid());
grant select on public.club_stamps to authenticated;
grant select, insert, update, delete on public.club_stamps to service_role;

-- 'collected', 'already', 'own' (the member's own gallery) or, for the
-- postal stamp, 'missing' while some hung obra has no attention yet.
create function public.collect_club_stamp(p_slug text, p_kind text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  collector uuid := auth.uid();
  target public.club_galleries%rowtype;
  hung integer;
  seen integer;
begin
  if collector is null then raise exception 'Sign in required'; end if;
  if p_kind not in ('postal', 'vernissage') then raise exception 'Invalid Club stamp'; end if;
  select * into target from public.club_galleries where slug = p_slug and status = 'active';
  if not found then raise exception 'Gallery unavailable'; end if;
  if target.user_id = collector then return 'own'; end if;
  if exists (select 1 from public.club_stamps where user_id = collector and gallery_id = target.id and kind = p_kind) then
    return 'already';
  end if;

  if p_kind = 'postal' then
    select count(*)::integer into hung from public.club_gallery_hangings where gallery_id = target.id;
    select count(*)::integer into seen
      from public.club_gallery_hangings h
      where h.gallery_id = target.id and exists (
        select 1 from public.gallery_attention a
        join public.gallery_attention_sessions s on s.id = a.session_id
        where a.artwork_id = h.artwork_id and s.user_id = collector
      );
    if hung = 0 or seen < hung then return 'missing'; end if;
  end if;

  insert into public.club_stamps(user_id, gallery_id, kind) values (collector, target.id, p_kind)
    on conflict do nothing;
  return 'collected';
end;
$$;

-- The visitor's Club stamps for their album, newest first.
create function public.my_club_stamps()
returns table (slug text, title text, artist_name text, country_code text, kind text, collected_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select g.slug, g.title, coalesce(nullif(btrim(p.name), ''), g.title), p.country_code, s.kind, s.collected_at
  from public.club_stamps s
  join public.club_galleries g on g.id = s.gallery_id
  left join public.profiles p on p.id = g.user_id
  where s.user_id = auth.uid()
  order by s.collected_at desc
$$;

revoke all on function public.collect_club_stamp(text, text) from public, anon;
revoke all on function public.my_club_stamps() from public, anon;
grant execute on function public.collect_club_stamp(text, text) to authenticated;
grant execute on function public.my_club_stamps() to authenticated;

notify pgrst, 'reload schema';
