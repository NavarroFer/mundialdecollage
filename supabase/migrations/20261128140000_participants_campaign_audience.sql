-- «Todos los que mandaron obra»: every subscribed contact who has taken part,
-- on the site (Google login + /onboarding) or by mail / the registration
-- form without ever creating an account — the registro sync already adds
-- those to contacts (source 'obra_email'). The list is participant_emails()
-- (20261001130000_countdown_campaigns.sql), worked out in
-- lib/campaign-audience.ts; only the audience value is new here.

alter table public.campaigns drop constraint if exists campaigns_audience_check;
alter table public.campaigns add constraint campaigns_audience_check
  check (audience in ('subscribed', 'no_artwork', 'profile_review', 'not_participating', 'multiple_artworks', 'club_prospects', 'public_profiles', 'certificates', 'participants'));
