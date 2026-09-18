-- Onboarding now uploads straight from the browser to Storage (bypassing
-- Vercel's Server Action body limit), so the size/type checks that used to
-- live only in app/onboarding/actions.ts no longer sit in front of every
-- write. Enforce them at the bucket level instead — keep in sync with
-- MAX_IMAGE_BYTES / ALLOWED_IMAGE_TYPES in lib/onboarding-image.ts.
update storage.buckets
set file_size_limit = 15728640, -- 15MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'artworks';
