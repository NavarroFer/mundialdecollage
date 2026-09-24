-- Fer (chat 2026-09-23): "todas participan a no ser que haya un error que
-- tenga que corregir a mano yo". The per-artist "Curación pendiente" step
-- on /admin/obras goes away: every artist whose Registro rows arrive gets
-- one of them confirmed (selected + promoted) automatically, and
-- lib/publish-legacy.ts then provisions the account that makes it public.
--
-- Same pick rule as 20260921100000_publish_everything_by_default.sql: an
-- admin's existing `selected` choice wins, otherwise the most recently
-- submitted row. Only touches email groups with no active promoted row, so
-- a pick an admin already confirmed (or changes later from the viewer) is
-- never overridden.
create or replace function public.promote_unresolved_legacy_submissions()
returns void language sql security definer set search_path = '' as $$
  with pick as (
    select distinct on (ls.email) ls.id
    from public.legacy_submissions ls
    where ls.archived_at is null
      and not exists (
        select 1 from public.legacy_submissions other
        where other.email = ls.email and other.archived_at is null and other.promoted
      )
    order by ls.email, ls.selected desc, ls.created_at desc, ls.id
  )
  update public.legacy_submissions ls
  set selected = true, promoted = true
  from pick
  where ls.id = pick.id;
$$;
revoke all on function public.promote_unresolved_legacy_submissions() from public, anon, authenticated;

create or replace function public.legacy_auto_promote() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.promote_unresolved_legacy_submissions();
  return null;
end;
$$;
revoke all on function public.legacy_auto_promote() from public, anon, authenticated;

-- Statement-level: covers the Registro sync (inserts and restores) and the
-- manual paste import alike; archiving a promoted row promotes a sibling.
-- The function only writes selected/promoted, so it never re-fires itself.
drop trigger if exists legacy_auto_promote on public.legacy_submissions;
create trigger legacy_auto_promote
  after insert or update of archived_at on public.legacy_submissions
  for each statement execute function public.legacy_auto_promote();

-- Backfill the groups currently waiting in "Curación pendiente".
select public.promote_unresolved_legacy_submissions();

notify pgrst, 'reload schema';
