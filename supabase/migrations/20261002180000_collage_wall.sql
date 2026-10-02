-- The collective collage: a big frame on Room 1's end wall in the 3D gallery
-- where signed-in visitors paste photos wherever they choose. Each Monday
-- (Argentina) a new one starts; older weeks stay on record. A piece stays
-- 'pending' (visible only to whoever pasted it) until an admin approves it
-- from /admin/muro, same as the comments. Every read and write for
-- visitors goes through server actions with the service role
-- (app/galeria-3d/wall-actions.ts), so emails and user ids never reach the
-- browser.
create table if not exists public.wall_pieces (
  id uuid primary key default gen_random_uuid(),
  -- The Monday of the collage it belongs to (wall_week_start()).
  week_start date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  -- Only for moderation context (/admin/muro); never shown publicly.
  author_email text,
  -- Inside the 'wall' bucket: `${user_id}/${uuid}.jpg`.
  image_path text not null unique,
  -- Where it was pasted, across (x, left to right) and up (y, bottom to top) the frame.
  x real not null check (x between 0 and 1),
  y real not null check (y between 0 and 1),
  -- A little crooked, like anything pasted by hand (radians).
  rotation real not null check (rotation between -0.2 and 0.2),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz
);

create index if not exists wall_pieces_week_idx on public.wall_pieces (week_start, status, created_at);
create index if not exists wall_pieces_user_idx on public.wall_pieces (user_id, created_at);
create index if not exists wall_pieces_pending_idx on public.wall_pieces (created_at) where status = 'pending';

alter table public.wall_pieces enable row level security;

create policy "wall_pieces: admin all" on public.wall_pieces
  for all using (public.is_admin()) with check (public.is_admin());

revoke all on public.wall_pieces from anon;
grant select, update, delete on public.wall_pieces to authenticated;
grant select, insert, update, delete on public.wall_pieces to service_role;

-- The photos: a public bucket so the gallery can show approved ones (and
-- resize them through /api/img), with random file names. Nothing lists the
-- bucket for visitors, and a pending photo's path only ever reaches the
-- person who pasted it. Each visitor uploads only into their own folder;
-- the gallery shrinks the photo first (lib/downscale-image.ts).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wall', 'wall', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "wall: owner upload"
  on storage.objects for insert
  with check (bucket_id = 'wall' and (storage.foldername(name))[1] = auth.uid()::text);

-- Rejecting a piece from /admin/muro deletes its photo.
create policy "wall: admin read"
  on storage.objects for select
  using (bucket_id = 'wall' and public.is_admin());

create policy "wall: admin delete"
  on storage.objects for delete
  using (bucket_id = 'wall' and public.is_admin());

create or replace function public.wall_week_start()
returns date
language sql stable as $$
  select date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')::date
$$;

-- Lives, like Candy Crush: three, and each one comes back eight hours after
-- it was used. A rejected piece gives its life back.
create or replace function public.wall_lives(visitor uuid)
returns table (lives integer, next_life_at timestamptz)
language sql stable security definer set search_path = public as $$
  select greatest(0, 3 - count(*))::integer,
         min(created_at) + interval '8 hours'
    from public.wall_pieces
    where user_id = visitor and status <> 'rejected' and created_at > now() - interval '8 hours'
$$;

-- Pastes one piece if the visitor has a life left (admins never run out).
-- The advisory lock means two tabs can't spend the same life.
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

  insert into public.wall_pieces (week_start, user_id, author_name, author_email, image_path, x, y, rotation)
    values (public.wall_week_start(), visitor, visitor_name, visitor_email, photo_path, at_x, at_y, new_rotation)
    returning id into new_id;

  select l.lives, l.next_life_at into left_lives, next_at from public.wall_lives(visitor) l;
  return query select 'placed'::text, new_id, new_rotation, left_lives, next_at;
end;
$$;

revoke all on function public.wall_lives(uuid) from public, anon, authenticated;
revoke all on function public.place_wall_piece(uuid, text, text, text, real, real, boolean) from public, anon, authenticated;
grant execute on function public.wall_lives(uuid) to service_role;
grant execute on function public.place_wall_piece(uuid, text, text, text, real, real, boolean) to service_role;

notify pgrst, 'reload schema';
