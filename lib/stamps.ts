export const STAMP_KEYS = ['first', 'gallery', 'world'] as const

export type StampKey = (typeof STAMP_KEYS)[number]

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
