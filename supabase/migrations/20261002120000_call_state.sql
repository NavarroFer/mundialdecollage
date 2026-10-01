-- Whether the 1st edition's call for obras is still open. Closed from
-- /admin/convocatoria («Finalizar convocatoria») rather than by date, since
-- the date can move; site.deadlineISO is only what the site announces.
-- One row. Everyone can read it (the public pages change once it closes);
-- only the service role writes it, after checking for an admin.
create table if not exists public.call_state (
  id boolean primary key default true check (id),
  closed_at timestamptz,
  closed_by text,
  updated_at timestamptz not null default now()
);

insert into public.call_state (id) values (true) on conflict (id) do nothing;

alter table public.call_state enable row level security;
create policy "call_state: public read" on public.call_state for select using (true);
grant select on public.call_state to anon, authenticated;
grant select, insert, update on public.call_state to service_role;

notify pgrst, 'reload schema';
