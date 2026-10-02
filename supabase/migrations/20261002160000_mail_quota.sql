-- What each mail provider lets us send (lib/mail-quota.ts, /admin/envios),
-- so the app knows how much is left before Resend or Brevo starts rejecting
-- with a quota error. Neither API reports usage, so we count our own sends
-- in mail_usage; the *_offset columns are what the provider's dashboard
-- showed when an admin last synced the counter (sends the app doesn't see,
-- like Supabase Auth mail over SMTP, only show up that way).
create table if not exists public.mail_providers (
  provider text primary key check (provider in ('resend', 'brevo')),
  plan text,
  daily_limit integer check (daily_limit > 0),
  monthly_limit integer check (monthly_limit > 0),
  -- Day of the month (UTC) the monthly quota starts over.
  cycle_day smallint not null default 1 check (cycle_day between 1 and 28),
  used_today_offset integer not null default 0 check (used_today_offset >= 0),
  used_cycle_offset integer not null default 0 check (used_cycle_offset >= 0),
  offset_at timestamptz,
  updated_at timestamptz not null default now()
);

-- One row per accepted send call: `sent` is how many addresses it went to.
create table if not exists public.mail_usage (
  id bigint generated always as identity primary key,
  provider text not null references public.mail_providers (provider),
  sent integer not null check (sent > 0),
  sent_at timestamptz not null default now()
);

create index if not exists mail_usage_provider_sent_at on public.mail_usage (provider, sent_at);

alter table public.mail_providers enable row level security;
alter table public.mail_usage enable row level security;
create policy "mail_providers: admin read" on public.mail_providers for select using (public.is_admin());
create policy "mail_usage: admin read" on public.mail_usage for select using (public.is_admin());
revoke all on public.mail_providers, public.mail_usage from anon;
grant select on public.mail_providers, public.mail_usage to authenticated;
grant select, insert, update, delete on public.mail_providers, public.mail_usage to service_role;

-- Both on the Free plan as of 2026-10-02, with what their dashboards showed.
insert into public.mail_providers (provider, plan, daily_limit, monthly_limit, cycle_day, used_today_offset, used_cycle_offset, offset_at)
values
  ('resend', 'Free', 100, 3000, 1, 2, 778, now()),
  ('brevo', 'Free', 300, null, 1, 0, 0, now())
on conflict (provider) do nothing;

notify pgrst, 'reload schema';
