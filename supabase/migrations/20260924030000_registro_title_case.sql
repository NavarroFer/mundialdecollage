-- An automatic "Obra de …" title can differ from the Registro name only in
-- capitalization (the admin's name cleanup, or an artwork made before the
-- sheet's casing changed). The sheet's title must still replace it, so the
-- comparison ignores case.
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
          and lower(title) in (lower(coalesce(old_title, 'Obra de ' || coalesce(old_name, 'artista'))),
                               lower('Obra de ' || coalesce(old_name, 'artista')));
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
