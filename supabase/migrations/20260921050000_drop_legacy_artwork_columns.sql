-- Phase 2 (contract) of the artworks migration — see
-- 20260921040000_artworks.sql for Phase 1 and its rationale for splitting
-- this into two migrations. Phase 1 has since been confirmed working in
-- production (public pages read correctly from `artworks`, backed by real
-- data for the site's already-registered artists), and a full repo grep
-- turned up no remaining code reading these columns or calling the old RPC
-- overload — safe to drop both now.
drop function if exists public.artwork_slug_taken(text, uuid);

alter table public.profiles
  drop column if exists artwork_title,
  drop column if exists artwork_slug,
  drop column if exists artwork_image_url,
  drop column if exists technique;

notify pgrst, 'reload schema';
