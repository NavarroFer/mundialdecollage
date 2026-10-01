-- Countdown to the call's deadline (lib/countdown-campaigns.ts): the daily
-- campaigns cron schedules three campaigns on its own — 15, 7 and 1 days
-- before site.deadlineISO — for the subscribed contacts who haven't taken
-- part yet. system_key marks each one so it's created only once, even if an
-- admin cancels it from /admin/campanas.
alter table public.campaigns
  add column if not exists system_key text;

create unique index if not exists campaigns_system_key_key
  on public.campaigns (system_key)
  where system_key is not null;

alter table public.campaigns drop constraint if exists campaigns_audience_check;
alter table public.campaigns add constraint campaigns_audience_check
  check (audience in ('subscribed', 'no_artwork', 'profile_review', 'not_participating'));

-- Every address that already takes part: an account that finished
-- /onboarding or has an obra, and every email that sent one through the
-- form/sheet before signing up (legacy_submissions). Only addresses — the
-- app subtracts them from the subscribed contacts (lib/campaign-audience.ts).
create or replace function public.participant_emails()
returns table (email text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select lower(trim(u.email))
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.email is not null
    and (
      p.onboarded_at is not null
      or exists (select 1 from public.artworks a where a.profile_id = u.id and a.archived_at is null)
    )
    and (public.is_admin() or auth.role() = 'service_role')
  union
  select lower(trim(l.email))
  from public.legacy_submissions l
  where l.email is not null
    and (public.is_admin() or auth.role() = 'service_role')
$$;

revoke all on function public.participant_emails() from public, anon;
grant execute on function public.participant_emails() to authenticated, service_role;

notify pgrst, 'reload schema';
