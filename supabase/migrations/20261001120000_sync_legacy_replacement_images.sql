-- A manually replaced legacy image must also replace the already-linked
-- artwork. The public gallery reads artworks.image_url, while the admin's
-- legacy upload control writes legacy_submissions.image_url.
create or replace function public.link_registro_on_image() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.claimed_by is not null and new.archived_at is null and new.image_url is not null
     and new.image_url is distinct from old.image_url then
    perform public.link_registro_user(new.claimed_by);

    update public.artworks
      set image_url = new.image_url
      where legacy_submission_id = new.id
        and archived_at is null
        and image_url is distinct from new.image_url;
  end if;
  return new;
end;
$$;
