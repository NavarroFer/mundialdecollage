-- One switch for Comunidad's moderation labels. Admins read and update it
-- (is_admin()); the server uses the service role after the same email check.
-- Visitors cannot see or change it. Applying this file again does not turn
-- the switch back on.

create table if not exists public.community_settings (
  id boolean primary key default true check (id),
  ai_moderation boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.community_settings (id, ai_moderation)
values (true, true)
on conflict (id) do nothing;

alter table public.community_settings enable row level security;

drop policy if exists "community_settings: admin read" on public.community_settings;
create policy "community_settings: admin read" on public.community_settings
  for select using (public.is_admin());

drop policy if exists "community_settings: admin update" on public.community_settings;
create policy "community_settings: admin update" on public.community_settings
  for update using (public.is_admin()) with check (public.is_admin());

revoke all on public.community_settings from public, anon, authenticated;
grant select, update on public.community_settings to authenticated;
grant select, insert, update on public.community_settings to service_role;

notify pgrst, 'reload schema';
