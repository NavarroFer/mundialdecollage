-- Campaigns can go to every subscribed contact (as before) or only to the
-- ones who signed in with Google but never sent their obra — mostly people
-- who liked or commented in the Galería 3D. See lib/campaign-audience.ts.
alter table public.campaigns
  add column if not exists audience text not null default 'subscribed';

alter table public.campaigns drop constraint if exists campaigns_audience_check;
alter table public.campaigns add constraint campaigns_audience_check
  check (audience in ('subscribed', 'no_artwork'));

-- Login addresses of the accounts that haven't finished /onboarding: no
-- profile, or one without onboarded_at, and no obra of their own (an artist
-- linked from Registro gets onboarded_at set, this is only a safety net).
-- Only addresses — the app matches them to subscribed `contacts` and leaves
-- admins out (lib/campaign-audience.ts), so unsubscribes are respected.
create or replace function public.accounts_without_artwork_emails()
returns table (email text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct lower(trim(u.email))
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.email is not null
    and p.onboarded_at is null
    and not exists (
      select 1 from public.artworks a
      where a.profile_id = u.id and a.archived_at is null
    )
    and (public.is_admin() or auth.role() = 'service_role')
$$;

revoke all on function public.accounts_without_artwork_emails() from public, anon;
grant execute on function public.accounts_without_artwork_emails() to authenticated, service_role;

notify pgrst, 'reload schema';
