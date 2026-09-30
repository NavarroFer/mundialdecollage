create table public.profile_stamps (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  stamp_key text not null check (stamp_key in ('first', 'gallery', 'world')),
  unlocked_at timestamptz not null default now(),
  primary key (profile_id, stamp_key)
);

alter table public.profile_stamps enable row level security;

create policy "profile_stamps: owner read own" on public.profile_stamps
  for select using (profile_id = auth.uid());

create policy "profile_stamps: owner insert own" on public.profile_stamps
  for insert with check (profile_id = auth.uid());

grant select, insert on public.profile_stamps to authenticated;
grant select, insert, update, delete on public.profile_stamps to service_role;

create or replace function public.award_first_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile_stamps (profile_id, stamp_key)
  values (new.profile_id, 'first') on conflict do nothing;
  return new;
end;
$$;

create trigger artworks_award_first_stamp
  after insert on public.artworks
  for each row execute function public.award_first_stamp();

insert into public.profile_stamps (profile_id, stamp_key)
select distinct profile_id, 'first' from public.artworks
on conflict do nothing;

notify pgrst, 'reload schema';
