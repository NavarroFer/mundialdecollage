-- Registro is the curated source for imported submissions. Keep removed
-- rows recoverable and give each materialized artwork a stable source ID.
alter table public.legacy_submissions
  add column archived_at timestamptz,
  add column country_code text;
alter table public.artworks
  add column archived_at timestamptz,
  add column legacy_submission_id uuid references public.legacy_submissions(id) on delete set null;
create unique index artworks_legacy_submission_key on public.artworks(legacy_submission_id);

-- Ownership alone must not let a caller attach an arbitrary imported row
-- to their upload and reserve its unique source ID.
drop policy "artworks: owner insert own" on public.artworks;
create policy "artworks: owner insert own" on public.artworks for insert
  with check (profile_id = auth.uid() and legacy_submission_id is null and archived_at is null);

create function public.registro_drive_id(url text) returns text
language sql immutable strict set search_path = '' as $$
  select coalesce(substring(url from '/file/d/([A-Za-z0-9_-]+)'),
                  substring(url from '[?&]id=([A-Za-z0-9_-]+)'))
$$;
create unique index legacy_drive_file_key
  on public.legacy_submissions(public.registro_drive_id(drive_url));

-- Recover provenance for artworks provisioned by the previous importer.
update public.artworks a set legacy_submission_id = (
  select ls.id from public.legacy_submissions ls
  where ls.claimed_by = a.profile_id and ls.image_url = a.image_url
  order by ls.created_at, ls.id limit 1
)
where exists (select 1 from public.legacy_submissions ls
              where ls.claimed_by = a.profile_id and ls.image_url = a.image_url);

-- One existing artist uploaded the same image twice under different Storage
-- names. Both uploads have SHA-256 d4653a90811f34cca3a4cfe4e60f0d1e813172e6b6eecfca3f521ea78a4b1a36;
-- visual inspection also confirmed the curated Drive image is that work.
-- Keep the selected upload's title, technique, slug and original image.
update public.artworks a set legacy_submission_id = ls.id
from public.legacy_submissions ls
where a.id = 'f5c9b528-1756-43d8-9fff-2f045051c0ad'
  and ls.id = '710adcaf-38cf-4802-ba95-6f23ee934df4'
  and a.profile_id = ls.claimed_by and a.legacy_submission_id is null;
update public.artworks duplicate set archived_at = now(), is_selected = false
where duplicate.id = '8d119482-a437-405f-86ef-9ac009f80b30'
  and exists(select 1 from public.artworks kept
    where kept.id = 'f5c9b528-1756-43d8-9fff-2f045051c0ad'
      and kept.profile_id = duplicate.profile_id and kept.legacy_submission_id is not null);

create function public.link_registro_user(target_user uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  verified_email text;
  chosen public.legacy_submissions%rowtype;
  item public.legacy_submissions%rowtype;
  artwork_id uuid;
  linked integer := 0;
begin
  select lower(trim(email)) into verified_email from auth.users
    where id = target_user and email_confirmed_at is not null;
  if verified_email is null then return 0; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_user::text, 0));
  select * into chosen from public.legacy_submissions
    where lower(trim(email)) = verified_email and archived_at is null
      and (claimed_by is null or claimed_by = target_user)
    order by selected desc, (country_code is not null) desc, created_at, id limit 1;
  if not found then return 0; end if;

  insert into public.profiles(id, name, country_code)
    values(target_user, chosen.name, chosen.country_code)
    on conflict (id) do update set
      name = coalesce(nullif(public.profiles.name, ''), excluded.name),
      country_code = coalesce(public.profiles.country_code, excluded.country_code);

  for item in select * from public.legacy_submissions
    where lower(trim(email)) = verified_email and archived_at is null
      and (claimed_by is null or claimed_by = target_user)
    order by selected desc, created_at, id
  loop
    -- Link even when the photo still needs downloading. Its original
    -- metadata and Drive link remain attached to this account.
    update public.legacy_submissions set claimed_by = target_user,
      claimed_at = coalesce(claimed_at, now()) where id = item.id;
    if item.image_url is not null then
      select id into artwork_id from public.artworks
        where legacy_submission_id = item.id;
      if artwork_id is null then
        -- Old onboarding copied the image to the owner's Storage folder.
        select id into artwork_id from public.artworks
          where profile_id = target_user and legacy_submission_id is null
            and (image_url = item.image_url or
                 image_url like '%/' || target_user::text || '/legacy-' || item.id::text || '.jpg')
          order by created_at, id limit 1;
        if artwork_id is not null then
          update public.artworks set legacy_submission_id = item.id where id = artwork_id;
        else
          insert into public.artworks(profile_id, title, slug, image_url, legacy_submission_id, is_selected)
            values(target_user, 'Obra de ' || coalesce(item.name, 'artista'),
              'obra-' || item.id::text, item.image_url, item.id,
              not exists(select 1 from public.artworks where profile_id = target_user
                         and is_selected and archived_at is null));
          linked := linked + 1;
        end if;
      end if;
    end if;
  end loop;
  if exists(select 1 from public.artworks where profile_id = target_user and archived_at is null) then
    update public.profiles set onboarded_at = coalesce(onboarded_at, now()) where id = target_user;
    -- Archiving an old duplicate may have removed this artist's selection.
    if not exists(select 1 from public.artworks where profile_id = target_user
                  and archived_at is null and is_selected) then
      update public.artworks set is_selected = true where id = (
        select id from public.artworks where profile_id = target_user and archived_at is null
        order by created_at, id limit 1);
    end if;
  end if;
  return linked;
end;
$$;
revoke all on function public.link_registro_user(uuid) from public, anon, authenticated;
grant execute on function public.link_registro_user(uuid) to service_role;

create function public.link_registro_on_login() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null then
    perform public.link_registro_user(new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.link_registro_on_login() from public, anon, authenticated;
create trigger auth_link_registro
  after insert or update of email, email_confirmed_at, last_sign_in_at on auth.users
  for each row execute function public.link_registro_on_login();

-- Image retries complete the same link after an artist has registered.
create function public.link_registro_on_image() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.claimed_by is not null and new.archived_at is null and new.image_url is not null
     and new.image_url is distinct from old.image_url then
    perform public.link_registro_user(new.claimed_by);
  end if;
  return new;
end;
$$;
revoke all on function public.link_registro_on_image() from public, anon, authenticated;
create trigger legacy_link_image after update of image_url on public.legacy_submissions
  for each row execute function public.link_registro_on_image();

create function public.sync_curated_registro(entries jsonb, allow_large_archive boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  item record;
  existing_id uuid;
  old_owner uuid;
  total integer;
  active_before integer;
  removed integer;
  added integer := 0;
  linked integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('mundial-registro-sync', 0));
  if jsonb_typeof(entries) <> 'array' or jsonb_array_length(entries) = 0 then
    raise exception 'Refusing empty Registro';
  end if;
  total := jsonb_array_length(entries);
  if exists(select 1 from jsonb_to_recordset(entries) as e(email text, drive_url text)
            where email is null or email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'
              or drive_url is null or drive_url !~ '^https://drive\.google\.com/file/d/[A-Za-z0-9_-]+/view$')
    or (select count(distinct public.registro_drive_id(e.drive_url))
        from jsonb_to_recordset(entries) as e(drive_url text)) <> total then
    raise exception 'Invalid or duplicated Registro rows';
  end if;
  select count(*) into active_before from public.legacy_submissions where archived_at is null;
  select count(*) into removed from public.legacy_submissions ls where archived_at is null
    and not exists(select 1 from jsonb_to_recordset(entries) as e(drive_url text)
                   where public.registro_drive_id(e.drive_url) = public.registro_drive_id(ls.drive_url));
  if not allow_large_archive and removed > greatest(10, active_before * 0.2) then
    raise exception 'Large removal (% rows): review full source before applying', removed;
  end if;

  for item in select * from jsonb_to_recordset(entries)
    as e(name text, email text, drive_url text, country_raw text, country_code text)
  loop
    select id, claimed_by into existing_id, old_owner from public.legacy_submissions
      where public.registro_drive_id(drive_url) = public.registro_drive_id(item.drive_url);
    if old_owner is not null and not exists(select 1 from auth.users
      where id = old_owner and lower(trim(email)) = lower(trim(item.email))) then
      raise exception 'Email changed on an already linked artwork: %', existing_id;
    end if;
    if existing_id is null then
      insert into public.legacy_submissions(name, email, drive_url, country_raw, country_code)
        values(item.name, lower(trim(item.email)), item.drive_url, item.country_raw, item.country_code);
      added := added + 1;
    else
      update public.legacy_submissions set name = item.name, email = lower(trim(item.email)),
        country_raw = item.country_raw, country_code = item.country_code, archived_at = null
        where id = existing_id;
      update public.artworks set archived_at = null where legacy_submission_id = existing_id;
    end if;
    insert into public.contacts(email, name, source)
      values(lower(trim(item.email)), item.name, 'obra_email')
      on conflict(email) do nothing; -- Never re-subscribe someone who opted out.
  end loop;

  update public.legacy_submissions ls set archived_at = now()
    where archived_at is null and not exists(
      select 1 from jsonb_to_recordset(entries) as e(drive_url text)
      where public.registro_drive_id(e.drive_url) = public.registro_drive_id(ls.drive_url));
  update public.artworks a set archived_at = now(), is_selected = false
    where a.archived_at is null and exists(select 1 from public.legacy_submissions ls
      where ls.id = a.legacy_submission_id and ls.archived_at is not null);

  for item in select u.id from auth.users u where u.email_confirmed_at is not null
    and exists(select 1 from public.legacy_submissions ls
               where lower(trim(ls.email)) = lower(trim(u.email)) and ls.archived_at is null)
  loop
    linked := linked + public.link_registro_user(item.id);
  end loop;
  return jsonb_build_object('active', total, 'inserted', added, 'archived', removed, 'linked_artworks', linked);
end;
$$;
revoke all on function public.sync_curated_registro(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.sync_curated_registro(jsonb, boolean) to service_role;

create policy "legacy_submissions: owner reads linked"
  on public.legacy_submissions for select to authenticated
  using (claimed_by = auth.uid() and archived_at is null);

-- A submission is one curated sheet row, regardless of how many files
-- previously represented it. Count native uploads separately, once.
create or replace function public.get_total_submissions_count() returns integer
language sql security definer set search_path = '' stable as $$
  select count(*)::integer from public.legacy_submissions where archived_at is null
$$;
revoke all on function public.get_total_submissions_count() from public;
grant execute on function public.get_total_submissions_count() to anon, authenticated, service_role;
notify pgrst, 'reload schema';
