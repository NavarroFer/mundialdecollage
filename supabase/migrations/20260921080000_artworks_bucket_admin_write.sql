-- The existing "artworks: owner upload/update" policies (20260918000000_
-- profile_visibility.sql) only let a session write inside its own
-- `${uid}/...` folder — correct for artist self-uploads, but it means an
-- admin's own session can't write into the `legacy/` prefix
-- storeLegacyArtworkGlobally uses (that path only ever gets written via the
-- service-role client today). An admin manually uploading a photo for a
-- legacy_submissions row whose Drive fetch keeps failing (see
-- components/admin/legacy-image-upload.tsx) needs to write there directly
-- from their own browser session, so this adds admin-wide write access to
-- the bucket alongside the existing owner-scoped policies rather than
-- replacing them.
create policy "artworks: admin upload"
  on storage.objects for insert
  with check (bucket_id = 'artworks' and public.is_admin());

create policy "artworks: admin update"
  on storage.objects for update
  using (bucket_id = 'artworks' and public.is_admin());
