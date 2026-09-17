-- Turns onboarding into the actual contest submission: country + technique +
-- artwork (title, image, optional instagram/website). Extends `profiles`
-- (per the convention set in 20260916000000_profiles.sql) instead of adding
-- a separate table, since today one Google account = one submission.
alter table public.profiles
  add column if not exists country_code text,
  add column if not exists technique text,
  add column if not exists artwork_title text,
  add column if not exists artwork_slug text unique,
  add column if not exists artwork_image_url text,
  add column if not exists instagram text,
  add column if not exists website text;

-- Public pages (directory, mapa, /obras) read completed submissions without
-- a session — nothing in this table is private once `onboarded_at` is set.
create policy "profiles: public read submitted"
  on public.profiles for select
  using (onboarded_at is not null);

-- Artwork images: public bucket (the images are shown on the site), each
-- user can only write inside their own `${uid}/...` folder.
insert into storage.buckets (id, name, public)
values ('artworks', 'artworks', true)
on conflict (id) do nothing;

create policy "artworks: public read"
  on storage.objects for select
  using (bucket_id = 'artworks');

create policy "artworks: owner upload"
  on storage.objects for insert
  with check (bucket_id = 'artworks' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "artworks: owner update"
  on storage.objects for update
  using (bucket_id = 'artworks' and (storage.foldername(name))[1] = auth.uid()::text);
