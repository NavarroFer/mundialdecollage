export const GALLERY_VENUES = ['mundial', 'mar'] as const
export type GalleryVenue = (typeof GALLERY_VENUES)[number]

export function isGalleryVenue(value: unknown): value is GalleryVenue {
  return value === 'mundial' || value === 'mar'
}

/** `?museo=mar` opens that walk. Anything else leaves the saved choice alone. */
export function venueFromSearch(search: string): GalleryVenue | null {
  const value = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('museo')
  return isGalleryVenue(value) ? value : null
}

/** `/museomar` is the public door to MAR. The query still wins when both are present. */
export function venueFromPath(pathname: string): GalleryVenue | null {
  return /(?:^|\/)museomar\/?$/.test(pathname) ? 'mar' : null
}

/** Separate from the Collage World Cup channel so the two buildings don't share avatars. */
export const MAR_PRESENCE_TOPIC = process.env.NODE_ENV === 'production' ? 'galeria-3d-mar' : 'galeria-3d-mar-dev'
