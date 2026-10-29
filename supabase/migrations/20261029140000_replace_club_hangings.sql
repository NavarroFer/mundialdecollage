-- The editor saves all of a gallery's hangings at once. One function keeps it
-- atomic: a failure (a locked frame, a slot outside the room, an obra that is
-- not the artist's) rolls everything back instead of leaving the public
-- gallery half-hung. It runs as the caller, so the owner's RLS policies and
-- the hanging validation trigger still decide what is allowed.
create function public.replace_club_gallery_hangings(p_rows jsonb)
returns void
language plpgsql security invoker set search_path = public
as $$
declare target_gallery uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'p_rows must be an array'; end if;
  select id into target_gallery from public.club_galleries where user_id = auth.uid();
  if target_gallery is null then raise exception 'No Club gallery'; end if;

  delete from public.club_gallery_hangings where gallery_id = target_gallery;
  insert into public.club_gallery_hangings(gallery_id, slot, artwork_id, frame_style)
  select target_gallery, (row->>'slot')::integer, (row->>'artwork_id')::uuid, nullif(row->>'frame_style', '')
  from jsonb_array_elements(p_rows) as row;
end;
$$;

revoke all on function public.replace_club_gallery_hangings(jsonb) from public, anon;
grant execute on function public.replace_club_gallery_hangings(jsonb) to authenticated;

notify pgrst, 'reload schema';
