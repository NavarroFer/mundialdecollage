-- Contacts represent email addresses collected across every source. Enforce
-- one normalized address while preserving historical rows and opt-outs.
do $$
begin
  if exists (
    select 1 from public.contacts
    group by lower(trim(email)) having count(*) > 1
  ) then
    raise exception 'Normalize contacts before adding the canonical email index';
  end if;
end $$;

update public.contacts set email = lower(trim(email))
where email is distinct from lower(trim(email));

create unique index if not exists contacts_normalized_email_key
  on public.contacts (lower(trim(email)));

create or replace function public.normalize_contact_email()
returns trigger language plpgsql set search_path = '' as $$
declare
  local_part text;
begin
  new.email := lower(trim(new.email));
  local_part := split_part(new.email, '@', 1);
  if new.email = 'mundialdecollage@gmail.com'
     or local_part ~ '(^|[-_.])(no-?reply|noreply|mailer-daemon|postmaster)([-_.]|$)' then
    new.subscribed := false;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_contact_email on public.contacts;
create trigger normalize_contact_email
  before insert or update of email, subscribed on public.contacts
  for each row execute function public.normalize_contact_email();

update public.contacts set subscribed = false
where email = 'mundialdecollage@gmail.com'
   or split_part(email, '@', 1) ~ '(^|[-_.])(no-?reply|noreply|mailer-daemon|postmaster)([-_.]|$)';

notify pgrst, 'reload schema';
