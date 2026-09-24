-- Some artists' published artwork had lost its Registro row: the row was
-- deleted after the same obra came back in the sheet with another Drive file
-- (or the artist uploaded it on the site), so link_registro_user found no
-- artwork for the new row and published a copy on every sync. Deleting the
-- copy didn't help: the next sync made it again.
--
-- link_registro_user now links that orphaned artwork instead, but only when
-- it's unambiguous: the artist's only artwork without a row, and the only
-- row without an artwork. Anything else still gets its own artwork.
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

-- The 12 copies the 2026-09-24 sync made. Fer confirmed each is the same
-- obra as the artist's orphaned artwork (8 are pixel-identical; 4 are the
-- same image re-encoded). None was public or had likes. The original keeps
-- its image and whatever title someone gave it; an automatic "Obra de …"
-- title takes the sheet's title.
with copias(copia, original, fila) as (values
  ('08e0b898-4d79-43e5-87df-922b4a99bd0f'::uuid, '7cdb15cc-c2fa-4954-86b8-5e716794dd88'::uuid, '1337a7b3-ba79-41df-8529-4980102aca2e'::uuid),
  ('0cad8da1-532b-463a-ac8a-c27c27fd0c38'::uuid, 'c436a66f-074b-4426-9b85-fd838d3005e0'::uuid, '15856ee3-94ab-43eb-a189-34a219976d43'::uuid),
  ('344a9c37-cfb6-4455-83af-470f98db997e'::uuid, '18542a3f-7be7-4cac-81e4-5b43aa91e01e'::uuid, '22d3d741-1e64-476c-b7d8-106a324e33b5'::uuid),
  ('47fc241f-537c-4293-972e-6dd707387fb6'::uuid, '8b0855f7-c861-4601-a45b-be211e362f32'::uuid, '17e20f6d-1b4f-4839-9810-f3da3f2841f7'::uuid),
  ('558177b2-459d-4003-b1db-15128f853c4c'::uuid, '7c932616-5f86-4a29-9cf4-cfc8ba29dc28'::uuid, '5fe4bd80-aef0-4d2c-80fc-4c29c8480144'::uuid),
  ('99b70818-4d29-462a-aa44-3c3cb19ded92'::uuid, 'f677cf31-94f4-4356-b76e-193581b86630'::uuid, '6aa059a6-5424-41a1-8f12-24fcd369465f'::uuid),
  ('a46e35e2-b551-497a-a897-28c68fae9d85'::uuid, 'ff7a9b91-39d4-4a3d-a611-e4f7725b3818'::uuid, '36691e5e-ed68-4065-b71c-fb3cc807530f'::uuid),
  ('c807c385-4696-4c8f-95e4-42aa27164396'::uuid, '68646e8b-1331-4064-8447-60dce16e86ba'::uuid, 'e75ce3ae-0b67-49a6-b1e2-af4982c8cc5a'::uuid),
  ('caebcd56-d15b-42c0-9de7-b0a3b68526fb'::uuid, '31e59f8e-50ff-43b2-b71e-e819d7248779'::uuid, '5f532053-8add-4b26-be1c-0d211ea48579'::uuid),
  ('dc26df96-53d7-4793-9701-e6e5aed80ccc'::uuid, 'd5505083-547c-41ba-89e8-c342a998da5d'::uuid, '44ad6304-c723-466f-9887-43903c4dd7f4'::uuid),
  ('df08a3a5-fe0b-466b-a4cf-d465cf7a1a96'::uuid, 'ef71da9f-43de-4d25-ae66-398732fc3b5c'::uuid, '64b255d6-58c5-444e-b128-abef5f75703f'::uuid),
  ('f11b6cb8-a183-4244-9363-893aa9c50c55'::uuid, '01832fbb-4ba7-4cef-a8a6-67aa82c1d324'::uuid, '82653298-49fe-493c-b344-fe7864411bc5'::uuid))
delete from public.artworks a using copias c
  where a.id = c.copia and a.legacy_submission_id = c.fila and not a.is_selected;

with copias(copia, original, fila) as (values
  ('08e0b898-4d79-43e5-87df-922b4a99bd0f'::uuid, '7cdb15cc-c2fa-4954-86b8-5e716794dd88'::uuid, '1337a7b3-ba79-41df-8529-4980102aca2e'::uuid),
  ('0cad8da1-532b-463a-ac8a-c27c27fd0c38'::uuid, 'c436a66f-074b-4426-9b85-fd838d3005e0'::uuid, '15856ee3-94ab-43eb-a189-34a219976d43'::uuid),
  ('344a9c37-cfb6-4455-83af-470f98db997e'::uuid, '18542a3f-7be7-4cac-81e4-5b43aa91e01e'::uuid, '22d3d741-1e64-476c-b7d8-106a324e33b5'::uuid),
  ('47fc241f-537c-4293-972e-6dd707387fb6'::uuid, '8b0855f7-c861-4601-a45b-be211e362f32'::uuid, '17e20f6d-1b4f-4839-9810-f3da3f2841f7'::uuid),
  ('558177b2-459d-4003-b1db-15128f853c4c'::uuid, '7c932616-5f86-4a29-9cf4-cfc8ba29dc28'::uuid, '5fe4bd80-aef0-4d2c-80fc-4c29c8480144'::uuid),
  ('99b70818-4d29-462a-aa44-3c3cb19ded92'::uuid, 'f677cf31-94f4-4356-b76e-193581b86630'::uuid, '6aa059a6-5424-41a1-8f12-24fcd369465f'::uuid),
  ('a46e35e2-b551-497a-a897-28c68fae9d85'::uuid, 'ff7a9b91-39d4-4a3d-a611-e4f7725b3818'::uuid, '36691e5e-ed68-4065-b71c-fb3cc807530f'::uuid),
  ('c807c385-4696-4c8f-95e4-42aa27164396'::uuid, '68646e8b-1331-4064-8447-60dce16e86ba'::uuid, 'e75ce3ae-0b67-49a6-b1e2-af4982c8cc5a'::uuid),
  ('caebcd56-d15b-42c0-9de7-b0a3b68526fb'::uuid, '31e59f8e-50ff-43b2-b71e-e819d7248779'::uuid, '5f532053-8add-4b26-be1c-0d211ea48579'::uuid),
  ('dc26df96-53d7-4793-9701-e6e5aed80ccc'::uuid, 'd5505083-547c-41ba-89e8-c342a998da5d'::uuid, '44ad6304-c723-466f-9887-43903c4dd7f4'::uuid),
  ('df08a3a5-fe0b-466b-a4cf-d465cf7a1a96'::uuid, 'ef71da9f-43de-4d25-ae66-398732fc3b5c'::uuid, '64b255d6-58c5-444e-b128-abef5f75703f'::uuid),
  ('f11b6cb8-a183-4244-9363-893aa9c50c55'::uuid, '01832fbb-4ba7-4cef-a8a6-67aa82c1d324'::uuid, '82653298-49fe-493c-b344-fe7864411bc5'::uuid))
update public.artworks a set legacy_submission_id = c.fila,
    title = case when a.title like 'Obra de %' then coalesce(nullif(trim(ls.title), ''), a.title) else a.title end
  from copias c, public.legacy_submissions ls
  where a.id = c.original and ls.id = c.fila and a.legacy_submission_id is null
    and not exists(select 1 from public.artworks o where o.legacy_submission_id = c.fila);

notify pgrst, 'reload schema';
