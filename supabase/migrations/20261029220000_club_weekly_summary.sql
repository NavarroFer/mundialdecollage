-- Club del Mundial: a weekly note in each member's bell with how their
-- gallery did the week before (Monday to Sunday, Argentina): people with an
-- account who looked at its obras, stamps collected and likes. The daily
-- cron (app/api/cron/exhibition) calls this every day; only the first call
-- of a week writes, once per gallery, so a retry never repeats it.

create function public.club_weekly_summaries(p_dry boolean default false)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  week_end date := date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')::date;
  week_start date := week_end - 7;
  since timestamptz := week_start::timestamp at time zone 'America/Argentina/Buenos_Aires';
  until timestamptz := week_end::timestamp at time zone 'America/Argentina/Buenos_Aires';
  summary record;
  written integer := 0;
begin
  for summary in
    select g.user_id, g.slug, g.title,
      (select count(distinct s.user_id)::integer
        from public.gallery_attention a
        join public.gallery_attention_sessions s on s.id = a.session_id
        join public.club_gallery_hangings h on h.artwork_id = a.artwork_id and h.gallery_id = g.id
        where a.mode = 'view' and s.created_at >= since and s.created_at < until) as viewers,
      (select count(*)::integer
        from public.artwork_stamp_collections c
        join public.club_gallery_hangings h on h.artwork_id = c.artwork_id and h.gallery_id = g.id
        where c.collected_at >= since and c.collected_at < until) as stamps,
      (select count(*)::integer
        from public.artwork_likes l
        join public.club_gallery_hangings h on h.artwork_id = l.artwork_id and h.gallery_id = g.id
        where l.created_at >= since and l.created_at < until) as likes
    from public.club_galleries g
    -- A gallery opened after the week ended has nothing to tell about it.
    where g.status = 'active' and g.created_at < until
      and not exists (
        select 1 from public.notifications n
        where n.user_id = g.user_id and n.dedupe_key = 'club_weekly:' || week_start
      )
  loop
    written := written + 1;
    if not p_dry then
      perform public.notify_user(
        summary.user_id,
        'club_weekly',
        jsonb_build_object('slug', summary.slug, 'title', summary.title, 'week', week_start::text,
          'viewers', summary.viewers, 'stamps', summary.stamps, 'likes', summary.likes),
        'club_weekly:' || week_start
      );
    end if;
  end loop;
  return written;
end;
$$;

revoke all on function public.club_weekly_summaries(boolean) from public, anon, authenticated;
grant execute on function public.club_weekly_summaries(boolean) to service_role;

notify pgrst, 'reload schema';
