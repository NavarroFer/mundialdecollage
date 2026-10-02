// Shared between the client-side upload (onboarding-form.tsx, which uploads
// straight to Supabase Storage to avoid Vercel's ~4.5MB function body limit)
// and the server action (which re-checks the path it's handed back).
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024

// Longest side a submission photo ever needs to render at (the biggest
// display on the site is the full-width image on /obras/[slug]) — anything
// bigger is wasted bytes in Storage and on every resize. Applied in the
// browser before upload (lib/downscale-image.ts) and to imports
// (lib/legacy-submissions.ts).
export const MAX_IMAGE_DIMENSION = 2000

// Ceiling for the raw download in lib/legacy-submissions.ts, before any
// resizing happens — separate from MAX_IMAGE_BYTES (the stored-file target)
// so a large-but-legitimate scan still gets a chance to be shrunk instead of
// being rejected outright. This only guards against fetching something
// absurd (a stray video link, etc.) in a serverless function.
export const MAX_FETCH_BYTES = 60 * 1024 * 1024

// SVGs can carry <script> and get served back from Storage as-is — everything
// else in this set is a plain raster format with no executable content.
export const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
