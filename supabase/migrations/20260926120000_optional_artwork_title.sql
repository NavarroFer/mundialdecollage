-- An obra can have no title. Instead of inventing "Obra de <nombre>" when
-- Registro has none, the title stays empty and the site shows "Sin datos"
-- until the artist writes it from /onboarding (confirmArtistDetails).
alter table public.artworks alter column title drop not null;

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

  insert into public.profiles(id, name, country_code, instagram)
    values(target_user, chosen.name, chosen.country_code,
           'https://instagram.com/' || nullif(trim(chosen.instagram), ''))
    on conflict (id) do update set
      name = coalesce(nullif(public.profiles.name, ''), excluded.name),
      country_code = coalesce(public.profiles.country_code, excluded.country_code),
      instagram = coalesce(nullif(public.profiles.instagram, ''), excluded.instagram);

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
        -- The artist's only artwork that no row claims (made from an earlier
        -- Drive file of this obra, or uploaded by the artist) is this row's
        -- obra when this is also their only row without an artwork. Linking
        -- it keeps every sync from publishing a copy.
        if artwork_id is null
           and (select count(*) from public.legacy_submissions ls
                where lower(trim(ls.email)) = verified_email and ls.archived_at is null
                  and ls.image_url is not null and (ls.claimed_by is null or ls.claimed_by = target_user)
                  and not exists(select 1 from public.artworks aw where aw.legacy_submission_id = ls.id)) = 1
           and (select count(*) from public.artworks
                where profile_id = target_user and legacy_submission_id is null
                  and archived_at is null and duplicate_of is null) = 1 then
          select id into artwork_id from public.artworks
            where profile_id = target_user and legacy_submission_id is null
              and archived_at is null and duplicate_of is null;
        end if;
        if artwork_id is not null then
          update public.artworks set legacy_submission_id = item.id where id = artwork_id;
        else
          insert into public.artworks(profile_id, title, slug, image_url, legacy_submission_id, is_selected)
            values(target_user,
              nullif(trim(item.title), ''),
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
  old_instagram text;
  new_title text;
  has_titles boolean;
  has_instagram boolean;
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
  has_instagram := exists(select 1 from jsonb_array_elements(entries) e where e ? 'instagram');
  select count(*) into active_before from public.legacy_submissions where archived_at is null;
  select count(*) into removed from public.legacy_submissions ls where archived_at is null
    and not exists(select 1 from jsonb_to_recordset(entries) as e(drive_url text)
                   where public.registro_drive_id(e.drive_url) = public.registro_drive_id(ls.drive_url));
  if not allow_large_archive and removed > greatest(10, active_before * 0.2) then
    raise exception 'Large removal (% rows): review full source before applying', removed;
  end if;

  for item in select * from jsonb_to_recordset(entries)
    as e(name text, email text, drive_url text, country_raw text, country_code text, title text, instagram text)
  loop
    select id, claimed_by, name, country_code, title, instagram
      into existing_id, old_owner, old_name, old_code, old_title, old_instagram
      from public.legacy_submissions
      where public.registro_drive_id(drive_url) = public.registro_drive_id(item.drive_url);
    if old_owner is not null and not exists(select 1 from auth.users
      where id = old_owner and lower(trim(email)) = lower(trim(item.email))) then
      raise exception 'Email changed on an already linked artwork: %', existing_id;
    end if;
    if existing_id is null then
      insert into public.legacy_submissions(name, email, drive_url, country_raw, country_code, title, instagram)
        values(item.name, lower(trim(item.email)), item.drive_url, item.country_raw, item.country_code,
               case when has_titles then nullif(trim(item.title), '') end,
               case when has_instagram then nullif(trim(item.instagram), '') end);
      added := added + 1;
    else
      update public.legacy_submissions set name = item.name, email = lower(trim(item.email)),
        country_raw = item.country_raw, country_code = item.country_code,
        title = case when has_titles then nullif(trim(item.title), '') else title end,
        instagram = case when has_instagram then nullif(trim(item.instagram), '') else instagram end,
        archived_at = null
        where id = existing_id;
      update public.artworks set archived_at = null where legacy_submission_id = existing_id;

      -- The sheet was corrected: update what still holds its previous value,
      -- or an empty title once the sheet brings a new one. An empty title
      -- whose sheet value didn't change stays empty: it was cleared because
      -- that value was wrong, and the artist fills it in from /onboarding.
      new_title := case when has_titles then nullif(trim(item.title), '') else old_title end;
      update public.artworks set title = new_title
        where legacy_submission_id = existing_id and title is distinct from new_title
          and ((title is null and new_title is distinct from old_title)
               or lower(title) in (lower(old_title), lower('Obra de ' || coalesce(old_name, 'artista'))));
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
      -- Instagram fills an empty profile, and follows the sheet while the
      -- profile still shows the sheet's previous handle and the artist never
      -- signed in. One the artist set themselves is never replaced.
      if old_owner is not null and has_instagram and nullif(trim(item.instagram), '') is not null then
        update public.profiles set instagram = 'https://instagram.com/' || trim(item.instagram)
          where id = old_owner
            and lower(coalesce(instagram, '')) <> lower('https://instagram.com/' || trim(item.instagram))
            and (nullif(trim(instagram), '') is null
                 or (lower(instagram) = lower('https://instagram.com/' || coalesce(old_instagram, ''))
                     and exists(select 1 from auth.users where id = old_owner and last_sign_in_at is null)));
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


-- Titles Registro already has right, still hidden behind an old automatic
-- "Obra de …" built from a messy name (the sync only replaces a title that
-- matches the current name).
update public.artworks a set title = fix.title
from (values
  ('5ad7d539-3465-46ea-b364-7a1cd64f88f0'::uuid, 'sexy vênus'),
  ('a82c7798-cf04-41bb-bc92-3ae35149936e'::uuid, 'Desfragmentación'),
  ('67417e7c-d9ac-4f45-85ec-663d90fe9dac'::uuid, 'Traición A Sangre'),
  ('2395a5eb-3f38-47dc-b2d5-bea05bf1f9d3'::uuid, 'mujer sanadora'),
  ('6986fa07-c064-431f-bb9a-6ab6d6be45ce'::uuid, 'Encajando'),
  ('18681da0-4735-412d-9401-d4f1cbec549a'::uuid, 'Jugada celestial'),
  ('7afeebd2-7e85-42bc-89ac-53af0692cfbb'::uuid, 'Jeroglíficos'),
  ('291ef051-93b6-4f19-8427-387444271a71'::uuid, 'Metamorfosis'),
  ('36833a54-2e2c-45eb-9ea6-77b3be855a49'::uuid, 'Vivir es esforzarse'),
  ('2b9d21b2-cf0e-4f41-b9e1-cf70ea46f465'::uuid, 'Río de Lectura'),
  ('c8339e6b-53d0-442f-9655-d6d7eed78342'::uuid, 'Jazz In Blue'),
  ('6438ee60-6745-4eee-a0ce-f7b8868d6cd9'::uuid, 'Electric Gaze'),
  ('c1de8a79-b25d-4657-8c6f-7fab48093415'::uuid, 'sin travestis no hay paraíso'),
  ('b18c04b0-b38a-496d-9a0e-241c287d5c51'::uuid, 'Woman in Love'),
  ('6fa77232-f984-4728-8d0f-b730872b642f'::uuid, 'Divina repetición'),
  ('3831be50-b2d7-4883-9786-846d5635a83c'::uuid, 'Sueños de Saturno'),
  ('f019e6c5-dad6-44b3-8e38-935851d79616'::uuid, 'Casitas in love'),
  ('e0d0c83b-1e1e-47ed-9e3a-4ef833722e92'::uuid, 'Edificios azules')
) as fix(id, title)
where a.id = fix.id and a.title like 'Obra de %';

-- Every other automatic title, and two that hold the province or the
-- technique instead of a title, become empty.
update public.artworks set title = null
where title like 'Obra de %'
   or title in ('provincia: Entre Ríos', 'obra - MISTA ( ACRILICO, SPRAY,CANETA, PAPEL, PASTEL, TECIDO)');

-- Names the import filled with the e-mail's leftovers. Only for artists who
-- haven't confirmed their details: a name they chose themselves stays.
update public.profiles p set name = fix.name
from (values
  ('*Omar Moreno*', 'Omar Moreno'),
  ('Marie Ainmé Laveau Vidal Vargas /Docente', 'Marie Ainmé Laveau Vidal Vargas'),
  ('De la Obra: Casitas In Love', 'María Siquot Ferre'),
  ('Valeria Paulina Ballesteros Lara y Soy de Ecuador', 'Valeria Paulina Ballesteros Lara'),
  ('Ismael (Guayabo.png)', 'Ismael'),
  ('Melisa Andrea González.', 'Melisa Andrea González')
) as fix(old_name, name)
where p.name = fix.old_name and p.details_confirmed_at is null;

notify pgrst, 'reload schema';
