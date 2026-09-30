-- Registro has no Instagram for these artists; an old import had stored the
-- accidental value @gmail.com on their public profiles. Remove that residue
-- and keep future Registro updates authoritative for this known bad value.
update public.profiles p
set instagram = (
  select case when ls.instagram is null then null
              else 'https://instagram.com/' || trim(ls.instagram) end
  from public.legacy_submissions ls
  where ls.claimed_by = p.id and ls.archived_at is null
  order by ls.selected desc, ls.created_at, ls.id
  limit 1
)
where lower(trim(coalesce(p.instagram, ''))) in (
  'https://instagram.com/gmail.com', 'http://instagram.com/gmail.com', '@gmail.com', 'gmail.com'
);

create or replace function public.reconcile_registro_instagram() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Do not overwrite an artist's own handle. This only repairs the known
  -- malformed placeholder when Registro is updated or moved to an account.
  if new.claimed_by is not null
     and lower(trim(coalesce((select instagram from public.profiles where id = new.claimed_by), ''))) in (
       'https://instagram.com/gmail.com', 'http://instagram.com/gmail.com', '@gmail.com', 'gmail.com'
     ) then
    update public.profiles set instagram = case when nullif(trim(new.instagram), '') is null then null
      else 'https://instagram.com/' || trim(new.instagram) end
      where id = new.claimed_by;
  end if;
  return new;
end;
$$;

drop trigger if exists reconcile_registro_instagram on public.legacy_submissions;
create trigger reconcile_registro_instagram
after insert or update of instagram, claimed_by on public.legacy_submissions
for each row execute function public.reconcile_registro_instagram();
