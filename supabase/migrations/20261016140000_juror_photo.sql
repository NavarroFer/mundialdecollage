-- The juror's photo (lib/juror-profile.ts), uploaded from their profile form
-- on /jurado or by an admin from /admin/jurado. The path is
-- `${juror id}/${upload time in ms}.${ext}`, one file per upload, so a new
-- photo is a new URL and /api/img can cache each one for good.
alter table public.jurors
  add column if not exists photo_path text check (photo_path ~ '^[0-9a-f-]{36}/[0-9]{13}\.(jpg|png|webp)$');

-- Public, to show the jury wherever it's presented; nothing lists it. No
-- upload policy: the server hands out a signed upload URL for that one path
-- (prepareJurorPhotoUpload in lib/jury.ts) after checking who's asking, and
-- deletes the replaced photo with the service role. The browser shrinks the
-- photo first (lib/downscale-image.ts); the limit is JUROR_PHOTO_MAX_BYTES.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jurors', 'jurors', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

notify pgrst, 'reload schema';
