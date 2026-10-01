-- Gallery/map achievements are for every signed-in visitor, not only for
-- artists who completed onboarding and therefore have a profiles row.
-- Keep profile_id temporarily nullable so a currently deployed older app can
-- still insert during the deploy overlap; new code writes user_id directly.
alter table public.profile_stamps
  add column user_id uuid references auth.users(id) on delete cascade default auth.uid();

update public.profile_stamps set user_id = profile_id where user_id is null;

alter table public.profile_stamps alter column user_id set not null;

-- profile_id can't lose its not null while it's part of the primary key.
alter table public.profile_stamps drop constraint profile_stamps_pkey;
alter table public.profile_stamps alter column profile_id drop not null;
alter table public.profile_stamps add constraint profile_stamps_user_stamp_key unique (user_id, stamp_key);

drop policy "profile_stamps: owner read own" on public.profile_stamps;
drop policy "profile_stamps: owner insert own" on public.profile_stamps;

create policy "profile_stamps: owner read own" on public.profile_stamps
  for select using (user_id = auth.uid());

create policy "profile_stamps: owner insert own" on public.profile_stamps
  for insert with check (user_id = auth.uid());

create or replace function public.award_first_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile_stamps (user_id, stamp_key)
  values (new.profile_id, 'first') on conflict (user_id, stamp_key) do nothing;
  return new;
end;
$$;

notify pgrst, 'reload schema';
