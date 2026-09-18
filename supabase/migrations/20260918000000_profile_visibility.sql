-- Submissions stay saved as soon as they arrive but aren't shown anywhere
-- public until an admin explicitly publishes them ("estas participan") from
-- /admin/obras. Existing submissions (as of this migration) are grandfathered
-- in as public so the live site doesn't lose anything already on display;
-- everything submitted from here on defaults to unpublished.
alter table public.profiles
  add column if not exists is_public boolean not null default false;

update public.profiles
  set is_public = true
  where onboarded_at is not null;

-- RLS row-ownership policies alone don't protect a single column: "users
-- update own" below only checks *whose* row is being touched, not *what*
-- changed, so without this trigger a user could set is_public on their own
-- row directly (e.g. via a raw REST call), bypassing moderation entirely.
-- This is the actual boundary — it silently resets is_public back to its
-- previous value (or false on insert) whenever the actor isn't an admin.
create or replace function public.protect_profile_visibility()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_public := false;
  elsif new.is_public is distinct from old.is_public then
    new.is_public := old.is_public;
  end if;

  return new;
end;
$$;

create trigger profiles_protect_visibility
  before insert or update on public.profiles
  for each row
  execute function public.protect_profile_visibility();

-- Public pages (directory, mapa, /obras) now only see published submissions.
drop policy if exists "profiles: public read submitted" on public.profiles;
create policy "profiles: public read published"
  on public.profiles for select
  using (is_public = true);

-- Admins moderate from /admin/obras — need to see and update every
-- submission, not just their own (or just the published ones).
create policy "profiles: admin read all"
  on public.profiles for select
  using (public.is_admin());

create policy "profiles: admin update all"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());
