-- Club del Mundial: each gallery's kraft board, where visitors paste a photo
-- for its artist. Same pieces, photos and lives as the museum's collective
-- collage (20261002180000_collage_wall.sql), marked with the gallery; the
-- board keeps its pieces instead of starting over each week, and the
-- gallery's own member approves them from their editor, not the admins.

alter table public.wall_pieces
  add column gallery_id uuid references public.club_galleries(id) on delete cascade;

create index wall_pieces_gallery_idx on public.wall_pieces (gallery_id, status, created_at) where gallery_id is not null;

-- The admins' count of photos to moderate is the museum's collage only.
create or replace function public.admin_notice_count(kind text)
returns integer
language sql stable security definer set search_path = '' as $$
  select (case kind
    when 'admin_comments_pending' then (select count(*) from public.artwork_comments where status = 'pending')
    when 'admin_wall_pending' then (select count(*) from public.wall_pieces where status = 'pending' and gallery_id is null)
    -- Same rows /admin/obras lists at the top as "sin imagen".
    when 'admin_images_failed' then (
      select count(*) from public.legacy_submissions
      where archived_at is null and image_fetch_failed_at is not null and image_url is null
    )
  end)::integer
$$;

-- The author hears about the museum's collage from the admins; a gallery's
-- board says which gallery it was.
create or replace function public.on_wall_piece_moderated()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare board_slug text;
declare board_title text;
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    if new.gallery_id is null then
      perform public.notify_user(
        new.user_id,
        case new.status when 'approved' then 'wall_approved' else 'wall_rejected' end,
        jsonb_build_object('pieceId', new.id, 'weekStart', new.week_start),
        'wall:' || new.id
      );
    else
      select g.slug, g.title into board_slug, board_title from public.club_galleries g where g.id = new.gallery_id;
      perform public.notify_user(
        new.user_id,
        case new.status when 'approved' then 'club_board_approved' else 'club_board_rejected' end,
        jsonb_build_object('pieceId', new.id, 'slug', board_slug, 'title', board_title),
        'wall:' || new.id
      );
    end if;
  end if;
  return null;
exception when others then
  -- A notice must never undo what it reports (a payment, a like…).
  raise warning 'notifications: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

-- Pastes a piece on a gallery's board if the visitor has a life left (the
-- same three lives as the museum's collage). The member's own pieces, and
-- the admins', go up approved; everyone else's wait for the member, who
-- gets a note in their bell with how many are waiting.
create function public.place_club_board_piece(
  visitor uuid,
  visitor_name text,
  visitor_email text,
  photo_path text,
  at_x real,
  at_y real,
  unlimited boolean,
  board uuid
)
returns table (status text, piece_id uuid, piece_rotation real, lives integer, next_life_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid;
  board_slug text;
  board_title text;
  approved boolean;
  left_lives integer;
  next_at timestamptz;
  new_id uuid;
  new_rotation real := ((random() - 0.5) * 0.24)::real;
  waiting integer;
begin
  select g.user_id, g.slug, g.title into owner_id, board_slug, board_title
    from public.club_galleries g where g.id = board and g.status = 'active';
  if owner_id is null then
    return query select 'unavailable'::text, null::uuid, null::real, 0, null::timestamptz;
    return;
  end if;
  approved := unlimited or visitor = owner_id;

  perform pg_advisory_xact_lock(hashtextextended('wall:' || visitor::text, 0));
  select l.lives, l.next_life_at into left_lives, next_at from public.wall_lives(visitor) l;
  if left_lives < 1 and not approved then
    return query select 'no_lives'::text, null::uuid, null::real, 0, next_at;
    return;
  end if;

  insert into public.wall_pieces (week_start, user_id, author_name, author_email, image_path, x, y, rotation, status, moderated_at, gallery_id)
    values (
      public.wall_week_start(), visitor, visitor_name, visitor_email, photo_path, at_x, at_y, new_rotation,
      case when approved then 'approved' else 'pending' end,
      case when approved then now() end,
      board
    )
    returning id into new_id;

  if not approved then
    select count(*)::integer into waiting from public.wall_pieces w where w.gallery_id = board and w.status = 'pending';
    perform public.notify_user(owner_id, 'club_board_pending',
      jsonb_build_object('count', waiting, 'slug', board_slug, 'title', board_title),
      'club_board_pending:' || board);
  end if;

  select l.lives, l.next_life_at into left_lives, next_at from public.wall_lives(visitor) l;
  return query select 'placed'::text, new_id, new_rotation, left_lives, next_at;
end;
$$;

revoke all on function public.place_club_board_piece(uuid, text, text, text, real, real, boolean, uuid) from public, anon, authenticated;
grant execute on function public.place_club_board_piece(uuid, text, text, text, real, real, boolean, uuid) to service_role;

notify pgrst, 'reload schema';
