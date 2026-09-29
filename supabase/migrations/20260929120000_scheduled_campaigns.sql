-- Campaigns can be scheduled for a day instead of going out right away. The
-- daily cron (/api/cron/campanas, 09:10 Argentina) sends every 'scheduled'
-- campaign whose scheduled_for is today or earlier; the audience is worked
-- out then, so unsubscribes and new contacts since scheduling are respected.
-- Translations are done when it's scheduled and stored in `translations`.
alter table public.campaigns
  add column if not exists scheduled_for date;

alter table public.campaigns drop constraint if exists campaigns_status_check;
alter table public.campaigns add constraint campaigns_status_check
  check (status in ('draft', 'scheduled', 'canceled', 'sending', 'sent', 'failed'));

alter table public.campaigns drop constraint if exists campaigns_scheduled_for_check;
alter table public.campaigns add constraint campaigns_scheduled_for_check
  check (status <> 'scheduled' or scheduled_for is not null);

create index if not exists campaigns_scheduled_idx
  on public.campaigns (scheduled_for)
  where status = 'scheduled';

notify pgrst, 'reload schema';
