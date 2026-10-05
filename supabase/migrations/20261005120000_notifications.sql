-- The bell in the header (components/notifications): in-site notifications
-- with read/unread state, for signed-in visitors and for the admins.
--
-- One row per recipient. Admins get their own rows (flagged `admin`) so each
-- of them reads at their own pace. Rows are written only by the database:
-- triggers on the tables where things happen call the helpers below
-- (20261005121000_admin_notifications.sql, 20261005122000_user_notifications.sql),
-- so no code path that changes those tables can forget to notify. The app
-- only reads rows and marks them read.
--
-- Texts aren't stored: `type` + `data` are rendered in the reader's language
-- by lib/notifications/registry.ts, which must know every type written.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  -- Shown under the bell's «Admin» filter.
  admin boolean not null default false,
  -- One live row per (user_id, dedupe_key): a grouped notice ("5 comentarios
  -- pendientes", "3 me gusta hoy") is updated in place instead of piling up.
  dedupe_key text not null default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  -- Last time it changed: what the bell sorts and dates by.
  updated_at timestamptz not null default now(),
  constraint notifications_user_dedupe_key unique (user_id, dedupe_key)
);

create index if not exists notifications_user_updated_idx on public.notifications (user_id, updated_at desc, id desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

-- Everyone reads their own and can only flip read_at (column grant below):
-- the browser marks them read directly, with no server round trip.
create policy "notifications: owner read" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications: owner mark read" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, update, delete on public.notifications to service_role;

-- ---------------------------------------------------------------------------
-- Helpers. Security definer and not callable by visitors (revoked below):
-- only the notification triggers use them.

-- Who gets the admin notices. Keep in sync with is_admin() and lib/admin.ts.
create or replace function public.admin_user_ids()
returns setof uuid
language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u
  where lower(u.email) = any (array['mundialdecollage@gmail.com', 'fernando.navarro.mdp@gmail.com'])
$$;

-- Creates a notice, or refreshes the one with the same key. `resurface`
-- false updates it quietly (e.g. a campaign retry that fixed some sends):
-- it keeps its read state and its place in the list.
create or replace function public.notify_user(
  recipient uuid, kind text, payload jsonb, key text default null, for_admin boolean default false, resurface boolean default true
) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications as n (user_id, type, admin, dedupe_key, data)
  values (recipient, kind, for_admin, coalesce(key, gen_random_uuid()::text), payload)
  on conflict (user_id, dedupe_key) do update
    set type = excluded.type,
        data = excluded.data,
        read_at = case when resurface then null else n.read_at end,
        updated_at = case when resurface then now() else n.updated_at end
$$;

create or replace function public.notify_admins(kind text, payload jsonb, key text, resurface boolean default true)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  admin_id uuid;
begin
  for admin_id in select * from public.admin_user_ids() loop
    perform public.notify_user(admin_id, kind, payload, key, true, resurface);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Housekeeping, from the daily cron (app/api/cron/exhibition): read notices
-- after 90 days, anything after 180 (artists who never sign in).
create or replace function public.prune_notifications()
returns integer
language sql security definer set search_path = '' as $$
  with gone as (
    delete from public.notifications
    where (read_at is not null and updated_at < now() - interval '90 days')
       or updated_at < now() - interval '180 days'
    returning 1
  )
  select count(*)::integer from gone
$$;

revoke all on function public.admin_user_ids() from public, anon, authenticated;
revoke all on function public.notify_user(uuid, text, jsonb, text, boolean, boolean) from public, anon, authenticated;
revoke all on function public.notify_admins(text, jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.prune_notifications() from public, anon, authenticated;
grant execute on function public.prune_notifications() to service_role;

notify pgrst, 'reload schema';
