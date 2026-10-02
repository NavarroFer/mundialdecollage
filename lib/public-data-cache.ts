import { revalidateTag, unstable_cache } from 'next/cache'

// Public, session-free data (published obras, counts, the call's state, the
// day's exhibition) is read on every visit to the home and the public pages.
// Cached across requests so a traffic spike doesn't become one Supabase query
// per visitor: writes made through the app call refreshPublicData() so they
// show up right away, and the short revalidate covers the rest (cron syncs,
// SQL triggers, edits in the Supabase dashboard).
const PUBLIC_DATA_TAG = 'public-data'
const REVALIDATE_SECONDS = 60

export function cachedPublicData<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  key: string,
): (...args: Args) => Promise<Result> {
  return unstable_cache(fn, [key], { tags: [PUBLIC_DATA_TAG], revalidate: REVALIDATE_SECONDS })
}

// Server Actions and route handlers only. expire: 0 makes the next read wait
// for fresh data instead of being served the stale copy once more.
export function refreshPublicData() {
  revalidateTag(PUBLIC_DATA_TAG, { expire: 0 })
}
