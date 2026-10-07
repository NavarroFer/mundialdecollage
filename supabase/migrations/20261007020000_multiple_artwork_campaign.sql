-- Count distinct active submissions, including sheet works not yet linked to
-- an account. Linked legacy rows count once. Re-evaluated on the send date.
alter table public.campaigns drop constraint if exists campaigns_audience_check;
alter table public.campaigns add constraint campaigns_audience_check
  check (audience in ('subscribed', 'no_artwork', 'profile_review', 'not_participating', 'multiple_artworks'));

create or replace function public.multiple_artwork_contacts()
returns table (contact_id uuid, artwork_titles text[])
language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select c.id, works.titles
  from public.contacts c
  left join auth.users u on lower(trim(u.email)) = lower(trim(c.email))
  left join public.profiles p on p.id = u.id
  join lateral (
    select array_agg(w.title order by w.created_at, w.id) as titles, count(*) as total
    from (
      select a.id, nullif(trim(a.title), '') as title, a.created_at
      from public.artworks a
      where a.profile_id = u.id and a.archived_at is null
        and a.duplicate_of is null and nullif(trim(a.image_url), '') is not null
      union all
      select l.id, nullif(trim(l.title), ''), l.created_at
      from public.legacy_submissions l
      where lower(trim(l.email)) = lower(trim(c.email))
        and l.archived_at is null and l.duplicate_of is null
        and nullif(trim(l.image_url), '') is not null
        and not exists (select 1 from public.artworks a where a.legacy_submission_id = l.id)
    ) w
  ) works on works.total > 1
  where c.subscribed and p.entries_chosen_at is null
    and (public.is_admin() or auth.role() = 'service_role')
    and not exists (select 1 from public.entry_purchases e where e.user_id = u.id and e.status = 'paid')
    and (
      (p.is_public and exists (select 1 from public.artworks a where a.profile_id = u.id and a.is_selected and a.archived_at is null and a.duplicate_of is null))
      or exists (select 1 from public.legacy_submissions l where lower(trim(l.email)) = lower(trim(c.email)) and l.promoted and l.archived_at is null and l.duplicate_of is null and nullif(trim(l.image_url), '') is not null)
    )
$$;
revoke all on function public.multiple_artwork_contacts() from public, anon;
grant execute on function public.multiple_artwork_contacts() to authenticated, service_role;
notify pgrst, 'reload schema';
