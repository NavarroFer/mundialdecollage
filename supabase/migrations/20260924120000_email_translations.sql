-- One template, many languages: `translations` holds, per locale, the
-- translated wording of each text in body_json (see lib/email-translation.ts)
-- — never a copy of the layout, so images and links stay single-sourced.
-- `translations_source` fingerprints the Spanish wording they were made
-- from; when it no longer matches, the translations are outdated.
alter table public.templates
  add column if not exists translations jsonb not null default '{}'::jsonb,
  add column if not exists translations_source text;

-- What a campaign actually sent in each language, and who got which one.
alter table public.campaigns
  add column if not exists translations jsonb not null default '{}'::jsonb;

alter table public.campaign_sends
  add column if not exists locale text;

-- Contacts don't store a country. The best evidence is the artist's own
-- profile (matched through their verified login email), then the country
-- Registro recorded for that address. Contacts with neither get Spanish.
create or replace function public.contact_country_codes()
returns table (contact_id uuid, country_code text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.id,
    coalesce(
      (
        select p.country_code
        from auth.users u
        join public.profiles p on p.id = u.id
        where lower(trim(u.email)) = c.email and p.country_code is not null
        limit 1
      ),
      (
        select ls.country_code
        from public.legacy_submissions ls
        where lower(trim(ls.email)) = c.email
          and ls.archived_at is null
          and ls.country_code is not null
        order by ls.selected desc, ls.created_at desc
        limit 1
      )
    )
  from public.contacts c
  where public.is_admin() or auth.role() = 'service_role'
$$;

revoke all on function public.contact_country_codes() from public, anon;
grant execute on function public.contact_country_codes() to authenticated, service_role;

notify pgrst, 'reload schema';
