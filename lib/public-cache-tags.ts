import { createHash } from 'node:crypto'

export const publicDataTag = (key: string) => `public-data:${key}`
// Hash user-derived slugs to stay within Next's 256-character tag limit.
export const artworkTag = (slug: string) => `artwork:${createHash('sha256').update(slug).digest('hex')}`
export const clubGalleryTag = (slug: string) => `club-gallery:${createHash('sha256').update(slug).digest('hex')}`
export const artistTag = (profileId: string) => `artist:${profileId.toLowerCase()}`
