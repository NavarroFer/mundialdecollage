-- Keep duplicate decisions durable across subsequent Registro synchronizations.
alter table public.artworks add column if not exists duplicate_of uuid
  references public.artworks(id) on delete restrict;

-- The old publish action inserts after auth_link_registro has already
-- materialized the source. Keep this guard for old deployments and retries.
create or replace function public.guard_duplicate_legacy_publication()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    if new.duplicate_of is not null then
      new.archived_at := coalesce(old.archived_at, new.archived_at, now());
      new.is_selected := false;
    end if;
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.profile_id::text, 0));
  if new.legacy_submission_id is null and exists (
    select 1 from public.artworks a
    join public.legacy_submissions ls on ls.id = a.legacy_submission_id
    where a.profile_id = new.profile_id and a.image_url = new.image_url
      and a.archived_at is null and ls.claimed_by = new.profile_id
  ) then
    return null;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_duplicate_legacy_publication() from public, anon, authenticated;
drop trigger if exists guard_duplicate_legacy_publication on public.artworks;
create trigger guard_duplicate_legacy_publication before insert or update on public.artworks
  for each row execute function public.guard_duplicate_legacy_publication();

-- Recoverable cleanup: only exact URL matches for the same artist and
-- auto-generated title, with an existing, source-linked canonical artwork.
-- Preserve custom titles/techniques for manual review, and never delete files.
update public.artworks duplicate
set archived_at = now(), is_selected = false, duplicate_of = kept.id
from public.artworks kept, public.legacy_submissions ls
where ls.id = kept.legacy_submission_id
  and duplicate.archived_at is null and duplicate.legacy_submission_id is null
  and duplicate.technique is null and duplicate.title like 'Obra de %'
  and kept.profile_id = duplicate.profile_id and kept.image_url = duplicate.image_url
  and kept.title = duplicate.title and kept.archived_at is null
  and kept.is_selected and ls.claimed_by = kept.profile_id;

-- User visually confirmed these two Drive files are the same Yamila work.
-- Preserve the selected version and keep both files available for recovery.
alter table public.legacy_submissions add column if not exists duplicate_of uuid
  references public.legacy_submissions(id) on delete restrict;
update public.artworks set duplicate_of = 'be0901cf-6d92-4a75-b5f1-dff37dda8033',
  archived_at = now(), is_selected = false
where id = '475e0cd9-cb58-459e-b5a9-1a351b257a59'
  and exists (select 1 from public.artworks kept
    where kept.id = 'be0901cf-6d92-4a75-b5f1-dff37dda8033' and kept.is_selected);
update public.legacy_submissions set duplicate_of = 'dc7e51ea-da6d-46cc-bb78-1fa7f97923fd',
  archived_at = now(), selected = false, promoted = false
where id = '6edb0bfb-a736-497f-84f8-bc82796c0d37'
  and exists (select 1 from public.artworks where id = '475e0cd9-cb58-459e-b5a9-1a351b257a59'
    and duplicate_of is not null);

-- A mail delivery agent is not an artist. Keep records recoverable, and
-- refuse a dirty source instead of silently re-importing it on the next sync.
update public.artworks a set archived_at = now(), is_selected = false
where exists (select 1 from auth.users u where u.id = a.profile_id
  and lower(u.email) = 'mailer-daemon@googlemail.com');
update public.legacy_submissions set archived_at = now(), selected = false, promoted = false
where lower(email) = 'mailer-daemon@googlemail.com';
update public.profiles p set is_public = false where exists (
  select 1 from auth.users u where u.id = p.id and lower(u.email) = 'mailer-daemon@googlemail.com');

create or replace function public.reject_automated_registro_sender()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.archived_at is null and new.duplicate_of is not null then
    raise exception 'Registro contains a confirmed duplicate; remove it from the source sheet';
  end if;
  if new.archived_at is null and split_part(lower(trim(new.email)), '@', 1)
     in ('mailer-daemon', 'postmaster') then
    raise exception 'Registro contains an automated mail sender; remove the bounce from the source sheet';
  end if;
  return new;
end;
$$;
revoke all on function public.reject_automated_registro_sender() from public, anon, authenticated;
drop trigger if exists reject_automated_registro_sender on public.legacy_submissions;
create trigger reject_automated_registro_sender before insert or update on public.legacy_submissions
  for each row execute function public.reject_automated_registro_sender();
notify pgrst, 'reload schema';
