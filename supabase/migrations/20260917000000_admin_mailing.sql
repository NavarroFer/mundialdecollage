-- Admin-only mailing system: contacts (the mailing list), templates (reusable
-- email bodies), campaigns (a composed send), and campaign_sends (per-recipient
-- log, so we know who got what and can see failures). Single-admin site today —
-- is_admin() is the one place that decides who that is.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select auth.jwt() ->> 'email' = 'fernavarro2607@gmail.com'
$$;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  source text not null default 'manual',
  subscribed boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  body_html text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.templates (id) on delete set null,
  subject text not null,
  body_html text not null,
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed')),
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.contacts enable row level security;
alter table public.templates enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_sends enable row level security;

create policy "contacts: admin only" on public.contacts
  for all using (public.is_admin()) with check (public.is_admin());

create policy "templates: admin only" on public.templates
  for all using (public.is_admin()) with check (public.is_admin());

create policy "campaigns: admin only" on public.campaigns
  for all using (public.is_admin()) with check (public.is_admin());

create policy "campaign_sends: admin only" on public.campaign_sends
  for all using (public.is_admin()) with check (public.is_admin());
