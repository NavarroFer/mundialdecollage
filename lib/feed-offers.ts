// Which Club banner a participating artist sees atop their home
// (components/feed-offers.tsx), from their own Club gallery, if any.

/** The viewer's Club gallery: active, there but not showing (draft or paused), or none. */
export type OwnClubGallery = 'active' | 'inactive' | null

export type ClubBanner = { kind: 'member' | 'pitch'; href: string }

/**
 * An active gallery gets a way into it, even while the Club is closed (its
 * owner keeps using it, lib/club-launch.ts). Anyone else gets the Club's
 * pitch, and only while it's open: to /club with no gallery yet, to
 * /mi-galeria with one waiting for its first charge or paused, since that
 * page says which and offers to pay.
 */
export function clubBanner(gallery: OwnClubGallery, clubOpen: boolean): ClubBanner | null {
  if (gallery === 'active') return { kind: 'member', href: '/mi-galeria' }
  if (!clubOpen) return null
  return { kind: 'pitch', href: gallery ? '/mi-galeria' : '/club' }
}
