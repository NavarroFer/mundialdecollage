-- app/taller/actions.ts checked capacity with a plain count-then-insert —
-- two people racing for the last spot could both pass the count before
-- either commits, overselling past the 20-cap. Move the real boundary into
-- a trigger: an advisory lock serializes concurrent registration attempts,
-- so the count each one sees is always up to date. The app-level check
-- stays too (fast "sold out" feedback without a round trip), but this is
-- what actually enforces it — same pattern as is_admin()/protect_profile_visibility.
create or replace function public.enforce_workshop_capacity()
returns trigger
language plpgsql
as $$
declare
  -- Keep in sync with site.workshop.capacity in lib/site.ts.
  capacity constant integer := 20;
  taken integer;
begin
  perform pg_advisory_xact_lock(hashtext('workshop_registrations_capacity'));

  select count(*) into taken
  from public.workshop_registrations
  where status in ('paid', 'pending');

  if taken >= capacity then
    raise exception 'workshop is full';
  end if;

  return new;
end;
$$;

create trigger workshop_registrations_enforce_capacity
  before insert on public.workshop_registrations
  for each row
  execute function public.enforce_workshop_capacity();
