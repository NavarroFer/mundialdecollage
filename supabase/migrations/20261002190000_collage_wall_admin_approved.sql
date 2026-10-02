-- An admin's own pieces on the collective collage go up already approved:
-- there's nobody else to review them. Everyone else's still wait in
-- /admin/muro. Same function as 20261002180000_collage_wall.sql otherwise.
create or replace function public.place_wall_piece(
  visitor uuid,
  visitor_name text,
  visitor_email text,
  photo_path text,
  at_x real,
  at_y real,
  unlimited boolean
)
returns table (status text, piece_id uuid, piece_rotation real, lives integer, next_life_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  left_lives integer;
  next_at timestamptz;
  new_id uuid;
  new_rotation real := ((random() - 0.5) * 0.24)::real;
begin
  perform pg_advisory_xact_lock(hashtextextended('wall:' || visitor::text, 0));

  select l.lives, l.next_life_at into left_lives, next_at from public.wall_lives(visitor) l;
  if left_lives < 1 and not unlimited then
    return query select 'no_lives'::text, null::uuid, null::real, 0, next_at;
    return;
  end if;

  insert into public.wall_pieces (week_start, user_id, author_name, author_email, image_path, x, y, rotation, status, moderated_at)
    values (
      public.wall_week_start(), visitor, visitor_name, visitor_email, photo_path, at_x, at_y, new_rotation,
      case when unlimited then 'approved' else 'pending' end,
      case when unlimited then now() end
    )
    returning id into new_id;

  select l.lives, l.next_life_at into left_lives, next_at from public.wall_lives(visitor) l;
  return query select 'placed'::text, new_id, new_rotation, left_lives, next_at;
end;
$$;

revoke all on function public.place_wall_piece(uuid, text, text, text, real, real, boolean) from public, anon, authenticated;
grant execute on function public.place_wall_piece(uuid, text, text, text, real, real, boolean) to service_role;

notify pgrst, 'reload schema';
