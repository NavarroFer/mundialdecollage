// Shared between the client-side upload (onboarding-form.tsx, which uploads
// straight to Supabase Storage to avoid Vercel's ~4.5MB function body limit)
// and the server action (which re-checks the path it's handed back).
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024

// SVGs can carry <script> and get served back from Storage as-is — everything
// else in this set is a plain raster format with no executable content.
export const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
