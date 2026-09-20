-- Fer decided (chat 2026-09-20/21) to flip the moderation model: instead of
-- nothing going public until an admin explicitly reviews it, show
-- everything as it comes in and moderate after the fact ("por ahora
-- mostramos todo, y vamos moderando mientras suben, total ya las curamos").
-- Two parts:

-- 1) Legacy backlog (supabase/migrations/20260919000000_legacy_submissions.
-- sql): resolve every still-unclaimed email group's pick in one shot instead
-- of the admin clicking "elegir obra" + "promover" once per artist. Fer's
-- rule for someone who sent more than one obra under the same email: the
-- most recently submitted one wins (`created_at desc`) — same as how a
-- resubmission is normally read, a later version meant to replace the
-- earlier one. This is exactly what selectLegacySubmission/
-- promoteLegacySubmission (app/admin/obras/actions.ts) already do per row;
-- nothing here is final — an admin can still switch a group's pick anytime
-- via "Usar esta obra" in /admin/obras, same as if they'd clicked it by hand.
update public.legacy_submissions
set selected = false, promoted = false
where claimed_by is null and (selected or promoted);

with latest_per_email as (
  select distinct on (email) id
  from public.legacy_submissions
  where claimed_by is null
  order by email, created_at desc
)
update public.legacy_submissions ls
set selected = true, promoted = true
from latest_per_email l
where ls.id = l.id;

-- This only resolves *which* obra counts per artist — it doesn't publish
-- anything on its own. Actually provisioning real accounts for the newly-
-- promoted rows still has to go through provisionLegacyProfiles (creates a
-- real auth user + profiles + artworks row per artist), which needs the
-- Supabase Admin Auth API, not plain SQL — a migration faking auth.users
-- rows directly would risk breaking Google-login auto-linking later. That
-- part happens from /admin/obras itself ("Seleccionar las N visibles" →
-- "Estas participan"), same one-click bulk action already built for this.

-- 2) Real registrations (supabase/migrations/20260918000000_profile_
-- visibility.sql): is_public used to default to false on every new
-- onboarding and stay that way until an admin flipped it — that's the
-- opt-in model being retired. New submissions from now on default to
-- public; an admin still moderates by hiding ("Ocultar") anything that
-- shouldn't be there, same tools as before, just after the fact instead of
-- before.
alter table public.profiles alter column is_public set default true;

create or replace function public.protect_profile_visibility()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_public := true;
  elsif new.is_public is distinct from old.is_public then
    new.is_public := old.is_public;
  end if;

  return new;
end;
$$;

-- Backfill: publish every already-onboarded profile that isn't public yet.
-- Same trigger boundary as provisionLegacyProfiles hits (is_admin() reads
-- auth.jwt(), which is empty outside a real PostgREST request, so a plain
-- UPDATE here would get silently reset by the trigger) — disabling it for
-- this one statement is the migration-time equivalent of doing this as the
-- actual admin, which is what the trigger's own "if is_admin() return new"
-- branch would do for a real session anyway.
alter table public.profiles disable trigger profiles_protect_visibility;

update public.profiles
set is_public = true
where onboarded_at is not null and is_public = false;

alter table public.profiles enable trigger profiles_protect_visibility;

notify pgrst, 'reload schema';
