-- Técnica for the obras imported from the sheet (legacy_submissions), the
-- same three fixed categories as artworks (public.artwork_technique). Set in
-- bulk from /admin/obras (setSubmissionsTechnique). An artwork linked later
-- from one of these rows (link_registro_user) inherits it.
alter table public.legacy_submissions
  add column if not exists technique public.artwork_technique;

create or replace function public.inherit_legacy_technique()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.technique is null and new.legacy_submission_id is not null then
    select l.technique into new.technique
    from public.legacy_submissions l
    where l.id = new.legacy_submission_id;
  end if;
  return new;
end;
$$;

drop trigger if exists inherit_legacy_technique on public.artworks;
create trigger inherit_legacy_technique
  before insert or update of legacy_submission_id on public.artworks
  for each row execute function public.inherit_legacy_technique();

notify pgrst, 'reload schema';
