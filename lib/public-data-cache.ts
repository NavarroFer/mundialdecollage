import { revalidateTag, unstable_cache } from 'next/cache'
import { isAnonymousRender } from '@/lib/render-mode'

// Public, session-free data (published obras, counts, the call's state, the
// day's exhibition) is read on every visit to the home and the public pages.
// Cached across requests so a traffic spike doesn't become one Supabase query
// per visitor: writes made through the app call refreshPublicData() so they
// show up right away, and the short revalidate covers the rest (cron syncs,
// SQL triggers, edits in the Supabase dashboard).
const PUBLIC_DATA_TAG = 'public-data'
const REVALIDATE_SECONDS = 60

// The anonymous copies of the public pages (lib/static-pages.ts) are built
// ahead and kept by the CDN, and a page is rebuilt as often as the most
// short-lived data it reads: with the 60 seconds above, every obra page would
// be rebuilt almost on every visit. They read their own entry instead, kept
// until the app changes the data (the tag, which also drops the pages built
// from it) or a day goes by; each page sets how often it's rebuilt itself.
const ANONYMOUS_REVALIDATE_SECONDS = 86400

export function cachedPublicData<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  key: string,
): (...args: Args) => Promise<Result> {
  const perVisit = unstable_cache(fn, [key], { tags: [PUBLIC_DATA_TAG], revalidate: REVALIDATE_SECONDS })
  const builtAhead = unstable_cache(fn, [key, 'anonymous'], { tags: [PUBLIC_DATA_TAG], revalidate: ANONYMOUS_REVALIDATE_SECONDS })
  return (...args) => (isAnonymousRender() ? builtAhead(...args) : perVisit(...args))
}

// Server Actions and route handlers only. expire: 0 makes the next read wait
// for fresh data instead of being served the stale copy once more.
export function refreshPublicData() {
  revalidateTag(PUBLIC_DATA_TAG, { expire: 0 })
}
