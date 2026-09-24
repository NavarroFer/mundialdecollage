-- Registro's "Titulo" column (E) now reaches the site, and corrections made
-- in the sheet reach obras that are already published. Registro is filled by
-- scripts/apps-script/Registro.gs, which fixes names, countries and titles
-- it had extracted badly; until now those fixes stopped at
-- legacy_submissions and the public site kept the first version.
--
-- A correction only reaches what still holds the sheet's previous value:
-- an artwork title nobody edited ('Obra de …' or the previous sheet title),
-- and the name/country of an account the artist never signed in to (created
-- from the sheet by lib/publish-legacy.ts). Once the artist signs in, their
-- profile is theirs. A case-only change doesn't count, so the admin's
-- "Limpieza de nombres" isn't undone by the next sync.
alter table public.legacy_submissions add column if not exists title text;

create or replace function public.link_registro_user(target_user uuid) returns integer
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
            values(target_user,
              coalesce(nullif(trim(item.title), ''), 'Obra de ' || coalesce(item.name, 'artista')),
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

create or replace function public.sync_curated_registro(entries jsonb, allow_large_archive boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  item record;
  existing_id uuid;
  old_owner uuid;
  old_name text;
  old_code text;
  old_title text;
  new_title text;
  has_titles boolean;
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
  -- A snapshot read without the Titulo column must not wipe titles.
  has_titles := exists(select 1 from jsonb_array_elements(entries) e where e ? 'title');
  select count(*) into active_before from public.legacy_submissions where archived_at is null;
  select count(*) into removed from public.legacy_submissions ls where archived_at is null
    and not exists(select 1 from jsonb_to_recordset(entries) as e(drive_url text)
                   where public.registro_drive_id(e.drive_url) = public.registro_drive_id(ls.drive_url));
  if not allow_large_archive and removed > greatest(10, active_before * 0.2) then
    raise exception 'Large removal (% rows): review full source before applying', removed;
  end if;

  for item in select * from jsonb_to_recordset(entries)
    as e(name text, email text, drive_url text, country_raw text, country_code text, title text)
  loop
    select id, claimed_by, name, country_code, title
      into existing_id, old_owner, old_name, old_code, old_title
      from public.legacy_submissions
      where public.registro_drive_id(drive_url) = public.registro_drive_id(item.drive_url);
    if old_owner is not null and not exists(select 1 from auth.users
      where id = old_owner and lower(trim(email)) = lower(trim(item.email))) then
      raise exception 'Email changed on an already linked artwork: %', existing_id;
    end if;
    if existing_id is null then
      insert into public.legacy_submissions(name, email, drive_url, country_raw, country_code, title)
        values(item.name, lower(trim(item.email)), item.drive_url, item.country_raw, item.country_code,
               case when has_titles then nullif(trim(item.title), '') end);
      added := added + 1;
    else
      update public.legacy_submissions set name = item.name, email = lower(trim(item.email)),
        country_raw = item.country_raw, country_code = item.country_code,
        title = case when has_titles then nullif(trim(item.title), '') else title end,
        archived_at = null
        where id = existing_id;
      update public.artworks set archived_at = null where legacy_submission_id = existing_id;

      -- The sheet was corrected: update what still holds its previous value.
      new_title := coalesce(case when has_titles then nullif(trim(item.title), '') else old_title end,
                            'Obra de ' || coalesce(item.name, 'artista'));
      update public.artworks set title = new_title
        where legacy_submission_id = existing_id and title is distinct from new_title
          and title in (coalesce(old_title, 'Obra de ' || coalesce(old_name, 'artista')),
                        'Obra de ' || coalesce(old_name, 'artista'));
      if old_owner is not null and exists(select 1 from auth.users
          where id = old_owner and last_sign_in_at is null) then
        update public.profiles set name = item.name
          where id = old_owner and nullif(trim(item.name), '') is not null
            and lower(trim(name)) = lower(trim(old_name))
            and lower(trim(old_name)) <> lower(trim(item.name));
        update public.profiles set country_code = item.country_code
          where id = old_owner and item.country_code is not null
            and country_code is not distinct from old_code
            and old_code is distinct from item.country_code;
      end if;
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

notify pgrst, 'reload schema';
