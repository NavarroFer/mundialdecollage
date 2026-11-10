-- One obra's photo is not an image: legacy/31ae4699-…-1794241694072.jpg was
-- uploaded from /admin/obras as a Photoshop file (PSD) renamed to .jpg.
-- sharp can't read it and no browser can draw it, so /api/img failed on every
-- visit and the 3D gallery could not build that obra's texture.
--
-- Until its artist sends it again: take the obra off the site (is_selected,
-- the same switch the admin's "Usar esta obra" flips, so the gallery, the map
-- and the profiles all stop listing it) and leave a notice in the artist's
-- bell asking them to upload it again (lib/notifications/registry.ts,
-- `artwork_image_unreadable`). Matches by the file's name, so it does nothing
-- where the row doesn't exist. Safe to run twice: the notice is keyed by the
-- obra, so a rerun refreshes it instead of adding another.
with hidden as (
  update public.artworks
     set is_selected = false
   where image_url like '%/artworks/legacy/31ae4699-93f1-4863-baf3-ff73da2a7ca7-1794241694072.jpg'
  returning id, profile_id, title
)
select public.notify_user(
  profile_id,
  'artwork_image_unreadable',
  jsonb_build_object('title', nullif(title, '')),
  'artwork_image_unreadable:' || id
)
from hidden;
