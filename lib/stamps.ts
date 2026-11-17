// The album's stamps (achievements). The database awards them and keeps the
// same list in profile_stamps' check constraint
// (supabase/migrations/20261117140000_more_stamps.sql; lib/stamps.test.ts
// compares both): every one but `gallery` and `world` comes from a trigger
// on the table where it is earned, and each one earned writes a
// 'stamp_unlocked' notice.

/** For anyone signed in: walking the site. */
export const VISITOR_STAMPS = ['gallery', 'world', 'like', 'fan', 'collector', 'curator', 'archive', 'regular', 'comment', 'wall'] as const
/** For artists: sending, showing and spreading their obra. */
export const ARTIST_STAMPS = ['first', 'post', 'exhibited', 'ambassador', 'applause'] as const
/** All the others. */
export const LEGEND_STAMP = 'legend'

export const STAMP_KEYS = [...VISITOR_STAMPS, ...ARTIST_STAMPS, LEGEND_STAMP] as const

export type StampKey = (typeof STAMP_KEYS)[number]

/** Where the bell's notices and the toast take someone to see their album (the home page opens it). */
export const ALBUM_HREF = '/#album'

/** The two the browser reports through /api/stamps; the rest only the database writes. */
export const VISIT_STAMPS = ['gallery', 'world'] as const satisfies readonly StampKey[]

export function isStampKey(value: string): value is StampKey {
  return STAMP_KEYS.includes(value as StampKey)
}

/** A stamp earned in a Club gallery: its artist's postal stamp, or having met them live. */
export type ClubStamp = { slug: string; artist: string; countryCode: string | null; kind: 'postal' | 'vernissage'; collectedAt: string }

export const STAMP_UNLOCKED_EVENT = 'mundial:stamp-unlocked'

// `awarded` is true only the moment a stamp is first earned; otherwise the
// event just keeps the album's count in sync with one earned earlier.
export type StampUnlocked = { stamp: StampKey; awarded: boolean }

export function announceStampUnlocked(stamp: StampKey, awarded: boolean) {
  window.dispatchEvent(new CustomEvent<StampUnlocked>(STAMP_UNLOCKED_EVENT, { detail: { stamp, awarded } }))
}

// After something that may have earned a stamp in the database (a like, a
// saved obra, a post…), the toaster (components/stamp-toaster.tsx) looks
// for new 'stamp_unlocked' notices and shows them on screen.
export const STAMP_CHECK_EVENT = 'mundial:stamp-check'

export function requestStampCheck() {
  window.dispatchEvent(new Event(STAMP_CHECK_EVENT))
}

// Opens the share dialog (components/stamp-share-host.tsx) for an earned
// stamp: its image for a story (1080x1920) or the feed (1080x1440).
export const STAMP_SHARE_EVENT = 'mundial:stamp-share'

/** `count`: how many stamps the person has, for «5 de 16». */
export type StampShareRequest = { stamp: StampKey; count: number }

export function openStampShare(request: StampShareRequest) {
  window.dispatchEvent(new CustomEvent<StampShareRequest>(STAMP_SHARE_EVENT, { detail: request }))
}
