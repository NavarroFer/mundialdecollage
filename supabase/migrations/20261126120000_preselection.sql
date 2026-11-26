-- Preselection (/admin/preseleccion): the organizers narrow every entered
-- obra down to the 50–60 the jury scores, in passes over a mosaic. Each pass
-- is kept here, apart from artworks.review_status: «Preseleccionada» is what
-- /jurado shows at once, so only the last step («Enviar al jurado»,
-- preselection_send below) writes it.
--
-- A slot is one place in the pool: an artist's obra (or, for an artist who
-- paid for more entries, each entered obra). Its key is the obra that fills it
-- by default, "artwork:<id>" or "legacy:<id>", the same keys jury_scores uses.
-- stage 1 and 2 are the passes, seen in batches; stage 3 is the final table.
create table if not exists public.preselection_marks (
  stage smallint not null check (stage between 1 and 3),
  slot_key text not null check (slot_key ~ '^(artwork|legacy):[0-9a-f-]{36}$'),
  picked boolean not null default false,
  -- The batch it was seen in; null while its batch is still open on screen.
  batch integer check (batch > 0),
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (stage, slot_key)
);

create index if not exists preselection_marks_batch on public.preselection_marks (stage, batch);

-- An artist with several obras who never chose one: the obra the organizers
-- picked to fill the slot instead of the default.
create table if not exists public.preselection_choices (
  slot_key text primary key check (slot_key ~ '^(artwork|legacy):[0-9a-f-]{36}$'),
  item_key text not null check (item_key ~ '^(artwork|legacy):[0-9a-f-]{36}$'),
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.preselection_marks enable row level security;
alter table public.preselection_choices enable row level security;

create policy "preselection_marks: admin read" on public.preselection_marks for select using (public.is_admin());
create policy "preselection_choices: admin read" on public.preselection_choices for select using (public.is_admin());

revoke all on public.preselection_marks, public.preselection_choices from anon;
grant select on public.preselection_marks, public.preselection_choices to authenticated;
grant select, insert, update, delete on public.preselection_marks, public.preselection_choices to service_role;

-- «Enviar al jurado»: the final obras become the jury's pool and nothing
-- else stays marked, in one transaction (the pool is read from two tables).
-- Only the service role calls it, after checking for an admin.
create or replace function public.preselection_send(artwork_ids uuid[], legacy_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  sent integer;
begin
  update public.artworks set review_status = 'unreviewed'
    where review_status <> 'unreviewed' and not (id = any(artwork_ids));
  update public.legacy_submissions set review_status = 'unreviewed'
    where review_status <> 'unreviewed' and not (id = any(legacy_ids));
  update public.artworks set review_status = 'preselected'
    where id = any(artwork_ids) and review_status <> 'preselected';
  update public.legacy_submissions set review_status = 'preselected'
    where id = any(legacy_ids) and review_status <> 'preselected';
  select (select count(*) from public.artworks where review_status = 'preselected')
       + (select count(*) from public.legacy_submissions where review_status = 'preselected')
    into sent;
  return sent;
end;
$$;

revoke all on function public.preselection_send(uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.preselection_send(uuid[], uuid[]) to service_role;

notify pgrst, 'reload schema';
