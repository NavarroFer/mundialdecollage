-- get_total_submissions_count() (20260921090000_total_submissions_count.sql)
-- counted every artworks row plus every unclaimed legacy_submissions row —
-- i.e. every file anyone ever sent, including an artist's rejected/
-- unresolved resubmissions and the still-uncurated legacy backlog. That made
-- the public "N obras recibidas" banner (lib/submissions.ts) show a much
-- bigger number (315) than /admin/obras' "Recibidas" pill (157), which only
-- counts admin-curated obras: one is_selected artwork per complete profile,
-- plus legacy rows an admin has explicitly `promoted`. Two numbers that look
-- like they should match but measure different things confused whoever built
-- the marketing banner from the live site.
--
-- This redefines the RPC to mirror app/admin/obras/page.tsx's
-- realSubmissions + legacyGalleryItems exactly, so the public banner and the
-- admin pill always agree:
--   - one artworks row per profile_id, only when is_selected and both the
--     profile (name, country_code) and that artwork (title, image_url) are
--     complete — a bare/incomplete registration isn't a finished obra yet.
--   - a legacy_submissions row only when promoted and it has an image_url,
--     excluding any already claimed into a profile counted above (that obra
--     already has its own artworks row — counting both would double it).
create or replace function public.get_total_submissions_count()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select
    (
      select count(*)
      from public.artworks a
      join public.profiles p on p.id = a.profile_id
      where a.is_selected
        and p.name is not null
        and p.country_code is not null
        and a.title is not null
        and a.image_url is not null
    )::integer
    + (
      select count(*)
      from public.legacy_submissions ls
      where ls.promoted
        and ls.image_url is not null
        and not exists (
          select 1
          from public.artworks a2
          join public.profiles p2 on p2.id = a2.profile_id
          where a2.profile_id = ls.claimed_by
            and a2.is_selected
            and p2.name is not null
            and p2.country_code is not null
            and a2.title is not null
            and a2.image_url is not null
        )
    )::integer
$$;

notify pgrst, 'reload schema';
