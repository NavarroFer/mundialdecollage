import { revalidateTag, unstable_cache } from 'next/cache'
import { publicDataTag, artworkTag, artistTag, clubGalleryTag } from '@/lib/public-cache-tags'
import { isAnonymousRender } from '@/lib/render-mode'

// Public, session-free data (published obras, counts, the call's state, the
// day's exhibition) is read on every visit to the home and the public pages.
// Cached across requests so a traffic spike doesn't become one Supabase query
// per visitor: writes made through the app call refreshPublicData() so they
// show up right away, and the hourly revalidate covers the rest (cron syncs,
// SQL triggers, edits in the Supabase dashboard). Not shorter: every rebuild
// of this data, and of the routes built from it (/api/obras, the sitemap), is
// an ISR write Vercel bills per 8 KB, and the obra listing alone weighs a few
// hundred KB. Rebuilt every minute, it was ~30K ISR writes a day.
const PUBLIC_DATA_TAG = 'public-data'
const REVALIDATE_SECONDS = 3600

// The anonymous copies of the public pages (lib/static-pages.ts) are built
// ahead and kept by the CDN, and a page is rebuilt as often as the most
// short-lived data it reads: with the hour above, each of the hundreds of
// obra pages would still be rebuilt every hour it gets visits. They read
// their own entry instead, kept until the app changes the data (the tag,
// which also drops the pages built from it) or a day goes by; each page sets
// how often it's rebuilt itself.
const ANONYMOUS_REVALIDATE_SECONDS = 86400

export function cachedPublicData<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  key: string,
  tags: (...args: Args) => string[] = () => [],
): (...args: Args) => Promise<Result> {
  return (...args) => {
    const anonymous = isAnonymousRender()
    // Version the keys: pre-existing entries only have the old global tag.
    return unstable_cache(fn, [key, 'scoped-v1', anonymous ? 'anonymous' : 'request'], {
      tags: [PUBLIC_DATA_TAG, publicDataTag(key), ...tags(...args)],
      revalidate: anonymous ? ANONYMOUS_REVALIDATE_SECONDS : REVALIDATE_SECONDS,
    })(...args)
  }
}

// Server Actions and route handlers only. expire: 0 makes the next read wait
// for fresh data instead of being served the stale copy once more.
export function refreshPublicData() {
  revalidateTag(PUBLIC_DATA_TAG, { expire: 0 })
}

// Content edits do not change catalog membership/order. Pages depend on the
// individual obras they draw, not the complete finalists listing. Keep the
// global fallback above for imports, publication/hiding and profile changes,
// which can alter membership or many linked records at once.
export function refreshArtworkData(artworks: { slug: string | null; profile_id: string }[]) {
  if (artworks.length === 0) return
  const tags = new Set([publicDataTag('finalists'), publicDataTag('exhibition')])
  for (const artwork of artworks) {
    if (artwork.slug) tags.add(artworkTag(artwork.slug))
    tags.add(artistTag(artwork.profile_id))
  }
  for (const tag of tags) revalidateTag(tag, { expire: 0 })
}

// The day's lineup changes at 09:00 Argentina with nothing written through
// the app, so no tag drops the pages that show it (the home, the 3D gallery)
// and they'd wait out their revalidate. The exhibition cron calls this once
// it has the new lineup, so those pages can be kept for an hour instead of
// rebuilt every few minutes for the rotation alone.
export function refreshExhibition() {
  revalidateTag(publicDataTag('exhibition'), { expire: 0 })
}

// A Club member saved their gallery: drop only that gallery (and the static
// page built from it), not every public page of the site.
export function refreshClubGallery(slug: string) {
  revalidateTag(clubGalleryTag(slug), { expire: 0 })
}
